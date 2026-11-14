import { prisma } from '../config/database.js';
import { deleteCloudinaryImage, uploadCloudinaryImage } from '../config/cloudinary.js';
import { slugify } from '../utils/slugify.js';
import { httpError } from '../utils/httpError.js';

const imageOrder = [{ isPrimary: 'desc' }, { sortOrder: 'asc' }];
const maxProductImages = 20;

const publicProduct = (product) => ({
  ...product,
  price: product.showPrice && product.price != null ? Number(product.price) : null,
});

const searchFilter = (q) => (q
  ? {
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { material: { contains: q, mode: 'insensitive' } },
      ],
    }
  : {});

const pagination = (page, limit, total) => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
});

export const productService = {
  async listPublicProducts({ categoryId, q, availability, page, limit }) {
    const where = {
      isActive: true,
      deletedAt: null,
      publicationState: 'PUBLISHED',
      ...(categoryId ? { categoryId, category: { isActive: true } } : { category: { isActive: true } }),
      ...(availability ? { availability } : {}),
      ...searchFilter(q),
    };

    const [items, total] = await prisma.$transaction([
      prisma.product.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, slug: true } },
          images: { orderBy: imageOrder },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.product.count({ where }),
    ]);

    return { items: items.map(publicProduct), pagination: pagination(page, limit, total) };
  },

  async getPublicProductBySlug(slug) {
    const product = await prisma.product.findFirst({
      where: {
        slug,
        isActive: true,
        deletedAt: null,
        publicationState: 'PUBLISHED',
        category: { isActive: true },
      },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        images: { orderBy: imageOrder },
      },
    });
    return product ? publicProduct(product) : null;
  },

  listPublicCategories() {
    return prisma.category.findMany({
      where: { isActive: true },
      select: { id: true, name: true, slug: true, description: true },
      orderBy: { name: 'asc' },
    });
  },

  async listAdminProducts({ categoryId, q, availability, publicationState, isActive, page, limit }) {
    const where = {
      deletedAt: null,
      ...(categoryId ? { categoryId } : {}),
      ...(availability ? { availability } : {}),
      ...(publicationState ? { publicationState } : {}),
      ...(isActive === undefined ? {} : { isActive }),
      ...searchFilter(q),
    };
    const [items, total] = await prisma.$transaction([
      prisma.product.findMany({
        where,
        include: { category: true, images: { orderBy: imageOrder } },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.product.count({ where }),
    ]);
    return { items, pagination: pagination(page, limit, total) };
  },

  getAdminProduct(id) {
    return prisma.product.findFirst({
      where: { id, deletedAt: null },
      include: { category: true, images: { orderBy: imageOrder } },
    });
  },

  async createProduct(data, actor) {
    const { images = [], ...fields } = data;
    return prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          ...fields,
          slug: slugify(fields.name),
          price: fields.price ?? null,
          images: { create: images },
        },
        include: { category: true, images: { orderBy: imageOrder } },
      });
      await tx.activityLog.create({
        data: {
          actorId: actor.id,
          actorEmail: actor.email,
          action: 'PRODUCT_CREATE',
          description: `Producto creado: ${product.name}`,
          entityType: 'Product',
          entityId: product.id,
          metadata: { slug: product.slug, categoryId: product.categoryId },
        },
      });
      return product;
    });
  },

  async updateProduct(id, data, actor) {
    const { images, ...fields } = data;
    return prisma.$transaction(async (tx) => {
      const current = await tx.product.findFirst({ where: { id, deletedAt: null } });
      if (!current) return null;

      const nextName = fields.name ?? current.name;
      const nextPrice = Object.hasOwn(fields, 'price') ? fields.price : current.price;
      const nextShowPrice = fields.showPrice ?? current.showPrice;
      if (nextShowPrice && nextPrice == null) {
        const error = new Error('Indica un precio para poder mostrarlo.');
        error.statusCode = 400;
        error.expose = true;
        throw error;
      }

      const updateData = {
        ...fields,
        ...(fields.name ? { slug: slugify(nextName) } : {}),
        ...(Object.hasOwn(fields, 'price') ? { price: fields.price } : {}),
      };

      if (images !== undefined) {
        await tx.productImage.deleteMany({ where: { productId: id } });
        updateData.images = { create: images };
      }

      const product = await tx.product.update({
        where: { id },
        data: updateData,
        include: { category: true, images: { orderBy: imageOrder } },
      });
      await tx.activityLog.create({
        data: {
          actorId: actor.id,
          actorEmail: actor.email,
          action: 'PRODUCT_UPDATE',
          description: `Producto actualizado: ${product.name}`,
          entityType: 'Product',
          entityId: product.id,
          metadata: { changedFields: Object.keys(data) },
        },
      });
      return product;
    });
  },

  async archiveProduct(id, actor) {
    return prisma.$transaction(async (tx) => {
      const product = await tx.product.findFirst({ where: { id, deletedAt: null } });
      if (!product) return false;
      await tx.product.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false },
      });
      await tx.activityLog.create({
        data: {
          actorId: actor.id,
          actorEmail: actor.email,
          action: 'PRODUCT_ARCHIVE',
          description: `Producto archivado: ${product.name}`,
          entityType: 'Product',
          entityId: product.id,
        },
      });
      return true;
    });
  },

  async uploadProductImage(id, file, actor) {
    const product = await prisma.product.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!product) return null;

    const existingCount = await prisma.productImage.count({ where: { productId: id } });
    if (existingCount >= maxProductImages) {
      throw httpError(409, `Un producto puede tener como máximo ${maxProductImages} imágenes.`);
    }

    const asset = await uploadCloudinaryImage(file.buffer, `luna-negra-joyas/products/${id}`);
    try {
      return await prisma.$transaction(async (tx) => {
        const currentProduct = await tx.product.findFirst({
          where: { id, deletedAt: null },
          select: { id: true },
        });
        if (!currentProduct) throw httpError(404, 'Producto no encontrado.');

        const images = await tx.productImage.findMany({
          where: { productId: id },
          select: { isPrimary: true, sortOrder: true },
        });
        if (images.length >= maxProductImages) {
          throw httpError(409, `Un producto puede tener como máximo ${maxProductImages} imágenes.`);
        }

        const image = await tx.productImage.create({
          data: {
            productId: id,
            url: asset.url,
            cloudinaryPublicId: asset.cloudinaryPublicId,
            altText: product.name,
            isPrimary: !images.some((item) => item.isPrimary),
            sortOrder: Math.max(-1, ...images.map((item) => item.sortOrder)) + 1,
          },
        });
        await tx.activityLog.create({
          data: {
            actorId: actor.id,
            actorEmail: actor.email,
            action: 'PRODUCT_IMAGE_UPLOAD',
            description: `Imagen agregada al producto: ${product.name}`,
            entityType: 'Product',
            entityId: id,
            metadata: { imageId: image.id },
          },
        });
        return image;
      });
    } catch (error) {
      try {
        await deleteCloudinaryImage(asset.cloudinaryPublicId);
      } catch (cleanupError) {
        throw new AggregateError([error, cleanupError], 'No se pudo completar ni revertir la carga de la imagen.');
      }
      throw error;
    }
  },

  async deleteProductImage(productId, imageId, actor) {
    const image = await prisma.productImage.findFirst({
      where: { id: imageId, productId, product: { deletedAt: null } },
      include: { product: { select: { name: true } } },
    });
    if (!image) return null;

    await deleteCloudinaryImage(image.cloudinaryPublicId);
    return prisma.$transaction(async (tx) => {
      const deleted = await tx.productImage.deleteMany({ where: { id: imageId, productId } });
      if (!deleted.count) return null;

      if (image.isPrimary) {
        await tx.productImage.updateMany({ where: { productId }, data: { isPrimary: false } });
        const nextPrimary = await tx.productImage.findFirst({
          where: { productId },
          orderBy: { sortOrder: 'asc' },
          select: { id: true },
        });
        if (nextPrimary) {
          await tx.productImage.update({
            where: { id: nextPrimary.id },
            data: { isPrimary: true },
          });
        }
      }

      await tx.activityLog.create({
        data: {
          actorId: actor.id,
          actorEmail: actor.email,
          action: 'PRODUCT_IMAGE_DELETE',
          description: `Imagen eliminada del producto: ${image.product.name}`,
          entityType: 'Product',
          entityId: productId,
          metadata: { imageId },
        },
      });
      return tx.productImage.findMany({ where: { productId }, orderBy: imageOrder });
    });
  },

  async createCategory(data, actor) {
    return prisma.$transaction(async (tx) => {
      const category = await tx.category.create({
        data: {
          ...data,
          slug: slugify(data.slug || data.name),
        },
      });
      await tx.activityLog.create({
        data: {
          actorId: actor.id,
          actorEmail: actor.email,
          action: 'CATEGORY_CREATE',
          description: `Categoría creada: ${category.name}`,
          entityType: 'Category',
          entityId: category.id,
        },
      });
      return category;
    });
  },

  listAdminCategories() {
    return prisma.category.findMany({ orderBy: { name: 'asc' } });
  },
};
