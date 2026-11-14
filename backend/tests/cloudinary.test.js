import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.SESSION_SECRET = 'test-session-secret-long-enough-for-validation';
process.env.CLOUDINARY_CLOUD_NAME = '';
process.env.CLOUDINARY_API_KEY = '';
process.env.CLOUDINARY_API_SECRET = '';

const { cloudinaryConfigured, uploadCloudinaryImage } = await import('../src/config/cloudinary.js');

test('image uploads fail explicitly when Cloudinary credentials are absent', () => {
  assert.equal(cloudinaryConfigured, false);
  assert.throws(() => uploadCloudinaryImage(Buffer.alloc(0), 'test'), {
    statusCode: 503,
    expose: true,
  });
});
