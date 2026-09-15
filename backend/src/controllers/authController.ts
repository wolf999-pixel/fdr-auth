import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../prisma/client';

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis' });

  const normalizedEmail = email.trim().toLowerCase();

  const user = await prisma.user.findFirst({
    where: {
      email: {
        equals: normalizedEmail,
        mode: 'insensitive'
      }
    },
    include: { role: true }
  });

  if (!user) return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect' });

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

/**
 * Création d'un compte agent par l'administrateur depuis le tableau de bord
 */
export async function createAgentUser(req: Request, res: Response) {
  const { full_name, email, password, role } = req.body;
  if (!full_name || !email || !password) {
    return res.status(400).json({ error: 'Nom complet, identifiant (email) et mot de passe sont requis' });
  }

  if (password.length < 4) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 4 caractères' });
  }

  const assignedRole = role === 'admin' ? 'admin' : 'agent';

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: `Un utilisateur avec le login/email "${email}" existe déjà` });
    }

    let targetRole = await prisma.role.findUnique({ where: { name: assignedRole } });
    if (!targetRole) {
      targetRole = await prisma.role.create({ data: { name: assignedRole } });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        full_name,
        email,
        password_hash,
        roleId: targetRole.id,
      },
      include: { role: true }
    });

    const adminActorId = (req as any).user?.sub || null;
    await prisma.auditLog.create({
      data: {
        userId: adminActorId || user.id,
        action: 'AGENT_CREATED_BY_ADMIN',
        metadata: {
          created_user_id: user.id,
          created_email: user.email,
          created_name: user.full_name,
          role: assignedRole,
          createdByAdminId: adminActorId
        } as any
      }
    });

    return res.status(201).json({
      success: true,
      message: `Compte ${assignedRole} pour "${full_name}" créé avec succès !`,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: assignedRole,
        createdAt: user.createdAt
      }
    });
  } catch (err: any) {
    console.error('Erreur createAgentUser:', err);
    return res.status(500).json({ error: 'Erreur serveur lors de la création de l’agent', details: err.message });
  }
}

/**
 * Liste des agents pour le tableau de bord administrateur
 */
export async function listAgents(req: Request, res: Response) {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        full_name: true,
        email: true,
        createdAt: true,
        role: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json({
      data: users.map((u) => ({
        id: u.id,
        full_name: u.full_name,
        email: u.email,
        role: u.role?.name || 'agent',
        createdAt: u.createdAt
      }))
    });
  } catch (err: any) {
    console.error('Erreur listAgents:', err);
    return res.status(500).json({ error: 'Impossible de récupérer la liste des agents', details: err.message });
  }
}
