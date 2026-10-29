/**
 * Admin content management — articles (actualités) and tech specs
 * (fiches techniques). Reuses the public CRUD controllers for write
 * operations; only adds privileged LIST endpoints that surface
 * unpublished/draft rows the public endpoints intentionally hide.
 */
const { query } = require('../config/database');

function escapeLike(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/* ============================================================
 * Articles — admin list (incl. drafts)
 * ============================================================ */
async function listArticles(req, res, next) {
  try {
    const pageNum  = Math.max(parseInt(req.query.page)  || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 200);
    const offset   = (pageNum - 1) * limitNum;
    const { search, category, status } = req.query;

    const conditions = [];
    const params = [];
    let idx = 1;

    if (search) {
      conditions.push(`(
        a.id::text ILIKE $${idx} OR a.title ILIKE $${idx} OR a.slug ILIKE $${idx}
        OR COALESCE(a.summary, '') ILIKE $${idx} OR COALESCE(a.content, '') ILIKE $${idx}
        OR a.category ILIKE $${idx} OR COALESCE(a.tags::text, '') ILIKE $${idx}
        OR COALESCE(a.read_time, '') ILIKE $${idx} OR COALESCE(u.full_name, '') ILIKE $${idx}
      )`);
      params.push(`%${escapeLike(search)}%`);
      idx++;
    }
    if (category) { conditions.push(`a.category = $${idx++}`); params.push(category); }
    if (status === 'published')  conditions.push('a.is_published = TRUE');
    if (status === 'draft')      conditions.push('a.is_published = FALSE');

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countRes = await query(`SELECT COUNT(*) FROM articles a LEFT JOIN users u ON a.author_id = u.id ${where}`, params);
    const total = parseInt(countRes.rows[0].count, 10);

    params.push(limitNum, offset);
    const { rows } = await query(
      `SELECT a.*, u.full_name AS author_name
         FROM articles a
         LEFT JOIN users u ON a.author_id = u.id
         ${where}
         ORDER BY a.created_at DESC NULLS LAST
         LIMIT $${idx++} OFFSET $${idx}`,
      params
    );
    res.json({
      articles: rows,
      total,
      page: pageNum,
      limit: limitNum,
      total_pages: Math.ceil(total / limitNum),
    });
  } catch (err) { next(err); }
}

/* ============================================================
 * Tech specs — admin list (all rows)
 * ============================================================ */
async function listTechSpecs(req, res, next) {
  try {
    const pageNum  = Math.max(parseInt(req.query.page)  || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 200);
    const offset   = (pageNum - 1) * limitNum;
    const { search, brand, category } = req.query;

    const conditions = [];
    const params = [];
    let idx = 1;

    if (search) {
      conditions.push(`(
        t.id::text ILIKE $${idx} OR t.brand ILIKE $${idx} OR t.model ILIKE $${idx}
        OR t.category ILIKE $${idx} OR t.year::text ILIKE $${idx}
        OR COALESCE(t.price_new::text, '') ILIKE $${idx} OR COALESCE(t.consumption, '') ILIKE $${idx}
        OR COALESCE(t.top_speed, '') ILIKE $${idx} OR COALESCE(t.norm_logo, '') ILIKE $${idx}
        OR COALESCE(t.engine::text, '') ILIKE $${idx} OR COALESCE(t.chassis::text, '') ILIKE $${idx}
        OR COALESCE(t.electronics::text, '') ILIKE $${idx} OR COALESCE(t.dimensions::text, '') ILIKE $${idx}
        OR COALESCE(i.name, '') ILIKE $${idx}
      )`);
      params.push(`%${escapeLike(search)}%`);
      idx++;
    }
    if (brand)    { conditions.push(`t.brand ILIKE $${idx++}`); params.push(brand); }
    if (category) { conditions.push(`t.category ILIKE $${idx++}`); params.push(category); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countRes = await query(
      `SELECT COUNT(*) FROM tech_specs t LEFT JOIN importers i ON i.id = t.importer_id ${where}`,
      params,
    );
    const total = parseInt(countRes.rows[0].count, 10);

    params.push(limitNum, offset);
    const { rows } = await query(
      `SELECT t.*,
              CASE WHEN i.id IS NULL THEN NULL ELSE jsonb_build_object(
                'id', i.id, 'name', i.name, 'logo_url', i.logo_url,
                'city', i.city
              ) END AS importer
         FROM tech_specs t
         LEFT JOIN importers i ON i.id = t.importer_id
         ${where}
        ORDER BY t.year DESC NULLS LAST, t.brand, t.model
        LIMIT $${idx++} OFFSET $${idx}`,
      params
    );
    res.json({
      specs: rows,
      total,
      page: pageNum,
      limit: limitNum,
      total_pages: Math.ceil(total / limitNum),
    });
  } catch (err) { next(err); }
}

/* ============================================================
 * Tips (conseils) — admin list (incl. drafts)
 * Mirrors listArticles so the admin panel can manage tips with the
 * same DX as actualités: filter by search/category/status, see drafts.
 * ============================================================ */
async function listTips(req, res, next) {
  try {
    const pageNum  = Math.max(parseInt(req.query.page)  || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 200);
    const offset   = (pageNum - 1) * limitNum;
    const { search, category, difficulty, status } = req.query;

    const conditions = [];
    const params = [];
    let idx = 1;

    if (search) {
      conditions.push(`(
        t.id::text ILIKE $${idx} OR t.title ILIKE $${idx} OR t.slug ILIKE $${idx}
        OR COALESCE(t.summary, '') ILIKE $${idx} OR COALESCE(t.content, '') ILIKE $${idx}
        OR t.category ILIKE $${idx} OR COALESCE(t.difficulty, '') ILIKE $${idx}
        OR COALESCE(t.tools::text, '') ILIKE $${idx} OR COALESCE(t.read_time, '') ILIKE $${idx}
        OR COALESCE(u.full_name, '') ILIKE $${idx}
      )`);
      params.push(`%${escapeLike(search)}%`);
      idx++;
    }
    if (category)  { conditions.push(`t.category = $${idx++}`); params.push(category); }
    if (difficulty){ conditions.push(`t.difficulty = $${idx++}`); params.push(difficulty); }
    if (status === 'published')  conditions.push('t.is_published = TRUE');
    if (status === 'draft')      conditions.push('t.is_published = FALSE');

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countRes = await query(`SELECT COUNT(*) FROM tips t LEFT JOIN users u ON t.author_id = u.id ${where}`, params);
    const total = parseInt(countRes.rows[0].count, 10);

    params.push(limitNum, offset);
    const { rows } = await query(
      `SELECT t.*, u.full_name AS author_name
         FROM tips t
         LEFT JOIN users u ON t.author_id = u.id
         ${where}
         ORDER BY t.created_at DESC NULLS LAST
         LIMIT $${idx++} OFFSET $${idx}`,
      params
    );
    res.json({
      tips: rows,
      total,
      page: pageNum,
      limit: limitNum,
      total_pages: Math.ceil(total / limitNum),
    });
  } catch (err) { next(err); }
}

module.exports = { listArticles, listTechSpecs, listTips };
