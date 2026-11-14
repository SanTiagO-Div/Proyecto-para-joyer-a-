import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  password: z.string().min(1).max(128),
}).strict();

export const createAdminUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  password: z.string().min(12).max(128),
  role: z.enum(['ADMIN', 'EDITOR']),
}).strict();

export const updateUserRoleSchema = z.object({
  role: z.enum(['ADMIN', 'EDITOR']),
}).strict();

export const updateUserStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'DISABLED']),
}).strict();

export const userListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
}).strict();
