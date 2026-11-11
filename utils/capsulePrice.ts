/**
 * What the fiche's floating capsule shows for the new price
 * (tech_specs.price_new: free text up to 50 characters, typed in the admin;
 * services/techSpecsApi.ts fmtPrice formats a plain number as « 9 000 DT »,
 * keeps any other text as typed, and turns an empty one into « — »).
 *
 * - an amount (« 9 000 DT »): the amount, « Prix neuf TTC » under it;
 * - other text (« Sur demande », « À partir de 35 000 DT (selon finition) »):
 *   the text in full on up to two lines, no « Prix neuf TTC » under it;
 * - nothing (« — », « N/C »): « Prix non communiqué ».
 */
export type CapsulePrice =
  | { kind: 'amount'; main: string; sub: 'Prix neuf TTC' }
  | { kind: 'text'; main: string; sub: null }
  | { kind: 'none'; main: 'Prix non communiqué'; sub: null };

export function capsulePrice(raw?: string | null): CapsulePrice {
  const v = String(raw ?? '').replace(/\s+/g, ' ').trim(); // \s also matches the non-breaking spaces
  if (!v || /^[—–-]+$/.test(v) || /^n\s*\/?\s*c\.?$/i.test(v)) return { kind: 'none', main: 'Prix non communiqué', sub: null };
  const shown = String(raw).trim(); // keeps fmtPrice's non-breaking spaces
  if (/^\d[\d\s.,]*\s?DT$/i.test(v)) return { kind: 'amount', main: shown, sub: 'Prix neuf TTC' };
  return { kind: 'text', main: shown, sub: null };
}
