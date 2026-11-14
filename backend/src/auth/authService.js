import argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import { prisma } from '../config/database.js';
import { passwordHashOptions } from './passwords.js';

const dummyHashPromise = argon2.hash(randomBytes(32).toString('hex'), passwordHashOptions);

export const authService = {
  async authenticate(email, password) {
    const account = await prisma.adminUser.findUnique({
      where: { email },
      include: { role: { select: { name: true } } },
    });

    const passwordHash = account?.passwordHash ?? await dummyHashPromise;
    let passwordMatches;
    try {
      passwordMatches = await argon2.verify(passwordHash, password);
    } catch (error) {
      if (!(error instanceof TypeError)) throw error;
      console.error('Stored password hash is invalid for an administrative account.');
      passwordMatches = false;
    }

    if (!account || account.status !== 'ACTIVE' || !passwordMatches) return null;

    return {
      id: account.id,
      name: account.name,
      email: account.email,
      role: account.role.name,
    };
  },
};
