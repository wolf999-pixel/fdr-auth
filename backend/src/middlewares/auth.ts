import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export const authMiddleware = {
  requireAuth: (req: Request, res: Response, next: NextFunction) => {
    let token: string | undefined;
    const auth = req.headers.authorization;
    if (auth) {
      const parts = auth.split(' ');
      if (parts.length === 2) {
        token = parts[1];
      }
    }
    if (!token && typeof req.query.token === 'string') {
      token = req.query.token;
    }
    if (!token) return res.status(401).json({ error: 'Missing Authorization header or token query parameter' });

    try {
      const payload: any = jwt.verify(token, process.env.JWT_SECRET || 'devsecret');
      (req as any).user = payload;
      return next();
    } catch (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  },

  requireRole: (roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
      const user = (req as any).user;
      if (!user) return res.status(401).json({ error: 'Not authenticated' });
      if (!roles.includes(user.role)) return res.status(403).json({ error: 'Forbidden' });
      return next();
    };
  }
};
