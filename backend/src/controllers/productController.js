import { asyncHandler } from '../utils/asyncHandler.js';
import { productService } from '../services/productService.js';

export const listPublicProducts = asyncHandler(async (req, res) => {
  res.json(await productService.listPublicProducts(req.validated));
});

export const getPublicProduct = asyncHandler(async (req, res) => {
  const product = await productService.getPublicProductBySlug(req.params.slug);
  if (!product) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Producto no encontrado.' } });
  }
  res.json(product);
});

export const listPublicCategories = asyncHandler(async (req, res) => {
  res.json(await productService.listPublicCategories());
});

export const listAdminProducts = asyncHandler(async (req, res) => {
  res.json(await productService.listAdminProducts(req.validated));
});

export const getAdminProduct = asyncHandler(async (req, res) => {
  const product = await productService.getAdminProduct(req.params.id);
  if (!product) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Producto no encontrado.' } });
  }
  res.json(product);
});

export const createProduct = asyncHandler(async (req, res) => {
  res.status(201).json(await productService.createProduct(req.validated, req.session.user));
});

export const updateProduct = asyncHandler(async (req, res) => {
  const product = await productService.updateProduct(req.params.id, req.validated, req.session.user);
  if (!product) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Producto no encontrado.' } });
  }
  res.json(product);
});

export const archiveProduct = asyncHandler(async (req, res) => {
  const archived = await productService.archiveProduct(req.params.id, req.session.user);
  if (!archived) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Producto no encontrado.' } });
  }
  res.status(204).end();
});

export const uploadProductImage = asyncHandler(async (req, res) => {
  const image = await productService.uploadProductImage(req.params.id, req.file, req.session.user);
  if (!image) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Producto no encontrado.' } });
  }
  res.status(201).json({ image });
});

export const deleteProductImage = asyncHandler(async (req, res) => {
  const images = await productService.deleteProductImage(req.params.id, req.params.imageId, req.session.user);
  if (!images) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Imagen no encontrada.' } });
  }
  res.json({ items: images });
});

export const listAdminCategories = asyncHandler(async (req, res) => {
  res.json(await productService.listAdminCategories());
});

export const createCategory = asyncHandler(async (req, res) => {
  res.status(201).json(await productService.createCategory(req.validated, req.session.user));
});
