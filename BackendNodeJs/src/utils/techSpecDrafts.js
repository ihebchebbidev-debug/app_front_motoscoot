/**
 * Fiches techniques en brouillon (tech_specs.is_published).
 *
 * A draft fiche is invisible to visitors and crawlers: public lists, search,
 * the detail page (404), popular brands, importer brand lists and the
 * sitemap all skip it. Only the back-office sees it.
 *
 * Migrations on the API server are run by hand (`npm run migrate`), so the
 * code must not break if 039 has not been applied yet:
 *   - reads use `publishedSql(alias)`, which reads the column through
 *     to_jsonb() and treats a missing column as "published" (today's
 *     behaviour) — no error, nothing hidden;
 *   - admin writes call `ensurePublishedColumn()`, which adds the column
 *     itself (idempotent ALTER … IF NOT EXISTS, same idea as
 *     ensureVisitTables) before storing a draft.
 * tech_specs holds a few hundred rows, so to_jsonb() per row costs nothing.
 */

/** SQL condition "this fiche is published" for the tech_specs alias given. */
function publishedSql(alias = 't') {
  return `COALESCE((to_jsonb(${alias})->>'is_published')::boolean, TRUE)`;
}

let ensured = false;

/**
 * Make sure tech_specs.is_published exists. Returns true when it does,
 * false when the database refused (permissions…) — callers then fall back
 * to today's behaviour (no draft support) instead of failing the save.
 */
async function ensurePublishedColumn(query) {
  if (ensured) return true;
  try {
    await query('ALTER TABLE tech_specs ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT TRUE');
    ensured = true;
  } catch (e) {
    ensured = false;
  }
  return ensured;
}

/** Test hook: forget the cached result. */
function _resetEnsured() { ensured = false; }

module.exports = { publishedSql, ensurePublishedColumn, _resetEnsured };
