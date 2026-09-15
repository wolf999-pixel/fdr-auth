import { Router, Request, Response } from 'express';
import * as authController from '../controllers/authController';
import { authMiddleware } from '../middlewares/auth';

const router = Router();

router.post('/login', (req: Request, res: Response) => authController.login(req, res));

// Gestion des agents par l'administrateur
router.post('/admin/agents', authMiddleware.requireAuth, authMiddleware.requireRole(['admin']), authController.createAgentUser);
router.get('/admin/agents', authMiddleware.requireAuth, authMiddleware.requireRole(['admin']), authController.listAgents);

export default router;
