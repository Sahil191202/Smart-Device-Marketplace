// src/shared/middleware/upload.js
const multer = require('multer');
const AppError = require('../utils/AppError');

// ── Allowed MIME types per category ──────────────────────────────────────────
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_AVATAR_SIZE = 2 * 1024 * 1024;   // 2MB
const MAX_PRODUCT_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * Memory storage — files stored in req.file.buffer.
 * We upload directly from buffer to Cloudinary (no temp disk files).
 * 
 * Why memory over diskStorage?
 * - No cleanup needed (no temp files)
 * - Better for containerized environments (ephemeral filesystem)
 * - Slight RAM overhead — acceptable for image sizes we enforce
 */
const memoryStorage = multer.memoryStorage();

const imageFileFilter = (req, file, cb) => {
  if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    return cb(
      new AppError(
        `Invalid file type. Allowed: ${ALLOWED_IMAGE_TYPES.join(', ')}`,
        400,
        'INVALID_FILE_TYPE'
      ),
      false
    );
  }
  cb(null, true);
};

// ── Upload configurations ─────────────────────────────────────────────────────

const avatarUpload = multer({
  storage: memoryStorage,
  limits: {
    fileSize: MAX_AVATAR_SIZE,
    files: 1,
  },
  fileFilter: imageFileFilter,
}).single('avatar'); // field name must be 'avatar'

const productImageUpload = multer({
  storage: memoryStorage,
  limits: {
    fileSize: MAX_PRODUCT_IMAGE_SIZE,
    files: 5, // max 5 product images per upload
  },
  fileFilter: imageFileFilter,
}).array('images', 5); // field name 'images', max 5

/**
 * Wraps multer middleware to convert multer errors into AppErrors.
 * Multer errors bypass Express error handler if not wrapped.
 */
const wrapMulter = (multerMiddleware) => (req, res, next) => {
  multerMiddleware(req, res, (err) => {
    if (!err) return next();

    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(new AppError('File too large', 400, 'FILE_TOO_LARGE'));
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return next(new AppError('Too many files', 400, 'TOO_MANY_FILES'));
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return next(new AppError(`Unexpected field: ${err.field}`, 400, 'UNEXPECTED_FIELD'));
    }
    if (err instanceof AppError) return next(err);

    next(new AppError('File upload failed', 400, 'UPLOAD_FAILED'));
  });
};

module.exports = {
  uploadAvatar: wrapMulter(avatarUpload),
  uploadProductImages: wrapMulter(productImageUpload),
};