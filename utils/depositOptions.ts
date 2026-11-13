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


/** The usual cylinder sizes, in cc (the list of « Cylindrée »). */
export const CC_OPTIONS = [
  '50', '80', '100', '110', '125', '150', '180', '200', '250', '300',
  '350', '400', '450', '500', '530', '560', '600', '650', '700', '750',
  '800', '850', '900', '1000', '1100', '1200', '1300', '1400', '1600', '1800',
];
/** The list choice that opens the number field (never stored). */
export const CC_CUSTOM = '__saisir__';
/** Typed sizes: 30 to 3 000 cc (a 49 cc scooter, a 2 458 cc Rocket 3). */
export const CC_MIN = 30;
export const CC_MAX = 3000;
export const CC_MESSAGE = 'Cylindrée : un nombre entre 30 et 3 000 cc';

/** Held by the list (sizes, Électrique, Autre): no number field needed. */
export const isListedCc = (v: string): boolean => CC_OPTIONS.includes(v) || v === 'Électrique' || v === 'Autre';

/** Digits only, no leading zeros (« 01250 » → « 1250 »). */
export const cleanCc = (v: string): string => v.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 4);

/** A value the form accepts for « Cylindrée ». */
export function ccIsValid(v?: string | null): boolean {
  if (!v || isListedCc(v)) return true;
  if (!/^\d{1,4}$/.test(v)) return false;
  const n = Number(v);
  return n >= CC_MIN && n <= CC_MAX;
}
