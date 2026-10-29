const { query } = require('../config/database');

const ALLOWED_STATUS = ['nouveau', 'en_cours', 'done', 'refuse'];

async function list(req, res, next) {
  try {
    const { status } = req.query;
    const params = [];
    let where = '';
    if (status && ALLOWED_STATUS.includes(status)) {
      params.push(status);
      where = 'WHERE t.status = $1';
    }
    const { rows } = await query(
      `SELECT t.*,
              u.email      AS creator_email,
              u.full_name  AS creator_full_name
         FROM dev_tickets t
         LEFT JOIN users u ON u.id = t.created_by
         ${where}
         ORDER BY t.created_at DESC
         LIMIT 500`,
      params
    );
    res.json(rows);
  } catch (e) { next(e); }
}

async function create(req, res, next) {
  try {
    const { title, description, image_url } = req.body || {};
    if (typeof title !== 'string' || !title.trim()) return res.status(400).json({ error: 'title required' });
    if (typeof description !== 'string' || !description.trim()) return res.status(400).json({ error: 'description required' });
    if (String(title).length > 200) return res.status(400).json({ error: 'title too long' });
    if (!req.user || !req.user.id) return res.status(401).json({ error: 'Authentication required' });

    const { rows } = await query(
      `INSERT INTO dev_tickets (title, description, image_url, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [String(title).trim(), String(description).trim(), image_url || null, req.user.id]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    // Surface the two most common operator-side failures with a clear,
    // actionable message instead of letting the global handler swallow them
    // as "Internal server error" in production.
    if (e && e.code === '42P01') {
      return res.status(500).json({
        error: 'La table dev_tickets est manquante. Lancez `npm run migrate` côté serveur.',
        code: 'MIGRATION_REQUIRED',
      });
    }
    if (e && e.code === '42883' && /gen_random_uuid/.test(e.message || '')) {
      return res.status(500).json({
        error: "Extension pgcrypto manquante côté Postgres. Lancez la migration 030_dev_tickets_pgcrypto.sql.",
        code: 'PGCRYPTO_MISSING',
      });
    }
    next(e);
  }
}

async function updateStatus(req, res, next) {
  try {
    const { status } = req.body || {};
    if (!ALLOWED_STATUS.includes(status)) {
      return res.status(400).json({ error: 'invalid status' });
    }
    const { rows } = await query(
      `UPDATE dev_tickets
          SET status = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING *`,
      [status, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Ticket not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
}

async function update(req, res, next) {
  try {
    const { title, description, image_url } = req.body || {};
    const fields = [];
    const params = [];
    if (title !== undefined && (typeof title !== 'string' || !title.trim() || title.length > 200)) return res.status(400).json({ error: 'Title must be a nonempty string of at most 200 characters' });
    if (description !== undefined && (typeof description !== 'string' || !description.trim())) return res.status(400).json({ error: 'Description must be a nonempty string' });
    if (title != null) { params.push(title.trim()); fields.push(`title = $${params.length}`); }
    if (description != null) { params.push(description.trim()); fields.push(`description = $${params.length}`); }
    if (image_url !== undefined) { params.push(image_url || null); fields.push(`image_url = $${params.length}`); }
    if (fields.length === 0) return res.status(400).json({ error: 'no fields to update' });
    params.push(req.params.id);
    const { rows } = await query(
      `UPDATE dev_tickets SET ${fields.join(', ')}, updated_at = NOW()
        WHERE id = $${params.length} RETURNING *`,
      params
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Ticket not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
}

async function remove(req, res, next) {
  try {
    const { rowCount } = await query('DELETE FROM dev_tickets WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Ticket not found' });
    res.json({ message: 'Ticket deleted' });
  } catch (e) { next(e); }
}

module.exports = { list, create, update, updateStatus, remove };
