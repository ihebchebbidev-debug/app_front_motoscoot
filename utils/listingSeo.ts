/**
 * Title and meta description of a listing (/annonce/<slug>-<n>). Shared by
 * the React page and the crawler prerender (api/og-listing.ts) so both send
 * the same text, built from the listing data rather than the raw ad text.
 *
 * Titre :       {Marque} {Modèle} {Année} d'occasion à {Ville} – {Prix} DT
 * Description : {Type} {Marque} {Modèle} {Année} d'occasion à vendre à {Ville} :
 *               {Prix} DT, {km} km, {cylindrée} cm³. Contactez directement le
 *               vendeur sur Moto-Scoot.tn.
 * Missing values are left out.
 */

export interface ListingSeoInput {
  brand?: string | null;
  model?: string | null;
  year?: string | number | null;
  city?: string | null;
  /** Number or formatted string ("10 000 DT"). */
  price?: string | number | null;
  mileage?: string | number | null;
  cc?: string | number | null;
  condition?: string | null;
  /** "Moto" | "Scooter" | … */
  type?: string | null;
}

const fmt = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 1 });

const digits = (v: unknown): number | null => {
  const s = String(v ?? '').replace(/[^\d]/g, '');
  const n = s ? parseInt(s, 10) : NaN;
  return Number.isFinite(n) ? n : null;
};

const firstNumber = (v: unknown): number | null => {
  const m = String(v ?? '').match(/\d+(?:[.,]\d+)?/);
  const n = m ? parseFloat(m[0].replace(',', '.')) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
};

const name = ({ brand, model, year }: ListingSeoInput) =>
  [brand, model, digits(year) || ''].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

// "Neuf" listings are new bikes; every other condition ("État neuf"
// included) is a used one.
export const isNewCondition = (condition?: string | null) => /^(neuf|new)$/i.test(String(condition ?? '').trim());
const usedLabel = (condition?: string | null) => (isNewCondition(condition) ? 'neuf' : "d'occasion");

export function listingTitle(l: ListingSeoInput): string {
  const price = digits(l.price);
  const place = l.city ? `à ${l.city}` : 'en Tunisie';
  return `${name(l) || 'Annonce'} ${usedLabel(l.condition)} ${place}${price ? ` – ${fmt(price)} DT` : ''}`;
}

export function listingDescription(l: ListingSeoInput): string {
  const price = digits(l.price);
  const km = digits(l.mileage);
  const cc = firstNumber(l.cc);
  const facts = [price ? `${fmt(price)} DT` : '', km !== null ? `${fmt(km)} km` : '', cc ? `${fmt(cc)} cm³` : ''].filter(Boolean).join(', ');
  const type = l.type && /^(moto|scooter|quad)$/i.test(l.type) ? `${l.type[0].toUpperCase()}${l.type.slice(1).toLowerCase()} ` : '';
  const place = l.city ? `à ${l.city}` : 'en Tunisie';
  return `${type}${name(l)} ${usedLabel(l.condition)} à vendre ${place}${facts ? ` : ${facts}` : ''}. Contactez directement le vendeur sur Moto-Scoot.tn.`;
}
