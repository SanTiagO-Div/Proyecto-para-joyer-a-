import { env } from '../config/env.js';

export const getPublicContact = (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({
    whatsappPhone: env.WHATSAPP_PHONE || null,
    socialLinks: {
      instagram: env.INSTAGRAM_URL || null,
      facebook: env.FACEBOOK_URL || null,
      tiktok: env.TIKTOK_URL || null,
    },
  });
};
