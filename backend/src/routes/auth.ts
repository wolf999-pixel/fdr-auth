import { Router, Request, Response } from 'express';
import * as authController from '../controllers/authController';

const router = Router();

router.post('/login', (req: Request, res: Response) => authController.login(req, res));
// optional: router.post('/register', authMiddleware.isAdmin, authController.register);

export default router;
