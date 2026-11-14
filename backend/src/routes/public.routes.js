import { Router } from 'express';
import { getPublicContact } from '../controllers/siteController.js';
import {
  getPublicProduct,
  listPublicCategories,
  listPublicProducts,
} from '../controllers/productController.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { publicProductListQuerySchema } from '../validators/productValidator.js';

const router = Router();

router.get('/contact', getPublicContact);
router.get('/products', validateRequest(publicProductListQuerySchema, 'query'), listPublicProducts);
router.get('/products/:slug', getPublicProduct);
router.get('/categories', listPublicCategories);

export { router as publicRouter };
