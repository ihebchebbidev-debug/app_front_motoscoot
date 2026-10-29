const { query } = require('../config/database');

async function getAll(req, res, next) {
  try {
    const { rows } = await query(
      'SELECT * FROM saved_searches WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(rows);
  } catch (e) { next(e); }
}

async function create(req, res, next) {
  try {
    const { name, filters, alert_enabled = true } = req.body;
    if (!filters) return res.status(400).json({ error: 'filters required' });
    const { rows } = await query(
      `INSERT INTO saved_searches (user_id, name, filters, alert_enabled)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.user.id, name || 'Recherche', filters, alert_enabled]
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
}

async function update(req, res, next) {
  try {
    const { name, filters, alert_enabled } = req.body;
    const { rows } = await query(
      `UPDATE saved_searches SET
        name = COALESCE($1, name),
        filters = COALESCE($2, filters),
        alert_enabled = COALESCE($3, alert_enabled)
       WHERE id = $4 AND user_id = $5 RETURNING *`,
      [name, filters, alert_enabled, req.params.id, req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
}

async function remove(req, res, next) {
  try {
    await query('DELETE FROM saved_searches WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (e) { next(e); }
}

module.exports = { getAll, create, update, remove };
