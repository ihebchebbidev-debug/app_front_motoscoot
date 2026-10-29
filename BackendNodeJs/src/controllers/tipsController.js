const { query } = require('../config/database');
const { buildUpdate, parsePagination, paginationMeta, validateRequired } = require('../utils/queryHelpers');

function bySlugOrId(val) {
  const v = String(val);
  // Tip ids are UUIDs in production; guide URLs end with that UUID.
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) return { where: 't.id = $1::uuid', value: v };
  if (/^\d+$/.test(v)) return { where: 't.id::text = $1', value: v };
  return { where: 't.slug = $1', value: v };
}

const TIP_FIELDS = ['title', 'slug', 'summary', 'content', 'category', 'difficulty', 'tools', 'image', 'is_published', 'read_time'];

async function getAll(req, res, next) {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const { category, difficulty } = req.query;
    const params = []; const conditions = ['t.is_published = true']; let idx = 1;

    if (category) { conditions.push(`t.category = $${idx++}`); params.push(category); }
    if (difficulty) { conditions.push(`t.difficulty = $${idx++}`); params.push(difficulty); }

    const where = `WHERE ${conditions.join(' AND ')}`;
    const countRes = await query(`SELECT COUNT(*) FROM tips t ${where}`, params);
    const total = parseInt(countRes.rows[0].count);

    params.push(limit, offset);
    const { rows } = await query(
      `SELECT t.*, u.full_name as author_name FROM tips t
       LEFT JOIN users u ON t.author_id = u.id
       ${where} ORDER BY t.published_at DESC NULLS LAST
       LIMIT $${idx++} OFFSET $${idx}`, params
    );
    res.json({ tips: rows, pagination: paginationMeta(page, limit, total) });
  } catch (err) { next(err); }
}

async function getBySlug(req, res, next) {
  try {
    const { where, value } = bySlugOrId(req.params.slug);
    const { rows } = await query(
      `SELECT t.*, u.full_name as author_name, u.avatar_url as author_avatar
       FROM tips t LEFT JOIN users u ON t.author_id = u.id WHERE ${where}`,
      [value]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Tip not found' });
    const ua = String(req.headers['user-agent'] || '').toLowerCase();
    const isBot = !ua || /bot|crawl|spider|preview|facebookexternalhit|whatsapp|telegram|discord|linkedin|twitter|embedly|curl|wget|headless/i.test(ua);
    if (!isBot) {
      await query('UPDATE tips SET views_count = views_count + 1 WHERE id = $1', [rows[0].id]);
    }
    res.json(rows[0]);
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const err = validateRequired(req.body, ['title', 'slug', 'category']);
    if (err) return res.status(400).json({ error: err });

    const { title, slug, summary, content, category, difficulty, tools, image, read_time } = req.body;
    const safeTools = Array.isArray(tools) ? tools.filter((s) => typeof s === 'string') : [];
    const { rows } = await query(
      `INSERT INTO tips (author_id, title, slug, summary, content, category, difficulty, tools, image, read_time, is_published, published_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, true, NOW()) RETURNING *`,
      [req.user.id, title, slug, summary, content, category, difficulty || 'Débutant', safeTools, image, read_time]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
}

// JWT only carries { id, email } — admin status must be looked up live in
// user_roles. Without this, admins could never moderate other authors' tips.
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
    const own = await query('SELECT author_id FROM tips WHERE id = $1', [req.params.id]);
    if (own.rows.length === 0) return res.status(404).json({ error: 'Tip not found' });
    const admin = await isAdmin(req.user?.id);
    if (String(own.rows[0].author_id) !== String(req.user.id) && !admin) {
      return res.status(403).json({ error: 'Not your tip' });
    }
    const upd = buildUpdate(req.body, TIP_FIELDS);
    if (!upd) return res.status(400).json({ error: 'No fields to update' });

    upd.params.push(req.params.id);
    const { rows } = await query(`UPDATE tips SET ${upd.sets} WHERE id = $${upd.nextIdx} RETURNING *`, upd.params);
    res.json(rows[0]);
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    const own = await query('SELECT author_id FROM tips WHERE id = $1', [req.params.id]);
    if (own.rows.length === 0) return res.status(404).json({ error: 'Tip not found' });
    const admin = await isAdmin(req.user?.id);
    if (String(own.rows[0].author_id) !== String(req.user.id) && !admin) {
      return res.status(403).json({ error: 'Not your tip' });
    }
    await query('DELETE FROM tips WHERE id = $1', [req.params.id]);
    res.json({ message: 'Tip deleted' });
  } catch (err) { next(err); }
}

module.exports = { getAll, getBySlug, create, update, remove };
