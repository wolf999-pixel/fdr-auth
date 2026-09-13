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

export async function register(req: Request, res: Response) {
  const { full_name, email, password } = req.body;
  if (!full_name || !email || !password) {
    return res.status(400).json({ error: 'Tous les champs (Nom complet, Email, Mot de passe) sont obligatoires' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'Un compte avec cette adresse email existe déjà' });
    }

    // Assurer le rôle agent par défaut
    let agentRole = await prisma.role.findUnique({ where: { name: 'agent' } });
    if (!agentRole) {
      agentRole = await prisma.role.create({ data: { name: 'agent' } });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        full_name,
        email,
        password_hash,
        roleId: agentRole.id,
      },
      include: { role: true }
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'AGENT_REGISTERED',
        metadata: {
          email: user.email,
          full_name: user.full_name,
          role: 'agent'
        } as any
      }
    });

    const payload = { sub: user.id, role: 'agent' };
    const secret = process.env.JWT_SECRET || 'devsecret';
    const expiresIn = (process.env.JWT_EXPIRES_IN || '24h') as jwt.SignOptions['expiresIn'];
    const token = jwt.sign(payload, secret, { expiresIn });

    return res.status(201).json({
      message: 'Compte agent créé avec succès',
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: 'agent',
      }
    });
  } catch (err: any) {
    console.error('Erreur inscription agent:', err);
    return res.status(500).json({ error: 'Échec de la création du compte', details: err.message });
  }
}
