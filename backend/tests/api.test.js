import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

process.env.NODE_ENV = 'test';
process.env.PORT = '4000';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test?schema=public';
process.env.SESSION_SECRET = 'test-session-secret-long-enough-for-validation';
process.env.ALLOWED_ORIGINS = 'http://localhost:3000';
process.env.WHATSAPP_PHONE = '';
process.env.INSTAGRAM_URL = 'https://www.instagram.com/lunanegrajoyas.co/';
process.env.FACEBOOK_URL = '';
process.env.TIKTOK_URL = '';

const { app } = await import('../src/app.js');

test('health endpoint reports the API as available', async () => {
  const response = await request(app).get('/api/health');
  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'ok');
});

test('public product endpoint rejects unsupported pagination before database access', async () => {
  const response = await request(app).get('/api/public/products?limit=51');
  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'VALIDATION_ERROR');
});

test('public contact endpoint exposes configured channels but no service credentials', async () => {
  const response = await request(app).get('/api/public/contact');
  assert.equal(response.status, 200);
  assert.equal(response.body.whatsappPhone, null);
  assert.equal(response.body.socialLinks.instagram, 'https://www.instagram.com/lunanegrajoyas.co/');
  assert.equal(Object.hasOwn(response.body, 'CLOUDINARY_API_SECRET'), false);
});

test('administrative endpoints fail closed without an authenticated session', async () => {
  const response = await request(app).get('/api/admin/products');
  assert.equal(response.status, 401);
  assert.equal(response.body.error.code, 'UNAUTHENTICATED');
  assert.equal((await request(app).get('/api/admin/uploads/status')).status, 401);
  assert.equal((await request(app).post('/api/admin/products/example/images')).status, 401);
});
