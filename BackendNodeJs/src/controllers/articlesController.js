const { query } = require('../config/database');
const { buildUpdate, parsePagination, paginationMeta, validateRequired } = require('../utils/queryHelpers');

/** Accept both a numeric id (e.g. "42") and a text slug. */
function bySlugOrId(val) {
  const value = String(val);
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) return { where: 'a.id = $1::uuid', value };
  return { where: /^\d+$/.test(value) ? 'a.id::text = $1' : 'a.slug = $1', value };
}

const ARTICLE_FIELDS = ['title', 'slug', 'summary', 'content', 'category', 'image', 'tags', 'is_featured', 'is_published', 'read_time'];

async function getAll(req, res, next) {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const { category, featured } = req.query;
    const params = []; const conditions = ['a.is_published = true']; let idx = 1;

    if (category) { conditions.push(`a.category = $${idx++}`); params.push(category); }
    if (featured === 'true') conditions.push('a.is_featured = true');

    const where = `WHERE ${conditions.join(' AND ')}`;
    const countRes = await query(`SELECT COUNT(*) FROM articles a ${where}`, params);
    const total = parseInt(countRes.rows[0].count);

    params.push(limit, offset);
    const { rows } = await query(
      `SELECT a.*, u.full_name as author_name FROM articles a
       LEFT JOIN users u ON a.author_id = u.id
       ${where} ORDER BY a.published_at DESC NULLS LAST
       LIMIT $${idx++} OFFSET $${idx}`, params
    );
    res.json({ articles: rows, pagination: paginationMeta(page, limit, total) });
  } catch (err) { next(err); }
}

async function getBySlug(req, res, next) {
  try {
    const { where, value } = bySlugOrId(req.params.slug);
    const { rows } = await query(
      `SELECT a.*, u.full_name as author_name, u.avatar_url as author_avatar
       FROM articles a LEFT JOIN users u ON a.author_id = u.id WHERE ${where}`,
      [value]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Article not found' });
    // Skip bots / link previews so views_count reflects real readers.
    const ua = String(req.headers['user-agent'] || '').toLowerCase();
    const isBot = !ua || /bot|crawl|spider|preview|facebookexternalhit|whatsapp|telegram|discord|linkedin|twitter|embedly|curl|wget|headless/i.test(ua);
    if (!isBot) {
      await query('UPDATE articles SET views_count = views_count + 1 WHERE id = $1', [rows[0].id]);
    }
    res.json(rows[0]);
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const err = validateRequired(req.body, ['title', 'slug', 'category']);
    if (err) return res.status(400).json({ error: err });

    const { title, slug, summary, content, category, image, tags, is_featured, read_time } = req.body;
    const safeTags = Array.isArray(tags) ? tags.filter((s) => typeof s === 'string') : [];
    const { rows } = await query(
      `INSERT INTO articles (author_id, title, slug, summary, content, category, image, tags, is_featured, read_time, is_published, published_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, true, NOW()) RETURNING *`,
      [req.user.id, title, slug, summary, content, category, image, safeTags, is_featured || false, read_time]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
}

// JWT only carries { id, email } — admin status must be looked up live in
// user_roles. Without this, admins could never moderate other authors' content.
async function isAdmin(userId) {
  if (!userId) return false;
  try {
    const r = await query(
      "SELECT 1 FROM user_roles WHERE user_id = $1 AND role = 'admin' LIMIT 1",
      [userId]
    );
    return r.rows.length > 0;
  } catch { return false; }
}

async function update(req, res, next) {
  try {
    const own = await query('SELECT author_id FROM articles WHERE id = $1', [req.params.id]);
    if (own.rows.length === 0) return res.status(404).json({ error: 'Article not found' });
    const admin = await isAdmin(req.user?.id);
    if (String(own.rows[0].author_id) !== String(req.user.id) && !admin) {
      return res.status(403).json({ error: 'Not your article' });
    }
    const upd = buildUpdate(req.body, ARTICLE_FIELDS);
    if (!upd) return res.status(400).json({ error: 'No fields to update' });

    upd.params.push(req.params.id);
    const { rows } = await query(
      `UPDATE articles SET ${upd.sets} WHERE id = $${upd.nextIdx} RETURNING *`, upd.params
    );
    res.json(rows[0]);
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    const own = await query('SELECT author_id FROM articles WHERE id = $1', [req.params.id]);
    if (own.rows.length === 0) return res.status(404).json({ error: 'Article not found' });
    const admin = await isAdmin(req.user?.id);
    if (String(own.rows[0].author_id) !== String(req.user.id) && !admin) {
      return res.status(403).json({ error: 'Not your article' });
    }
    await query('DELETE FROM articles WHERE id = $1', [req.params.id]);
    res.json({ message: 'Article deleted' });
  } catch (err) { next(err); }
}

module.exports = { getAll, getBySlug, create, update, remove };
