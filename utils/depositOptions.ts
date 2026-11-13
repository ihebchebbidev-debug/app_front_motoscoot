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
