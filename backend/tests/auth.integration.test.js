import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

test('session authentication enforces CSRF, hides account existence and checks roles', {
  skip: process.env.RUN_DATABASE_INTEGRATION !== 'true',
}, async () => {
  const { prisma } = await import('../src/config/database.js');
  const { closeSessionPool } = await import('../src/config/session.js');
  const { hashPassword } = await import('../src/auth/passwords.js');
  const { app } = await import('../src/app.js');
  const { default: request } = await import('supertest');
  const suffix = randomUUID();
  const password = 'Test-Only-Password-123!';
  const email = `${suffix}@example.invalid`;
  const categoryIds = [];
  const productIds = [];
  let actorId;
  let disabledId;
  let adminId;
  const createdUserIds = [];

  try {
    const role = await prisma.role.upsert({
      where: { name: 'EDITOR' },
      update: {},
      create: { name: 'EDITOR', description: 'Integration test editor' },
    });
    const adminRole = await prisma.role.upsert({
      where: { name: 'ADMIN' },
      update: {},
      create: { name: 'ADMIN', description: 'Integration test admin' },
    });
    const passwordHash = await hashPassword(password);
    const actor = await prisma.adminUser.create({
      data: {
        name: 'Auth Integration',
        email,
        passwordHash,
        roleId: role.id,
      },
    });
    actorId = actor.id;
    const disabled = await prisma.adminUser.create({
      data: {
        name: 'Disabled Integration',
        email: `disabled-${suffix}@example.invalid`,
        passwordHash,
        roleId: role.id,
        status: 'DISABLED',
      },
    });
    disabledId = disabled.id;
    const administrator = await prisma.adminUser.create({
      data: {
        name: 'Admin Integration',
        email: `admin-${suffix}@example.invalid`,
        passwordHash,
        roleId: adminRole.id,
      },
    });
    adminId = administrator.id;

    const agent = request.agent(app);
    const csrfResponse = await agent.get('/api/auth/csrf-token');
    assert.equal(csrfResponse.status, 200);
    assert.ok(csrfResponse.body.csrfToken);

    const csrfToken = csrfResponse.body.csrfToken;
    const missingCsrf = await agent.post('/api/auth/login').send({ email, password });
    assert.equal(missingCsrf.status, 403);

    const login = await agent
      .post('/api/auth/login')
      .set('x-csrf-token', csrfToken)
      .send({ email, password });
    assert.equal(login.status, 200);
    assert.equal(login.body.user.role, 'EDITOR');
    assert.equal(Object.hasOwn(login.body.user, 'passwordHash'), false);
    assert.match(login.headers['set-cookie'].join(';'), /HttpOnly/i);

    const me = await agent.get('/api/auth/me');
    assert.equal(me.status, 200);
    assert.equal(me.body.user.email, email);

    const adminProducts = await agent.get('/api/admin/products');
    assert.equal(adminProducts.status, 200);
    const uploadStatus = await agent.get('/api/admin/uploads/status');
    assert.equal(uploadStatus.status, 200);
    assert.equal(typeof uploadStatus.body.cloudinaryConfigured, 'boolean');
    assert.match(uploadStatus.headers['cache-control'], /no-store/i);
    assert.equal((await agent.get('/api/admin/users')).status, 403);

    const noCsrfCategory = await agent.post('/api/admin/categories').send({
      name: `Auth ${suffix}`,
    });
    assert.equal(noCsrfCategory.status, 403);

    const createdCategory = await agent
      .post('/api/admin/categories')
      .set('x-csrf-token', login.body.csrfToken)
      .send({ name: `Auth ${suffix}` });
    assert.equal(createdCategory.status, 201);
    categoryIds.push(createdCategory.body.id);

    const createdProduct = await agent
      .post('/api/admin/products')
      .set('x-csrf-token', login.body.csrfToken)
      .send({
        name: `Product ${suffix}`,
        description: 'A valid payload used to verify editor product permissions.',
        categoryId: createdCategory.body.id,
        publicationState: 'DRAFT',
      });
    assert.equal(createdProduct.status, 201);
    productIds.push(createdProduct.body.id);

    const logout = await agent
      .post('/api/auth/logout')
      .set('x-csrf-token', login.body.csrfToken);
    assert.equal(logout.status, 204);
    assert.equal((await agent.get('/api/auth/me')).status, 401);

    const adminAgent = request.agent(app);
    const adminCsrf = await adminAgent.get('/api/auth/csrf-token');
    const adminLogin = await adminAgent
      .post('/api/auth/login')
      .set('x-csrf-token', adminCsrf.body.csrfToken)
      .send({ email: administrator.email, password });
    assert.equal(adminLogin.status, 200);
    assert.equal((await adminAgent.get('/api/admin/users')).status, 200);

    const selfRoleChange = await adminAgent
      .patch(`/api/admin/users/${adminId}/role`)
      .set('x-csrf-token', adminLogin.body.csrfToken)
      .send({ role: 'EDITOR' });
    assert.equal(selfRoleChange.status, 400);
    const selfDisable = await adminAgent
      .patch(`/api/admin/users/${adminId}/status`)
      .set('x-csrf-token', adminLogin.body.csrfToken)
      .send({ status: 'DISABLED' });
    assert.equal(selfDisable.status, 400);

    const createdUser = await adminAgent
      .post('/api/admin/users')
      .set('x-csrf-token', adminLogin.body.csrfToken)
      .send({
        name: 'Managed Integration',
        email: `managed-${suffix}@example.invalid`,
        password,
        role: 'EDITOR',
      });
    assert.equal(createdUser.status, 201);
    assert.equal(Object.hasOwn(createdUser.body, 'passwordHash'), false);
    createdUserIds.push(createdUser.body.id);

    const managedAgent = request.agent(app);
    const managedCsrf = await managedAgent.get('/api/auth/csrf-token');
    const managedLogin = await managedAgent
      .post('/api/auth/login')
      .set('x-csrf-token', managedCsrf.body.csrfToken)
      .send({ email: createdUser.body.email, password });
    assert.equal(managedLogin.status, 200);
    assert.equal((await managedAgent.get('/api/auth/me')).status, 200);

    const changedRole = await adminAgent
      .patch(`/api/admin/users/${createdUser.body.id}/role`)
      .set('x-csrf-token', adminLogin.body.csrfToken)
      .send({ role: 'ADMIN' });
    assert.equal(changedRole.status, 200);
    assert.equal(changedRole.body.role.name, 'ADMIN');
    assert.equal((await managedAgent.get('/api/auth/me')).status, 401);
    const disabledUser = await adminAgent
      .patch(`/api/admin/users/${createdUser.body.id}/status`)
      .set('x-csrf-token', adminLogin.body.csrfToken)
      .send({ status: 'DISABLED' });
    assert.equal(disabledUser.status, 200);
    assert.equal(disabledUser.body.status, 'DISABLED');

    assert.equal((await adminAgent.post('/api/auth/logout')
      .set('x-csrf-token', adminLogin.body.csrfToken)).status, 204);

    const anonymous = request.agent(app);
    const anonymousCsrf = await anonymous.get('/api/auth/csrf-token');
    const unknownEmail = await anonymous
      .post('/api/auth/login')
      .set('x-csrf-token', anonymousCsrf.body.csrfToken)
      .send({ email: `missing-${suffix}@example.invalid`, password });
    const disabledAccount = await anonymous
      .post('/api/auth/login')
      .set('x-csrf-token', anonymousCsrf.body.csrfToken)
      .send({ email: disabled.email, password });
    assert.equal(unknownEmail.status, 401);
    assert.deepEqual(unknownEmail.body, disabledAccount.body);
  } finally {
    const accountIds = [actorId, disabledId, adminId, ...createdUserIds].filter(Boolean);
    if (accountIds.length) {
      await prisma.$executeRaw`
        DELETE FROM "Session"
        WHERE sess->'user'->>'id' = ANY(${accountIds})
      `;
      await prisma.activityLog.deleteMany({
        where: { actorId: { in: accountIds } },
      });
      await prisma.adminUser.deleteMany({
        where: { id: { in: accountIds } },
      });
    }
    if (productIds.length) {
      await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    }
    if (categoryIds.length) {
      await prisma.category.deleteMany({ where: { id: { in: categoryIds } } });
    }
    await closeSessionPool();
    await prisma.$disconnect();
  }
});
