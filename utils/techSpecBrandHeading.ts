import { ccValue, priceValue } from './techSpecSort.js';

/**
 * Title and one-line summary of a brand page (/fiches-techniques/<marque>),
 * shared by the React page and the crawler HTML (api/og-prerender.ts) so both
 * say exactly the same thing.
 *
 * Search Console (90 days): people search « <marque> tunisie », « <marque>
 * prix tunisie », almost never « fiche technique » (1 click). The H1 says
 * what they look for and fits on one line on a phone; « fiches techniques »
 * stays in the <title>, the breadcrumb and the /fiches-techniques hub.
 */
export const brandPageH1 = (brand: string) => `Prix ${brand} en Tunisie`;

const NBSP = String.fromCharCode(0xa0);
/** 5850 → « 5 850 » with a no-break space (fr-FR uses a narrow one). */
const fr = (n: number) => Math.round(n).toLocaleString('fr-FR').replace(/\s/g, NBSP);

export interface BrandSummarySource { price?: string | null; cc?: string | null }

/**
 * « 9 modèles », « 5 850 à 24 000 DT », « 125 à 399 cm³ ». A part with
 * nothing readable (all « En arrivage », no cylinder) is left out.
 */
export function brandSummaryParts(models: BrandSummarySource[]): string[] {
  const n = models.length;
  const parts = [`${n}${NBSP}modèle${n > 1 ? 's' : ''}`];
  const prices = models.map((m) => priceValue(m.price ?? undefined)).filter((v): v is number => v !== null);
  if (prices.length) {
    const lo = Math.min(...prices), hi = Math.max(...prices);
    parts.push(lo === hi ? `${fr(lo)}${NBSP}DT` : `${fr(lo)} à ${fr(hi)}${NBSP}DT`);
  }
  const ccs = models.map((m) => ccValue(m.cc ?? undefined)).filter((v): v is number => v !== null).map(Math.round);
  if (ccs.length) {
    const lo = Math.min(...ccs), hi = Math.max(...ccs);
    parts.push(lo === hi ? `${lo}${NBSP}cm³` : `${lo} à ${hi}${NBSP}cm³`);
  }
  return parts;
}

/** The parts on one line, for the crawler HTML. */
export const brandSummaryText = (models: BrandSummarySource[]) => brandSummaryParts(models).join(' · ');
