import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth';
import prisma from '../prisma/client';

const router = Router();

router.get('/', authMiddleware.requireAuth, authMiddleware.requireRole(['agent', 'admin']), async (req, res) => {
  const [verifications, auditLogs] = await Promise.all([
    prisma.verification.findMany({
      orderBy: { createdAt: 'desc' },
      include: { document: true, qrCode: true }
    }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      include: { user: true }
    })
  ]);

  const history = [
    ...verifications.map((item) => ({
      id: item.id,
      type: 'verification',
      date: item.createdAt,
      action: item.result,
      reason: item.reason,
      actor: (item.verifierInfo as any)?.source || (item.verifierInfo as any)?.ip || 'Vérificateur externe (Scan QR)',
      document: item.document ? {
        id: item.document.id,
        reference: item.document.reference,
        subject: item.document.subject,
        recipient: item.document.recipient,
        service: item.document.service,
        year: item.document.year,
        fileName: item.document.fileName,
        sha256: item.document.sha256,
      } : null,
      qr: item.qrCode ? {
        qrUuid: item.qrCode.qrUuid,
        revoked: item.qrCode.revoked,
      } : null,
      details: item.verifierInfo || null,
    })),
    ...auditLogs.map((item) => {
      const meta = item.metadata && typeof item.metadata === 'object' ? (item.metadata as any) : {};
      const reason = meta.reason || null;

      return {
        id: item.id,
        type: 'audit',
        date: item.createdAt,
        action: item.action,
        reason,
        actor: item.user?.full_name || item.user?.email || 'Système',
        document: meta.reference || meta.document_id ? {
          reference: meta.reference || null,
          id: meta.document_id || null,
          subject: meta.subject || null,
          fileName: meta.fileName || null,
        } : null,
        qr: meta.qr_uuid ? {
          qrUuid: meta.qr_uuid,
        } : null,
        details: meta,
      };
    })
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return res.json({ data: history, meta: { total: history.length } });
});

export default router;
