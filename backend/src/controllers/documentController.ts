import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import prisma from '../prisma/client';
import { computeSha256 } from '../utils/demoStore';
import { validatePdfFile } from '../utils/fileValidation';
import { getPublicBaseUrl } from '../utils/network';

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
    const publicBaseUrl = getPublicBaseUrl();
    const mappedQrCodes = doc.qrcodes.map((qr) => ({
      ...qr,
      verification_url: `${publicBaseUrl}/verify?token=${encodeURIComponent(qr.token || '')}`
    }));
    return res.json({
      document: {
        ...doc,
        qrcodes: mappedQrCodes,
        signedDocument: doc.signed || null
      }
    });
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
    const publicBaseUrl = getPublicBaseUrl();
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
  const publicBaseUrl = getPublicBaseUrl();
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
    const publicBaseUrl = getPublicBaseUrl();
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

export async function publicSecurePdf(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const token = req.query.token as string;

    if (!token) {
      return res.status(400).json({ error: 'Token de vérification requis' });
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ error: 'Format d’identifiant de document invalide' });
    }

    // Vérifier la validité du token JWT
    const secret = process.env.JWT_SECRET || 'devsecret';
    let payload: any;
    try {
      payload = jwt.verify(token, secret);
    } catch (tokenErr: any) {
      return res.status(401).json({ error: 'Token de vérification invalide ou expiré' });
    }

    // Vérifier que le token correspond bien au document demandé
    const qr = await prisma.qrCode.findFirst({
      where: {
        documentId: id,
        OR: [
          { token },
          { qrUuid: payload.qr_uuid }
        ]
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!qr) {
      return res.status(403).json({ error: 'Le token ne correspond pas à ce document' });
    }

    if (qr.revoked) {
      return res.status(403).json({ error: 'Le QR code de ce document a été révoqué' });
    }

    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) return res.status(404).json({ error: 'Document non trouvé' });
    if (!fs.existsSync(doc.filePath)) {
      return res.status(404).json({ error: 'Fichier introuvable sur le serveur' });
    }

    // Génération du PDF sécurisé avec le QR code
    const QRCode = require('qrcode');
    const publicBaseUrl = getPublicBaseUrl();
    const verificationUrl = `${publicBaseUrl}/verify?token=${encodeURIComponent(qr.token || token)}`;
    const qrDataUrl = await QRCode.toDataURL(verificationUrl);

    const { PDFDocument } = require('pdf-lib');
    const origBytes = fs.readFileSync(doc.filePath);
    const pdfDoc = await PDFDocument.load(origBytes);
    const pages = pdfDoc.getPages();
    if (!pages || pages.length === 0) {
      return res.status(400).json({ error: 'Le PDF ne contient aucune page' });
    }

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

    const modifiedPdfBytes = await pdfDoc.save();
    const cleanFileName = (doc.fileName || 'document').replace(/\.pdf$/i, '');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${cleanFileName.replace(/\s+/g, '_')}-securise.pdf"`
    );
    res.setHeader('Cache-Control', 'no-store');
    return res.send(Buffer.from(modifiedPdfBytes));
  } catch (error: any) {
    console.error('Erreur publicSecurePdf:', error);
    return res.status(500).json({
      error: 'Échec de génération du PDF sécurisé public',
      details: error.message
    });
  }
}

/**
 * Analyse intelligente de PDF pour extraire automatiquement les métadonnées administratives
 * Utilise l'IA Google Gemini (gemini-3.6-flash) avec extraction de texte pdf-parse
 * Possède un repli automatique par analyse heuristique / regex en cas d'indisponibilité réseau
 */
export async function analyzePdf(req: Request, res: Response) {
  if (!req.file) {
    return res.status(400).json({ error: 'Fichier PDF requis pour l\'analyse' });
  }

  const filePath = req.file.path;
  const originalName = req.file.originalname || '';

  try {
    const fileBytes = fs.readFileSync(filePath);
    let extractedText = '';

    try {
      const pdfModule = require('pdf-parse');
      if (pdfModule.PDFParse) {
        const parser = new pdfModule.PDFParse(new Uint8Array(fileBytes));
        const res = await parser.getText();
        extractedText = res.text || '';
      } else if (typeof pdfModule === 'function') {
        const parsed = await pdfModule(fileBytes);
        extractedText = parsed.text || '';
      }
    } catch (parseErr: any) {
      console.warn('pdf-parse n\'a pas pu extraire tout le texte, utilisation du fallback binaire:', parseErr.message);
      extractedText = fileBytes.toString('latin1');
    }

    const apiKey = process.env.GEMINI_API_KEY;
    let aiExtracted = false;
    let metadata = {
      reference: '',
      subject: '',
      recipient: '',
      service: '',
      year: new Date().getFullYear().toString(),
      engine: 'heuristics'
    };

    if (apiKey && extractedText.trim().length > 20) {
      try {
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });

        const prompt = `Tu es un expert en gestion documentaire et archivage administratif au Fonds Routier du Cameroun.
Analyse le texte suivant extrait d'un document administratif officiel (PDF intitulé "${originalName}") et extrait précisément les métadonnées clés.

Texte du document:
"""
${extractedText.slice(0, 6000)}
"""

Réponds STRICTEMENT sous la forme d'un objet JSON valide sans balises markdown, avec exactement ces champs:
{
  "reference": "la référence ou le numéro du document (ex: N° 124/FDR/DG/2026 ou DOC-2026-...). Si absent, invente une référence administrative officielle cohérente",
  "subject": "l'objet précis de la lettre, décision ou correspondance administrative (ex: Mandatement des décomptes de travaux d'entretien routier)",
  "recipient": "le destinataire ou la personne/service visé (ex: Monsieur le Directeur des Affaires Financières, ou Société BTP Cameroun)",
  "service": "le service ou direction émettrice au Fonds Routier (ex: Direction Générale, Direction Technique et Contrôle, Direction des Affaires Financières, Cellule Informatique)",
  "year": "l'année civile concernée au format à 4 chiffres (ex: 2026)"
}`;

        const aiResult = await model.generateContent(prompt);
        let rawResponse = aiResult.response.text().trim();
        // Nettoyer les backticks markdown éventuels
        if (rawResponse.startsWith('```json')) {
          rawResponse = rawResponse.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
        } else if (rawResponse.startsWith('```')) {
          rawResponse = rawResponse.replace(/^```\s*/, '').replace(/```\s*$/, '').trim();
        }

        const parsedJson = JSON.parse(rawResponse);
        if (parsedJson && (parsedJson.subject || parsedJson.reference)) {
          metadata = {
            reference: parsedJson.reference || '',
            subject: parsedJson.subject || '',
            recipient: parsedJson.recipient || '',
            service: parsedJson.service || '',
            year: parsedJson.year ? String(parsedJson.year) : new Date().getFullYear().toString(),
            engine: 'gemini-ai'
          };
          aiExtracted = true;
        }
      } catch (aiErr: any) {
        console.warn('L\'extraction IA Gemini a échoué, repli sur l\'extraction heuristique locale:', aiErr.message);
      }
    }

    // Repli heuristique si Gemini n'a pas pu traiter
    if (!aiExtracted) {
      const { PDFDocument } = require('pdf-lib');
      let creationDate: Date | undefined;
      try {
        const pdfDoc = await PDFDocument.load(fileBytes);
        creationDate = pdfDoc.getCreationDate();
      } catch (_) {}

      let detectedYear = creationDate ? creationDate.getFullYear().toString() : new Date().getFullYear().toString();
      const yearMatch = extractedText.match(/\b(202[0-9])\b/) || originalName.match(/\b(202[0-9])\b/);
      if (yearMatch) detectedYear = yearMatch[1];

      const refMatch = extractedText.match(/N[°oº]?\s*([0-9A-Z\/\-_]+(?:\/FDR|\/MINTP|\/SG)?)/i) ||
                       originalName.match(/(?:DOC|REF|FDR)[-_]([0-9A-Z-_]+)/i);
      const detectedRef = refMatch ? `REF-${refMatch[1].trim()}` : `DOC-${detectedYear}-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      let detectedSubject = '';
      const objMatch = extractedText.match(/Objet\s*:\s*([^\r\n\.\;]{6,100})/i);
      if (objMatch) {
        detectedSubject = objMatch[1].trim();
      } else {
        detectedSubject = originalName.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ');
      }

      let detectedRecipient = '';
      const recMatch = extractedText.match(/[AÀ]\s+(?:Monsieur|Madame|l'attention\s+de)\s+([^\r\n\.\;]{4,60})/i) ||
                       extractedText.match(/Destinataire\s*:\s*([^\r\n\.\;]{4,60})/i);
      if (recMatch) {
        detectedRecipient = recMatch[1].trim();
      } else {
        detectedRecipient = 'Service des Opérations Financières';
      }

      let detectedService = 'Direction Générale';
      if (/finances?|compta/i.test(extractedText) || /finances?/i.test(originalName)) {
        detectedService = 'Direction des Affaires Financières';
      } else if (/technique|travaux|route/i.test(extractedText) || /technique/i.test(originalName)) {
        detectedService = 'Direction Technique et Contrôle';
      } else if (/audit|contrôle/i.test(extractedText)) {
        detectedService = 'Cellule d\'Audit Interne';
      }

      metadata = {
        reference: detectedRef,
        subject: detectedSubject,
        recipient: detectedRecipient,
        service: detectedService,
        year: detectedYear,
        engine: 'heuristics-fallback'
      };
    }

    // Nettoyage du fichier temporaire d'analyse
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    return res.json({
      success: true,
      engine: metadata.engine,
      metadata: {
        reference: metadata.reference,
        subject: metadata.subject,
        recipient: metadata.recipient,
        service: metadata.service,
        year: metadata.year,
      }
    });
  } catch (error: any) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    console.error('Erreur globale analyse PDF:', error);
    return res.status(500).json({ error: 'Échec de l\'analyse du document', details: error.message });
  }
}
