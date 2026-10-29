const { query } = require('../config/database');
const { encodeCursor, parseCursorParams } = require('../utils/cursor');

// Public visibility filter — see techSpecsController for the rationale.
// All public endpoints in this file restrict to fiches available in Tunisia.
const PUB = `t.available_in_tunisia = TRUE`;

async function compare(req, res, next) {
  try {
    const ids = req.body.ids;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids array required' });
    if (ids.length > 4) return res.status(400).json({ error: 'max 4 specs' });
    const { rows } = await query(
      `SELECT t.* FROM tech_specs t WHERE t.id = ANY($1::uuid[]) AND ${PUB}`, [ids]
    );
    res.json(rows);
  } catch (e) { next(e); }
}

async function getCategories(_req, res, next) {
  try {
    const { rows } = await query(
      `SELECT DISTINCT category FROM tech_specs t WHERE ${PUB} ORDER BY category`
    );
    res.json(rows.map(r => r.category));
  } catch (e) { next(e); }
}

/**
 * GET /api/tech-specs/popular
 *
 * Two response shapes:
 *  - Legacy (no `cursor` / no `mode=cursor`): returns a plain array (current
 *    consumers depend on this).
 *  - Cursor mode: returns `{ specs, nextCursor }`. Ordering tuple:
 *    (popularity DESC, year DESC, id ASC). Cursor encodes the last row's
 *    (popularity, year, id) so the next page seeks past it.
 */
async function getPopular(req, res, next) {
  const useCursor = req.query.cursor !== undefined || req.query.mode === 'cursor';
  try {
    if (useCursor) {
      const { limit, cursor } = parseCursorParams(req.query, 12, 50);
      const params = [];
      let where = `WHERE ${PUB}`;
      let idx = 1;

      if (cursor && cursor.id) {
        const cPop = Number(cursor.popularity || 0);
        const cYear = Number(cursor.year || 0);
        const cId = String(cursor.id);
        where += ` AND (
          COALESCE(b.visits, 0) < $${idx}
          OR (COALESCE(b.visits, 0) = $${idx} AND t.year < $${idx + 1})
          OR (COALESCE(b.visits, 0) = $${idx} AND t.year = $${idx + 1} AND t.id > $${idx + 2}::uuid)
        )`;
        params.push(cPop, cYear, cId);
        idx += 3;
      }
      params.push(limit + 1);

      try {
        const { rows } = await query(
          `SELECT t.*, COALESCE(b.visits, 0) AS popularity
             FROM tech_specs t
             LEFT JOIN brand_visits b ON b.brand = t.brand
             ${where}
            ORDER BY popularity DESC, t.year DESC, t.id ASC
            LIMIT $${idx}`,
          params
        );
        let nextCursor = null;
        let page = rows;
        if (rows.length > limit) {
          page = rows.slice(0, limit);
          const last = page[page.length - 1];
          nextCursor = encodeCursor({
            popularity: Number(last.popularity || 0),
            year: Number(last.year || 0),
            id: last.id,
          });
        }
        return res.json({ specs: page, nextCursor });
      } catch (joinErr) {
        if (joinErr && joinErr.code !== '42P01') throw joinErr;
        // brand_visits missing: degrade gracefully to a year-only cursor.
        const params2 = [];
        let where2 = `WHERE ${PUB}`;
        let i2 = 1;
        if (cursor && cursor.id) {
          const cYear = Number(cursor.year || 0);
          const cId = String(cursor.id);
          where2 += ` AND (t.year < $${i2} OR (t.year = $${i2} AND t.id > $${i2 + 1}::uuid))`;
          params2.push(cYear, cId);
          i2 += 2;
        }
        params2.push(limit + 1);
        const { rows } = await query(
          `SELECT t.* FROM tech_specs t ${where2} ORDER BY t.year DESC, t.id ASC LIMIT $${i2}`,
          params2
        );
        let nextCursor = null;
        let page = rows;
        if (rows.length > limit) {
          page = rows.slice(0, limit);
          const last = page[page.length - 1];
          nextCursor = encodeCursor({ popularity: 0, year: Number(last.year || 0), id: last.id });
        }
        return res.json({ specs: page, nextCursor });
      }
    }

    // ---- Legacy plain-array response (back-compat) ----
    const limit = Math.min(parseInt(req.query.limit, 10) || 8, req.query.all === '1' ? 2000 : 20);
    try {
      const { rows } = await query(
        `SELECT t.*, COALESCE(b.visits, 0) AS popularity
           FROM tech_specs t
           LEFT JOIN brand_visits b ON b.brand = t.brand
          WHERE ${PUB}
          ORDER BY popularity DESC, t.year DESC
          LIMIT $1`,
        [limit]
      );
      return res.json(rows);
    } catch (joinErr) {
      if (joinErr && joinErr.code !== '42P01') throw joinErr;
      const { rows } = await query(
        `SELECT t.* FROM tech_specs t WHERE ${PUB} ORDER BY year DESC LIMIT $1`,
        [limit]
      );
      return res.json(rows);
    }
  } catch (e) {
    next(e);
  }
}

// One-time best-effort schema bootstrap so tracking never silently no-ops
// just because a migration (004 / 028) hasn't been applied in the target env.
let _visitTablesEnsured = false;
async function ensureVisitTables() {
  if (_visitTablesEnsured) return;
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS brand_visits (
        brand      VARCHAR(100) PRIMARY KEY,
        visits     INTEGER      NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS model_visits (
        brand      VARCHAR(100) NOT NULL,
        model      VARCHAR(150) NOT NULL,
        visits     INTEGER      NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        PRIMARY KEY (brand, model)
      )
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_model_visits_brand_visits
        ON model_visits (brand, visits DESC)
    `);
    _visitTablesEnsured = true;
  } catch (e) {
    // Permission denied or similar — leave flag false so we retry next call.
  }
}

async function trackVisit(req, res, next) {
  try {
    await ensureVisitTables();

    // Look up brand + model once so we can fan out to both counters.
    const { rows } = await query(
      `SELECT brand, model FROM tech_specs WHERE id = $1`,
      [req.params.id]
    );
    const spec = rows[0];
    if (!spec) return res.json({ success: true });

    const safeModel = (spec.model && String(spec.model).trim()) || '— Non précisé —';

    const results = await Promise.allSettled([
      query(
        `INSERT INTO brand_visits (brand, visits)
              VALUES ($1, 1)
         ON CONFLICT (brand) DO UPDATE
           SET visits = brand_visits.visits + 1,
               updated_at = NOW()`,
        [spec.brand]
      ),
      query(
        `INSERT INTO model_visits (brand, model, visits)
              VALUES ($1, $2, 1)
         ON CONFLICT (brand, model) DO UPDATE
           SET visits = model_visits.visits + 1,
               updated_at = NOW()`,
        [spec.brand, safeModel]
      ),
    ]);

    const failures = results
      .filter((r) => r.status === 'rejected')
      .map((r) => r.reason && (r.reason.message || r.reason.code));

    res.json({ success: true, brand: spec.brand, model: safeModel, failures: failures.length ? failures : undefined });
  } catch (e) {
    // Don't fail the user-visible flow over an analytics insert.
    next(e);
  }
}

/**
 * GET /api/tech-specs/search?q=<term>&limit=<n>
 *
 * Public, lightweight cross-field search used by the public Fiches
 * Techniques pages so a user typing "MT-07", "689", "Sport", "73 ch"
 * or "2024" surfaces matching specs regardless of which field stored
 * the value. Returns a plain array (mapped to the same shape getPopular
 * returns) so the frontend mapper accepts it as-is.
 *
 * `q` is required and must be ≥ 1 char after trim. Limit is clamped
 * 1–50 to keep responses small.
 */
async function searchAll(req, res, next) {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) return res.json([]);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 30, 1), 50);
    const like = `%${q.replace(/[\\%_]/g, (m) => '\\' + m)}%`;
    const { rows } = await query(
      `SELECT t.* FROM tech_specs t
        WHERE ${PUB} AND (
              brand ILIKE $1 OR model ILIKE $1 OR category ILIKE $1
           OR year::text ILIKE $1
           OR engine_cc ILIKE $1 OR engine_power ILIKE $1
           OR engine_torque ILIKE $1 OR engine_type ILIKE $1
           OR transmission ILIKE $1 OR fuel_system ILIKE $1
           OR cooling ILIKE $1 OR top_speed ILIKE $1
           OR consumption ILIKE $1 OR frame ILIKE $1
           OR abs ILIKE $1 OR tcs ILIKE $1 OR riding_modes ILIKE $1
        )
        ORDER BY year DESC NULLS LAST, brand, model
        LIMIT $2`,
      [like, limit]
    );
    res.json(rows);
  } catch (e) { next(e); }
}

/**
 * GET /api/tech-specs/latest?limit=3
 * Returns the most recently uploaded fiches techniques.
 */
async function getLatest(req, res, next) {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 3, 1), 20);
    const { rows } = await query(
      `SELECT t.* FROM tech_specs t WHERE ${PUB} ORDER BY created_at DESC NULLS LAST, year DESC LIMIT $1`,
      [limit]
    );
    res.json(rows);
  } catch (e) { next(e); }
}

module.exports = { compare, getCategories, getPopular, trackVisit, searchAll, getLatest };
