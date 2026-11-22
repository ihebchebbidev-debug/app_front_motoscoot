/**
 * Validation of a lot of fiches techniques imported from the back-office
 * ("Importer un lot", POST /admin/tech-specs/import).
 *
 * Each item uses the same shape as the admin form payload
 * (components/admin/TechSpecsTab.tsx buildPayload): brand, model, year,
 * category, price_new, engine{}, chassis{}, electronics{}, maintenance{}, colors[],
 * dimensions{}, consumption, top_speed, image, gallery.
 *
 * Rules:
 *   - brand, model (≤ 100 chars), year (1900–2100) and category (≤ 50) are
 *     required; an item missing one is rejected with a French reason.
 *   - Only the known keys of each section are kept, as trimmed strings
 *     (≤ 300 chars); anything else is dropped silently.
 *   - Images: only files already in our upload pipeline (/uploads/…) are
 *     kept. A link to another site (constructor, competitor) is dropped
 *     with a warning — photos go through /api/uploads, never hotlinked.
 */

const { normalizeColors } = require('./techSpecColors');

const MAX_ITEMS = 50;

const SECTIONS = {
  engine: ['type', 'cc', 'power', 'torque', 'fuelSystem', 'cooling', 'transmission'],
  chassis: ['frame', 'suspensionFront', 'travelFront', 'suspensionRear', 'travelRear',
    'brakesFront', 'brakesRear', 'tireFront', 'tireRear'],
  electronics: ['abs', 'tcs', 'ridingModes', 'quickshifter', 'lighting', 'usb', 'dashboard',
    'connectivity', 'cruiseControl', 'keyless', 'other'],
  maintenance: ['warranty', 'firstService', 'serviceInterval'],
  dimensions: ['weight', 'seatHeight', 'tank', 'length', 'wheelbase'],
};

const UPLOAD_RE = /^(?:https:\/\/(?:www\.)?moto-scoot\.tn)?\/uploads\/[A-Za-z0-9._-]+$/;

function str(v, max) {
  if (typeof v === 'number' && Number.isFinite(v)) v = String(v);
  if (typeof v !== 'string') return '';
  const s = v.trim().replace(/\s+/g, ' ');
  return s.length > max ? s.slice(0, max) : s;
}

function section(raw, keys) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const k of keys) {
    const s = str(raw[k], 300);
    if (s) out[k] = s;
  }
  return out;
}

/** Same normalisation as ms_slugify in SQL, used to spot duplicates. */
function slugKey(s) {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/**
 * Validate one item. Returns { fiche } or { error }, plus warnings[].
 */
function normalizeItem(raw) {
  const warnings = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { error: 'Ce n’est pas une fiche (objet attendu)', warnings };
  }
  const brand = str(raw.brand, 100);
  const model = str(raw.model, 100);
  const category = str(raw.category, 50);
  const year = Number(raw.year);
  if (!brand) return { error: 'Marque manquante', warnings };
  if (!model) return { error: 'Modèle manquant', warnings };
  if (!Number.isInteger(year) || year < 1900 || year > 2100) {
    return { error: `Année invalide (${raw.year === undefined ? 'absente' : raw.year})`, warnings };
  }
  if (!category) return { error: 'Catégorie manquante', warnings };

  const image = str(raw.image, 500);
  let keptImage = null;
  if (image) {
    if (UPLOAD_RE.test(image)) keptImage = image;
    else warnings.push('Photo principale ignorée : elle doit être envoyée sur moto-scoot.tn (pas un lien externe)');
  }
  const gallery = [];
  if (Array.isArray(raw.gallery)) {
    let dropped = 0;
    for (const g of raw.gallery) {
      const s = str(g, 500);
      if (s && UPLOAD_RE.test(s)) gallery.push(s);
      else if (s) dropped++;
    }
    if (dropped) warnings.push(`${dropped} photo(s) de galerie ignorée(s) : liens externes`);
  }

  const price = raw.price_new === null || raw.price_new === undefined ? '' : str(raw.price_new, 50);

  return {
    warnings,
    fiche: {
      brand,
      model,
      year,
      category,
      price_new: price || null,
      image: keptImage,
      gallery,
      engine: section(raw.engine, SECTIONS.engine),
      chassis: section(raw.chassis, SECTIONS.chassis),
      electronics: section(raw.electronics, SECTIONS.electronics),
      maintenance: section(raw.maintenance, SECTIONS.maintenance),
      colors: normalizeColors(raw.colors),
      dimensions: section(raw.dimensions, SECTIONS.dimensions),
      consumption: str(raw.consumption, 50) || null,
      top_speed: str(raw.top_speed, 50) || null,
      available_in_tunisia: raw.available_in_tunisia !== false,
    },
  };
}

/** Accepts { fiches: [...] } or a bare array. Returns the list or an error. */
function readBatch(body) {
  const list = Array.isArray(body) ? body : (body && Array.isArray(body.fiches) ? body.fiches : null);
  if (!list) return { error: 'Fichier attendu : une liste de fiches (ou { "fiches": [...] })' };
  if (list.length === 0) return { error: 'Le lot est vide' };
  if (list.length > MAX_ITEMS) return { error: `Lot trop gros : ${list.length} fiches (maximum ${MAX_ITEMS} par import)` };
  return { list };
}

module.exports = { normalizeItem, readBatch, slugKey, MAX_ITEMS, SECTIONS };
