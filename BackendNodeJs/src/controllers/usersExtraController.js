const { query } = require('../config/database');

async function getMyStats(req, res, next) {
  try {
    const [listings, favs, convs, notifs] = await Promise.all([
      query(`SELECT COUNT(*)::int AS total,
                    COUNT(*) FILTER (WHERE status = 'active')::int AS active,
                    COUNT(*) FILTER (WHERE status = 'sold')::int AS sold,
                    COALESCE(SUM(views_count), 0)::int AS total_views,
                    COALESCE(SUM(favorites_count), 0)::int AS total_favorites,
                    COALESCE(SUM(contacts_count), 0)::int AS total_contacts
             FROM listings WHERE user_id = $1`, [req.user.id]),
      query('SELECT COUNT(*)::int AS n FROM favorites WHERE user_id = $1', [req.user.id]),
      query(`SELECT COUNT(*)::int AS n FROM conversations
             WHERE buyer_id = $1 OR seller_id = $1`, [req.user.id]),
      query('SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = $1 AND is_read = FALSE', [req.user.id])
    ]);
    res.json({
      listings: listings.rows[0],
      favorites_count: favs.rows[0].n,
      conversations_count: convs.rows[0].n,
      unread_notifications: notifs.rows[0].n
    });
  } catch (e) { next(e); }
}

async function blockUser(req, res, next) {
  try {
    // Coerce both sides to strings — params are always strings, but req.user.id may be
    // a UUID string OR a numeric id depending on the JWT payload. Comparing without
    // String() coercion would always be false → user could "block themselves".
    if (String(req.params.id) === String(req.user.id)) {
      return res.status(400).json({ error: 'cannot block self' });
    }
    await query(
      `INSERT INTO user_blocks (blocker_id, blocked_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [req.user.id, req.params.id]
    );
    res.json({ success: true });
  } catch (e) { next(e); }
}

async function unblockUser(req, res, next) {
  try {
    await query(
      'DELETE FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2',
      [req.user.id, req.params.id]
    );
    res.json({ success: true });
  } catch (e) { next(e); }
}

async function getBlockedUsers(req, res, next) {
  try {
    const { rows } = await query(
      `SELECT u.id, u.full_name, u.avatar_url, b.created_at AS blocked_at
       FROM user_blocks b JOIN users u ON b.blocked_id = u.id
       WHERE b.blocker_id = $1 ORDER BY b.created_at DESC`, [req.user.id]
    );
    res.json(rows);
  } catch (e) { next(e); }
}

module.exports = { getMyStats, blockUser, unblockUser, getBlockedUsers };
