import { v2 as cloudinary } from 'cloudinary';
import { env } from './env.js';
import { httpError } from '../utils/httpError.js';

const credentials = [
  env.CLOUDINARY_CLOUD_NAME,
  env.CLOUDINARY_API_KEY,
  env.CLOUDINARY_API_SECRET,
];

export const cloudinaryConfigured = credentials.every((value) => (
  value && value.toLowerCase() !== 'replace-me'
));

if (cloudinaryConfigured) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export const uploadCloudinaryImage = (buffer, folder) => {
  if (!cloudinaryConfigured) {
    throw httpError(503, 'La carga de imágenes no está configurada. Contacta al administrador.');
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({
      folder,
      resource_type: 'image',
      overwrite: false,
      transformation: [{ quality: 'auto', fetch_format: 'auto' }],
    }, (error, result) => {
      if (error) {
        reject(error);
        return;
      }
      if (!result?.secure_url || !result.public_id) {
        reject(new Error('Cloudinary no devolvió los metadatos esperados de la imagen.'));
        return;
      }
      resolve({ url: result.secure_url, cloudinaryPublicId: result.public_id });
    });
    stream.end(buffer);
  });
};

export const deleteCloudinaryImage = async (publicId) => {
  if (!cloudinaryConfigured) {
    throw httpError(503, 'La gestión de imágenes no está configurada. Contacta al administrador.');
  }
  const result = await cloudinary.uploader.destroy(publicId, {
    resource_type: 'image',
    invalidate: true,
  });
  if (!['ok', 'not found'].includes(result.result)) {
    throw new Error('Cloudinary no confirmó la eliminación de la imagen.');
  }
};
