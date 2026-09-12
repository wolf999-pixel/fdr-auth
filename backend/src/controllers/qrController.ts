import { Request, Response } from 'express';
import prisma from '../prisma/client';

function isValidUuid(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

export async function revokeQr(req: Request, res: Response) {
  const { qr_uuid } = req.params;
  
  if (!isValidUuid(qr_uuid)) {
    return res.status(400).json({ error: 'Invalid QR UUID format' });
  }

  try {
    const qr = await prisma.qrCode.findUnique({
      where: { qrUuid: qr_uuid }
    });

    if (!qr) {
      return res.status(404).json({ error: 'QR code not found' });
    }

    if (qr.revoked) {
      return res.status(400).json({ error: 'QR code already revoked' });
    }

    const revokedQr = await prisma.qrCode.update({
      where: { qrUuid: qr_uuid },
      data: { revoked: true }
    });

    await prisma.auditLog.create({
      data: {
        userId: (req as any).user?.sub || null,
        action: 'QR_REVOKED',
        metadata: {
          qr_uuid: revokedQr.qrUuid,
          document_id: revokedQr.documentId
        } as any
      }
    });

    return res.json({
      success: true,
      qr_uuid: revokedQr.qrUuid,
      revoked_at: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error revoking QR:', error);
    return res.status(500).json({ error: 'Failed to revoke QR', details: error.message });
  }
}
