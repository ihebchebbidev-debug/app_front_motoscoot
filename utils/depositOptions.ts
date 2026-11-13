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
