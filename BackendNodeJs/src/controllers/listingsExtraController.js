const { query } = require('../config/database');
const { lazyExpireOne, expireBoosts } = require('../jobs/boostExpiry');

/** GET /api/listings/popular?limit=8 */
async function getPopular(req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 8, 24);
    let rows;
    try {
      ({ rows } = await query(
        `SELECT l.*, u.full_name AS seller_name, u.avatar_url AS seller_avatar, u.seller_type,
                u.shop_name AS seller_shop_name, u.shop_logo AS seller_shop_logo
         FROM listings l JOIN users u ON l.user_id = u.id
         WHERE l.status = 'active' AND COALESCE(u.is_active, TRUE) = TRUE
           AND COALESCE(l.views_count, 0) > 0
         ORDER BY l.views_count DESC NULLS LAST, l.created_at DESC
         LIMIT $1`, [limit]
      ));
    } catch (innerErr) {
      if (innerErr && innerErr.code === '42703') {
        ({ rows } = await query(
          `SELECT l.*, u.full_name AS seller_name, u.avatar_url AS seller_avatar, u.seller_type
           FROM listings l JOIN users u ON l.user_id = u.id
           WHERE l.status = 'active' AND COALESCE(u.is_active, TRUE) = TRUE
             AND COALESCE(l.views_count, 0) > 0
           ORDER BY l.views_count DESC NULLS LAST, l.created_at DESC
           LIMIT $1`, [limit]
        ));
      } else { throw innerErr; }
    }
    res.json(rows);
  } catch (e) { next(e); }
}

/** GET /api/listings/:id/similar?limit=6 */
async function getSimilar(req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 6, 12);
    const base = await query('SELECT brand, type, price FROM listings WHERE id = $1', [req.params.id]);
    if (base.rows.length === 0) return res.json([]);
    const { brand, type, price } = base.rows[0];
    let rows;
    try {
      ({ rows } = await query(
        `SELECT l.*, u.full_name AS seller_name, u.avatar_url AS seller_avatar, u.seller_type,
                u.shop_name AS seller_shop_name, u.shop_logo AS seller_shop_logo
         FROM listings l JOIN users u ON l.user_id = u.id
         WHERE l.status = 'active' AND l.id != $1
           AND COALESCE(u.is_active, TRUE) = TRUE
           AND (l.brand = $2 OR l.type = $3)
         ORDER BY ABS(l.price - $4) ASC, l.views_count DESC
         LIMIT $5`,
        [req.params.id, brand, type, price, limit]
      ));
    } catch (innerErr) {
      if (innerErr && innerErr.code === '42703') {
        ({ rows } = await query(
          `SELECT l.*, u.full_name AS seller_name, u.avatar_url AS seller_avatar
           FROM listings l JOIN users u ON l.user_id = u.id
           WHERE l.status = 'active' AND l.id != $1
             AND COALESCE(u.is_active, TRUE) = TRUE
             AND (l.brand = $2 OR l.type = $3)
           ORDER BY ABS(l.price - $4) ASC, l.views_count DESC
           LIMIT $5`,
          [req.params.id, brand, type, price, limit]
        ));
      } else { throw innerErr; }
    }
    res.json(rows);
  } catch (e) { next(e); }
}

/** GET /api/listings/suggestions?q= */
async function getSuggestions(req, res, next) {
  try {
    const q = (req.query.q || '').trim();
    if (q.length < 2) return res.json([]);
    const pattern = `%${q}%`;
    const { rows } = await query(
      `SELECT DISTINCT title, brand, model FROM listings
       WHERE status = 'active' AND (title ILIKE $1 OR brand ILIKE $1 OR model ILIKE $1)
       LIMIT 10`, [pattern]
    );
    res.json(rows);
  } catch (e) { next(e); }
}

/** POST /api/listings/:id/contact { channel } */
async function trackContact(req, res, next) {
  try {
    const { channel = 'message' } = req.body;
    // Dedupe per (listing, viewer-ip-or-uid) in a 1h window — same pattern as
    // view counting in `getById`. Prevents anonymous spammers from inflating
    // a seller's contacts_count by reloading the contact button.
    const ip = (req.ip || req.headers['x-forwarded-for'] || '').toString().split(',')[0].trim() || null;
    const uid = req.user?.id || null;
    const ins = await query(
      `INSERT INTO listing_contacts (listing_id, user_id, channel)
       SELECT $1, $2, $3
       WHERE NOT EXISTS (
         SELECT 1 FROM listing_contacts
         WHERE listing_id = $1
           AND ((user_id IS NOT NULL AND user_id = $2) OR (user_id IS NULL AND $2 IS NULL))
           AND channel = $3
           AND created_at > NOW() - INTERVAL '1 hour'
       )
       RETURNING id`,
      [req.params.id, uid, channel]
    ).catch(() => ({ rows: [] }));
    if (ins.rows.length) {
      await query('UPDATE listings SET contacts_count = contacts_count + 1 WHERE id = $1', [req.params.id]);
    }
    res.json({ success: true });
  } catch (e) { next(e); }
}

/** POST /api/listings/:id/share { platform } */
async function trackShare(req, res, next) {
  try {
    const { platform } = req.body;
    const uid = req.user?.id || null;
    // Dedupe per (listing, user, platform) within 1h to keep counts honest.
    const ins = await query(
      `INSERT INTO listing_shares (listing_id, user_id, platform)
       SELECT $1, $2, $3
       WHERE NOT EXISTS (
         SELECT 1 FROM listing_shares
         WHERE listing_id = $1
           AND ((user_id IS NOT NULL AND user_id = $2) OR (user_id IS NULL AND $2 IS NULL))
           AND COALESCE(platform,'') = COALESCE($3,'')
           AND created_at > NOW() - INTERVAL '1 hour'
       )
       RETURNING id`,
      [req.params.id, uid, platform || null]
    ).catch(() => ({ rows: [] }));
    if (ins.rows.length) {
      await query('UPDATE listings SET shares_count = shares_count + 1 WHERE id = $1', [req.params.id]);
    }
    res.json({ success: true });
  } catch (e) { next(e); }
}

/** PATCH /api/listings/:id/status { status } */
async function setStatus(req, res, next) {
  try {
    const { status } = req.body;
    const allowed = ['active', 'sold', 'expired', 'draft', 'pending'];
    if (!allowed.includes(status)) return res.status(400).json({ error: 'invalid status' });
    const own = await query('SELECT user_id, status AS current_status FROM listings WHERE id = $1', [req.params.id]);
    if (own.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    if (String(own.rows[0].user_id) !== String(req.user.id)) return res.status(403).json({ error: 'Forbidden' });

    // Moderation guard: a regular user must NOT be able to flip a 'rejected'
    // listing back to 'pending' (which would re-queue it for moderation and
    // bypass the admin's prior rejection) or escalate any non-active status
    // to 'active' on their own. Only admins may set 'active' / 'pending' here;
    // owners are limited to lifecycle transitions they legitimately control.
    const OWNER_ALLOWED = new Set(['sold', 'expired', 'draft']);
    if (!OWNER_ALLOWED.has(status)) {
      return res.status(403).json({ error: 'Only admins can set this status' });
    }
    const current = String(own.rows[0].current_status || '').toLowerCase();
    if (current === 'rejected' || current === 'banned') {
      return res.status(403).json({ error: 'Listing is locked by moderation' });
    }

    const { rows } = await query(
      'UPDATE listings SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [status, req.params.id]
    );
    res.json(rows[0]);
  } catch (e) { next(e); }
}

/** POST /api/listings/:id/boost { pack, days, amount } */
async function boost(req, res, next) {
  try {
    const { pack = 'featured' } = req.body;
    // Cap the boost duration so a malicious or buggy client can't request an
    // indefinite (or negative) boost. Defaults to 7 days; max 90.
    const requested = parseInt(req.body.days, 10);
    const days = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), 90) : 7;
    // Clamp the recorded amount to a sane non-negative integer. Prior code
    // accepted ANY value (negatives, NaN, scientific notation strings) which
    // skewed revenue analytics on the admin dashboard. 1e9 is a generous cap.
    const rawAmount = Number(req.body.amount);
    const amount = Number.isFinite(rawAmount) ? Math.min(Math.max(rawAmount, 0), 1_000_000_000) : 0;
    const ALLOWED_PACKS = ['featured', 'top', 'urgent', 'spotlight'];
    if (pack && !ALLOWED_PACKS.includes(String(pack))) {
      return res.status(400).json({ error: 'Invalid boost pack' });
    }
    const own = await query('SELECT user_id, title FROM listings WHERE id = $1', [req.params.id]);
    if (own.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    if (String(own.rows[0].user_id) !== String(req.user.id)) return res.status(403).json({ error: 'Forbidden' });
    const { rows } = await query(
      `INSERT INTO listing_boosts (listing_id, user_id, pack, ends_at, amount)
       VALUES ($1,$2,$3, NOW() + ($4 || ' days')::interval, $5) RETURNING *`,
      [req.params.id, req.user.id, pack, String(days), amount]
    );
    await query('UPDATE listings SET is_featured = TRUE WHERE id = $1', [req.params.id]);

    // Fire-and-forget boost confirmation email (respect promotions opt-out).
    (async () => {
      try {
        const { sendBoostConfirmationEmail } = require('../services/mailer');
        const { rows: ur } = await query(
          `SELECT u.email, u.name,
                  COALESCE(ep.promotions, TRUE) AS promotions_ok
             FROM users u LEFT JOIN email_preferences ep ON ep.user_id = u.id
            WHERE u.id = $1`,
          [req.user.id]
        );
        if (ur[0]?.email && ur[0].promotions_ok) {
          const FE = process.env.FRONTEND_URL || 'https://www.moto-scoot.tn';
          await sendBoostConfirmationEmail({
            to: ur[0].email,
            recipientName: ur[0].name,
            listingTitle: own.rows[0].title,
            pack, days,
            endsAt: rows[0].ends_at,
            amount,
            listingUrl: `${FE}/annonces/${req.params.id}`,
          });
        }
      } catch (e) {
        // Best-effort: never fail the boost call because email failed.
        require('../utils/logger').warn('[boost] confirmation email failed:', e.message);
      }
    })();

    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
}

/**
 * POST /api/admin/boosts/expire — admin-triggered manual sweep.
 *
 * Useful when you want to flush expired boosts immediately (e.g. after a bulk
 * support action) instead of waiting for the next 10-minute tick. Mounted from
 * the admin router so admin auth is already enforced.
 */
async function expireBoostsNow(_req, res, next) {
  try {
    const result = await expireBoosts();
    res.json({ ok: true, ...result });
  } catch (e) { next(e); }
}
async function getDrafts(req, res, next) {
  try {
    const { rows } = await query(
      `SELECT * FROM listings WHERE user_id = $1 AND status = 'draft'
       ORDER BY updated_at DESC`, [req.user.id]
    );
    res.json(rows);
  } catch (e) { next(e); }
}

/** POST /api/listings/estimate-price { brand, model, year, mileage, condition } */
async function estimatePrice(req, res, next) {
  try {
    const { brand, model, year, mileage, condition } = req.body;
    if (!brand) return res.status(400).json({ error: 'brand required' });
    const filters = ['status = $1', 'brand ILIKE $2'];
    const params = ['sold', brand];
    let i = 3;
    if (model) { filters.push(`model ILIKE $${i++}`); params.push(model); }
    if (year)  { filters.push(`year BETWEEN $${i++} AND $${i++}`); params.push(year - 2, year + 2); }
    const { rows } = await query(
      `SELECT AVG(price)::int AS avg, MIN(price) AS min, MAX(price) AS max, COUNT(*)::int AS n
       FROM listings WHERE ${filters.join(' AND ')}`, params
    );
    const r = rows[0];
    if (!r.avg) {
      const fb = await query(
        `SELECT AVG(price)::int AS avg, MIN(price) AS min, MAX(price) AS max, COUNT(*)::int AS n
         FROM listings WHERE brand ILIKE $1 ${model ? 'AND model ILIKE $2' : ''}`,
        model ? [brand, model] : [brand]
      );
      return res.json({ ...fb.rows[0], confidence: 'low' });
    }
    res.json({ ...r, confidence: r.n >= 5 ? 'high' : 'medium' });
  } catch (e) { next(e); }
}

/**
 * GET /api/listings/:id/stats — owner-only stats for sellers / pros.
 *
 * Returns aggregated counters + a 14-day timeseries for views, contacts and shares
 * so the frontend can render a small "performance" widget on the listing details page.
 *
 * Auth: required. The caller MUST own the listing (admins bypass the ownership check).
 */
async function getStats(req, res, next) {
  try {
    if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' });

    const own = await query('SELECT user_id FROM listings WHERE id = $1', [req.params.id]);
    if (own.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    const isOwner = String(own.rows[0].user_id) === String(req.user.id);
    // The JWT only carries { id, email } — admin status must be looked up in
    // user_roles (mirrors the requireAdmin middleware). Without this, admins
    // could never view stats for other users' listings.
    let isAdmin = false;
    if (!isOwner) {
      try {
        const r = await query(
          "SELECT 1 FROM user_roles WHERE user_id = $1 AND role = 'admin' LIMIT 1",
          [req.user.id]
        );
        isAdmin = r.rows.length > 0;
      } catch { /* table missing — treat as non-admin */ }
    }
    if (!isOwner && !isAdmin) return res.status(403).json({ error: 'Forbidden' });

    const [main, viewsByDay, contactsByDay, sharesByDay] = await Promise.all([
      query(
        `SELECT views_count, favorites_count, contacts_count, shares_count
         FROM listings WHERE id = $1`,
        [req.params.id]
      ),
      query(
        `SELECT to_char(DATE(created_at), 'YYYY-MM-DD') AS day, COUNT(*)::int AS count
         FROM listing_views WHERE listing_id = $1 AND created_at > NOW() - INTERVAL '14 days'
         GROUP BY day ORDER BY day`,
        [req.params.id]
      ),
      query(
        `SELECT to_char(DATE(created_at), 'YYYY-MM-DD') AS day, COUNT(*)::int AS count
         FROM listing_contacts WHERE listing_id = $1 AND created_at > NOW() - INTERVAL '14 days'
         GROUP BY day ORDER BY day`,
        [req.params.id]
      ),
      query(
        `SELECT to_char(DATE(created_at), 'YYYY-MM-DD') AS day, COUNT(*)::int AS count
         FROM listing_shares WHERE listing_id = $1 AND created_at > NOW() - INTERVAL '14 days'
         GROUP BY day ORDER BY day`,
        [req.params.id]
      ),
    ]);

    const counters = main.rows[0] || {
      views_count: 0, favorites_count: 0, contacts_count: 0, shares_count: 0,
    };

    res.json({
      views_count: Number(counters.views_count) || 0,
      favorites_count: Number(counters.favorites_count) || 0,
      contacts_count: Number(counters.contacts_count) || 0,
      shares_count: Number(counters.shares_count) || 0,
      views_by_day: viewsByDay.rows,
      contacts_by_day: contactsByDay.rows,
      shares_by_day: sharesByDay.rows,
      window_days: 14,
    });
  } catch (e) { next(e); }
}

module.exports = {
  getPopular, getSimilar, getSuggestions, trackContact, trackShare,
  setStatus, boost, expireBoostsNow, getDrafts, estimatePrice, getStats
};
