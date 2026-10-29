const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

// Auto-create uploads directories
const UPLOADS_DIR = path.join(__dirname, '../../uploads');
const THUMBS_DIR = path.join(UPLOADS_DIR, 'thumbnails');
[UPLOADS_DIR, THUMBS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ⚠️  EPHEMERAL STORAGE WARNING
// Files are written to local disk, which is wiped on every Render/Heroku
// redeploy and on container restarts. For production-grade uploads, swap
// `compressAndSave` to write to S3 / Cloudflare R2 / Supabase Storage and
// return the CDN URL. Until then, every redeploy deletes user uploads.
if (process.env.NODE_ENV === 'production' && !process.env.S3_BUCKET) {
  logger.warn('[uploads] Local disk storage in production — uploads will be lost on redeploy. Configure S3_BUCKET (or equivalent object storage) and swap compressAndSave().');
}

// Use memory storage so we can process with sharp before saving
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, WebP and GIF images are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 25 * 1024 * 1024 } // Hardcoded 25MB raw input max
});

/**
 * Compress and save an image buffer using sharp
 * - Converts to WebP for best size/quality ratio
 * - Creates a thumbnail version (300px wide)
 * - Returns { filename, url, thumbnail_url }
 */
async function compressAndSave(buffer, originalName, req) {
  const id = uuidv4();
  const ext = '.webp';
  const filename = `${id}${ext}`;
  const thumbFilename = `thumb_${id}${ext}`;

  // Main image: resize to max 1600px wide, quality 82 (good balance)
  await sharp(buffer)
    .resize({ width: 1600, height: 1200, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(path.join(UPLOADS_DIR, filename));

  // Thumbnail: 300px wide, quality 70
  await sharp(buffer)
    .resize({ width: 300, height: 300, fit: 'cover' })
    .webp({ quality: 70 })
    .toFile(path.join(THUMBS_DIR, thumbFilename));

  // Persist RELATIVE URLs ("/uploads/<file>") so links keep working when the
  // API host changes (staging↔prod, custom domain, http↔https). The current
  // request host is still surfaced in the response as a convenience for the
  // immediate uploader, but storage-layer references should use the relative
  // form. The deletion ACL already matches by `%/uploads/<filename>` suffix
  // which works for both shapes.
  const relativeUrl = `/uploads/${filename}`;
  const relativeThumb = `/uploads/thumbnails/${thumbFilename}`;
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  return {
    filename,
    url: relativeUrl,
    thumbnail_url: relativeThumb,
    absolute_url: `${baseUrl}${relativeUrl}`,
    absolute_thumbnail_url: `${baseUrl}${relativeThumb}`,
  };
}

/**
 * POST /api/uploads/single
 */
async function uploadSingle(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const result = await compressAndSave(req.file.buffer, req.file.originalname, req);
    res.json(result);
  } catch (err) {
    logger.error('Upload error:', err.message);
    res.status(500).json({ error: 'Image processing failed' });
  }
}

/**
 * POST /api/uploads/multiple
 */
async function uploadMultiple(req, res) {
  try {
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files uploaded' });

    const results = await Promise.all(
      req.files.map(f => compressAndSave(f.buffer, f.originalname, req))
    );

    res.json({
      images: results,
      urls: results.map(r => r.url),
      thumbnails: results.map(r => r.thumbnail_url)
    });
  } catch (err) {
    logger.error('Upload error:', err.message);
    res.status(500).json({ error: 'Image processing failed' });
  }
}

/**
 * DELETE /api/uploads/:filename
 *
 * ACL: only the user that owns the listing/garage referencing this file (or an
 * admin) may delete it. We resolve ownership by scanning known referencing
 * tables for the public URL.
 */
async function deleteFile(req, res, next) {
  try {
    const { filename } = req.params;
    // Security: prevent path traversal
    const safeName = path.basename(filename);
    const filePath = path.join(UPLOADS_DIR, safeName);
    const thumbPath = path.join(THUMBS_DIR, `thumb_${safeName}`);

    const { query } = require('../config/database');

    // Look up admin role (admins may delete anything).
    let isAdmin = false;
    try {
      const r = await query("SELECT 1 FROM user_roles WHERE user_id = $1 AND role = 'admin'", [req.user.id]);
      isAdmin = r.rows.length > 0;
    } catch { /* table missing — treat as non-admin */ }

    if (!isAdmin) {
      // Match ownership by filename suffix (`%/uploads/<filename>`) so URLs
      // stored from a different host (dev↔prod, http↔https, custom domain)
      // still resolve correctly. We do NOT trust req.protocol/req.host here.
      const urlSuffix = `%/uploads/${safeName}`;
      let owned = false;

      try {
        // Postgres array LIKE — wrap in a subquery that unnests the images[]
        // and matches each entry against the suffix.
        const owns = await query(
          `SELECT 1 FROM listings
            WHERE user_id = $1
              AND EXISTS (SELECT 1 FROM unnest(COALESCE(images, ARRAY[]::text[])) AS img WHERE img LIKE $2)
            LIMIT 1`,
          [req.user.id, urlSuffix]
        );
        owned = owns.rows.length > 0;
      } catch { /* ignore */ }

      if (!owned) {
        try {
          const av = await query(
            `SELECT 1 FROM users WHERE id = $1 AND avatar_url LIKE $2 LIMIT 1`,
            [req.user.id, urlSuffix]
          );
          owned = av.rows.length > 0;
        } catch { /* ignore */ }
      }
      if (!owned) {
        try {
          const g = await query(
            `SELECT 1 FROM garages
              WHERE owner_id = $1
                AND (image LIKE $2
                     OR EXISTS (SELECT 1 FROM unnest(COALESCE(images, ARRAY[]::text[])) AS img WHERE img LIKE $2))
              LIMIT 1`,
            [req.user.id, urlSuffix]
          );
          owned = g.rows.length > 0;
        } catch { /* ignore */ }
      }
      if (!owned) {
        return res.status(403).json({ error: 'You do not own this file' });
      }
    }

    [filePath, thumbPath].forEach(p => {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    });

    res.json({ message: 'File deleted' });
  } catch (err) { next(err); }
}

module.exports = { upload, uploadSingle, uploadMultiple, deleteFile, compressAndSave };
