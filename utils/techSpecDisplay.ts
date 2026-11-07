import { ccValue, powerValue, priceValue } from './techSpecSort';

/**
 * Short values for the model cards (brand page, price guides, similar
 * models). The catalogue writes them freely (« 124.6 CC », « 124.6 cm³ »,
 * « 9.3 kW (12.6 ch) à 8000 tr/min », « En arrivage »): on a card they were
 * cut mid-way and changed unit from one card to the next. The full wording
 * stays on the model's own sheet.
 */

/** French decimal comma, at most one decimal: 124.65 → « 124,7 ». */
const fr = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',');

/** « 124.6 CC », « 399 cm³ » → « 124,6 cc » ; nothing readable → « — ». */
export function ccLabel(cc?: string): string {
  const n = ccValue(cc);
  return n === null ? '—' : `${fr(n)} cc`;
}

/** « 9.3 kW (12.6 ch) à 8000 tr/min » → « 12,6 ch » ; « 6.5 kW » → « 8,8 ch ». */
export function powerLabel(power?: string): string {
  const n = powerValue(power);
  return n === null ? '—' : `${fr(n)} ch`;
}

/** « 10.3 Nm à 6500 tr/min » → « 10,3 Nm ». */
export function torqueLabel(torque?: string): string {
  const m = (torque || '').match(/(\d+(?:[.,]\d+)?)\s*n\.?m/i);
  if (!m) return '—';
  const n = parseFloat(m[1].replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? `${fr(n)} Nm` : '—';
}

export type PriceLabel = { kind: 'price'; text: string } | { kind: 'status'; text: string };

/**
 * A real price (« 9 000 DT ») or a state (« En arrivage », « Épuisé »…).
 * A state used to look exactly like a price: orange and heavy.
 */
export function priceLabel(priceNew?: string): PriceLabel {
  const raw = (priceNew || '').trim();
  if (!raw) return { kind: 'status', text: 'Prix non annoncé' };
  const n = priceValue(raw);
  // « Épuisé (29000 DT) » has a number but is a state first.
  if (n === null || /^[^\d]*[a-zéèàù]{4,}/i.test(raw.replace(/^à partir de/i, ''))) {
    return { kind: 'status', text: raw };
  }
  // Non-breaking spaces (NBSP): « 9 000 DT » never splits over two lines.
  const NBSP = String.fromCharCode(0xa0);
  const amount = Math.round(n).toLocaleString('fr-FR').replace(/\s/g, NBSP);
  return { kind: 'price', text: `${/^à partir de/i.test(raw) ? `Dès${NBSP}` : ''}${amount}${NBSP}DT` };
}
