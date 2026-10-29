const { query } = require('../config/database');

/**
 * GET /api/admin/brand-trends?days=30
 * Returns:
 *  - top: [{ brand, visits }] top 10 by total visits in the window
 *  - series: [{ day: 'YYYY-MM-DD', <brand1>: n, <brand2>: n, ... }]
 *      one row per day in the window, zero-filled for missing days
 *  - all: [{ brand, visits }] every brand with at least 1 visit in window
 */
exports.getBrandTrends = async (req, res, next) => {
  try {
    const rawDays = parseInt(req.query.days, 10);
    const days = Number.isFinite(rawDays) && rawDays > 0 ? Math.min(rawDays, 365) : 30;

    // 1) all brands with totals in window (full table)
    const { rows: totals } = await query(
      `SELECT brand, SUM(visits)::int AS visits
         FROM brand_visit_daily
        WHERE day >= CURRENT_DATE - ($1::int - 1)
        GROUP BY brand
        ORDER BY visits DESC, brand ASC`,
      [days]
    );

    const top = totals.slice(0, 10);
    const topBrands = top.map(t => t.brand);

    // 2) raw daily rows for top brands only
    let dailyRows = [];
    if (topBrands.length > 0) {
      const { rows } = await query(
        `SELECT brand, to_char(day, 'YYYY-MM-DD') AS day, visits
           FROM brand_visit_daily
          WHERE day >= CURRENT_DATE - ($1::int - 1)
            AND brand = ANY($2::text[])
          ORDER BY day ASC`,
        [days, topBrands]
      );
      dailyRows = rows;
    }

    // 3) zero-filled series, one row per day
    const series = [];
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const byKey = new Map();
    for (const r of dailyRows) byKey.set(`${r.day}|${r.brand}`, r.visits);

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - i);
      const key = d.toISOString().slice(0, 10);
      const row = { day: key };
      for (const b of topBrands) row[b] = byKey.get(`${key}|${b}`) || 0;
      series.push(row);
    }

    res.json({ days, top, series, all: totals });
  } catch (err) { next(err); }
};

/**
 * GET /api/admin/brand-trends/:brand/models
 * Per-model breakdown for a brand: listings count and aggregated views
 * (from listings.views_count). Sorted by views DESC.
 */
exports.getBrandModelsBreakdown = async (req, res, next) => {
  try {
    const brand = String(req.params.brand || '').trim();
    if (!brand) return res.status(400).json({ error: 'brand parameter required' });

    // Source: model_visits — real visitor clicks on each (brand, model)
    // fiche technique. We LEFT JOIN tech_specs only to expose models from
    // the catalogue that exist but have 0 visits, so the admin sees the
    // full picture. The "visits" column is what the panel ranks/percents on.
    let rows = [];
    try {
      const result = await query(
        `WITH catalog AS (
            SELECT COALESCE(NULLIF(TRIM(model), ''), '— Non précisé —') AS model
              FROM tech_specs
             WHERE LOWER(brand) = LOWER($1)
             GROUP BY 1
         ),
         visits AS (
            SELECT model, SUM(visits)::int AS visits
              FROM model_visits
             WHERE LOWER(brand) = LOWER($1)
             GROUP BY model
         )
         SELECT COALESCE(c.model, v.model) AS model,
                COALESCE(v.visits, 0)      AS visits
           FROM catalog c
           FULL OUTER JOIN visits v ON v.model = c.model
          ORDER BY visits DESC, model ASC`,
        [brand]
      );
      rows = result.rows;
    } catch (err) {
      // model_visits table missing — fall back to catalogue counts so the
      // panel still renders something (zeros) until migration 028 runs.
      if (err && err.code !== '42P01') throw err;
      const result = await query(
        `SELECT COALESCE(NULLIF(TRIM(model), ''), '— Non précisé —') AS model,
                0::int AS visits
           FROM tech_specs
          WHERE LOWER(brand) = LOWER($1)
          GROUP BY 1
          ORDER BY model ASC`,
        [brand]
      );
      rows = result.rows;
    }

    const total_visits = rows.reduce((acc, r) => acc + Number(r.visits || 0), 0);

    res.json({ brand, models: rows, total_visits });
  } catch (err) { next(err); }
};
