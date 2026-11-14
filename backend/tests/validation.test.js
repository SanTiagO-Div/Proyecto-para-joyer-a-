import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createProductSchema,
  publicProductListQuerySchema,
  updateProductSchema,
} from '../src/validators/productValidator.js';
import { slugify } from '../src/utils/slugify.js';

process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-session-secret-long-enough-for-validation';
const { environmentSchema } = await import('../src/config/env.js');

test('create product rejects a visible price when price is absent', () => {
  const parsed = createProductSchema.safeParse({
    name: 'Anillo Luna',
    description: 'Anillo de diseño',
    showPrice: true,
    categoryId: 'category-1',
  });
  assert.equal(parsed.success, false);
});

test('product APIs do not accept client-supplied Cloudinary metadata', () => {
  const product = {
    name: 'Anillo Luna',
    description: 'Anillo de diseño',
    categoryId: 'category-1',
  };
  assert.equal(createProductSchema.safeParse({ ...product, images: [] }).success, false);
  assert.equal(updateProductSchema.safeParse({ images: [] }).success, false);
});

test('public product filters clamp pagination to the supported limit', () => {
  const parsed = publicProductListQuerySchema.safeParse({ page: '2', limit: '51' });
  assert.equal(parsed.success, false);
});

test('partial product updates do not apply creation defaults', () => {
  assert.deepEqual(updateProductSchema.parse({ isActive: false }), { isActive: false });
});

test('contact settings normalize WhatsApp numbers and require HTTPS social URLs', () => {
  const parsed = environmentSchema.parse({
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    SESSION_SECRET: 'test-session-secret-long-enough-for-validation',
    WHATSAPP_PHONE: '+573001234567',
  });
  assert.equal(parsed.WHATSAPP_PHONE, '573001234567');
  assert.equal(parsed.INSTAGRAM_URL, 'https://www.instagram.com/lunanegrajoyas.co/');

  const invalidUrl = environmentSchema.safeParse({
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    SESSION_SECRET: 'test-session-secret-long-enough-for-validation',
    INSTAGRAM_URL: 'http://instagram.com/lunanegrajoyas.co',
  });
  assert.equal(invalidUrl.success, false);

  const partialCloudinaryConfig = environmentSchema.safeParse({
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    SESSION_SECRET: 'test-session-secret-long-enough-for-validation',
    CLOUDINARY_CLOUD_NAME: 'test-cloud',
  });
  assert.equal(partialCloudinaryConfig.success, false);
});

test('slugify normalizes accented Spanish names', () => {
  assert.equal(slugify('Aretes Aurora Dorada'), 'aretes-aurora-dorada');
});
