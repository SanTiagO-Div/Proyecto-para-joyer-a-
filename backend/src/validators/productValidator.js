import { z } from 'zod';

const productFields = {
  name: z.string().trim().min(2).max(150),
  description: z.string().trim().min(1).max(4000),
  material: z.string().trim().max(120).optional().nullable(),
  price: z.number().finite().min(0).max(9999999999.99).optional().nullable(),
  currency: z.string().trim().regex(/^[A-Z]{3}$/),
  showPrice: z.boolean(),
  availability: z.enum(['AVAILABLE', 'OUT_OF_STOCK', 'MADE_TO_ORDER']),
  publicationState: z.enum(['DRAFT', 'PUBLISHED', 'HIDDEN']),
  categoryId: z.string().trim().min(1),
  isActive: z.boolean(),
};

const productBase = z.object({
  ...productFields,
  currency: productFields.currency.default('COP'),
  showPrice: productFields.showPrice.default(false),
  availability: productFields.availability.default('AVAILABLE'),
  publicationState: productFields.publicationState.default('DRAFT'),
  isActive: productFields.isActive.default(true),
}).strict();

const priceVisibilityRule = (value, ctx) => {
  if (value.showPrice && value.price == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['price'],
      message: 'Indica un precio para poder mostrarlo.',
    });
  }
};

export const createProductSchema = productBase.superRefine(priceVisibilityRule);
export const updateProductSchema = z.object(productFields)
  .partial()
  .strict()
  .superRefine((value, ctx) => {
  if (value.showPrice === true && value.price === null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['price'],
      message: 'Indica un precio para poder mostrarlo.',
    });
  }
  });

const commonListQuery = {
  categoryId: z.string().trim().min(1).optional(),
  q: z.string().trim().max(100).optional(),
  availability: z.enum(['AVAILABLE', 'OUT_OF_STOCK', 'MADE_TO_ORDER']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
};

export const publicProductListQuerySchema = z.object(commonListQuery).strict();
export const adminProductListQuerySchema = z.object({
  ...commonListQuery,
  publicationState: z.enum(['DRAFT', 'PUBLISHED', 'HIDDEN']).optional(),
  isActive: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
}).strict();

export const categorySchema = z.object({
  name: z.string().trim().min(2).max(100),
  slug: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(500).optional().nullable(),
  isActive: z.boolean().default(true),
}).strict();
