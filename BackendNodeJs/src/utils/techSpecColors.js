/**
 * Couleurs d'une fiche technique (tech_specs.colors, TEXT[]).
 *
 * Migrations on the API server are run by hand (`npm run migrate`), so the
 * code must not break if 042 has not been applied yet (same idea as
 * techSpecDrafts.js):
 *   - reads use `SELECT t.*`: without the column a fiche simply has no
 *     colours;
 *   - admin writes call `ensureColorsColumn()`, which adds the column itself
 *     (idempotent ALTER … IF NOT EXISTS). If the database refuses, the
 *     colours are left out and the rest of the fiche is saved as before.
 */

const MAX_COLORS = 20;
const MAX_LENGTH = 40;

/**
 * Accepts a list (["Blanc", "Noir mat"]) or one text ("Blanc, Noir mat" or
 * one per line). Returns trimmed names, each once (case-insensitive), at
 * most 20 of 40 characters. Anything else gives [].
 */
function normalizeColors(value) {
  let list;
  if (Array.isArray(value)) list = value;
  else if (typeof value === 'string') list = value.split(/[,;\n]/);
  else return [];
  const seen = new Set();
  const out = [];
  for (const item of list) {
    if (typeof item !== 'string') continue;
    const name = item.trim().replace(/\s+/g, ' ').slice(0, MAX_LENGTH).trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
    if (out.length === MAX_COLORS) break;
  }
  return out;
}

let ensured = false;

/** Make sure tech_specs.colors exists. True when it does, false when the database refused. */
async function ensureColorsColumn(query) {
  if (ensured) return true;
  try {
    await query("ALTER TABLE tech_specs ADD COLUMN IF NOT EXISTS colors TEXT[] NOT NULL DEFAULT '{}'");
    ensured = true;
  } catch (e) {
    ensured = false;
  }
  return ensured;
}

/** Test hook: forget the cached result. */
function _resetEnsured() { ensured = false; }

module.exports = { normalizeColors, ensureColorsColumn, _resetEnsured, MAX_COLORS };
