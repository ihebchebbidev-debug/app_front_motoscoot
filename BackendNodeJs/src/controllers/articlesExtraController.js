const { query } = require('../config/database');

function bySlugOrId(val) {
  const isId = /^\d+$/.test(String(val));
  return { where: isId ? 'id = $1' : 'slug = $1', value: isId ? parseInt(val, 10) : val };
}

// Bots / crawlers shouldn't bump article views — match what listingsController does.
const BOT_UA_RE = /(bot|spider|crawler|crawling|preview|facebookexternalhit|whatsapp|slurp|baiduspider|yandex|duckduckbot|bingbot|googlebot)/i;

async function trackView(req, res, next) {
  try {
    const { where, value } = bySlugOrId(req.params.slug);
    const a = await query(`SELECT id FROM articles WHERE ${where}`, [value]);
    if (a.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    // Bot guard
    const ua = String(req.headers['user-agent'] || '');
    if (BOT_UA_RE.test(ua)) return res.json({ success: true, skipped: 'bot' });

    const articleId = a.rows[0].id;
    const userId = req.user?.id || null;
    const fingerprint = req.body?.fingerprint || null;

    // Dedupe within 1 hour by (article, user) OR (article, fingerprint).
    // If neither user nor fingerprint is provided, we skip the count entirely
    // — anonymous-no-fingerprint hits are too easy to spam.
    if (!userId && !fingerprint) {
      return res.json({ success: true, skipped: 'no_identity' });
    }
    try {
      const dupe = await query(
        `SELECT 1 FROM article_views
          WHERE article_id = $1
            AND viewed_at > NOW() - INTERVAL '1 hour'
            AND ((user_id IS NOT NULL AND user_id = $2)
              OR (user_id IS NULL AND fingerprint = $3))
          LIMIT 1`,
        [articleId, userId, fingerprint]
      );
      if (dupe.rows.length > 0) return res.json({ success: true, skipped: 'dedupe' });
    } catch (e) {
      // 42703 = column missing (e.g. viewed_at not present yet) — fall through
      if (!e || e.code !== '42703') throw e;
    }

    await query(
      'INSERT INTO article_views (article_id, user_id, fingerprint) VALUES ($1,$2,$3)',
      [articleId, userId, fingerprint]
    );
    await query('UPDATE articles SET views_count = views_count + 1 WHERE id = $1', [articleId]);
    res.json({ success: true });
  } catch (e) { next(e); }
}

async function toggleLike(req, res, next) {
  try {
    const { where, value } = bySlugOrId(req.params.slug);
    const a = await query(`SELECT id FROM articles WHERE ${where}`, [value]);
    if (a.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const articleId = a.rows[0].id;
    // Atomic like / unlike — single round trip prevents the SELECT-then-INSERT
    // race where two concurrent calls both see "no row" and double-insert.
    const ins = await query(
      `INSERT INTO article_likes (article_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (article_id, user_id) DO NOTHING
       RETURNING id`,
      [articleId, req.user.id]
    );
    if (ins.rowCount === 0) {
      // Already liked → toggle off
      await query('DELETE FROM article_likes WHERE article_id = $1 AND user_id = $2', [articleId, req.user.id]);
      await query('UPDATE articles SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = $1', [articleId]);
      return res.json({ liked: false });
    }
    await query('UPDATE articles SET likes_count = likes_count + 1 WHERE id = $1', [articleId]);
    res.json({ liked: true });
  } catch (e) { next(e); }
}

async function getComments(req, res, next) {
  try {
    const { where, value } = bySlugOrId(req.params.slug);
    const a = await query(`SELECT id FROM articles WHERE ${where}`, [value]);
    if (a.rows.length === 0) return res.json([]);
    const { rows } = await query(
      `SELECT c.*, u.full_name AS author_name, u.avatar_url AS author_avatar
       FROM article_comments c JOIN users u ON c.user_id = u.id
       WHERE c.article_id = $1 AND c.is_deleted = FALSE
       ORDER BY c.created_at DESC`, [a.rows[0].id]
    );
    res.json(rows);
  } catch (e) { next(e); }
}

async function addComment(req, res, next) {
  try {
    const { content, parent_id } = req.body;
    if (!content) return res.status(400).json({ error: 'content required' });
    const { where, value } = bySlugOrId(req.params.slug);
    const a = await query(`SELECT id FROM articles WHERE ${where}`, [value]);
    if (a.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const { rows } = await query(
      `INSERT INTO article_comments (article_id, user_id, parent_id, content)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [a.rows[0].id, req.user.id, parent_id || null, content]
    );
    await query('UPDATE articles SET comments_count = comments_count + 1 WHERE id = $1', [a.rows[0].id]);
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
}

async function deleteComment(req, res, next) {
  try {
    const c = await query('SELECT user_id, article_id, is_deleted FROM article_comments WHERE id = $1', [req.params.commentId]);
    if (c.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    // Allow author OR admin to delete; idempotent so repeated calls don't
    // double-decrement comments_count.
    let isAdmin = false;
    try {
      const ar = await query(
        "SELECT 1 FROM user_roles WHERE user_id = $1 AND role IN ('admin','moderator')",
        [req.user.id]
      );
      isAdmin = ar.rows.length > 0;
    } catch { /* ignore */ }
    if (!isAdmin && String(c.rows[0].user_id) !== String(req.user.id)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (c.rows[0].is_deleted) {
      return res.json({ success: true, already: true });
    }
    await query('UPDATE article_comments SET is_deleted = TRUE WHERE id = $1 AND is_deleted = FALSE', [req.params.commentId]);
    await query('UPDATE articles SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = $1', [c.rows[0].article_id]);
    res.json({ success: true });
  } catch (e) { next(e); }
}

async function getFeatured(req, res, next) {
  try {
    const { rows } = await query(
      `SELECT * FROM articles WHERE is_published = TRUE AND is_featured = TRUE
       ORDER BY published_at DESC LIMIT 6`
    );
    res.json(rows);
  } catch (e) { next(e); }
}

async function getRelated(req, res, next) {
  try {
    const { where, value } = bySlugOrId(req.params.slug);
    const a = await query(`SELECT id, category FROM articles WHERE ${where}`, [value]);
    if (a.rows.length === 0) return res.json([]);
    const { rows } = await query(
      `SELECT id, slug, title, image, category, summary, published_at, read_time
       FROM articles WHERE is_published = TRUE AND id != $1 AND category = $2
       ORDER BY published_at DESC LIMIT 4`,
      [a.rows[0].id, a.rows[0].category]
    );
    res.json(rows);
  } catch (e) { next(e); }
}

async function getCategories(_req, res, next) {
  try {
    const { rows } = await query(
      `SELECT category, COUNT(*)::int AS n FROM articles
       WHERE is_published = TRUE GROUP BY category ORDER BY n DESC`
    );
    res.json(rows.map(r => r.category));
  } catch (e) { next(e); }
}

module.exports = {
  trackView, toggleLike, getComments, addComment, deleteComment,
  getFeatured, getRelated, getCategories
};
