import multer from 'multer';
import { fileTypeFromBuffer } from 'file-type';
import { asyncHandler } from '../utils/asyncHandler.js';
import { httpError } from '../utils/httpError.js';

const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
    fields: 0,
    parts: 1,
  },
});

export const validateImageBuffer = async (buffer, declaredMimeType) => {
  const detectedType = await fileTypeFromBuffer(buffer);
  if (!detectedType || !allowedImageTypes.has(detectedType.mime) || detectedType.mime !== declaredMimeType) {
    throw httpError(400, 'El archivo debe ser una imagen JPEG, PNG o WebP válida.');
  }
  return detectedType;
};

export const receiveProductImage = (req, res, next) => {
  upload.single('image')(req, res, (error) => {
    if (error instanceof multer.MulterError) {
      const message = error.code === 'LIMIT_FILE_SIZE'
        ? 'Cada imagen puede pesar como máximo 5 MB.'
        : 'Envía una sola imagen por solicitud.';
      return next(httpError(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400, message));
    }
    next(error);
  });
};

export const validateProductImage = asyncHandler(async (req, res, next) => {
  if (!req.file) throw httpError(400, 'Selecciona un archivo de imagen.');
  await validateImageBuffer(req.file.buffer, req.file.mimetype);
  next();
});
