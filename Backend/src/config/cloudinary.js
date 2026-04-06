// src/config/cloudinary.js
const cloudinary = require('cloudinary').v2;
const env = require('./env');
const logger = require('./logger');

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure: true, // always HTTPS URLs
});

/**
 * Upload a buffer directly to Cloudinary (no temp files on disk).
 * Returns the upload result with url + public_id.
 */
const uploadBuffer = (buffer, options = {}) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'image',
        ...options,
      },
      (error, result) => {
        if (error) {
          logger.error('Cloudinary upload failed', { error: error.message });
          return reject(new Error(`Cloudinary upload failed: ${error.message}`));
        }
        resolve(result);
      }
    );
    uploadStream.end(buffer);
  });
};

/**
 * Delete an asset from Cloudinary by public_id.
 * Called when avatar is replaced or user is deleted.
 */
const deleteAsset = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    logger.debug('Cloudinary asset deleted', { publicId, result: result.result });
    return result;
  } catch (err) {
    // Log but don't throw — orphaned Cloudinary files are not critical
    logger.warn('Cloudinary delete failed', { publicId, error: err.message });
  }
};

module.exports = { cloudinary, uploadBuffer, deleteAsset };