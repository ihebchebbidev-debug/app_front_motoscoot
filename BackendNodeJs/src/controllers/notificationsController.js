const { query } = require('../config/database');
const { parsePagination, paginationMeta } = require('../utils/queryHelpers');

async function getAll(req, res, next) {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const unread = req.query.unread === 'true';
    // Build params + placeholders dynamically so adding a future WHERE
    // condition can't silently shift LIMIT/OFFSET indices.
    const params = [req.user.id];
    let where = 'WHERE user_id = $1';
    if (unread) where += ' AND is_read = FALSE';

    const countRes = await query(`SELECT COUNT(*) FROM notifications ${where}`, params);
    const total = parseInt(countRes.rows[0].count);

    const limitIdx = params.length + 1;
    const offsetIdx = params.length + 2;
    params.push(limit, offset);

    const { rows } = await query(
      `SELECT * FROM notifications ${where} ORDER BY created_at DESC LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params
    );
    res.json({ notifications: rows, pagination: paginationMeta(page, limit, total) });
  } catch (e) { next(e); }
}

async function getUnreadCount(req, res, next) {
  try {
    const { rows } = await query(
      'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = FALSE',
      [req.user.id]
    );
    res.json({ count: parseInt(rows[0].count) });
  } catch (e) { next(e); }
}

async function markRead(req, res, next) {
  try {
    await query('UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (e) { next(e); }
}

async function markAllRead(req, res, next) {
  try {
    await query('UPDATE notifications SET is_read = TRUE WHERE user_id = $1', [req.user.id]);
    res.json({ success: true });
  } catch (e) { next(e); }
}

async function remove(req, res, next) {
  try {
    await query('DELETE FROM notifications WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (e) { next(e); }
}

async function createForUser(userId, type, title, body, link = null, data = {}) {
  const { rows } = await query(
    `INSERT INTO notifications (user_id, type, title, body, link, data)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [userId, type, title, body, link, data]
  );
  return rows[0];
}

module.exports = { getAll, getUnreadCount, markRead, markAllRead, remove, createForUser };
