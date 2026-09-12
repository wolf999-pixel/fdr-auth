import { Router } from 'express';
import authRoutes from './auth';
import documentRoutes from './documents';
import qrRoutes from './qr';
import verifyRoutes from './verify';
import historyRoutes from './history';

const router = Router();
router.use('/auth', authRoutes);
router.use('/documents', documentRoutes);
router.use('/qr', qrRoutes);
router.use('/verify', verifyRoutes);
router.use('/history', historyRoutes);

export default router;
