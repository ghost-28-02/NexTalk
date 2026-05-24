/**
 * Cloudinary Upload Adapter
 *
 * Wraps the existing cloudinary config — does NOT duplicate configuration.
 * Implements the standard upload adapter interface:
 *   upload(filePath, options) → Promise<{ url, publicId }>
 *   remove(publicId)         → Promise<void>
 *
 * FUTURE: add `uploadMedia(filePath, options)` when video/audio support is needed.
 */

const { cloudinary } = require('../../../config/cloudinary.config');

const FOLDER = process.env.FOLDER_NAME || 'NexTalk';

const DEFAULT_IMAGE_TRANSFORM = [
  { width: 800, crop: 'limit', quality: 'auto', fetch_format: 'auto' },
];

const AVATAR_TRANSFORM = [
  { width: 400, height: 400, crop: 'fill', gravity: 'face', quality: 'auto', fetch_format: 'auto' },
];

/**
 * @param {string} filePath   — temp file path from express-fileupload
 * @param {object} options
 *   @param {string}   options.subfolder     — e.g. 'avatars', 'media'
 *   @param {string}   options.mimeType      — used only by local adapter; ignored here
 *   @param {string}   options.originalName  — used only by local adapter; ignored here
 *   @param {boolean}  options.isAvatar      — applies face-crop transformation
 */
async function upload(filePath, options = {}) {
  const { subfolder = 'general', isAvatar = false } = options;
  const transformation = isAvatar ? AVATAR_TRANSFORM : DEFAULT_IMAGE_TRANSFORM;

  const result = await cloudinary.uploader.upload(filePath, {
    folder: `${FOLDER}/${subfolder}`,
    resource_type: 'image',
    transformation,
  });

  return { url: result.secure_url, publicId: result.public_id };
}

async function remove(publicId) {
  if (!publicId) return;
  await cloudinary.uploader.destroy(publicId);
}

module.exports = { upload, remove };
