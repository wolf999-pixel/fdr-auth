import { Router } from 'express';
import multer from 'multer';
import * as docController from '../controllers/documentController';
import { authMiddleware } from '../middlewares/auth';

const router = Router();
const upload = multer({ dest: process.env.UPLOADS_DIR || 'uploads/' });

router.get('/stats', authMiddleware.requireAuth, authMiddleware.requireRole(['agent', 'admin']), docController.getDashboardStats);
router.post('/analyze-pdf', authMiddleware.requireAuth, authMiddleware.requireRole(['agent', 'admin']), upload.single('file'), docController.analyzePdf);
router.post('/', authMiddleware.requireAuth, authMiddleware.requireRole(['agent', 'admin']), upload.single('file'), docController.createDocument);
router.get('/', authMiddleware.requireAuth, authMiddleware.requireRole(['agent','admin']), docController.listDocuments);
router.get('/:id', authMiddleware.requireAuth, authMiddleware.requireRole(['agent','admin']), docController.getDocument);
router.get('/:id/file', authMiddleware.requireAuth, authMiddleware.requireRole(['agent','admin']), docController.getDocumentFile);
router.get('/:id/secure-pdf', authMiddleware.requireAuth, authMiddleware.requireRole(['agent','admin']), docController.exportSecurePdf);
router.post('/:id/qr', authMiddleware.requireAuth, authMiddleware.requireRole(['agent', 'admin']), docController.generateQrForDocument);
router.post('/:id/signed', authMiddleware.requireAuth, authMiddleware.requireRole(['agent', 'admin']), upload.single('file'), docController.uploadSignedDocument);

export default router;