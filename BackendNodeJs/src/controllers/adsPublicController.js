const { query } = require('../config/database');

/**
 * GET /api/ads/active?zone=home_banner&limit=1
 *
 * Returns an ARRAY of currently active ad campaigns for the requested zone.
 * The frontend (`adsApi.getActive` -> `AdCampaignResponse[]`) expects an array,
 * so we always reply with `[]` when there is no match — never `null`.
 */
async function getActive(req, res, next) {
  try {
    const { zone } = req.query;
    if (!zone || typeof zone !== 'string' || zone.trim().length === 0) {
      return res.status(400).json({ error: 'zone required' });
    }
    const limit = Math.min(parseInt(req.query.limit, 10) || 1, 10);

    let rows;
    try {
      ({ rows } = await query(
        `SELECT id, title, zone, media_type, media_url, link_url, cta_text, description
         FROM ad_campaigns
         WHERE zone = $1
           AND is_active = TRUE
           AND start_date::date <= CURRENT_DATE
           AND end_date::date >= CURRENT_DATE
         ORDER BY RANDOM()
         LIMIT $2`,
        [zone.trim(), limit]
      ));
    } catch (err) {
      // Postgres throws 22P02 ("invalid_text_representation") when the zone
      // is not a member of the ad_zone enum. Treat as "no ads" instead of 500.
      if (err && (err.code === '22P02' || /invalid input value for enum/i.test(err.message || ''))) {
        return res.json([]);
      }
      throw err;
    }

    res.json(rows);
  } catch (e) {
    next(e);
  }
}

// Accept either UUID-ish or numeric ad ids; reject anything else with 400 so a
// bad path param doesn't reach Postgres and 500 with 22P02.
const ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;

async function trackImpression(req, res, next) {
  try {
    if (!ID_RE.test(String(req.params.id || ''))) {
      return res.status(400).json({ error: 'invalid id' });
    }
    try {
      await query(
        'INSERT INTO ad_impressions (campaign_id, user_id) VALUES ($1, $2)',
        [req.params.id, req.user?.id || null]
      );
      await query('UPDATE ad_campaigns SET views = views + 1 WHERE id = $1', [req.params.id]);
    } catch (err) {
      // Bad cast (22P02) or FK miss (23503) → treat as no-op, never 500 trackers.
      if (err && (err.code === '22P02' || err.code === '23503')) {
        return res.json({ success: true, skipped: true });
      }
      throw err;
    }
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
}

async function trackClick(req, res, next) {
  try {
    if (!ID_RE.test(String(req.params.id || ''))) {
      return res.status(400).json({ error: 'invalid id' });
    }
    try {
      const landing = typeof req.body?.landing_page === 'string' ? req.body.landing_page.slice(0, 2048) : null;
      await query(
        'INSERT INTO ad_clicks (campaign_id, user_id, landing_page) VALUES ($1, $2, $3)',
        [req.params.id, req.user?.id || null, landing]
      );
      await query('UPDATE ad_campaigns SET clicks = clicks + 1 WHERE id = $1', [req.params.id]);
    } catch (err) {
      if (err && (err.code === '22P02' || err.code === '23503')) {
        return res.json({ success: true, skipped: true });
      }
      throw err;
    }
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
}

module.exports = { getActive, trackImpression, trackClick };
