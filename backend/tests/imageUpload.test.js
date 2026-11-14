import test from 'node:test';
import assert from 'node:assert/strict';
import { validateImageBuffer } from '../src/middleware/productImageUpload.js';

const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0XYAAAAASUVORK5CYII=',
  'base64',
);

test('image uploads accept supported bytes only when their MIME type matches', async () => {
  const detected = await validateImageBuffer(onePixelPng, 'image/png');
  assert.equal(detected.mime, 'image/png');

  await assert.rejects(validateImageBuffer(onePixelPng, 'image/jpeg'), {
    statusCode: 400,
    expose: true,
  });
  await assert.rejects(validateImageBuffer(Buffer.from('<svg></svg>'), 'image/svg+xml'), {
    statusCode: 400,
    expose: true,
  });
});
