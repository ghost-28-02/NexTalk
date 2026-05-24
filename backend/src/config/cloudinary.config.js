const cloudinary = require('cloudinary').v2;

function connectCloudinary() {
  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    console.warn('[Cloudinary] Skipped — env vars not set');
    return;
  }
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  console.log('[Cloudinary] Connected');
}

module.exports = { cloudinary, connectCloudinary };
