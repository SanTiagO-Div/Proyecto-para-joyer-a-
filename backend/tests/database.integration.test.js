import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

test('PostgreSQL catalog CRUD persists data and administrative activity', {
  skip: process.env.RUN_DATABASE_INTEGRATION !== 'true',
}, async () => {
  const { prisma } = await import('../src/config/database.js');
  const { productService } = await import('../src/services/productService.js');
  const { updateProductSchema } = await import('../src/validators/productValidator.js');
  const { app } = await import('../src/app.js');
  const { default: request } = await import('supertest');
  const key = randomUUID();
  let categoryId;
  let actorId;
  let productId;

  try {
    const role = await prisma.role.upsert({
      where: { name: 'ADMIN' },
      update: {},
      create: { name: 'ADMIN', description: 'Integration test role' },
    });
    const category = await prisma.category.create({
      data: { name: `Test ${key}`, slug: `test-${key}` },
    });
    categoryId = category.id;
    const actor = await prisma.adminUser.create({
      data: {
        name: 'Integration Test',
        email: `${key}@example.invalid`,
        passwordHash: 'not-a-real-password-hash',
        roleId: role.id,
      },
    });
    actorId = actor.id;
    const user = { id: actor.id, email: actor.email, role: 'ADMIN' };

    const created = await productService.createProduct({
      name: `Collar ${key}`,
      description: 'Producto de integración',
      categoryId,
      price: 25000,
      showPrice: false,
      images: [],
    }, user);
    productId = created.id;
    assert.equal(created.slug, `collar-${key}`);

    const publicProduct = await productService.getPublicProductBySlug(created.slug);
    assert.equal(publicProduct, null);

    const published = await productService.updateProduct(created.id, {
      publicationState: 'PUBLISHED',
      showPrice: true,
    }, user);
    assert.equal(Number(published.price), 25000);

    const listed = await productService.listPublicProducts({
      page: 1,
      limit: 12,
    });
    assert.ok(listed.items.some((item) => item.id === created.id));

    const deactivation = await productService.updateProduct(
      created.id,
      updateProductSchema.parse({ isActive: false }),
      user,
    );
    assert.equal(deactivation.publicationState, 'PUBLISHED');
    assert.equal(deactivation.showPrice, true);
    assert.equal(Number(deactivation.price), 25000);
    const inactiveProduct = await productService.getPublicProductBySlug(created.slug);
    assert.equal(inactiveProduct, null);
    const hiddenFromCatalog = await productService.listPublicProducts({ page: 1, limit: 12 });
    assert.equal(hiddenFromCatalog.items.some((item) => item.id === created.id), false);

    await productService.updateProduct(created.id, updateProductSchema.parse({ isActive: true }), user);
    const activeAgain = await productService.getPublicProductBySlug(created.slug);
    assert.equal(activeAgain.id, created.id);

    const httpResponse = await request(app)
      .get('/api/public/products')
      .query({ q: key.slice(0, 8) });
    assert.equal(httpResponse.status, 200);
    assert.ok(httpResponse.body.items.some((item) => item.id === created.id));

    assert.equal(await productService.archiveProduct(created.id, user), true);
    assert.equal(await productService.getPublicProductBySlug(created.slug), null);

    const logCount = await prisma.activityLog.count({
      where: { entityId: created.id, actorId: actor.id },
    });
    assert.equal(logCount, 5);
  } finally {
    if (productId) await prisma.product.delete({ where: { id: productId } });
    if (actorId) {
      await prisma.activityLog.deleteMany({ where: { actorId } });
      await prisma.adminUser.delete({ where: { id: actorId } });
    }
    if (categoryId) await prisma.category.delete({ where: { id: categoryId } });
    await prisma.$disconnect();
  }
});
