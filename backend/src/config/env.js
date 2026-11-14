import { z } from 'zod';

const socialUrl = (domain) => z.string().trim().default('').refine((value) => {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (url.hostname === domain || url.hostname.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}, `La URL debe usar HTTPS y pertenecer a ${domain}.`);

export const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().url().or(z.string().startsWith('postgresql://')),
  SESSION_SECRET: z.string().min(32),
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  TRUST_PROXY: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  CLOUDINARY_CLOUD_NAME: z.string().trim().default(''),
  CLOUDINARY_API_KEY: z.string().trim().default(''),
  CLOUDINARY_API_SECRET: z.string().trim().default(''),
  WHATSAPP_PHONE: z.string().trim().regex(/^\+?[1-9]\d{7,14}$/).or(z.literal('')).transform((value) => value.replace(/\D/g, '')).default(''),
  INSTAGRAM_URL: socialUrl('instagram.com').default('https://www.instagram.com/lunanegrajoyas.co/'),
  FACEBOOK_URL: socialUrl('facebook.com'),
  TIKTOK_URL: socialUrl('tiktok.com'),
  SESSION_COOKIE_NAME: z.string().min(1).default('lunanegra.sid'),
}).superRefine((values, ctx) => {
  const cloudinaryCredentials = [
    values.CLOUDINARY_CLOUD_NAME,
    values.CLOUDINARY_API_KEY,
    values.CLOUDINARY_API_SECRET,
  ];
  const configuredCount = cloudinaryCredentials.filter(Boolean).length;
  if (configuredCount !== 0 && configuredCount !== cloudinaryCredentials.length) {
    ctx.addIssue({
      code: 'custom',
      path: ['CLOUDINARY_API_SECRET'],
      message: 'Configura juntas las tres credenciales de Cloudinary o déjalas vacías.',
    });
  }
});

export const env = environmentSchema.parse(process.env);
export const allowedOrigins = env.ALLOWED_ORIGINS
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
