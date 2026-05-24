/**
 * Upload Manager — provider-agnostic upload orchestrator.
 *
 * Selects the active storage adapter based on environment:
 *   STORAGE_PROVIDER=cloudinary  → Cloudinary adapter
 *   STORAGE_PROVIDER=local       → Local disk adapter
 *   (default)                    → Cloudinary if env vars present, local otherwise
 *
 * Switching providers: set STORAGE_PROVIDER in .env and restart.
 * No code changes required — every caller goes through this module.
 *
 * To add S3 support:
 *   1. Create src/shared/upload/adapters/s3.adapter.js (same interface)
 *   2. Add `case 's3': return s3Adapter;` to getAdapter()
 *   3. Set STORAGE_PROVIDER=s3
 */

const cloudinaryAdapter = require('./adapters/cloudinary.adapter');
const localAdapter = require('./adapters/local.adapter');
const { AppError } = require('../../core/errors/AppError');
const { ERROR_CODES } = require('../../core/errors/error.codes');

// ─── Validation constants ────────────────────────────────────────────────────

const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

// ─── Adapter selection ───────────────────────────────────────────────────────

function getAdapter() {
  const provider = process.env.STORAGE_PROVIDER;

  if (provider === 'local') return localAdapter;
  if (provider === 'cloudinary') return cloudinaryAdapter;

  // Auto-detect: use Cloudinary if credentials are present, local otherwise.
  // This lets the dev environment work with zero cloud setup.
  return process.env.CLOUDINARY_CLOUD_NAME ? cloudinaryAdapter : localAdapter;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Upload an avatar image.
 * Validates file type + size, then delegates to the active adapter.
 *
 * @param {object} file     — express-fileupload file object (file.tempFilePath, file.mimetype, etc.)
 * @param {string} userId   — used in logging; adapters may use it for folder naming
 * @returns {{ url: string, publicId: string }}
 */
async function uploadAvatar(file, userId) {
  // Type check
  if (!ALLOWED_AVATAR_TYPES.includes(file.mimetype)) {
    throw AppError.badRequest(
      'Avatar must be a JPEG, PNG, or WebP image',
      ERROR_CODES.UNSUPPORTED_FILE_TYPE
    );
  }

  // Size check
  if (file.size > MAX_AVATAR_SIZE_BYTES) {
    throw AppError.badRequest(
      `Avatar must be smaller than ${MAX_AVATAR_SIZE_BYTES / (1024 * 1024)} MB`,
      ERROR_CODES.FILE_TOO_LARGE
    );
  }

  const adapter = getAdapter();

  return adapter.upload(file.tempFilePath, {
    subfolder: 'avatars',
    mimeType: file.mimetype,
    originalName: file.name || 'avatar',
    isAvatar: true,
  });
}

/**
 * Delete a previously uploaded file by its publicId.
 * Non-fatal — caller should not crash if deletion fails (file may already be gone).
 *
 * @param {string|null} publicId
 */
async function deleteUpload(publicId) {
  if (!publicId) return;
  const adapter = getAdapter();
  return adapter.remove(publicId).catch(() => {});
}

/**
 * Returns the name of the currently active storage provider.
 * Useful for health checks and logging.
 */
function getProviderName() {
  const provider = process.env.STORAGE_PROVIDER;
  if (provider === 'local') return 'local';
  if (provider === 'cloudinary') return 'cloudinary';
  return process.env.CLOUDINARY_CLOUD_NAME ? 'cloudinary' : 'local';
}

module.exports = { uploadAvatar, deleteUpload, getProviderName };
