import { Router } from 'express';
import multer from 'multer';
import { createRateLimiter } from '../middlewares/rateLimit';
import * as verifyController from '../controllers/verifyController';

const router = Router();
const upload = multer({ dest: process.env.UPLOADS_DIR || 'uploads/' });

// Rate limit: 30 requests per minute per IP
const verifyRateLimiter = createRateLimiter(60000, 30);

// public endpoint: token from QR and optional file
router.post('/', verifyRateLimiter, upload.single('file'), verifyController.verify);

export default router;
