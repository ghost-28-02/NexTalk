const { cloudinary } = require('../../config/cloudinary.config');

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm'];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_VIDEO_SIZE = 50 * 1024 * 1024;

const FOLDER = process.env.FOLDER_NAME || 'NexTalk';

async function uploadImage(filePath, subfolder = 'avatars') {
  const result = await cloudinary.uploader.upload(filePath, {
    folder: `${FOLDER}/${subfolder}`,
    resource_type: 'image',
    transformation: [{ width: 800, crop: 'limit', quality: 'auto' }],
  });
  return { url: result.secure_url, publicId: result.public_id };
}

async function uploadMedia(filePath, subfolder = 'media') {
  const result = await cloudinary.uploader.upload(filePath, {
    folder: `${FOLDER}/${subfolder}`,
    resource_type: 'auto',
  });
  return { url: result.secure_url, publicId: result.public_id };
}

async function deleteFile(publicId) {
  return cloudinary.uploader.destroy(publicId);
}

function validateImageFile(file) {
  if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    return 'Only JPEG, PNG, WebP, and GIF images are allowed';
  }
  if (file.size > MAX_IMAGE_SIZE) {
    return 'Image must be smaller than 5MB';
  }
  return null;
}

function validateVideoFile(file) {
  if (!ALLOWED_VIDEO_TYPES.includes(file.mimetype)) {
    return 'Only MP4 and WebM videos are allowed';
  }
  if (file.size > MAX_VIDEO_SIZE) {
    return 'Video must be smaller than 50MB';
  }
  return null;
}

module.exports = {
  uploadImage,
  uploadMedia,
  deleteFile,
  validateImageFile,
  validateVideoFile,
};
