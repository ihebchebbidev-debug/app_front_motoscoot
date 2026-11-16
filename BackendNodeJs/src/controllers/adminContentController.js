/**
 * Admin content management — articles (actualités) and tech specs
 * (fiches techniques). Reuses the public CRUD controllers for write
 * operations; only adds privileged LIST endpoints that surface
 * unpublished/draft rows the public endpoints intentionally hide.
 */
const { query } = require('../config/database');
const {
  buildFilters: buildTechSpecFilters,
  orderBy: techSpecOrderBy,
  INCOMPLETE_SQL: TECH_SPEC_INCOMPLETE_SQL,
} = require('../utils/techSpecAdminList');

function escapeLike(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/* ============================================================
 * Articles — admin list (incl. drafts)
 * ============================================================ */
/**
 * ORDER BY for the admin lists: newest first (default) or most viewed
 * (?sort=views). Only these two fixed strings ever reach the SQL.
 */
function viewsOrder(sort, alias) {
  return sort === 'views'
    ? `COALESCE(${alias}.views_count, 0) DESC, ${alias}.created_at DESC NULLS LAST`
    : `${alias}.created_at DESC NULLS LAST`;
}

async function listArticles(req, res, next) {
  try {
    const pageNum  = Math.max(parseInt(req.query.page)  || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 200);
    const offset   = (pageNum - 1) * limitNum;
    const { search, category, status, sort } = req.query;

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
      `SELECT a.*, u.full_name AS author_name,
              COALESCE(a.views_count, 0)::int AS views_count,
              (SELECT COUNT(*) FROM article_views v
                WHERE v.article_id = a.id AND v.viewed_at > NOW() - INTERVAL '30 days')::int AS views_30d
         FROM articles a
         LEFT JOIN users u ON a.author_id = u.id
         ${where}
         ORDER BY ${viewsOrder(sort, 'a')}
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
// model_visits is created lazily by the public visit counter
// (techSpecsExtraController.ensureVisitTables): the "Plus consultées" sort
// only joins it once it exists.
let hasModelVisits = false;
async function modelVisitsExists() {
  if (hasModelVisits) return true;
  try {
    const { rows } = await query(`SELECT to_regclass('public.model_visits') IS NOT NULL AS ok`);
    hasModelVisits = !!(rows[0] && rows[0].ok);
  } catch { hasModelVisits = false; }
  return hasModelVisits;
}

async function listTechSpecs(req, res, next) {
  try {
    const pageNum  = Math.max(parseInt(req.query.page)  || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 200);
    const offset   = (pageNum - 1) * limitNum;

    const { base, params, statusSql, pub } = buildTechSpecFilters(req.query);
    const visits = await modelVisitsExists();
    const from = `FROM tech_specs t LEFT JOIN importers i ON i.id = t.importer_id`;
    const baseWhere = base.length ? `WHERE ${base.join(' AND ')}` : '';
    const listWhere = [...base, ...(statusSql ? [statusSql] : [])];

    // Status counters with every other filter applied (one query).
    const { rows: [c] } = await query(
      `SELECT COUNT(*)::int AS "all",
              COUNT(*) FILTER (WHERE ${pub})::int AS published,
              COUNT(*) FILTER (WHERE NOT ${pub})::int AS draft,
              COUNT(*) FILTER (WHERE ${TECH_SPEC_INCOMPLETE_SQL})::int AS incomplete
         ${from} ${baseWhere}`,
      params,
    );
    const counts = { all: c.all, published: c.published, draft: c.draft, incomplete: c.incomplete };
    const total = req.query.status && counts[req.query.status] !== undefined ? counts[req.query.status] : counts.all;

    // Brand and category choices for the filters, over the whole catalogue.
    const [{ rows: brands }, { rows: categories }] = await Promise.all([
      query(`SELECT MIN(TRIM(brand)) AS name, COUNT(*)::int AS count FROM tech_specs
              GROUP BY LOWER(TRIM(brand)) ORDER BY LOWER(TRIM(brand))`),
      query(`SELECT MIN(TRIM(category)) AS name, COUNT(*)::int AS count FROM tech_specs
              WHERE COALESCE(TRIM(category), '') <> ''
              GROUP BY LOWER(TRIM(category)) ORDER BY LOWER(TRIM(category))`),
    ]);

    const n = params.length;
    const { rows } = await query(
      `SELECT t.*,
              ${visits ? 'COALESCE(mv.visits, 0)::int' : '0'} AS visits,
              CASE WHEN i.id IS NULL THEN NULL ELSE jsonb_build_object(
                'id', i.id, 'name', i.name, 'logo_url', i.logo_url,
                'city', i.city
              ) END AS importer
         ${from}
         ${visits ? 'LEFT JOIN model_visits mv ON mv.brand = t.brand AND mv.model = t.model' : ''}
         ${listWhere.length ? `WHERE ${listWhere.join(' AND ')}` : ''}
        ORDER BY ${techSpecOrderBy(req.query.sort, visits)}
        LIMIT $${n + 1} OFFSET $${n + 2}`,
      [...params, limitNum, offset],
    );
    res.json({
      specs: rows,
      counts,
      facets: { brands, categories },
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
    const { search, category, difficulty, status, sort } = req.query;

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
      `SELECT t.*, u.full_name AS author_name,
              COALESCE(t.views_count, 0)::int AS views_count,
              (SELECT COUNT(*) FROM tip_views v
                WHERE v.tip_id = t.id AND v.viewed_at > NOW() - INTERVAL '30 days')::int AS views_30d
         FROM tips t
         LEFT JOIN users u ON t.author_id = u.id
         ${where}
         ORDER BY ${viewsOrder(sort, 't')}
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
