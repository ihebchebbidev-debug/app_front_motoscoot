const { query } = require('../config/database');
const { makeTrackView } = require('../utils/contentViews');

function bySlugOrId(val) {
  const isId = /^\d+$/.test(String(val));
  return { where: isId ? 'id = $1' : 'slug = $1', value: isId ? parseInt(val, 10) : val };
}


// Views: privacy-friendly daily-unique counter shared with articles.
const trackView = makeTrackView('tips');

async function toggleLike(req, res, next) {
  try {
    const { where, value } = bySlugOrId(req.params.slug);
    const t = await query(`SELECT id FROM tips WHERE ${where}`, [value]);
    if (t.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const tipId = t.rows[0].id;
    const ins = await query(
      `INSERT INTO tip_likes (tip_id, user_id) VALUES ($1, $2)
       ON CONFLICT (tip_id, user_id) DO NOTHING RETURNING id`,
      [tipId, req.user.id]
    );
    if (ins.rowCount === 0) {
      await query('DELETE FROM tip_likes WHERE tip_id = $1 AND user_id = $2', [tipId, req.user.id]);
      await query('UPDATE tips SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = $1', [tipId]);
      return res.json({ liked: false });
    }
    await query('UPDATE tips SET likes_count = likes_count + 1 WHERE id = $1', [tipId]);
    res.json({ liked: true });
  } catch (e) { next(e); }
}

async function toggleBookmark(req, res, next) {
  try {
    const { where, value } = bySlugOrId(req.params.slug);
    const t = await query(`SELECT id FROM tips WHERE ${where}`, [value]);
    if (t.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const tipId = t.rows[0].id;
    const ins = await query(
      `INSERT INTO tip_bookmarks (tip_id, user_id) VALUES ($1, $2)
       ON CONFLICT (tip_id, user_id) DO NOTHING RETURNING id`,
      [tipId, req.user.id]
    );
    if (ins.rowCount === 0) {
      await query('DELETE FROM tip_bookmarks WHERE tip_id = $1 AND user_id = $2', [tipId, req.user.id]);
      await query('UPDATE tips SET bookmarks_count = GREATEST(bookmarks_count - 1, 0) WHERE id = $1', [tipId]);
      return res.json({ bookmarked: false });
    }
    await query('UPDATE tips SET bookmarks_count = bookmarks_count + 1 WHERE id = $1', [tipId]);
    res.json({ bookmarked: true });
  } catch (e) { next(e); }
}

async function getBookmarks(req, res, next) {
  try {
    const { rows } = await query(
      `SELECT t.* FROM tip_bookmarks b JOIN tips t ON b.tip_id = t.id
       WHERE b.user_id = $1 ORDER BY b.created_at DESC`, [req.user.id]
    );
    res.json(rows);
  } catch (e) { next(e); }
}

async function getRelated(req, res, next) {
  try {
    const { where, value } = bySlugOrId(req.params.slug);
    const t = await query(`SELECT id, category FROM tips WHERE ${where}`, [value]);
    if (t.rows.length === 0) return res.json([]);
    const { rows } = await query(
      `SELECT id, slug, title, image, category, summary, read_time, difficulty
       FROM tips WHERE is_published = TRUE AND id != $1 AND category = $2
       ORDER BY published_at DESC LIMIT 4`,
      [t.rows[0].id, t.rows[0].category]
    );
    res.json(rows);
  } catch (e) { next(e); }
}

async function getFeatured(_req, res, next) {
  try {
    const { rows } = await query(
      `SELECT * FROM tips WHERE is_published = TRUE
       ORDER BY views_count DESC, published_at DESC LIMIT 6`
    );
    res.json(rows);
  } catch (e) { next(e); }
}

async function getCategories(_req, res, next) {
  try {
    const { rows } = await query(
      `SELECT category, COUNT(*)::int AS n FROM tips
       WHERE is_published = TRUE GROUP BY category ORDER BY n DESC`
    );
    res.json(rows.map(r => r.category));
  } catch (e) { next(e); }
}

module.exports = {
  trackView, toggleLike, toggleBookmark, getBookmarks,
  getRelated, getFeatured, getCategories
};
