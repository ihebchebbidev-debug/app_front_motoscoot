/**
 * Choice lists of the deposit's « Données techniques » step.
 */

/** When /reference/conditions answers nothing (error, empty table), the
 *  required « État » still has its choices: the list the API serves today. */
export const DEFAULT_CONDITIONS = ['Neuf', 'État neuf', 'Excellent', 'Très bon', 'Bon', 'Correct', 'À réparer', 'Pour pièces'];

/**
 * The options plus the field's current value when the list does not hold it
 * (a draft restored before the list arrived, or a value the admin renamed):
 * the field shows what the form will publish, never « Choisir… ».
 */
export function optionsWithValue(options: string[], value?: string | null): string[] {
  const v = (value ?? '').trim();
  return v && !options.includes(v) ? [...options, v] : options;
}

/** « Modèle » example that fits what is sold (« TMAX 560 » on a helmet misled). */
const MODEL_EXAMPLES: Record<string, string> = {
  Moto: 'MT-07', Scooter: 'TMAX 560', Quad: 'Kodiak 450',
  Casque: 'Shoei GT-Air 3', Gant: 'Alpinestars SP-8', Veste: 'Dainese Super Speed', Pantalons: 'Rev’It Sand 4',
  Chaussures: 'TCX Street 3', Antivol: 'Abus Granit 59', Intercom: 'Cardo Packtalk Edge',
};

export function modelExample(category?: string, accessoryType?: string): string {
  const ex = (category === 'Accessoires' ? MODEL_EXAMPLES[accessoryType || ''] : MODEL_EXAMPLES[category || '']);
  return ex ? `Ex : ${ex}` : 'Ex : le nom du modèle';
}

/** One line under each condition (validated by the owner, 2026-11-13). */
export const CONDITION_HINTS: Record<string, string> = {
  'Neuf': "Jamais utilisé : 0 km, ou étiquette et emballage d'origine pour un accessoire.",
  'État neuf': "Très peu utilisé (moins de 1 000 km), aucune trace d'usure.",
  'Excellent': 'Entretien à jour, aucun défaut visible, rien à prévoir.',
  'Très bon': "Légères traces d'usage (petites rayures), tout fonctionne.",
  'Bon': 'Usure normale visible, fonctionne sans problème.',
  'Correct': 'Fonctionne, mais défauts visibles ou petites réparations à prévoir.',
  'À réparer': 'Ne fonctionne pas ou demande une réparation importante.',
  'Pour pièces': 'Vendu pour ses pièces, ne sera pas remis en état.',
};

/**
 * The admin's category photo for a tile: the 300 px thumbnail the upload
 * pipeline makes (~8 KB) and the 1200 px original for wide, dense screens.
 * Stored URLs can be absolute and in http:// (« http://<api>/uploads/x.webp »):
 * the /uploads/ path is kept and served from the API origin over https.
 */
export function categoryTileImage(url: string | null | undefined, apiOrigin: string): { src: string; srcSet?: string } | null {
  if (!url) return null;
  const i = url.indexOf('/uploads/');
  if (i < 0) return url.startsWith('/') || /^https:/i.test(url) ? { src: url } : null;
  const path = url.slice(i); // /uploads/<file> or /uploads/thumbnails/thumb_<file>
  const file = path.slice('/uploads/'.length);
  if (file.includes('/')) return { src: `${apiOrigin}${path}` };
  const full = `${apiOrigin}/uploads/${file}`;
  const thumb = `${apiOrigin}/uploads/thumbnails/thumb_${file}`;
  return { src: thumb, srcSet: `${thumb} 300w, ${full} 1200w` };
}
