import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth';
import * as qrController from '../controllers/qrController';

const router = Router();

// Exposes QR management if needed
router.post('/revoke/:qr_uuid', authMiddleware.requireAuth, authMiddleware.requireRole(['admin']), qrController.revokeQr);

export default router;
