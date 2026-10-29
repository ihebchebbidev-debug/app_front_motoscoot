const { query } = require('../config/database');

async function getPopular(req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 6, 20);
    const { rows } = await query(
      `SELECT * FROM garages
       ORDER BY rating DESC NULLS LAST, reviews_count DESC NULLS LAST
       LIMIT $1`, [limit]
    );
    res.json(rows);
  } catch (e) { next(e); }
}

async function getNearby(req, res, next) {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    const radius = parseFloat(req.query.radius) || 50;
    if (isNaN(lat) || isNaN(lng)) return res.status(400).json({ error: 'lat & lng required' });
    // Use a subquery (instead of HAVING without GROUP BY) so the WHERE on the
    // computed distance is portable across Postgres versions.
    const { rows } = await query(
      `SELECT * FROM (
         SELECT g.*,
           (6371 * acos(
             cos(radians($1)) * cos(radians(g.latitude)) *
             cos(radians(g.longitude) - radians($2)) +
             sin(radians($1)) * sin(radians(g.latitude))
           )) AS distance_km
         FROM garages g
         WHERE g.latitude IS NOT NULL AND g.longitude IS NOT NULL
       ) sub
       WHERE distance_km < $3
       ORDER BY distance_km ASC
       LIMIT 30`,
      [lat, lng, radius]
    );
    res.json(rows);
  } catch (e) { next(e); }
}

async function getReviews(req, res, next) {
  try {
    const { rows } = await query(
      `SELECT r.*, u.full_name AS author_name, u.avatar_url AS author_avatar
       FROM garage_reviews r LEFT JOIN users u ON r.user_id = u.id
       WHERE r.garage_id = $1 ORDER BY r.created_at DESC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (e) { next(e); }
}

async function markHelpful(req, res, next) {
  try {
    // Per-user dedupe: prevent the same authenticated user from inflating
    // helpful_count by clicking repeatedly. Uses ON CONFLICT against a
    // (review_id, user_id) unique index — falls back to a simple increment
    // if the helper table doesn't exist (older deployments).
    try {
      const ins = await query(
        `INSERT INTO garage_review_helpful (review_id, user_id)
         VALUES ($1, $2)
         ON CONFLICT (review_id, user_id) DO NOTHING
         RETURNING id`,
        [req.params.reviewId, req.user.id]
      );
      if (ins.rowCount === 0) {
        return res.json({ success: true, already: true });
      }
    } catch (e) {
      // 42P01 = relation does not exist — table not yet created in this DB.
      if (!e || e.code !== '42P01') throw e;
    }
    await query(
      'UPDATE garage_reviews SET helpful_count = helpful_count + 1 WHERE id = $1',
      [req.params.reviewId]
    );
    res.json({ success: true });
  } catch (e) { next(e); }
}

async function deleteReview(req, res, next) {
  try {
    const r = await query('SELECT user_id, garage_id FROM garage_reviews WHERE id = $1', [req.params.reviewId]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    // Allow the review author OR an admin to delete (admins need to moderate
    // abusive reviews — previously they were locked out by the strict 403).
    let isAdmin = false;
    try {
      const ar = await query(
        "SELECT 1 FROM user_roles WHERE user_id = $1 AND role IN ('admin','moderator')",
        [req.user.id]
      );
      isAdmin = ar.rows.length > 0;
    } catch { /* ignore — best effort */ }
    if (!isAdmin && String(r.rows[0].user_id) !== String(req.user.id)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const garageId = r.rows[0].garage_id;
    await query('DELETE FROM garage_reviews WHERE id = $1', [req.params.reviewId]);
    // Recompute aggregate rating + count after delete (mirrors what addReview does).
    await query(
      `UPDATE garages
          SET rating        = COALESCE((SELECT AVG(rating) FROM garage_reviews WHERE garage_id = $1), 0),
              reviews_count = (SELECT COUNT(*) FROM garage_reviews WHERE garage_id = $1)
        WHERE id = $1`,
      [garageId]
    );
    res.json({ success: true });
  } catch (e) { next(e); }
}

/** PATCH /garages/:id/reviews/:reviewId/reply — owner of the garage replies to a review. */
async function replyToReview(req, res, next) {
  try {
    const { reply } = req.body;
    if (!reply || !String(reply).trim()) {
      return res.status(400).json({ error: 'reply required' });
    }
    // Verify the authenticated user owns the garage
    const own = await query('SELECT owner_id FROM garages WHERE id = $1', [req.params.id]);
    if (own.rows.length === 0) return res.status(404).json({ error: 'Garage not found' });
    if (String(own.rows[0].owner_id) !== String(req.user.id)) {
      return res.status(403).json({ error: 'Only the garage owner can reply' });
    }
    // Verify the review belongs to this garage
    const rev = await query(
      'SELECT id FROM garage_reviews WHERE id = $1 AND garage_id = $2',
      [req.params.reviewId, req.params.id]
    );
    if (rev.rows.length === 0) return res.status(404).json({ error: 'Review not found' });

    const { rows } = await query(
      `UPDATE garage_reviews
         SET owner_reply = $1, owner_reply_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [String(reply).trim(), req.params.reviewId]
    );
    res.json(rows[0]);
  } catch (e) { next(e); }
}

async function getSpecialties(_req, res, next) {
  // Defensive: this endpoint feeds a public filter dropdown — it must never 500.
  // Possible failure modes we tolerate:
  //   - garages table missing (42P01)            -> []
  //   - specialties column missing (42703)       -> []
  //   - any other DB error                       -> []  + logged
  try {
    const { rows } = await query(
      `SELECT DISTINCT UNNEST(specialties) AS specialty
         FROM garages
        WHERE specialties IS NOT NULL
          AND array_length(specialties, 1) > 0
        ORDER BY specialty`
    );
    return res.json(rows.map(r => r.specialty).filter(Boolean));
  } catch (e) {
    if (e && (e.code === '42P01' || e.code === '42703')) {
      return res.json([]);
    }
    // Log but don't break the UI
    try { require('../utils/logger').warn('getSpecialties failed:', e.message); } catch (_) {}
    return res.json([]);
  }
}

module.exports = { getPopular, getNearby, getReviews, markHelpful, deleteReview, replyToReview, getSpecialties };
