const { query } = require('../config/database');
const { subscribedSql } = require('../utils/importerSubscription');
const { buildUpdate, validateRequired } = require('../utils/queryHelpers');
const { publishedSql, ensurePublishedColumn } = require('../utils/techSpecDrafts');
const { normalizeItem, readBatch, slugKey } = require('../utils/techSpecImport');
const { normalizeColors, ensureColorsColumn } = require('../utils/techSpecColors');

// Whitelisted columns the admin can update via PUT. Includes the JSONB
// sub-objects (engine/chassis/electronics/dimensions) AND norm_logo so the
// public details page can render the emission-norm badge.
const SPEC_FIELDS = [
  'brand', 'model', 'year', 'category', 'price_new', 'image', 'gallery',
  'engine', 'chassis', 'electronics', 'dimensions',
  'consumption', 'top_speed', 'norm_logo', 'importer_id',
  'available_in_tunisia', 'maintenance', 'is_published', 'colors',
];

// Public-facing visibility filter. Used by /tech-specs/brands and
// /tech-specs/brands/:brand so the landing-page "Neuf" flow only exposes
// fiches the customer can actually buy locally. Admin endpoints (under
// /admin/tech-specs) bypass this filter and see every row.
const PUBLIC_VISIBLE_WHERE = `t.available_in_tunisia = TRUE`;

function shouldFilterTunisia(req) {
  return req.query.available_in_tunisia === 'true' || req.query.availableInTunisia === 'true';
}

// Fields selected from `importers` for the embedded payload returned with
// each fiche technique. Kept lean to avoid leaking admin-only data.
const IMPORTER_JSON =
  `CASE WHEN i.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', i.id, 'name', i.name, 'logo_url', i.logo_url,
      'address', i.address, 'city', i.city, 'phone', i.phone,
      'whatsapp', i.whatsapp, 'email', i.email, 'website', i.website,
      'description', i.description, 'rating', i.rating,
      'reviews_count', i.reviews_count,
      'subscribed', ${subscribedSql('i')}
    ) END AS importer`;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Unique slug "brand-model", then "-year", then "-year-N" on collision. */
async function uniqueSlug(brand, model, year, excludeId = null) {
  const { rows: [{ base }] } = await query('SELECT ms_slugify($1) AS base', [`${brand || ''} ${model || ''}`]);
  const b = base || 'fiche';
  const candidates = [b, `${b}-${year}`];
  for (let n = 2; n < 50; n++) candidates.push(`${b}-${year}-${n}`);
  for (const c of candidates) {
    const { rows } = await query('SELECT 1 FROM tech_specs WHERE slug = $1 AND ($2::uuid IS NULL OR id <> $2::uuid)', [c, excludeId]);
    if (rows.length === 0) return c;
  }
  return `${b}-${Date.now()}`;
}

// Drafts (is_published = FALSE) never reach a public endpoint.
const PUBLISHED = publishedSql('t');

async function getBrands(req, res, next) {
  try {
    const where = `WHERE ${PUBLISHED}${shouldFilterTunisia(req) ? ` AND ${PUBLIC_VISIBLE_WHERE}` : ''}`;
    // Public list: only count brands that have at least one fiche
    // marked available_in_tunisia. A brand whose every fiche is unticked
    // disappears from the landing-page Neuf flow.
    const { rows } = await query(
      `SELECT brand, COUNT(*) AS models_count
         FROM tech_specs t
        ${where}
        GROUP BY brand
        ORDER BY brand`
    );
    res.json(rows);
  } catch (err) { next(err); }
}

async function getModels(req, res, next) {
  try {
    const visibilityClause = shouldFilterTunisia(req) ? `AND ${PUBLIC_VISIBLE_WHERE}` : '';
    // Return enough columns for the public model cards (image + key engine
    // figures) so we don't need a second round-trip per row. The importer
    // JOIN is intentionally LEFT so models without an assigned importer
    // still appear in the listing.
    const { rows } = await query(
      `SELECT t.id, t.slug, t.brand, t.model, t.year, t.category, t.price_new, t.image, t.gallery,
              t.engine, t.chassis, t.electronics, t.dimensions,
              t.consumption, t.top_speed, t.norm_logo, t.importer_id,
              t.available_in_tunisia,
              ${IMPORTER_JSON}
         FROM tech_specs t
         LEFT JOIN importers i ON i.id = t.importer_id
        WHERE t.brand ILIKE $1
          AND ${PUBLISHED}
          ${visibilityClause}
        ORDER BY t.year DESC, t.model`,
      [req.params.brand]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

async function getById(req, res, next) {
  try {
    const { rows } = await query(
      `SELECT t.*, ${IMPORTER_JSON}
         FROM tech_specs t
         LEFT JOIN importers i ON i.id = t.importer_id
        WHERE ${UUID_RE.test(String(req.params.id)) ? 't.id = $1' : 't.slug = $1'}
          AND ${PUBLISHED}`,
      [String(req.params.id).toLowerCase()],
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Tech spec not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    // Only brand/model/year are truly required — category defaults to
    // 'Roadster' so a hurried admin save doesn't fail. The optional sub-
    // objects default to {} so the JSONB columns never receive null.
    const err = validateRequired(req.body, ['brand', 'model', 'year']);
    if (err) return res.status(400).json({ error: err });

    const {
      brand, model, year,
      category = 'Roadster',
      price_new = null,
      image = null,
      gallery,
      engine, chassis, electronics, dimensions,
      consumption = null,
      top_speed = null,
      norm_logo = null,
      importer_id = null,
      available_in_tunisia = true,
      maintenance,
      is_published,
      colors,
    } = req.body;
    // A draft can only be stored once the column exists; without it the
    // fiche is created as before (published).
    const draftCol = is_published === false && await ensurePublishedColumn(query);
    // Colours are stored once the column exists; without it the fiche is saved without them.
    const colorList = normalizeColors(colors);
    const colorsCol = colorList.length > 0 && await ensureColorsColumn(query);

    // A unique-index race is retried, never exposed as a failed duplicate model save.
    for (let attempt = 0; attempt < 5; attempt++) {
      const slug = await uniqueSlug(brand, model, year);
      try {
    const { rows } = await query(
      `INSERT INTO tech_specs
         (brand, model, year, category, price_new, image, gallery,
          engine, chassis, electronics, dimensions,
          consumption, top_speed, norm_logo, importer_id, available_in_tunisia, maintenance, slug
          ${draftCol ? ', is_published' : ''}${colorsCol ? ', colors' : ''})
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18${draftCol ? ',FALSE' : ''}${colorsCol ? ',$19' : ''})
       RETURNING *`,
      [
        brand, model, year, category, price_new, image,
        Array.isArray(gallery) ? gallery : (gallery || []),
        engine || {}, chassis || {}, electronics || {}, dimensions || {},
        consumption, top_speed, norm_logo, importer_id,
        available_in_tunisia !== false,
        maintenance || {},
        slug,
        ...(colorsCol ? [colorList] : []),
      ]
    );
    res.status(201).json(rows[0]);
    return;
      } catch (error) {
        if (error.code !== '23505' || error.constraint !== 'tech_specs_slug_key' || attempt === 4) throw error;
      }
    }
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    let body = req.body;
    if (body && 'is_published' in body) {
      if (await ensurePublishedColumn(query)) body = { ...body, is_published: body.is_published !== false };
      else { body = { ...body }; delete body.is_published; }
    }
    if (body && 'colors' in body) {
      if (await ensureColorsColumn(query)) body = { ...body, colors: normalizeColors(body.colors) };
      else { body = { ...body }; delete body.colors; }
    }
    const upd = buildUpdate(body, SPEC_FIELDS);
    if (!upd) return res.status(400).json({ error: 'No fields to update' });

    upd.params.push(req.params.id);
    const { rows } = await query(
      `UPDATE tech_specs SET ${upd.sets} WHERE id = $${upd.nextIdx} RETURNING *`,
      upd.params
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
}

/**
 * POST /admin/tech-specs/import — create a lot of fiches as DRAFTS.
 * Body: { fiches: [...] } (or a bare array), max 50 per call, same shape as
 * the admin form payload. Each fiche is validated on its own: a bad one is
 * reported and skipped, the others are created. A fiche already in the
 * catalogue (same brand, same model name, same year), or twice in the lot,
 * is skipped. The brand keeps the spelling already used on the site
 * ("SYM", not "Sym") so a brand page never splits in two.
 */
async function importBatch(req, res, next) {
  try {
    const batch = readBatch(req.body);
    if (batch.error) return res.status(400).json({ error: batch.error });
    if (!(await ensurePublishedColumn(query))) {
      return res.status(503).json({
        error: 'Le statut brouillon n’est pas disponible sur la base de données : lancez la migration 039 avant d’importer.',
      });
    }

    const { rows: existing } = await query('SELECT brand, model, year FROM tech_specs');
    const brandSpelling = new Map();
    const taken = new Set();
    for (const r of existing) {
      brandSpelling.set(slugKey(r.brand), r.brand);
      taken.add(`${slugKey(r.brand)}|${slugKey(r.model)}|${r.year}`);
    }

    // Colours of the lot are kept when the column exists (or can be added);
    // a lot without colours does not touch the column.
    const colorsCol = batch.list.some((x) => normalizeColors(x && x.colors).length > 0) && await ensureColorsColumn(query);

    const created = [];
    const skipped = [];
    const warnings = [];
    for (let i = 0; i < batch.list.length; i++) {
      const { fiche, error, warnings: w } = normalizeItem(batch.list[i]);
      const label = fiche ? `${fiche.brand} ${fiche.model} ${fiche.year}` : `Fiche n° ${i + 1}`;
      if (error) { skipped.push({ index: i, label, reason: error }); continue; }
      fiche.brand = brandSpelling.get(slugKey(fiche.brand)) || fiche.brand;
      const key = `${slugKey(fiche.brand)}|${slugKey(fiche.model)}|${fiche.year}`;
      if (taken.has(key)) { skipped.push({ index: i, label, reason: 'Déjà présente sur le site (ou deux fois dans le lot)' }); continue; }
      for (const msg of w) warnings.push({ index: i, label, message: msg });

      let row = null;
      for (let attempt = 0; attempt < 5 && !row; attempt++) {
        const slug = await uniqueSlug(fiche.brand, fiche.model, fiche.year);
        try {
          const { rows } = await query(
            `INSERT INTO tech_specs
               (brand, model, year, category, price_new, image, gallery,
                engine, chassis, electronics, dimensions, maintenance,
                consumption, top_speed, available_in_tunisia, slug, is_published${colorsCol ? ', colors' : ''})
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,FALSE${colorsCol ? ',$17' : ''})
             RETURNING id, slug, brand, model, year`,
            [
              fiche.brand, fiche.model, fiche.year, fiche.category, fiche.price_new,
              fiche.image, fiche.gallery,
              fiche.engine, fiche.chassis, fiche.electronics, fiche.dimensions, fiche.maintenance,
              fiche.consumption, fiche.top_speed, fiche.available_in_tunisia, slug,
              ...(colorsCol ? [fiche.colors] : []),
            ],
          );
          row = rows[0];
        } catch (e) {
          if (e.code !== '23505' || e.constraint !== 'tech_specs_slug_key' || attempt === 4) throw e;
        }
      }
      taken.add(key);
      brandSpelling.set(slugKey(fiche.brand), fiche.brand);
      created.push(row);
    }
    res.status(created.length ? 201 : 200).json({ created, skipped, warnings });
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    const result = await query('DELETE FROM tech_specs WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
}

module.exports = { getBrands, getModels, getById, create, update, remove, importBatch };
