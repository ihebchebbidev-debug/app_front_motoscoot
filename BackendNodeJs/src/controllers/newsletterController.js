const { query } = require('../config/database');

/** GET /api/admin/newsletter — list subscribers (admin) */
async function adminList(req, res, next) {
  try {
    const { active } = req.query;
    let sql = 'SELECT id, email, is_active, subscribed_at, unsubscribed_at FROM newsletter_subscribers';
    const params = [];
    if (active === 'true') sql += ' WHERE is_active = TRUE';
    else if (active === 'false') sql += ' WHERE is_active = FALSE';
    sql += ' ORDER BY subscribed_at DESC LIMIT 500';
    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (e) { next(e); }
}

/** DELETE /api/admin/newsletter/:id — remove subscriber */
async function adminRemove(req, res, next) {
  try {
    const result = await query(
      'DELETE FROM newsletter_subscribers WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Subscriber not found' });
    res.json({ success: true });
  } catch (e) { next(e); }
}

module.exports = { adminList, adminRemove };
