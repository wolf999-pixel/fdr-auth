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
      type: 'verification',
      date: item.createdAt,
      action: item.result,
      reason: item.reason,
      actor: (item.verifierInfo as any)?.source || 'Vérificateur',
    })),
    ...auditLogs.map((item) => {
      const reason = typeof item.metadata === 'object' && item.metadata && 'reason' in (item.metadata as object)
        ? (item.metadata as any).reason
        : null;

      return {
        type: 'audit',
        date: item.createdAt,
        action: item.action,
        reason,
        actor: item.user?.full_name || 'Système',
      };
    })
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return res.json({ data: history, meta: { total: history.length } });
});

export default router;
