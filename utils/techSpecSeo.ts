/**
 * Title and meta description of a technical sheet (/fiche-technique/<slug>).
 * Shared by the React page and the crawler prerender (api/og-prerender.ts)
 * so both always send the same text.
 *
 * Titre :       {Marque} {Modèle} | Prix en Tunisie & Fiche Technique
 *               (sans prix chiffré : {Marque} {Modèle} | Fiche Technique & Caractéristiques)
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

/**
 * First number in a spec value: "124.7 cc" → 124.7, "11,6 ch" → 11.6.
 * Keeping only the digits turned "124.7 cc" into 1247; the page, the crawler
 * HTML and the JSON-LD of both must read engine size through this one rule.
 */
export const parseSpecNumber = (v: unknown): number | null => {
  const m = String(v ?? '').match(/\d+(?:[.,]\d+)?/);
  if (!m) return null;
  const n = parseFloat(m[0].replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
};
const firstNumber = parseSpecNumber;

/**
 * New price of a model, in dinars, from tech_specs.price_new (free text up to
 * 50 characters typed in the admin) or its formatted form (« 9 000 DT »).
 * The one rule for the page, the crawler HTML and both JSON-LD:
 * - the amount written before « DT » / « TND » / « dinars » wins, otherwise the
 *   first number (« Prix 2026 : 9 000 DT » → 9000, not 2026 or 20269000);
 * - spaces (also non-breaking) and a dot before groups of three digits are
 *   thousand separators (« 9.000 », « 4 679 »);
 * - after that, a dot or comma is the decimal mark (« 6199.500 » → 6199.5);
 * - no amount (« Sur demande », « En arrivage », « — ») → null.
 */
const GROUPED = String.raw`\d{1,3}(?:[ \u00a0\u202f]\d{3})+(?:[.,]\d+)?|\d{1,3}(?:\.\d{3})+(?:,\d+)?`;
const PLAIN = String.raw`\d+(?:[.,]\d+)?`;
const AMOUNT = `(?:${GROUPED}|${PLAIN})`;
export const parseSpecPrice = (v: unknown): number | null => {
  const text = String(v ?? '');
  const m = text.match(new RegExp(`(${AMOUNT})\\s*(?:DT|TND|dinars?)\\b`, 'i')) || text.match(new RegExp(`(${AMOUNT})`));
  if (!m) return null;
  let raw = m[1].replace(/[ \u00a0\u202f]/g, '');
  if (/^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(raw)) raw = raw.replace(/\./g, '');
  const n = Math.round(parseFloat(raw.replace(',', '.')) * 1000) / 1000;
  return Number.isFinite(n) && n > 0 ? n : null;
};
const priceNumber = parseSpecPrice;

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
 * Summary of a technical sheet, shown at the bottom of the page and in the
 * crawler HTML (api/og-prerender.ts):
 *   "SYM Jet 14 EVO 125 (2026) : scooter 125 cm³ équipé d’un moteur de 124,7 cm³
 *    développant 12,6 ch. Son prix neuf en Tunisie est d’environ 9 000 DT (prix
 *    relevé en novembre 2026). Le modèle est distribué en Tunisie par Megacycle,
 *    basé à Sousse."
 * Missing values drop their part of the sentence; when the exact displacement
 * is already a whole number ("125 cc") the "équipé d’un moteur de" part is
 * left out instead of repeating it.
 */
export function techSpecSummary(s: TechSpecSummaryInput): string {
  const name = [s.brand, s.model].filter(Boolean).join(' ').trim();
  const cc = firstNumber(s.cc);
  const power = formatPowerCh(s.power);
  const p = priceNumber(s.price);
  const checked = s.updatedAt ? new Date(s.updatedAt) : null;
  const checkedLabel = checked && !Number.isNaN(checked.getTime()) ? `${MONTHS[checked.getUTCMonth()]} ${checked.getUTCFullYear()}` : '';
  const kind = s.categoryLabel ? String(s.categoryLabel).trim().toLowerCase() : 'moto';
  const feminine = kind === 'moto';
  const sizeClass = cc !== null ? ` ${Math.round(cc)} cm³` : '';
  const engine = cc !== null && Math.round(cc) !== cc ? ` ${feminine ? 'équipée' : 'équipé'} d’un moteur de ${fmt(cc)} cm³` : '';
  return [
    `${name}${s.year ? ` (${s.year})` : ''} : ${kind}${sizeClass}${engine}${power ? ` développant ${power}` : ''}.`,
    p !== null ? `Son prix neuf en Tunisie est d’environ ${fmt(p)} DT${checkedLabel ? ` (prix relevé en ${checkedLabel})` : ''}.` : '',
    s.importerName ? `Le modèle est distribué en Tunisie par ${s.importerName}${s.importerCity ? `, basé à ${s.importerCity}` : ''}.` : '',
  ].filter(Boolean).join(' ');
}

/** "9 000 DT", no-break spaces (U+00A0) inside and before "DT"; null without a price. */
export function formatDinars(price: unknown): string | null {
  const p = priceNumber(price);
  return p === null ? null : `${p.toLocaleString('fr-FR').replace(/[\s ]/g, ' ')} DT`;
}

export interface TechSpecPriceBlockInput {
  brand?: string | null;
  model?: string | null;
  /** Category as typed in the admin ("Scooter", "Maxi Scooter"…). */
  category?: string | null;
  cc?: string | null;
  /** Raw API value: 9000, "10 350", "En arrivage". */
  price?: number | string | null;
  updatedAt?: string | null;
  /** tech_specs.available_in_tunisia: the model is sold in Tunisia (not a stock level). */
  availableInTunisia?: boolean | null;
  importerName?: string | null;
  importerCity?: string | null;
}

export interface TechSpecPriceBlock {
  /** Row label of the price: "Prix (Novembre 2026)", or "Prix" undated. */
  priceLabel: string;
  /** "9 000 DT TTC" */
  price: string | null;
  availability: string | null;
  /** "Megacycle (Sousse)" */
  dealer: string | null;
  /** 125 cm³ scooters only: link to the 125 scooter price page, shown under the spec table. */
  pricesLink: { href: string; label: string } | null;
}

/**
 * "Prix neuf en Tunisie" block, right under the H1 of a technical sheet: three
 * label / value rows (dated price, availability, dealer). Shared by the React
 * page and the crawler HTML (api/og-prerender.ts) so both show the same rows.
 * Availability only says whether the model is sold in Tunisia: the data has
 * no stock level. The comparator is reached from the page's own button.
 */
export const TECH_SPEC_PRICE_LABEL = 'Prix neuf en Tunisie';
export function techSpecPriceBlock(s: TechSpecPriceBlockInput): TechSpecPriceBlock {
  const price = formatDinars(s.price);
  const checked = s.updatedAt ? new Date(s.updatedAt) : null;
  const checkedLabel = price && checked && !Number.isNaN(checked.getTime()) ? `${MONTHS[checked.getUTCMonth()]} ${checked.getUTCFullYear()}` : null;
  const cc = firstNumber(s.cc);
  const availability =
    price === null && /arrivage/i.test(String(s.price ?? '')) ? 'En arrivage en Tunisie'
    : s.availableInTunisia === true ? 'Commercialisé en Tunisie'
    : s.availableInTunisia === false ? 'Non commercialisé en Tunisie'
    : null;
  const scooter125 = /scooter/i.test(String(s.category ?? '')) && cc !== null && cc >= 110 && cc <= 130;
  return {
    priceLabel: checkedLabel ? `Prix (${checkedLabel.charAt(0).toUpperCase()}${checkedLabel.slice(1)})` : 'Prix',
    price: price ? `${price} TTC` : null,
    availability,
    dealer: s.importerName ? `${s.importerName}${s.importerCity ? ` (${s.importerCity})` : ''}` : null,
    pricesLink: scooter125 ? { href: '/prix/scooter-125-tunisie', label: 'Prix des scooters 125 neufs en Tunisie' } : null,
  };
}

/**
 * The title promises a price only when the sheet has one (owner, 2026-11-19):
 * 50 of 101 sheets (« En arrivage », « Prochainement », empty) said « Prix en
 * Tunisie » with no price on the page. Same rule as the description
 * (parseSpecPrice): once a price is entered in the admin, « Prix » comes back.
 */
export function techSpecTitle({ brand, model, price }: TechSpecSeoInput): string {
  const name = [brand, model].filter(Boolean).join(' ').trim() || 'Fiche technique';
  return priceNumber(price) !== null
    ? `${name} | Prix en Tunisie & Fiche Technique`
    : `${name} | Fiche Technique & Caractéristiques`;
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

/** One sheet of the catalogue, from the raw API document or the mapped TechSpec. */
export interface SimilarModelSource {
  id?: string | number;
  slug?: string;
  brand?: string;
  model?: string;
  category?: string | null;
  cc?: unknown;
  /** 9000, "9 399 DT", "En arrivage"… */
  price?: unknown;
}

export interface SimilarModel {
  /** Site-relative: "/fiche-technique/sym-jet-x-125" */
  href: string;
  name: string;
  /** "9 399 DT TTC" */
  price: string;
}

export const SIMILAR_MODELS_HEADING = 'Modèles similaires';

/**
 * "Modèles similaires" of a technical sheet, shared by the React page and the
 * crawler HTML: same family (scooter with scooter, otherwise the same
 * category), displacement within 25 % (at least ±15 cm³), a known price —
 * closest price first (closest displacement when the sheet has no price).
 */
export function similarTechSpecs(current: SimilarModelSource, catalogue: SimilarModelSource[], max = 4): SimilarModel[] {
  const family = (c: unknown) => (/scooter/i.test(String(c ?? '')) ? 'scooter' : String(c ?? '').trim().toLowerCase());
  const cc0 = firstNumber(current.cc);
  const p0 = priceNumber(current.price);
  const seen = new Set<string>();
  return catalogue
    .filter((m) => m.slug && m.slug !== current.slug && String(m.id ?? '') !== String(current.id ?? '-'))
    .filter((m) => family(m.category) === family(current.category))
    .map((m) => ({ m, cc: firstNumber(m.cc), price: formatDinars(m.price), p: priceNumber(m.price) }))
    .filter((x) => x.price !== null && x.p !== null)
    .filter((x) => cc0 === null || (x.cc !== null && Math.abs(x.cc - cc0) <= Math.max(15, cc0 * 0.25)))
    .sort((a, b) =>
      (p0 !== null ? Math.abs(a.p! - p0) - Math.abs(b.p! - p0) : Math.abs((a.cc ?? 0) - (cc0 ?? 0)) - Math.abs((b.cc ?? 0) - (cc0 ?? 0)))
      || `${a.m.brand} ${a.m.model}`.localeCompare(`${b.m.brand} ${b.m.model}`, 'fr'))
    .filter((x) => !seen.has(x.m.slug!) && !!seen.add(x.m.slug!))
    .slice(0, max)
    .map((x) => ({
      href: `/fiche-technique/${x.m.slug}`,
      name: [x.m.brand, x.m.model].filter(Boolean).join(' '),
      price: `${x.price} TTC`,
    }));
}

export interface TechSpecPropertyInput {
  cc?: unknown;
  power?: unknown;
  torque?: unknown;
  topSpeed?: unknown;
  consumption?: unknown;
  weight?: unknown;
  tank?: unknown;
}

/**
 * Product.additionalProperty of a technical sheet, shared by the crawler HTML
 * and the React page: numeric values with their unit (UN/CEFACT unitCode where
 * one exists, unitText always) so search engines and AI answers can read
 * "26" + "ch" instead of the text "26 ch". Missing or "N/A" values are left out.
 */
export function techSpecProperties(s: TechSpecPropertyInput): Array<Record<string, unknown>> {
  const row = (name: string, value: number | null, unitCode: string | null, unitText: string) =>
    value === null ? null : { '@type': 'PropertyValue', name, value, ...(unitCode ? { unitCode } : {}), unitText };
  return [
    row('Cylindrée', firstNumber(s.cc), 'CMQ', 'cm³'),
    row('Puissance', powerCh(s.power), null, 'ch'),
    row('Couple', firstNumber(s.torque), 'NU', 'Nm'),
    row('Vitesse max', firstNumber(s.topSpeed), 'KMH', 'km/h'),
    row('Consommation', firstNumber(s.consumption), null, 'L/100 km'),
    row('Poids', firstNumber(s.weight), 'KGM', 'kg'),
    row('Réservoir', firstNumber(s.tank), 'LTR', 'L'),
  ].filter((r): r is NonNullable<typeof r> => r !== null);
}

/**
 * Picture of a technical sheet when it is shared (og:image, twitter:image and
 * the share window): the first photo of the sheet's own gallery, the one the
 * page opens on. The admin "image principale" is the brand-page card picture
 * and is only the fallback for a sheet without a gallery.
 */
export function techSpecShareImage(s: { image?: string | null; gallery?: Array<string | null | undefined> | null }): string | null {
  return (s.gallery || []).find((g): g is string => !!g) || s.image || null;
}

/**
 * Title the sheet gallery gives its photos ("/m/<slug of this>/<file>").
 * Shared with the crawler HTML so its preload asks for the very URL the
 * gallery then shows, and the photo is fetched once, before the JavaScript.
 */
/**
 * Photos of a technical sheet, in the order the gallery shows them: the
 * sheet's own gallery, or the admin « image principale » when it has none.
 * Shared by the page and the crawler HTML (owner, 2026-11-22: every photo
 * in the page, not only the first).
 */
export function techSpecPhotos(s: { image?: string | null; gallery?: Array<string | null | undefined> | null }): string[] {
  const extras = (s.gallery || []).filter((g): g is string => !!g);
  return Array.from(new Set(extras.length > 0 ? extras : [s.image].filter((g): g is string => !!g)));
}

export function techSpecGalleryTitle(s: { brand?: unknown; model?: unknown; year?: unknown }): string {
  return `${s.brand} ${s.model} ${s.year}`;
}

export const TECH_SPEC_FAQ_HEADING = 'Questions fréquentes';

export interface TechSpecFaqInput {
  brand?: string | null;
  model?: string | null;
  /** Category as typed in the admin ("Scooter", "Roadster"): « du » scooter, « de la » moto. */
  category?: string | null;
  price?: number | string | null;
  updatedAt?: string | null;
  topSpeed?: string | null;
  consumption?: string | null;
  tank?: string | null;
  cc?: string | null;
  power?: string | null;
  weight?: string | null;
  /** « Garantie & Entretien » fields of the admin, free text (« 2 ans, kilométrage illimité »). */
  warranty?: string | null;
  firstService?: string | null;
  serviceInterval?: string | null;
  availableInTunisia?: boolean | null;
  importerName?: string | null;
  importerCity?: string | null;
}

export interface TechSpecFaqItem { question: string; answer: string }

/**
 * A free-text admin value made readable inside a sentence, without changing
 * what it says: « 1000 KM » → « 1 000 km », « 1 Ans » → « 1 an », « Tous Les »
 * → « tous les », no final period (the sentence adds it). Empty when blank.
 */
export function faqFreeText(value: unknown): string {
  let v = String(value ?? '').replace(/\s+/g, ' ').trim().replace(/[.;,\s]+$/, '');
  if (!v) return '';
  // Thousands only in distances (« 2025 » in « avril 2025 » is a year).
  v = v.replace(/\b(\d{4,})\s*km\b/gi, (_, n) => `${n.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0')}\u00a0km`);
  v = v.replace(/(\d)\s*km\b/gi, '$1\u00a0km');
  v = v.replace(/\b1\s+ans\b/gi, '1 an').replace(/\b(\d+)\s+Ans\b/g, '$1 ans').replace(/\b(\d+)\s+Mois\b/g, '$1 mois');
  v = v.replace(/^Tou[st] les\b/i, 'tous les');
  // Common opening words read mid-sentence (« Première révision : entre 500 et 1 200 km »); names keep their capital.
  v = v.replace(/^(Entre|Vidanges?|Jusqu’à|Jusqu'à|Selon|Chaque|Après)\b/, (w) => w.toLowerCase());
  return v;
}


/**
 * Questions fréquentes of a technical sheet (owner, 2026-11-22), written from
 * the fields already filled in the admin, nothing to type. They answer the
 * Google searches that reach the sheets (Search Console, 3 months): « prix »
 * (27 % of impressions), « vitesse max » (2,6 %, 1,3 % CTR), « fiche
 * technique / puissance / poids », « consommation ». Warranty and servicing
 * (owner, 2026-11-22) come from « Garantie & Entretien ». A question appears only
 * when its value is known: no invented price, speed or consumption.
 * Shared by the page (components/TechSpecsDetails.tsx) and the crawler HTML
 * (api/og-prerender.ts) so both show the same text.
 */
export function techSpecFaq(s: TechSpecFaqInput): TechSpecFaqItem[] {
  const name = [s.brand, s.model].filter(Boolean).join(' ').trim();
  if (!name) return [];
  const scooter = /scooter/i.test(String(s.category ?? ''));
  const ofName = `${scooter ? 'du' : 'de la'} ${name}`;
  const theName = `${scooter ? 'le' : 'la'} ${name}`;
  const TheName = `${scooter ? 'Le' : 'La'} ${name}`;
  const faq: TechSpecFaqItem[] = [];

  const price = formatDinars(s.price);
  const checked = s.updatedAt ? new Date(s.updatedAt) : null;
  const checkedLabel = checked && !Number.isNaN(checked.getTime()) ? `${MONTHS[checked.getUTCMonth()]} ${checked.getUTCFullYear()}` : '';
  if (price) {
    faq.push({
      question: `Quel est le prix ${ofName} en Tunisie ?`,
      answer: `${TheName} est affiché${scooter ? '' : 'e'} à ${price} TTC en Tunisie, prix du neuf${checkedLabel ? ` relevé en ${checkedLabel}` : ''}.`,
    });
  } else if (/arrivage/i.test(String(s.price ?? ''))) {
    faq.push({
      question: `Quel est le prix ${ofName} en Tunisie ?`,
      answer: `${TheName} est annoncé${scooter ? '' : 'e'} en arrivage en Tunisie : son prix n’est pas encore connu.`,
    });
  }

  const speed = firstNumber(s.topSpeed);
  if (speed !== null) {
    faq.push({ question: `Quelle est la vitesse maximale ${ofName} ?`, answer: `Sa vitesse maximale annoncée est de ${fmt(speed)} km/h.` });
  }

  const conso = firstNumber(s.consumption);
  if (conso !== null) {
    faq.push({ question: `Combien consomme ${theName} ?`, answer: `Sa consommation annoncée est de ${fmt(conso)} L/100 km.` });
  }

  const tank = firstNumber(s.tank);
  if (tank !== null && conso !== null && conso < 30) {
    const range = Math.round((tank / conso) * 100 / 10) * 10;
    faq.push({
      question: `Quelle est l’autonomie ${ofName} ?`,
      answer: `Avec un réservoir de ${fmt(tank)} L et une consommation de ${fmt(conso)} L/100 km, son autonomie théorique est d’environ ${fmt(range)} km.`,
    });
  }

  const cc = firstNumber(s.cc);
  const power = formatPowerCh(s.power);
  if (cc !== null) {
    faq.push({
      question: `Quelle est la cylindrée ${ofName} ?`,
      answer: `${TheName} a un moteur de ${fmt(cc)} cm³${power ? ` qui développe ${power}` : ''}.`,
    });
  }

  const weight = firstNumber(s.weight);
  if (weight !== null) {
    faq.push({ question: `Combien pèse ${theName} ?`, answer: `Son poids annoncé est de ${fmt(weight)} kg.` });
  }

  const warranty = faqFreeText(s.warranty);
  if (warranty) {
    faq.push({ question: `Quelle est la garantie ${ofName} ?`, answer: `Garantie constructeur annoncée : ${warranty}.` });
  }

  const firstService = faqFreeText(s.firstService);
  const serviceInterval = faqFreeText(s.serviceInterval);
  if (firstService || serviceInterval) {
    faq.push({
      question: `Quand faire la révision ${ofName} ?`,
      answer: [firstService && `Première révision : ${firstService}.`, serviceInterval && `Révisions suivantes : ${serviceInterval}.`].filter(Boolean).join(' '),
    });
  }

  if (s.importerName) {
    faq.push({
      question: `Où acheter ${theName} en Tunisie ?`,
      answer: `${TheName} est distribué${scooter ? '' : 'e'} en Tunisie par ${s.importerName}${s.importerCity ? `, basé à ${s.importerCity}` : ''}.`,
    });
  } else if (s.availableInTunisia === false) {
    faq.push({ question: `${TheName} est-${scooter ? 'il' : 'elle'} vendu${scooter ? '' : 'e'} en Tunisie ?`, answer: `Ce modèle n’est pas commercialisé en Tunisie à ce jour.` });
  }
  return faq;
}

export interface TechSpecVersionSource extends SimilarModelSource {
  power?: string | null;
  fuelSystem?: string | null;
  weight?: string | null;
}

export interface TechSpecVersionRow {
  /** Site-relative link; null for the sheet being read (shown in bold, no link). */
  href: string | null;
  name: string;
  /** "9 000 DT", or « Prix non communiqué ». */
  price: string;
  fuel: string;
  power: string;
  weight: string;
}

export interface TechSpecVersions {
  /** « Les versions du SYM Jet 14 » */
  heading: string;
  rows: TechSpecVersionRow[];
  /** Columns with at least one value (empty ones are left out of the table). */
  columns: Array<'price' | 'fuel' | 'power' | 'weight'>;
}

export const VERSION_COLUMN_LABELS: Record<TechSpecVersions['columns'][number], string> = {
  price: 'Prix neuf', fuel: 'Alimentation', power: 'Puissance', weight: 'Poids',
};

const familyWords = (model: unknown) => String(model ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 2);
// Same brand, same category and same first two words of the model: « F 900 R »
// (roadster) and « F 900 GS » (trail) share two words but are not versions.
const familyKey = (brand: unknown, model: unknown, category: unknown) =>
  `${String(brand ?? '').trim().toLowerCase()}|${String(category ?? '').trim().toLowerCase()}|${familyWords(model).join(' ').toLowerCase().replace(/[^a-z0-9 ]/g, '')}`;

/**
 * « Les versions du SYM Jet 14 » (owner, 2026-11-22): every sheet of the same
 * brand and category whose model starts with the same two words (« Jet 14 EVO 125 »,
 * « Jet 14 125 AC E5 », « Jet 14 125 carburateur »), with links between them
 * and what tells them apart (no brakes column: owner, 2026-11-22). Google sent « sym jet 14 » (553 impressions,
 * 7th) to the EVO sheet while the first results show the AC E5: the block
 * links the variants so each search reaches its own sheet.
 * Null when the model has no other version. Shared by the page and the
 * crawler HTML (api/og-prerender.ts).
 */
export function techSpecVersions(current: TechSpecVersionSource, catalogue: TechSpecVersionSource[]): TechSpecVersions | null {
  const key = familyKey(current.brand, current.model, current.category);
  if (familyWords(current.model).length === 0) return null;
  const seen = new Set<string>();
  const members = [current, ...catalogue.filter((m) => familyKey(m.brand, m.model, m.category) === key)]
    .filter((m) => {
      const id = String(m.slug || m.id || '');
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  if (members.length < 2) return null;
  const isCurrent = (m: TechSpecVersionSource) => (current.slug && m.slug === current.slug) || (current.id != null && String(m.id) === String(current.id));
  const rows = members
    .map((m) => ({ m, p: priceNumber(m.price) }))
    .sort((a, b) => (a.p ?? Infinity) - (b.p ?? Infinity) || String(a.m.model).localeCompare(String(b.m.model), 'fr'))
    .map(({ m }) => ({
      href: isCurrent(m) || !m.slug ? null : `/fiche-technique/${m.slug}`,
      name: [m.brand, m.model].filter(Boolean).join(' '),
      price: formatDinars(m.price) ?? 'Prix non communiqué',
      fuel: String(m.fuelSystem ?? '').trim(),
      power: formatPowerCh(m.power),
      weight: firstNumber(m.weight) !== null ? `${fmt(firstNumber(m.weight)!)} kg` : '',
    }));
  const columns = (['price', 'fuel', 'power', 'weight'] as const).filter((c) => c === 'price' || rows.some((r) => r[c]));
  const scooter = /scooter/i.test(String(current.category ?? ''));
  const family = [current.brand, ...familyWords(current.model)].filter(Boolean).join(' ');
  return { heading: `Les versions ${scooter ? 'du' : 'de la'} ${family}`, rows, columns: [...columns] };
}
