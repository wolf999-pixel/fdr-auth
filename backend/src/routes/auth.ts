import { Router, Request, Response } from 'express';
import * as authController from '../controllers/authController';

const router = Router();

router.post('/login', (req: Request, res: Response) => authController.login(req, res));
router.post('/register', (req: Request, res: Response) => authController.register(req, res));

export default router;
