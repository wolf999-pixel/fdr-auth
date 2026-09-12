import bcrypt from 'bcrypt';
import prisma from '../prisma/client';

const defaultRoles = ['agent', 'admin'];

const defaultUsers = [
  {
    email: 'admin@fdr.test',
    password: 'admin123',
    full_name: 'Admin Test',
    role: 'admin',
  },
  {
    email: 'agent@fdr.test',
    password: 'agent123',
    full_name: 'Agent Test',
    role: 'agent',
  },
];

export async function ensureDefaultRolesAndUsers() {
  for (const roleName of defaultRoles) {
    await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName },
    });
  }

  for (const userSeed of defaultUsers) {
    const role = await prisma.role.findUnique({ where: { name: userSeed.role } });
    if (!role) continue;

    const existingUser = await prisma.user.findUnique({ where: { email: userSeed.email } });

    if (existingUser) {
      await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          full_name: userSeed.full_name,
          password_hash: await bcrypt.hash(userSeed.password, 10),
          roleId: role.id,
        },
      });
      continue;
    }

    await prisma.user.create({
      data: {
        full_name: userSeed.full_name,
        email: userSeed.email,
        password_hash: await bcrypt.hash(userSeed.password, 10),
        roleId: role.id,
      },
    });
  }
}
