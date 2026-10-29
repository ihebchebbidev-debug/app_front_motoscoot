const { query } = require('../config/database');

async function getAll(req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 12, 50);
    const { rows } = await query(
      `SELECT id, name, role, avatar_url, content, rating, created_at, is_admin_entry
       FROM site_reviews WHERE is_published = TRUE
       ORDER BY created_at DESC LIMIT $1`, [limit]
    );
    res.json(rows);
  } catch (e) { next(e); }
}

async function create(req, res, next) {
  try {
    const { content, rating = 5, role } = req.body;
    if (!content) return res.status(400).json({ error: 'content required' });
    if (typeof content !== 'string' || content.trim().length < 5) {
      return res.status(400).json({ error: 'content must be at least 5 characters' });
    }
    const ratingNum = Number(rating);
    if (!Number.isFinite(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ error: 'rating must be between 1 and 5' });
    }
    const userRes = await query('SELECT full_name, avatar_url FROM users WHERE id = $1', [req.user.id]);
    const user = userRes.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { rows } = await query(
      `INSERT INTO site_reviews (user_id, name, role, avatar_url, content, rating, is_published)
       VALUES ($1,$2,$3,$4,$5,$6,FALSE) RETURNING *`,
      [req.user.id, user.full_name, role || null, user.avatar_url, content.trim(), ratingNum]
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
}

async function adminPublish(req, res, next) {
  try {
    const { is_published } = req.body;
    if (typeof is_published !== 'boolean') {
      return res.status(400).json({ error: 'is_published (boolean) required' });
    }
    const { rows } = await query(
      'UPDATE site_reviews SET is_published = $1 WHERE id = $2 RETURNING *',
      [is_published, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Review not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
}

async function remove(req, res, next) {
  try {
    await query('DELETE FROM site_reviews WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { next(e); }
}

/** POST /admin/site-reviews — admin authors a testimonial directly. */
async function adminCreate(req, res, next) {
  try {
    const { name, role, content, rating = 5, avatar_url, is_published = true, created_at } = req.body || {};
    if (!name || !String(name).trim()) return res.status(400).json({ error: 'name required' });
    if (!content || String(content).trim().length < 5) return res.status(400).json({ error: 'content must be at least 5 characters' });
    const r = Number(rating);
    if (!Number.isInteger(r) || r < 1 || r > 5) return res.status(400).json({ error: 'rating must be between 1 and 5' });
    const date = created_at && !Number.isNaN(Date.parse(created_at)) ? new Date(created_at) : new Date();
    const { rows } = await query(
      `INSERT INTO site_reviews (user_id, name, role, avatar_url, content, rating, is_published, is_admin_entry, created_at)
       VALUES (NULL,$1,$2,$3,$4,$5,$6,TRUE,$7) RETURNING *`,
      [String(name).trim().slice(0, 100), role ? String(role).slice(0, 100) : null, avatar_url || null,
       String(content).trim(), r, is_published !== false, date]
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
}

/** Public aggregate used for JSON-LD aggregateRating. */
async function getSummary(_req, res, next) {
  try {
    const { rows } = await query(
      `SELECT COUNT(*)::int AS count, COALESCE(ROUND(AVG(rating)::numeric, 1), 0)::float AS average
         FROM site_reviews WHERE is_published = TRUE`);
    res.json(rows[0]);
  } catch (e) { next(e); }
}

module.exports = { getAll, create, adminPublish, remove, adminCreate, getSummary };
