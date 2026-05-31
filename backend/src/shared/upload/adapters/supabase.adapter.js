/**
 * Supabase Storage Adapter — for file/document uploads.
 *
 * Used for: PDF, Word, Excel, ZIP, and any non-media file type.
 * Images and videos continue to use Cloudinary (better CDN + transforms).
 *
 * Setup:
 *   1. Create a Supabase project at https://supabase.com (free)
 *   2. Go to Storage → Create a bucket named "nextalk-files" (set to Public)
 *   3. Add to your .env:
 *        SUPABASE_URL=https://xxxx.supabase.co
 *        SUPABASE_SERVICE_ROLE_KEY=your-service-role-key   ← Settings → API
 *        SUPABASE_BUCKET=nextalk-files
 *
 * Interface:
 *   upload(filePath, options) → Promise<{ url, publicId }>
 *   remove(publicId)         → Promise<void>
 *
 * publicId format: "supabase:{bucket}/{path}"
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

let _client = null;

function getClient() {
  if (_client) return _client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'Supabase storage not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env'
    );
  }

  _client = createClient(url, key);
  return _client;
}

function getBucket() {
  return process.env.SUPABASE_BUCKET || 'nextalk-files';
}

function generateStoragePath(originalName = 'file') {
  const ext  = path.extname(originalName) || '.bin';
  const base = path.basename(originalName, ext).replace(/[^a-z0-9]/gi, '_').slice(0, 40);
  const rand = crypto.randomBytes(6).toString('hex');
  const ts   = Date.now();
  // e.g. files/2024_report_1716465123456_a3b2c4d5.pdf
  return `files/${base}_${ts}_${rand}${ext}`;
}

async function upload(filePath, options = {}) {
  const { originalName = 'file', mimeType = 'application/octet-stream' } = options;

  const supabase    = getClient();
  const bucket      = getBucket();
  const storagePath = generateStoragePath(originalName);

  const fileBuffer = fs.readFileSync(filePath);

  const { error } = await supabase.storage
    .from(bucket)
    .upload(storagePath, fileBuffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (error) throw new Error(`Supabase upload failed: ${error.message}`);

  // Get the public URL
  const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);

  return {
    url:      data.publicUrl,
    publicId: `supabase:${bucket}/${storagePath}`,
  };
}

async function remove(publicId) {
  if (!publicId || !publicId.startsWith('supabase:')) return;

  try {
    const supabase = getClient();
    // publicId = "supabase:{bucket}/{path}"
    const withoutPrefix = publicId.replace('supabase:', '');
    const slashIdx      = withoutPrefix.indexOf('/');
    const bucket        = withoutPrefix.slice(0, slashIdx);
    const storagePath   = withoutPrefix.slice(slashIdx + 1);

    await supabase.storage.from(bucket).remove([storagePath]);
  } catch {
    // Non-fatal — file may already be deleted
  }
}

module.exports = { upload, remove };
