import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../prisma/client';

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Missing credentials' });

  const user = await prisma.user.findUnique({
    where: { email },
    include: { role: true }
  });

  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) return res.status(401).json({ error: 'Invalid credentials' });

  const roleName = user.role?.name || 'agent';
  if (!['agent', 'admin'].includes(roleName)) {
    return res.status(403).json({ error: 'Unauthorized account role' });
  }

  const payload = { sub: user.id, role: roleName };
  const secret = process.env.JWT_SECRET || 'devsecret';
  const expiresIn = (process.env.JWT_EXPIRES_IN || '1h') as jwt.SignOptions['expiresIn'];
  const token = jwt.sign(payload, secret, { expiresIn });

  return res.json({
    token,
    user: {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      role: roleName,
    }
  });
}
