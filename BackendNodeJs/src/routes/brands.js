const router = require('express').Router();
const { query } = require('../config/database');

/**
 * GET /api/brands/popular
 * Top N brands by community-wide visit count (running total).
 * Query: ?limit=20 (capped 100). Public.
 */
router.get('/popular', async (req, res, next) => {
  try {
    const rawLimit = parseInt(req.query.limit, 10);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 20;

    const detailed = req.query.detailed === '1' || req.query.detailed === 'true';

    if (detailed) {
      // Restrict to brands that actually appear in the global fiche
      // techniques catalog (tech_specs). The brand_visits table is
      // incremented from many surfaces (listings/annonces included),
      // which previously caused "neuf"-only brands with no tech sheet
      // to leak into the home-page "Marques populaires" section.
      const { rows } = await query(
        `SELECT b.id, b.name, b.logo_url, COALESCE(bv.visits, 0) AS visits
           FROM brand_visits bv
           JOIN brands b ON b.name = bv.brand
          WHERE bv.visits > 0
            AND EXISTS (SELECT 1 FROM tech_specs ts WHERE ts.brand = b.name)
          ORDER BY bv.visits DESC, b.name ASC
          LIMIT $1`,
        [limit]
      );
      if (rows.length > 0) return res.json({ brands: rows });

      // Fallback: any brand from the tech_specs catalog with a logo.
      const { rows: fallback } = await query(
        `SELECT b.id, b.name, b.logo_url, 0 AS visits
           FROM brands b
          WHERE b.logo_url IS NOT NULL AND b.logo_url <> ''
            AND EXISTS (SELECT 1 FROM tech_specs ts WHERE ts.brand = b.name)
          ORDER BY b.name ASC
          LIMIT $1`,
        [limit]
      );
      return res.json({ brands: fallback });
    }

    const { rows } = await query(
      `SELECT brand, visits
         FROM brand_visits
        WHERE visits > 0
        ORDER BY visits DESC, brand ASC
        LIMIT $1`,
      [limit]
    );
    res.json({ brands: rows.map(r => r.brand) });
  } catch (err) { next(err); }
});

/**
 * POST /api/brands/visit
 * Increments the community-wide counter AND records an event for
 * time-series analytics (raw event + daily rollup upsert).
 * Body: { brand: string }. Public, best-effort.
 */
router.post('/visit', async (req, res, next) => {
  try {
    const brand = typeof req.body?.brand === 'string' ? req.body.brand.trim() : '';
    if (!brand || brand.length > 100) {
      return res.status(400).json({ error: 'Invalid brand' });
    }

    // Three writes — wrap in a single round-trip via Promise.all. We don't
    // need a transaction: each statement is independently safe and a partial
    // failure (e.g. event logged, total not bumped) is acceptable for
    // best-effort analytics.
    await Promise.all([
      query(
        `INSERT INTO brand_visits (brand, visits, updated_at)
              VALUES ($1, 1, NOW())
         ON CONFLICT (brand)
         DO UPDATE SET visits = brand_visits.visits + 1,
                       updated_at = NOW()`,
        [brand]
      ),
      query(
        `INSERT INTO brand_visit_events (brand) VALUES ($1)`,
        [brand]
      ),
      query(
        `INSERT INTO brand_visit_daily (brand, day, visits)
              VALUES ($1, CURRENT_DATE, 1)
         ON CONFLICT (brand, day)
         DO UPDATE SET visits = brand_visit_daily.visits + 1`,
        [brand]
      ),
    ]);

    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
