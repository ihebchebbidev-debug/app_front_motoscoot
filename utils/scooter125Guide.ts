/**
 * "Scooter 125 neuf en Tunisie" price guide (/prix/scooter-125-tunisie).
 * Shared by the React page (components/Scooter125Prices.tsx) and the crawler
 * prerender (api/og-prerender.ts) so both list the same models and send the
 * same text. Everything is generated from the technical sheets: a price
 * change in the admin shows up here without editing the page.
 *
 * A sheet is listed when it is a scooter (any "Scooter…" category), its
 * engine is 125 cm³ or less, it is available in Tunisia and its new price is
 * a number ("En arrivage" and "Pas encore dévoilé" are left out).
 */
import { powerCh } from './techSpecSeo.js';

export const SCOOTER_125_PATH = '/prix/scooter-125-tunisie';
export const SCOOTER_125_BREADCRUMB = 'Scooters 125';

/** One sheet, from either the raw API document or the mapped TechSpec. */
export interface Scooter125Source {
  id?: string | number;
  slug?: string;
  brand?: string;
  model?: string;
  year?: string | number;
  category?: string;
  price?: unknown;
  cc?: unknown;
  power?: unknown;
  weight?: unknown;
  importer?: string | null;
  image?: string;
  availableInTunisia?: boolean;
}

export interface Scooter125Row {
  id?: string | number;
  slug?: string;
  brand: string;
  model: string;
  name: string;
  year?: number;
  price: number;
  cc: number;
  powerCh: number | null;
  weightKg: number | null;
  importer: string | null;
  image?: string;
}

export interface Scooter125Band {
  id: string;
  title: string;
  intro: string;
  rows: Scooter125Row[];
}

export interface Scooter125Faq {
  question: string;
  answer: string;
}

const firstNumber = (v: unknown): number | null => {
  const m = String(v ?? '').match(/\d+(?:[.,]\d+)?/);
  const n = m ? parseFloat(m[0].replace(',', '.')) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** "9000", "10 900", "9 000 DT" → number; "En arrivage", "—" → null. */
export const parseDtPrice = (v: unknown): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? v : null;
  const s = String(v ?? '');
  if (!/^\s*(?:à partir de\s*)?[\d\s  .]+(?:dt|tnd)?\s*$/i.test(s)) return null;
  const digits = s.replace(/[^\d]/g, '');
  const n = digits ? parseInt(digits, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
};

const fmtNum = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
export const fmtDt = (n: number) => `${n.toLocaleString('fr-FR')} DT`;
export const fmtCh = (n: number | null) => (n === null ? '—' : `${fmtNum(n)} ch`);
export const fmtKg = (n: number | null) => (n === null ? '—' : `${fmtNum(n)} kg`);

export function scooter125Rows(sources: Scooter125Source[]): Scooter125Row[] {
  const rows: Scooter125Row[] = [];
  const seen = new Set<string>();
  for (const s of sources) {
    if (!s || s.availableInTunisia === false) continue;
    if (!/scooter/i.test(String(s.category ?? ''))) continue;
    const cc = firstNumber(s.cc);
    if (cc === null || cc > 125) continue;
    const price = parseDtPrice(s.price);
    if (price === null) continue;
    const brand = String(s.brand ?? '').trim();
    const model = String(s.model ?? '').trim();
    if (!brand || !model) continue;
    const key = String(s.slug || s.id || `${brand} ${model}`);
    if (seen.has(key)) continue;
    seen.add(key);
    const year = typeof s.year === 'number' ? s.year : parseInt(String(s.year ?? ''), 10);
    rows.push({
      id: s.id,
      slug: s.slug,
      brand,
      model,
      name: `${brand} ${model}`,
      year: Number.isFinite(year) ? year : undefined,
      price,
      cc,
      powerCh: powerCh(s.power),
      weightKg: firstNumber(s.weight),
      importer: s.importer ? String(s.importer) : null,
      image: s.image,
    });
  }
  return rows.sort((a, b) => a.price - b.price || a.name.localeCompare(b.name, 'fr'));
}

/** Raw API document (/api/tech-specs/brands/:brand) → source. */
export const scooter125SourceFromApi = (d: any): Scooter125Source => ({
  id: d?.id,
  slug: d?.slug,
  brand: d?.brand,
  model: d?.model,
  year: d?.year,
  category: d?.category,
  price: d?.price_new,
  cc: d?.engine?.cc,
  power: d?.engine?.power,
  weight: d?.dimensions?.weight,
  importer: d?.importer?.name ?? null,
  image: d?.cover_image || d?.image,
  availableInTunisia: d?.available_in_tunisia,
});

const median = (values: number[]): number => {
  const v = [...values].sort((a, b) => a - b);
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : Math.round((v[mid - 1] + v[mid]) / 2);
};

const listNames = (rows: Scooter125Row[]) => {
  const names = rows.map((r) => r.name);
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} et ${names[names.length - 1]}` : names[0] || '';
};

const range = (values: (number | null)[], fmt: (n: number) => string) => {
  const v = values.filter((n): n is number => n !== null);
  if (!v.length) return '';
  const min = Math.min(...v);
  const max = Math.max(...v);
  return min === max ? fmt(min) : `de ${fmt(min)} à ${fmt(max)}`;
};

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
export const frenchDate = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

export function scooter125Title(now = new Date()): string {
  return `Scooter 125 neuf en Tunisie : prix et comparatif ${now.getFullYear()}`;
}

export function scooter125Heading(now = new Date()): string {
  return `Scooter 125 neuf en Tunisie : les prix ${now.getFullYear()}`;
}

export function scooter125Description(rows: Scooter125Row[], now = new Date()): string {
  const counts = new Map<string, number>();
  rows.forEach((r) => counts.set(r.brand, (counts.get(r.brand) || 0) + 1));
  const brands = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5).map(([b]) => b);
  const base = `Prix des scooters 125 neufs en Tunisie en ${now.getFullYear()}`;
  if (!rows.length) return `${base} : prix du neuf en DT, puissance et poids comparés.`;
  return `${base} : ${brands.join(', ')}. Prix du neuf en DT, puissance et poids comparés sur ${rows.length} modèles.`;
}

/** Direct answer shown first (and as the crawler intro). */
export function scooter125Intro(rows: Scooter125Row[], now = new Date()): string {
  if (!rows.length) return 'Aucun prix de scooter 125 neuf n’est publié pour le moment dans nos fiches techniques.';
  const cheapest = rows[0];
  const dearest = rows[rows.length - 1];
  return `Au ${frenchDate(now)}, un scooter 125 neuf coûte ${range(rows.map((r) => r.price), fmtDt)} en Tunisie, `
    + `d’après les ${rows.length} modèles de nos fiches techniques. `
    + `Le moins cher est le ${cheapest.name} (${fmtDt(cheapest.price)}), le plus cher le ${dearest.name} (${fmtDt(dearest.price)}). `
    + `Le prix médian est de ${fmtDt(median(rows.map((r) => r.price)))}.`;
}

export const scooter125Stats = (rows: Scooter125Row[]) => ({
  count: rows.length,
  min: rows.length ? rows[0].price : null,
  median: rows.length ? median(rows.map((r) => r.price)) : null,
  brands: new Set(rows.map((r) => r.brand)).size,
});

const BANDS = [
  { id: 'moins-de-7000', max: 7000, title: 'Moins de 7 000 DT : les scooters 125 les plus abordables', lead: 'Le prix d’entrée du 125 neuf en Tunisie, pour les trajets du quotidien.' },
  { id: '7000-10000', min: 7000, max: 10000, title: 'De 7 000 à 10 000 DT : le milieu de gamme', lead: 'Les scooters 125 au prix intermédiaire.' },
  { id: 'plus-de-10000', min: 10000, title: 'Plus de 10 000 DT : le haut de gamme du 125', lead: 'Les scooters 125 les plus chers du marché tunisien.' },
];

export function scooter125Bands(rows: Scooter125Row[]): Scooter125Band[] {
  return BANDS.map((b) => {
    const inBand = rows.filter((r) => (b.min === undefined || r.price >= b.min) && (b.max === undefined || r.price < b.max));
    const importers = [...new Set(inBand.map((r) => r.importer).filter(Boolean))];
    const facts = inBand.length
      ? [
        `${inBand.length} modèle${inBand.length > 1 ? 's' : ''} : ${listNames(inBand)}.`,
        `Prix ${range(inBand.map((r) => r.price), fmtDt)}, puissance ${range(inBand.map((r) => r.powerCh), (n) => fmtCh(n))}.`,
        importers.length ? `Importateur${importers.length > 1 ? 's' : ''} : ${importers.join(', ')}.` : '',
      ].filter(Boolean).join(' ')
      : 'Aucun modèle publié dans cette tranche pour le moment.';
    return { id: b.id, title: b.title, intro: `${b.lead} ${facts}`, rows: inBand };
  });
}

/** "Comment choisir" advice: general, plus the ranges measured on the listed models. */
export function scooter125Advice(rows: Scooter125Row[]): { title: string; text: string }[] {
  const weights = range(rows.map((r) => r.weightKg), (n) => fmtKg(n));
  const powers = range(rows.map((r) => r.powerCh), (n) => fmtCh(n));
  return [
    { title: 'Le budget total', text: 'Au prix du neuf s’ajoutent l’immatriculation, l’assurance et l’équipement (casque, gants). Demandez au vendeur le prix final, carte grise comprise.' },
    { title: 'Le poids', text: `Les scooters 125 de ce comparatif pèsent ${weights || 'entre 110 et 170 kg environ'}. Un modèle léger est plus facile à manœuvrer et à garer en ville.` },
    { title: 'La puissance', text: `Elle va ${powers || 'de 9 à 15 ch environ'}. Quelques chevaux de plus comptent surtout à deux ou sur voie rapide.` },
    { title: 'L’importateur et le réseau', text: 'Un importateur officiel assure la garantie, les pièces et l’entretien. Vérifiez qu’un atelier de la marque existe près de chez vous.' },
    { title: 'L’entretien', text: 'Renseignez-vous sur la fréquence des révisions et le prix des pièces courantes (courroie, plaquettes, pneus) avant d’acheter.' },
  ];
}

export function scooter125Faq(rows: Scooter125Row[]): Scooter125Faq[] {
  if (!rows.length) return [];
  const [a, b, c] = rows;
  const strongest = rows.filter((r) => r.powerCh !== null).sort((x, y) => (y.powerCh as number) - (x.powerCh as number))[0];
  const lightest = rows.filter((r) => r.weightKg !== null).sort((x, y) => (x.weightKg as number) - (y.weightKg as number))[0];
  const next = [b, c].filter(Boolean).map((r) => `le ${r.name} (${fmtDt(r.price)})`).join(' et ');
  return [
    {
      question: 'Quel est le scooter 125 le moins cher en Tunisie ?',
      answer: `Parmi les ${rows.length} scooters 125 neufs de nos fiches, le moins cher est le ${a.name} à ${fmtDt(a.price)}.${next ? ` Viennent ensuite ${next}.` : ''}`,
    },
    {
      question: 'Combien coûte un scooter 125 neuf en Tunisie ?',
      answer: `Comptez ${range(rows.map((r) => r.price), fmtDt)} selon la marque et le modèle. Le prix médian des ${rows.length} modèles comparés est de ${fmtDt(median(rows.map((r) => r.price)))}.`,
    },
    ...(strongest ? [{
      question: 'Quel est le scooter 125 le plus puissant ?',
      answer: `Le ${strongest.name}, avec ${fmtCh(strongest.powerCh)}, pour ${fmtDt(strongest.price)}.${lightest ? ` Le plus léger est le ${lightest.name} (${fmtKg(lightest.weightKg)}).` : ''}`,
    }] : []),
    {
      question: 'Le prix affiché comprend-il la carte grise ?',
      answer: 'Ce sont les prix catalogue du neuf enregistrés dans nos fiches techniques. L’immatriculation, l’assurance et les éventuelles options peuvent s’y ajouter : demandez toujours le prix final au vendeur.',
    },
    {
      question: 'Où trouver un scooter 125 d’occasion ?',
      answer: 'Les annonces Moto-Scoot.tn regroupent les scooters d’occasion vendus partout en Tunisie, par des particuliers et des professionnels.',
    },
  ];
}

export function scooter125Method(now = new Date()): string {
  return 'Les prix sont les prix catalogue du neuf enregistrés dans nos fiches techniques, en dinars tunisiens. '
    + 'Ce ne sont pas des offres de vente de Moto-Scoot.tn. '
    + 'Sont listés les scooters de 125 cm³ maximum disponibles en Tunisie dont le prix est publié ; '
    + 'un modèle « en arrivage » apparaît dès que son prix est connu. '
    + `Les poids sont ceux des constructeurs (à vide ou tous pleins faits selon la fiche). Liste à jour au ${frenchDate(now)}.`;
}
