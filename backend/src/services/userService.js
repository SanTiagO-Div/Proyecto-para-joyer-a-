import { prisma } from '../config/database.js';
import { hashPassword } from '../auth/passwords.js';

const userSelect = {
  id: true,
  name: true,
  email: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  role: { select: { name: true } },
};

const logAdminAction = (tx, actor, action, description, userId, metadata) => tx.activityLog.create({
  data: {
    actorId: actor.id,
    actorEmail: actor.email,
    action,
    description,
    entityType: 'AdminUser',
    entityId: userId,
    metadata,
  },
});

export const userService = {
  async listUsers(page, limit) {
    const [items, total] = await prisma.$transaction([
      prisma.adminUser.findMany({
        select: userSelect,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.adminUser.count(),
    ]);
    return {
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },

  async createUser(data, actor) {
    return prisma.$transaction(async (tx) => {
      const role = await tx.role.findUnique({ where: { name: data.role } });
      if (!role) {
        const error = new Error('El rol solicitado no está configurado.');
        error.statusCode = 400;
        error.expose = true;
        throw error;
      }

      const passwordHash = await hashPassword(data.password);
      const user = await tx.adminUser.create({
        data: {
          name: data.name,
          email: data.email,
          passwordHash,
          roleId: role.id,
        },
        select: userSelect,
      });
      await logAdminAction(
        tx,
        actor,
        'ADMIN_USER_CREATE',
        `Cuenta administrativa creada: ${user.email}`,
        user.id,
        { role: role.name },
      );
      return user;
    });
  },

  async updateUserRole(id, newRoleName, actor) {
    return prisma.$transaction(async (tx) => {
      const user = await tx.adminUser.findUnique({
        where: { id },
        include: { role: true },
      });
      if (!user) return null;
      if (actor.id === user.id) {
        const error = new Error('No puedes cambiar tu propio rol.');
        error.statusCode = 400;
        error.expose = true;
        throw error;
      }

      const nextRole = await tx.role.findUnique({ where: { name: newRoleName } });
      if (!nextRole) {
        const error = new Error('El rol solicitado no está configurado.');
        error.statusCode = 400;
        error.expose = true;
        throw error;
      }
      if (user.role.name === newRoleName) {
        return tx.adminUser.findUnique({ where: { id }, select: userSelect });
      }
      if (user.status === 'ACTIVE' && user.role.name === 'ADMIN' && newRoleName !== 'ADMIN') {
        const activeAdmins = await tx.adminUser.count({
          where: { status: 'ACTIVE', role: { name: 'ADMIN' } },
        });
        if (activeAdmins <= 1) {
          const error = new Error('Debe permanecer al menos un administrador activo.');
          error.statusCode = 409;
          error.expose = true;
          throw error;
        }
      }

      const updated = await tx.adminUser.update({
        where: { id },
        data: { roleId: nextRole.id },
        select: userSelect,
      });
      await logAdminAction(
        tx,
        actor,
        'ADMIN_USER_ROLE_CHANGE',
        `Rol de cuenta actualizado: ${updated.email}`,
        updated.id,
        { previousRole: user.role.name, role: newRoleName },
      );
      await tx.session.deleteMany({
        where: { sess: { path: ['user', 'id'], equals: id } },
      });
      return updated;
    }, { isolationLevel: 'Serializable' });
  },

  async updateUserStatus(id, status, actor) {
    return prisma.$transaction(async (tx) => {
      const user = await tx.adminUser.findUnique({
        where: { id },
        include: { role: true },
      });
      if (!user) return null;
      if (user.status === status) {
        return tx.adminUser.findUnique({ where: { id }, select: userSelect });
      }
      if (actor.id === user.id && status === 'DISABLED') {
        const error = new Error('No puedes desactivar tu propia cuenta.');
        error.statusCode = 400;
        error.expose = true;
        throw error;
      }
      if (user.status === 'ACTIVE' && status === 'DISABLED' && user.role.name === 'ADMIN') {
        const activeAdmins = await tx.adminUser.count({
          where: { status: 'ACTIVE', role: { name: 'ADMIN' } },
        });
        if (activeAdmins <= 1) {
          const error = new Error('Debe permanecer al menos un administrador activo.');
          error.statusCode = 409;
          error.expose = true;
          throw error;
        }
      }

      const updated = await tx.adminUser.update({
        where: { id },
        data: { status },
        select: userSelect,
      });
      await logAdminAction(
        tx,
        actor,
        'ADMIN_USER_STATUS_CHANGE',
        `Estado de cuenta actualizado: ${updated.email}`,
        updated.id,
        { previousStatus: user.status, status },
      );

      if (status === 'DISABLED') {
        await tx.session.deleteMany({
          where: { sess: { path: ['user', 'id'], equals: id } },
        });
      }
      return updated;
    }, { isolationLevel: 'Serializable' });
  },
};
