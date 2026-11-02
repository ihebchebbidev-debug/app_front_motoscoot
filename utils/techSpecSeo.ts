/**
 * Title and meta description of a technical sheet (/fiche-technique/<slug>).
 * Shared by the React page and the crawler prerender (api/og-prerender.ts)
 * so both always send the same text.
 *
 * Titre :       {Marque} {Modèle} | Prix en Tunisie & Fiche Technique
 * Description : Prix de la {Marque} {Modèle} en Tunisie : {Prix} DT.
 *               Fiche technique : {cylindrée} cm³, {puissance} ch, {poids} kg.
 *               Comparez et choisissez votre moto.
 * Scooters ("Scooter", "Maxi Scooter", "Scooter / Adventure (ADV)") read
 * "Prix du …" and "votre scooter"; every other category keeps "la" / "moto".
 * Missing values are left out rather than shown as "N/A".
 */

export interface TechSpecSeoInput {
  brand?: string | null;
  model?: string | null;
  category?: string | null;
  /** Raw API value or formatted string ("9000", "9 000 DT"). */
  price?: number | string | null;
  cc?: string | null;
  power?: string | null;
  weight?: string | null;
}

const fmt = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 1 });

const firstNumber = (v: unknown): number | null => {
  const m = String(v ?? '').match(/\d+(?:[.,]\d+)?/);
  if (!m) return null;
  const n = parseFloat(m[0].replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
};

const priceNumber = (v: unknown): number | null => {
  const digits = String(v ?? '').replace(/[^\d]/g, '');
  const n = digits ? parseInt(digits, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
};

// Power is stored as "12.6 ch", "15 cv", "9.2 kW" or "15 ch (11 kW)"; the
// description shows ch. Only the unit right after the first number counts.
export const powerCh = (v: unknown): number | null => {
  const m = String(v ?? '').match(/(\d+(?:[.,]\d+)?)\s*(kw)?/i);
  const n = m ? parseFloat(m[1].replace(',', '.')) : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  return m?.[2] ? Math.round(n * 1.35962 * 10) / 10 : n;
};

/** "12,6 ch" from any stored power value ("9.3 kW (12.6 ch) à 8000 tr/min", "15 cv"), or ''. */
export const formatPowerCh = (v: unknown): string => {
  const n = powerCh(v);
  return n !== null ? `${fmt(n)} ch` : '';
};

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

export interface TechSpecSummaryInput extends TechSpecSeoInput {
  year?: string | number | null;
  /** Category as typed in the admin ("Maxi Scooter"), not the filter bucket. */
  categoryLabel?: string | null;
  /** ISO date of the last update, shown as the month the price was checked. */
  updatedAt?: string | null;
  importerName?: string | null;
  importerCity?: string | null;
}

/**
 * Answer-first sentence of a technical sheet, shown on the page and sent to
 * crawlers (api/og-prerender.ts): model, displacement, power, new price in DT
 * with the month it was checked, importer.
 */
export function techSpecSummary(s: TechSpecSummaryInput): string {
  const name = [s.brand, s.model].filter(Boolean).join(' ').trim();
  const cc = firstNumber(s.cc);
  const p = priceNumber(s.price);
  const checked = s.updatedAt ? new Date(s.updatedAt) : null;
  const checkedLabel = checked && !Number.isNaN(checked.getTime()) ? `${MONTHS[checked.getUTCMonth()]} ${checked.getUTCFullYear()}` : '';
  return [
    `${name}${s.year ? ` (${s.year})` : ''}${s.categoryLabel ? ` : ${String(s.categoryLabel).toLowerCase()}` : ''}${cc !== null ? ` de ${fmt(cc)} cm³` : ''}${formatPowerCh(s.power) ? `, ${formatPowerCh(s.power)}` : ''}.`,
    p !== null ? `Prix du neuf en Tunisie : ${fmt(p)} DT${checkedLabel ? ` (prix relevé en ${checkedLabel})` : ''}.` : '',
    s.importerName ? `Importateur : ${s.importerName}${s.importerCity ? ` (${s.importerCity})` : ''}.` : '',
  ].filter(Boolean).join(' ');
}

export function techSpecTitle({ brand, model }: TechSpecSeoInput): string {
  const name = [brand, model].filter(Boolean).join(' ').trim() || 'Fiche technique';
  return `${name} | Prix en Tunisie & Fiche Technique`;
}

export function techSpecDescription({ brand, model, category, price, cc, power, weight }: TechSpecSeoInput): string {
  const name = [brand, model].filter(Boolean).join(' ').trim();
  const scooter = /scooter/i.test(String(category ?? ''));
  const of = scooter ? 'du' : 'de la';
  const p = priceNumber(price);
  const specs = [
    firstNumber(cc) !== null ? `${fmt(firstNumber(cc)!)} cm³` : '',
    powerCh(power) !== null ? `${fmt(powerCh(power)!)} ch` : '',
    firstNumber(weight) !== null ? `${fmt(firstNumber(weight)!)} kg` : '',
  ].filter(Boolean).join(', ');
  return [
    p !== null ? `Prix ${of} ${name} en Tunisie : ${fmt(p)} DT.` : `Fiche technique ${of} ${name} en Tunisie.`,
    specs ? `${p !== null ? 'Fiche technique' : 'Caractéristiques'} : ${specs}.` : '',
    `Comparez et choisissez votre ${scooter ? 'scooter' : 'moto'}.`,
  ].filter(Boolean).join(' ');
}
