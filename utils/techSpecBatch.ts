/**
 * Reading a lot file for "Importer un lot" (admin › Fiches techniques).
 *
 * The file is JSON: a list of fiches, or { "fiches": [...] }, each in the
 * admin form payload shape (brand, model, year, category, engine{}, …).
 * The server re-validates everything (BackendNodeJs/src/utils/techSpecImport.js);
 * this only reads the file and builds the preview the admin checks before
 * sending, so obvious mistakes show up before any request.
 */

export const BATCH_MAX = 50;

export interface BatchPreviewRow {
  index: number;
  label: string;
  category: string;
  /** French reason when the server will certainly refuse this fiche. */
  problem?: string;
  hasPhoto: boolean;
}

export type BatchParse =
  | { ok: true; fiches: unknown[]; rows: BatchPreviewRow[] }
  | { ok: false; error: string };

const text = (v: unknown): string =>
  typeof v === 'string' ? v.trim() : typeof v === 'number' && Number.isFinite(v) ? String(v) : '';

export function parseBatch(raw: string): BatchParse {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'Le fichier n’est pas un JSON valide.' };
  }
  const list = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as { fiches?: unknown }).fiches)
      ? (data as { fiches: unknown[] }).fiches
      : null;
  if (!list) return { ok: false, error: 'Le fichier doit contenir une liste de fiches.' };
  if (list.length === 0) return { ok: false, error: 'Le lot est vide.' };
  if (list.length > BATCH_MAX) {
    return { ok: false, error: `Lot trop gros : ${list.length} fiches (maximum ${BATCH_MAX} par import).` };
  }

  const rows = list.map((item, index): BatchPreviewRow => {
    const f = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const brand = text(f.brand);
    const model = text(f.model);
    const year = Number(f.year);
    const category = text(f.category);
    let problem: string | undefined;
    if (!brand) problem = 'Marque manquante';
    else if (!model) problem = 'Modèle manquant';
    else if (!Number.isInteger(year) || year < 1900 || year > 2100) problem = 'Année invalide';
    else if (!category) problem = 'Catégorie manquante';
    const image = text(f.image);
    return {
      index,
      label: [brand, model, Number.isInteger(year) ? year : ''].filter(Boolean).join(' ') || `Fiche n° ${index + 1}`,
      category,
      problem,
      hasPhoto: image.startsWith('/uploads/') || /^https:\/\/(www\.)?moto-scoot\.tn\/uploads\//.test(image),
    };
  });
  return { ok: true, fiches: list, rows };
}
