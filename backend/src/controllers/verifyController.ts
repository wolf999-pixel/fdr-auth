import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import crypto from 'crypto';
import prisma from '../prisma/client';
import { computeSha256 } from '../utils/demoStore';
import { validatePdfFile } from '../utils/fileValidation';

function extractTokenFromInput(rawValue: string | null | undefined): string | null {
  if (!rawValue) return null;

  const trimmed = rawValue.trim();
  if (!trimmed) return null;

  try {
    const parsedUrl = new URL(trimmed);
    const tokenFromUrl = parsedUrl.searchParams.get('token');
    if (tokenFromUrl) return tokenFromUrl;
  } catch (_error) {
    // raw token or malformed url: keep the raw value
  }

  return trimmed;
}

export async function verify(req: Request, res: Response) {
  let uploadedFilePath: string | null = null;

  try {
    const rawToken = req.body.token || (req.query.token as string) || null;
    const token = extractTokenFromInput(rawToken);
    if (!token) return res.status(400).json({ error: 'Token required' });

    try {
      const secret = process.env.JWT_SECRET || 'devsecret';
      const payload: any = jwt.verify(token, secret);

      const qrRow = payload.qr_uuid
        ? await prisma.qrCode.findUnique({
            where: { qrUuid: payload.qr_uuid }
          })
        : null;

      const document = qrRow ? await prisma.document.findUnique({ where: { id: qrRow.documentId } }) : null;

      if (!qrRow || !document) {
        await prisma.verification.create({
          data: {
            result: 'NON_AUTHENTIQUE',
            reason: 'QR inconnu',
            verifierInfo: { ip: req.ip },
            documentId: payload.document_id || null,
            qrCodeId: null,
          }
        });
        return res.json({
          result: 'NON_AUTHENTIQUE',
          message: 'DOCUMENT NON AUTHENTIQUE',
          reason: 'QR inconnu',
          document: document ? {
            reference: document.reference,
            subject: document.subject,
            recipient: document.recipient,
            service: document.service,
            year: document.year,
          } : null,
        });
      }

      if (qrRow.revoked) {
        await prisma.verification.create({
          data: {
            result: 'NON_AUTHENTIQUE',
            reason: 'QR révoqué',
            verifierInfo: { ip: req.ip },
            documentId: qrRow.documentId,
            qrCodeId: qrRow.id,
          }
        });
        return res.json({
          result: 'NON_AUTHENTIQUE',
          message: 'DOCUMENT NON AUTHENTIQUE',
          reason: 'QR révoqué',
          document: {
            reference: document.reference,
            subject: document.subject,
            recipient: document.recipient,
            service: document.service,
            year: document.year,
          },
        });
      }

      let actualSha: string | null = null;
      if ((req as any).file || req.file) {
        uploadedFilePath = (req as any).file ? (req as any).file.path : (req.file as any).path;
        
        // Validate PDF before processing
        if (!uploadedFilePath) {
          return res.status(400).json({
            error: 'Invalid file upload'
          });
        }
        
        const validation = validatePdfFile(uploadedFilePath, (req as any).file?.originalname || 'upload.pdf');
        if (!validation.valid) {
          await prisma.verification.create({
            data: {
              result: 'NON_AUTHENTIQUE',
              reason: 'Fichier invalide',
              verifierInfo: { ip: req.ip, error: validation.error },
              documentId: qrRow.documentId,
              qrCodeId: qrRow.id,
            }
          });
          return res.status(400).json({
            result: 'NON_AUTHENTIQUE',
            reason: 'Fichier invalide',
            error: validation.error || 'Invalid PDF file'
          });
        }

        const fileBuffer = fs.readFileSync(uploadedFilePath);
        actualSha = computeSha256(fileBuffer);
      }

      let isAuthentic = false;
      let matchType = 'Le document correspond au QR officiel';

      if (!uploadedFilePath) {
        // Vérification par token QR seul
        isAuthentic = true;
      } else {
        // 1. Correspondance avec le document original
        if (actualSha === payload.sha256 || actualSha === document.sha256) {
          isAuthentic = true;
          matchType = 'Document original certifié conforme';
        }

        // 2. Correspondance avec la version signée si enregistrée
        if (!isAuthentic) {
          const signedDoc = await prisma.signedDocument.findUnique({
            where: { documentId: document.id }
          });
          if (signedDoc && fs.existsSync(signedDoc.filePath)) {
            const signedBuffer = fs.readFileSync(signedDoc.filePath);
            if (computeSha256(signedBuffer) === actualSha) {
              isAuthentic = true;
              matchType = 'Version signée officielle certifiée conforme';
            }
          }
        }

        // 3. Correspondance avec le PDF sécurisé officiel (avec QR intégré)
        if (!isAuthentic && fs.existsSync(document.filePath)) {
          try {
            const { PDFDocument } = require('pdf-lib');
            const QRCode = require('qrcode');
            const publicBaseUrl = (process.env.PUBLIC_APP_URL || 'http://172.23.27.88:5173').replace(/\/$/, '');
            const verificationUrl = `${publicBaseUrl}/verify?token=${encodeURIComponent(qrRow.token || token)}`;
            const qrDataUrl = await QRCode.toDataURL(verificationUrl);

            const origBytes = fs.readFileSync(document.filePath);
            const pdfDoc = await PDFDocument.load(origBytes);
            const pages = pdfDoc.getPages();
            if (pages && pages.length > 0) {
              const pngImageBytes = Buffer.from(qrDataUrl.split(',')[1], 'base64');
              const pngImage = await pdfDoc.embedPng(pngImageBytes);

              const page = pages[pages.length - 1];
              const { width } = page.getSize();
              const qrSize = Math.min(58, Math.max(40, width * 0.12));
              const x = (width - qrSize) / 2;
              const y = 25;

              page.drawImage(pngImage, { x, y, width: qrSize, height: qrSize });
              const generatedSecureBytes = await pdfDoc.save();
              const secureHash = computeSha256(Buffer.from(generatedSecureBytes));
              if (secureHash === actualSha) {
                isAuthentic = true;
                matchType = 'Document sécurisé officiel (avec QR) certifié conforme';
              }
            }
          } catch (genErr) {
            // Ignorer erreur de génération et poursuivre
          }
        }
      }

      if (!isAuthentic) {
        await prisma.verification.create({
          data: {
            result: 'NON_AUTHENTIQUE',
            reason: 'Document modifié',
            verifierInfo: { ip: req.ip },
            documentId: qrRow.documentId,
            qrCodeId: qrRow.id,
          }
        });
        return res.json({
          result: 'NON_AUTHENTIQUE',
          message: 'DOCUMENT NON AUTHENTIQUE',
          reason: 'Document modifié',
          document: {
            reference: document.reference,
            subject: document.subject,
            recipient: document.recipient,
            service: document.service,
            year: document.year,
          },
        });
      }

      await prisma.verification.create({
        data: {
          result: 'AUTHENTIQUE',
          reason: null,
          verifierInfo: { ip: req.ip },
          documentId: qrRow.documentId,
          qrCodeId: qrRow.id,
        }
      });

      return res.json({
        result: 'AUTHENTIQUE',
        message: 'DOCUMENT AUTHENTIQUE',
        reason: matchType,
        qr: { qr_uuid: qrRow.qrUuid, document_id: qrRow.documentId },
        document: {
          reference: document.reference,
          subject: document.subject,
          recipient: document.recipient,
          service: document.service,
          year: document.year,
        },
      });
    } catch (err: any) {
      await prisma.verification.create({
        data: {
          result: 'NON_AUTHENTIQUE',
          reason: 'QR invalide',
          verifierInfo: { ip: req.ip, error: err.message },
          documentId: null,
          qrCodeId: null,
        }
      });
      return res.json({
        result: 'NON_AUTHENTIQUE',
        message: 'DOCUMENT NON AUTHENTIQUE',
        reason: 'QR invalide',
        document: null,
      });
    }
  } finally {
    // Cleanup uploaded file if it exists
    if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
      try {
        fs.unlinkSync(uploadedFilePath);
      } catch (e) {
        console.error('Failed to clean up uploaded file:', e);
      }
    }
  }
}
