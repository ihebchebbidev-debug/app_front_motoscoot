/**
 * Admin › Fiches techniques list: filters, sort and status counters.
 * Used by adminContentController.listTechSpecs (GET /admin/tech-specs).
 *
 * Query string (every value is optional):
 *   status   = published | draft | incomplete
 *   brand    = exact brand (case and outer spaces ignored)
 *   category = exact category (case and outer spaces ignored)
 *   tunisia  = true | false   (available_in_tunisia)
 *   search   = free text over brand, model, specs, importer
 *   sort     = recent (default) | updated | brand | year | views
 *
 * Only the fixed SQL fragments below ever reach ORDER BY: an unknown sort
 * falls back to "recent".
 */
const { publishedSql } = require('./techSpecDrafts');

/** A fiche is "à compléter" without a photo, or without both cc and power.
 *  Same rule as the "Publier" confirmation in components/admin/TechSpecsTab.tsx. */
const INCOMPLETE_SQL = `(COALESCE(t.image, '') = ''
  OR (COALESCE(t.engine->>'cc', '') = '' AND COALESCE(t.engine->>'power', '') = ''))`;

const SORTS = {
  recent: 't.created_at DESC NULLS LAST, t.brand ASC, t.model ASC',
  updated: 'COALESCE(t.updated_at, t.created_at) DESC NULLS LAST, t.brand ASC, t.model ASC',
  brand: 'LOWER(t.brand) ASC, LOWER(t.model) ASC, t.year DESC',
  year: 't.year DESC NULLS LAST, LOWER(t.brand) ASC, LOWER(t.model) ASC',
  views: 'visits DESC, t.created_at DESC NULLS LAST',
};

function escapeLike(s) {
  return String(s).replace(/[\\%_]/g, (m) => '\\' + m);
}

/**
 * Build the WHERE parts. `base` holds every filter except the status one,
 * so the status counters show what each tab would contain with the other
 * filters applied.
 */
function buildFilters(q = {}) {
  const base = [];
  const params = [];
  const add = (sqlFn, value) => { params.push(value); base.push(sqlFn(`$${params.length}`)); };

  if (q.search) {
    add((p) => `(
        t.brand ILIKE ${p} OR t.model ILIKE ${p} OR (t.brand || ' ' || t.model) ILIKE ${p}
        OR t.category ILIKE ${p} OR t.year::text ILIKE ${p}
        OR COALESCE(t.price_new::text, '') ILIKE ${p} OR COALESCE(t.consumption, '') ILIKE ${p}
        OR COALESCE(t.top_speed, '') ILIKE ${p}
        OR COALESCE(t.engine::text, '') ILIKE ${p} OR COALESCE(t.chassis::text, '') ILIKE ${p}
        OR COALESCE(t.electronics::text, '') ILIKE ${p} OR COALESCE(t.dimensions::text, '') ILIKE ${p}
        OR COALESCE(i.name, '') ILIKE ${p}
      )`, `%${escapeLike(String(q.search).trim())}%`);
  }
  if (q.brand) add((p) => `LOWER(TRIM(t.brand)) = LOWER(TRIM(${p}))`, String(q.brand));
  if (q.category) add((p) => `LOWER(TRIM(t.category)) = LOWER(TRIM(${p}))`, String(q.category));
  if (q.tunisia === 'true') base.push('t.available_in_tunisia = TRUE');
  if (q.tunisia === 'false') base.push('t.available_in_tunisia = FALSE');

  const pub = publishedSql('t');
  const statusSql = {
    published: pub,
    draft: `NOT ${pub}`,
    incomplete: INCOMPLETE_SQL,
  }[q.status];

  return { base, params, statusSql, pub };
}

function orderBy(sort, hasVisits) {
  if (sort === 'views' && !hasVisits) return SORTS.recent;
  return SORTS[sort] || SORTS.recent;
}

module.exports = { buildFilters, orderBy, INCOMPLETE_SQL, SORTS };
