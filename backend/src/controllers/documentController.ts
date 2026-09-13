import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import prisma from '../prisma/client';
import { computeSha256 } from '../utils/demoStore';
import { validatePdfFile } from '../utils/fileValidation';

export async function createDocument(req: Request, res: Response) {
  let tempFilePath: string | null = null;

  try {
    if (!req.file) return res.status(400).json({ error: 'File required' });
    
    const uploadsDir = process.env.UPLOADS_DIR || 'uploads';
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    tempFilePath = req.file.path;

    const validation = validatePdfFile(tempFilePath, req.file.originalname);
    if (!validation.valid) {
      if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
      return res.status(400).json({ error: validation.error || 'Invalid PDF file' });
    }

    const fileBuffer = fs.readFileSync(tempFilePath);
    const sha256 = computeSha256(fileBuffer);
    const finalPath = path.join(uploadsDir, req.file.filename);
    fs.renameSync(tempFilePath, finalPath);
    tempFilePath = null;

    const metadata = req.body || {};
    
    const reference = metadata.reference || null;
    if (reference) {
      const existingDoc = await prisma.document.findUnique({ where: { reference } });
      if (existingDoc) {
        if (fs.existsSync(finalPath)) fs.unlinkSync(finalPath);
        return res.status(409).json({ error: `Document with reference ${reference} already exists` });
      }
    }

    const doc = await prisma.document.create({
      data: {
        reference,
        subject: metadata.subject || null,
        recipient: metadata.recipient || null,
        service: metadata.service || null,
        year: metadata.year ? parseInt(metadata.year, 10) : null,
        filePath: finalPath,
        fileName: req.file.originalname,
        sha256,
        createdBy: (req as any).user ? (req as any).user.sub : null,
      },
    });

    return res.status(201).json({ document: { ...doc, signed: null, qrcodes: [] } });
  } catch (error: any) {
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (e) {
        console.error('Failed to clean up temp file:', e);
      }
    }
    console.error('Error creating document:', error);
    return res.status(500).json({ error: 'Failed to create document', details: error.message });
  }
}

export async function listDocuments(req: Request, res: Response) {
  try {
    const documents = await prisma.document.findMany({
      orderBy: { createdAt: 'desc' },
      include: { signed: true, qrcodes: true }
    });

    return res.json({
      data: documents.map((document) => ({
        ...document,
        signedDocument: document.signed || null
      })),
      meta: { total: documents.length, page: 1, limit: 50 }
    });
  } catch (error: any) {
    console.error('Error listing documents:', error);
    return res.status(500).json({ error: 'Failed to list documents', details: error.message });
  }
}

export async function getDocument(req: Request, res: Response) {
  try {
    const { id } = req.params;
    
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ error: 'Invalid document ID format' });
    }

    const doc = await prisma.document.findUnique({
      where: { id },
      include: { signed: true, qrcodes: true }
    });

    if (!doc) return res.status(404).json({ error: 'Document not found' });
    return res.json({ document: { ...doc, signedDocument: doc.signed || null } });
  } catch (error: any) {
    console.error('Error getting document:', error);
    return res.status(500).json({ error: 'Failed to get document', details: error.message });
  }
}

export async function getDocumentFile(req: Request, res: Response) {
  const doc = await prisma.document.findUnique({ where: { id: req.params.id } });
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  if (!fs.existsSync(doc.filePath)) return res.status(404).json({ error: 'File not found' });

  res.setHeader('Content-Type', 'application/pdf');
  return fs.createReadStream(doc.filePath).pipe(res);
}

function isValidUuid(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

export async function generateQrForDocument(req: Request, res: Response) {
  const documentId = req.params.id;
  
  if (!isValidUuid(documentId)) {
    return res.status(400).json({ error: 'Invalid document ID format' });
  }
  
  const doc = await prisma.document.findUnique({
    where: { id: documentId }
  });

  if (!doc) return res.status(404).json({ error: 'Document not found' });

  const existingQr = await prisma.qrCode.findFirst({
    where: { documentId: doc.id, revoked: false },
    orderBy: { createdAt: 'desc' }
  });

  if (existingQr && existingQr.token) {
    const QRCode = require('qrcode');
    const publicBaseUrl = (process.env.PUBLIC_APP_URL || 'http://172.23.27.88:5173').replace(/\/$/, '');
    const verificationUrl = `${publicBaseUrl}/verify?token=${encodeURIComponent(existingQr.token)}`;
    return res.status(200).json({
      qr: {
        id: existingQr.id,
        qr_uuid: existingQr.qrUuid,
        token: existingQr.token,
        verification_url: verificationUrl,
        qr_image_data_url: await QRCode.toDataURL(verificationUrl)
      }
    });
  }

  const secret = process.env.JWT_SECRET || 'devsecret';
  const payload = {
    qr_uuid: crypto.randomUUID(),
    document_id: doc.id,
    reference: doc.reference,
    subject: doc.subject,
    recipient: doc.recipient,
    service: doc.service,
    year: doc.year,
    file_name: doc.fileName,
    sha256: doc.sha256,
    issued_at: new Date().toISOString()
  };
  const token = jwt.sign(payload, secret as jwt.Secret, { expiresIn: '10y' });

  const qr = await prisma.qrCode.create({
    data: {
      qrUuid: payload.qr_uuid,
      documentId: doc.id,
      payload: payload as any,
      signature: crypto.createHmac('sha256', secret).update(token).digest('hex'),
      token,
      revoked: false,
    }
  });

  await prisma.auditLog.create({
    data: {
      userId: (req as any).user?.sub || null,
      action: 'QR_GENERATED',
      metadata: {
        qr_uuid: qr.qrUuid,
        document_id: doc.id,
        reference: doc.reference
      } as any
    }
  });

  const QRCode = require('qrcode');
  const publicBaseUrl = (process.env.PUBLIC_APP_URL || 'http://172.23.27.88:5173').replace(/\/$/, '');
  const verificationUrl = `${publicBaseUrl}/verify?token=${encodeURIComponent(token)}`;
  const qrImageDataUrl = await QRCode.toDataURL(verificationUrl);

  return res.status(201).json({
    qr: {
      id: qr.id,
      qr_uuid: qr.qrUuid,
      token,
      verification_url: verificationUrl,
      qr_image_data_url: qrImageDataUrl
    }
  });
}

export async function exportSecurePdf(req: Request, res: Response) {
  try {
    const { id } = req.params;
    
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ error: 'Invalid document ID format' });
    }

    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    // Check file exists
    if (!fs.existsSync(doc.filePath)) {
      return res.status(404).json({ error: 'Document file not found on disk' });
    }

    // Get QR code (latest generated for this document)
    const qr = await prisma.qrCode.findFirst({
      where: { documentId: id },
      orderBy: { createdAt: 'desc' }
    });
    if (!qr) return res.status(404).json({ error: 'QR not found for this document' });

    // Generate QR image with verification URL
    const QRCode = require('qrcode');
    const publicBaseUrl = (process.env.PUBLIC_APP_URL || 'http://172.23.27.88:5173').replace(/\/$/, '');
    const verificationUrl = `${publicBaseUrl}/verify?token=${encodeURIComponent(qr.token || '')}`;
    const qrDataUrl = await QRCode.toDataURL(verificationUrl);

    // Load and modify PDF
    const { PDFDocument } = require('pdf-lib');
    const origBytes = fs.readFileSync(doc.filePath);
    
    let pdfDoc;
    let pages;
    try {
      pdfDoc = await PDFDocument.load(origBytes);
      pages = pdfDoc.getPages();
      if (!pages || pages.length === 0) {
        return res.status(400).json({ error: 'PDF has no pages' });
      }
    } catch (pdfError: any) {
      console.error('Failed to load PDF:', pdfError.message);
      return res.status(400).json({ error: 'PDF file is corrupted or invalid' });
    }

    // Embed QR image
    try {
      const pngImageBytes = Buffer.from(qrDataUrl.split(',')[1], 'base64');
      const pngImage = await pdfDoc.embedPng(pngImageBytes);

      const page = pages[pages.length - 1];
      const { width } = page.getSize();
      const qrSize = Math.min(58, Math.max(40, width * 0.12));
      const x = (width - qrSize) / 2;
      const y = 25;

      page.drawImage(pngImage, {
        x,
        y,
        width: qrSize,
        height: qrSize
      });
    } catch (drawError: any) {
      console.error('Failed to embed QR code in PDF:', drawError.message);
      return res.status(500).json({ error: 'Failed to embed QR code in PDF' });
    }

    // Save modified PDF
    let modifiedPdfBytes;
    try {
      modifiedPdfBytes = await pdfDoc.save();
    } catch (saveError: any) {
      console.error('Failed to save modified PDF:', saveError.message);
      return res.status(500).json({ error: 'Failed to save modified PDF' });
    }

    // Send PDF
    const cleanFileName = (doc.fileName || 'document').replace(/\.pdf$/i, '');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${cleanFileName.replace(/\s+/g, '_')}-secure.pdf"`
    );
    res.setHeader('Cache-Control', 'no-store');
    return res.send(Buffer.from(modifiedPdfBytes));
  } catch (error: any) {
    console.error('Error exporting secure PDF:', error);
    return res.status(500).json({
      error: 'Failed to export secure PDF',
      details: error.message
    });
  }
}

export async function uploadSignedDocument(req: Request, res: Response) {
  let tempFilePath: string | null = null;

  try {
    // Validate file exists
    if (!req.file) return res.status(400).json({ error: 'File required' });
    tempFilePath = req.file.path;

    // Validate UUID format
    const { id } = req.params;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
      return res.status(400).json({ error: 'Invalid document ID format' });
    }

    // Validate PDF before moving
    const validation = validatePdfFile(tempFilePath, req.file.originalname);
    if (!validation.valid) {
      if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
      return res.status(400).json({ error: validation.error || 'Invalid PDF file' });
    }

    // Check document exists
    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) {
      if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
      return res.status(404).json({ error: 'Document not found' });
    }

    // Move file to uploads directory
    const uploadsDir = process.env.UPLOADS_DIR || 'uploads';
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    const finalPath = path.join(uploadsDir, req.file.filename);
    fs.renameSync(tempFilePath, finalPath);
    tempFilePath = null;

    // Create/update signed document record
    const userId = (req as any).user ? (req as any).user.sub : null;
    const signed = await prisma.signedDocument.upsert({
      where: { documentId: doc.id },
      update: {
        filePath: finalPath,
        fileName: req.file.originalname,
        uploadedBy: userId,
      },
      create: {
        id: crypto.randomUUID(),
        documentId: doc.id,
        filePath: finalPath,
        fileName: req.file.originalname,
        uploadedBy: userId,
      }
    });

    // Create audit log
    if (userId) {
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'SIGNED_DOCUMENT_UPLOAD',
          metadata: {
            documentId: doc.id,
            fileName: req.file.originalname,
            fileSize: req.file.size,
          },
        },
      });
    }

    return res.status(201).json({ signed_document: signed });
  } catch (error: any) {
    // Cleanup temp file if something goes wrong
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (e) {
        console.error('Failed to clean up temp file:', e);
      }
    }
    console.error('Error uploading signed document:', error);
    return res.status(500).json({ error: 'Failed to upload signed document', details: error.message });
  }
}

export async function getDashboardStats(req: Request, res: Response) {
  const [totalDocuments, totalQr, verifications] = await Promise.all([
    prisma.document.count(),
    prisma.qrCode.count({ where: { revoked: false } }),
    prisma.verification.findMany({
      where: { result: 'AUTHENTIQUE' },
      select: { createdAt: true }
    })
  ]);

  const monthlyMap = new Map<string, number>();
  for (const item of verifications) {
    const month = new Date(item.createdAt).toISOString().slice(0, 7);
    monthlyMap.set(month, (monthlyMap.get(month) || 0) + 1);
  }

  const monthlyAuthentications = Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({ month, count }));

  return res.json({
    data: {
      totalDocuments,
      totalQr,
      totalAuthentications: verifications.length,
      monthlyAuthentications,
    }
  });
}

/**
 * Analyse intelligente de PDF pour extraire automatiquement les métadonnées administratives
 */
export async function analyzePdf(req: Request, res: Response) {
  if (!req.file) {
    return res.status(400).json({ error: 'Fichier PDF requis pour l\'analyse' });
  }

  const filePath = req.file.path;
  try {
    const fileBytes = fs.readFileSync(filePath);
    const { PDFDocument } = require('pdf-lib');
    const pdfDoc = await PDFDocument.load(fileBytes);
    
    // Tentative d'extraction des métadonnées intégrées (titre, sujet, auteur, date)
    const title = pdfDoc.getTitle() || '';
    const subject = pdfDoc.getSubject() || '';
    const author = pdfDoc.getAuthor() || '';
    const creationDate = pdfDoc.getCreationDate();

    // Recherche de texte brute dans les buffers ou streams
    const textContent = fileBytes.toString('latin1');
    const originalName = req.file.originalname || '';

    // Heuristiques intelligentes adaptées à l'administration du Cameroun / Fonds Routier :
    // 1. Année
    let detectedYear: string = creationDate ? creationDate.getFullYear().toString() : new Date().getFullYear().toString();
    const yearMatch = textContent.match(/\b(202[0-9])\b/) || originalName.match(/\b(202[0-9])\b/);
    if (yearMatch) detectedYear = yearMatch[1];

    // 2. Référence
    const refMatch = textContent.match(/N[°oº]?\s*([0-9A-Z\/\-_]+(?:\/FDR|\/MINTP|\/SG)?)/i) ||
                     originalName.match(/(?:DOC|REF|FDR)[-_]([0-9A-Z-_]+)/i);
    let detectedRef = refMatch ? `REF-${refMatch[1].trim()}` : `DOC-${detectedYear}-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // 3. Objet / Titre
    let detectedSubject = subject || title;
    if (!detectedSubject) {
      const objMatch = textContent.match(/Objet\s*:\s*([^\r\n\.\;]{6,80})/i);
      if (objMatch) {
        detectedSubject = objMatch[1].trim();
      } else {
        detectedSubject = originalName.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ');
      }
    }

    // 4. Destinataire
    let detectedRecipient = author;
    if (!detectedRecipient) {
      const recMatch = textContent.match(/[AÀ]\s+(?:Monsieur|Madame|l'attention\s+de)\s+([^\r\n\.\;]{4,50})/i) ||
                       textContent.match(/Destinataire\s*:\s*([^\r\n\.\;]{4,50})/i);
      if (recMatch) {
        detectedRecipient = recMatch[1].trim();
      } else {
        detectedRecipient = 'Service des Opérations Financières';
      }
    }

    // 5. Service émetteur
    let detectedService = 'Direction Générale';
    if (/finances?|compta/i.test(textContent) || /finances?/i.test(originalName)) {
      detectedService = 'Direction des Affaires Financières';
    } else if (/technique|travaux|route/i.test(textContent) || /technique/i.test(originalName)) {
      detectedService = 'Direction Technique et Contrôle';
    } else if (/audit|contrôle/i.test(textContent)) {
      detectedService = 'Cellule d\'Audit Interne';
    }

    // Nettoyage du fichier temporaire
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    return res.json({
      success: true,
      metadata: {
        reference: detectedRef,
        subject: detectedSubject,
        recipient: detectedRecipient,
        service: detectedService,
        year: detectedYear,
      }
    });
  } catch (error: any) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    console.error('Erreur analyse PDF:', error);
    return res.status(500).json({ error: 'Échec de l\'analyse automatique du PDF', details: error.message });
  }
}
