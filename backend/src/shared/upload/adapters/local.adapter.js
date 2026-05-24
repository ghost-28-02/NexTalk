/**
 * Local File Storage Adapter
 *
 * Stores uploaded files on disk under {cwd}/uploads/{subfolder}/.
 * Served as static assets via Express: GET /uploads/{subfolder}/{filename}.
 *
 * Active when:  STORAGE_PROVIDER=local  OR  Cloudinary env vars are absent.
 * Purpose:      Zero-credential dev environment — no cloud account needed.
 *
 * Implements the standard upload adapter interface:
 *   upload(filePath, options) → Promise<{ url, publicId }>
 *   remove(publicId)         → Promise<void>
 *
 * publicId format: "local:{subfolder}/{filename}"
 * — The "local:" prefix lets remove() identify local files and avoid
 *   accidentally calling cloudinary.destroy() on local paths.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const UPLOADS_ROOT = path.join(process.cwd(), 'uploads');

/** Map MIME type to a canonical file extension. */
const MIME_TO_EXT = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

function resolveExtension(mimeType, originalName = '') {
  return MIME_TO_EXT[mimeType] || path.extname(originalName) || '.bin';
}

/**
 * Generates a collision-proof filename:
 *   {timestamp}_{8-hex-random}{ext}
 * Example: 1716465123456_a3b2c4d5.jpg
 */
function generateFilename(mimeType, originalName) {
  const ext = resolveExtension(mimeType, originalName);
  const rand = crypto.randomBytes(4).toString('hex');
  return `${Date.now()}_${rand}${ext}`;
}

async function upload(filePath, options = {}) {
  const { subfolder = 'general', mimeType = '', originalName = 'file' } = options;

  const dir = path.join(UPLOADS_ROOT, subfolder);
  fs.mkdirSync(dir, { recursive: true });

  const filename = generateFilename(mimeType, originalName);
  const dest = path.join(dir, filename);

  // Copy rather than rename — source may be in /tmp which could be
  // on a different filesystem (EXDEV: cross-device link not permitted).
  fs.copyFileSync(filePath, dest);

  const baseUrl = process.env.API_URL || `http://localhost:${process.env.PORT || 4000}`;
  const url = `${baseUrl}/uploads/${subfolder}/${filename}`;
  const publicId = `local:${subfolder}/${filename}`;

  return { url, publicId };
}

async function remove(publicId) {
  if (!publicId || !publicId.startsWith('local:')) return;

  const relativePath = publicId.replace('local:', '');
  const filePath = path.join(UPLOADS_ROOT, relativePath);

  try {
    fs.unlinkSync(filePath);
  } catch {
    // File already deleted or path invalid — non-fatal
  }
}

module.exports = { upload, remove };
