import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  archiveProduct,
  createCategory,
  createProduct,
  deleteProductImage,
  getAdminProduct,
  listAdminCategories,
  listAdminProducts,
  uploadProductImage,
  updateProduct,
} from '../controllers/productController.js';
import { cloudinaryConfigured } from '../config/cloudinary.js';
import { requireAuthentication } from '../middleware/requireAuthentication.js';
import { requireRole } from '../middleware/requireRole.js';
import { receiveProductImage, validateProductImage } from '../middleware/productImageUpload.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { csrfProtection } from '../auth/csrf.js';
import { userRouter } from './user.routes.js';
import {
  categorySchema,
  createProductSchema,
  adminProductListQuerySchema,
  updateProductSchema,
} from '../validators/productValidator.js';

const router = Router();
router.use(requireAuthentication, csrfProtection);

router.get('/uploads/status', requireRole('ADMIN', 'EDITOR'), (req, res) => {
  res.set('Cache-Control', 'no-store').json({ cloudinaryConfigured });
});
router.get('/products', validateRequest(adminProductListQuerySchema, 'query'), listAdminProducts);
router.post('/products', requireRole('ADMIN', 'EDITOR'), validateRequest(createProductSchema), createProduct);
router.get('/products/:id', requireRole('ADMIN', 'EDITOR'), getAdminProduct);
router.patch('/products/:id', requireRole('ADMIN', 'EDITOR'), validateRequest(updateProductSchema), updateProduct);
router.delete('/products/:id', requireRole('ADMIN', 'EDITOR'), archiveProduct);
router.post(
  '/products/:id/images',
  requireRole('ADMIN', 'EDITOR'),
  rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false }),
  receiveProductImage,
  validateProductImage,
  uploadProductImage,
);
router.delete('/products/:id/images/:imageId', requireRole('ADMIN', 'EDITOR'), deleteProductImage);
router.get('/categories', requireRole('ADMIN', 'EDITOR'), listAdminCategories);
router.post('/categories', requireRole('ADMIN', 'EDITOR'), validateRequest(categorySchema), createCategory);
router.use('/users', requireRole('ADMIN'), userRouter);

export { router as adminRouter };
