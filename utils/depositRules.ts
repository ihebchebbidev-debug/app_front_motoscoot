/**
 * Required fields of the listing deposit: the one place that says which field
 * is required, on which step, when, and what to say when it is missing.
 *
 * Read by the zod schema (types/listing.ts: the conditional fields) and by the
 * deposit (components/DepositAd.tsx: « Suivant », « Publier », the toasts),
 * so a new accessory rule is written once and both agree.
 */
import type { DepositStepId } from './depositSteps';

export interface DepositValues {
  category?: string;
  accessoryType?: string;
  [field: string]: unknown;
}

interface Rule {
  field: string;
  label: string;
  step: DepositStepId;
  /** When the field is required (always when absent). */
  when?: (v: DepositValues) => boolean;
  /** Message added by the schema; fields without one keep the schema's own. */
  message?: string;
  /** What counts as filled (default: not empty). */
  filled?: (value: unknown) => boolean;
}

const isAccessory = (v: DepositValues) => v.category === 'Accessoires';
const isVehicle = (v: DepositValues) => !isAccessory(v);
const accessoryIs = (...types: string[]) => (v: DepositValues) => isAccessory(v) && types.includes(String(v.accessoryType ?? ''));

const notEmpty = (value: unknown) =>
  Array.isArray(value) ? value.length > 0 : value !== undefined && value !== null && value !== '';

// In the order the fields appear on screen (toasts list them in this order).
const RULES: Rule[] = [
  { field: 'images', label: 'Photos', step: 'photos' },

  { field: 'brand', label: 'Marque', step: 'technical' },
  { field: 'model', label: 'Modèle', step: 'technical' },
  { field: 'condition', label: 'État', step: 'technical' },
  { field: 'year', label: 'Année', step: 'technical', when: isVehicle, message: 'Année requise (4 chiffres)', filled: (y) => /^\d{4}$/.test(String(y ?? '')) },
  { field: 'mileage', label: 'Kilométrage', step: 'technical', when: isVehicle, message: 'Kilométrage requis' },
  { field: 'cc', label: 'Cylindrée', step: 'technical', when: isVehicle, message: 'Cylindrée requise' },
  { field: 'accessoryType', label: "Type d'accessoire", step: 'technical', when: isAccessory, message: "Type d'accessoire requis" },
  { field: 'helmetType', label: 'Type de casque', step: 'technical', when: accessoryIs('Casque'), message: 'Type de casque requis' },
  { field: 'visorType', label: 'Type de visière', step: 'technical', when: accessoryIs('Casque'), message: 'Type de visière requis' },
  { field: 'size', label: 'Taille', step: 'technical', when: accessoryIs('Gant', 'Veste', 'Pantalons'), message: 'Taille requise' },
  { field: 'gender', label: 'Genre', step: 'technical', when: accessoryIs('Veste', 'Pantalons', 'Chaussures'), message: 'Genre requis' },
  { field: 'shoeSize', label: 'Pointure', step: 'technical', when: accessoryIs('Chaussures'), message: 'Pointure requise' },
  { field: 'antiTheftType', label: "Type d'antivol", step: 'technical', when: accessoryIs('Antivol'), message: "Type d'antivol requis" },
  { field: 'intercomFeatures', label: 'Options Intercom', step: 'technical', when: accessoryIs('Intercom'), message: 'Sélectionner au moins une option' },

  { field: 'price', label: 'Prix', step: 'details' },
  { field: 'governorate', label: 'Gouvernorat', step: 'details' },
  { field: 'phone', label: 'Téléphone', step: 'details' },
  { field: 'description', label: 'Description', step: 'details' },
];

/**
 * Fields that only make sense for some listings, and when (the same « when »
 * as the required rules, plus the vehicle equipment, an optional step that
 * accessories do not have). Every other field belongs to every listing.
 */
const CONDITIONAL_FIELDS: { field: string; when: (v: DepositValues) => boolean }[] = [
  ...RULES.filter((r) => r.when).map((r) => ({ field: r.field, when: r.when! })),
  { field: 'equipment', when: isVehicle },
];

/**
 * The fields of the listing these values describe: the ones the form shows,
 * the draft keeps and the publish sends. A field outside it (the year of a
 * moto left when the seller switched to « Casque ») is never sent or checked.
 */
export function depositFieldBelongs(field: string, values: DepositValues): boolean {
  const rule = CONDITIONAL_FIELDS.find((r) => r.field === field);
  return !rule || rule.when(values);
}

/** Fields holding a value that no longer belongs to the listing (to clear). */
export function strayDepositFields(values: DepositValues): string[] {
  return CONDITIONAL_FIELDS
    .filter((r) => !r.when(values) && notEmpty(values[r.field]))
    .map((r) => r.field);
}

/** The values with every stray field emptied ('' or []), the rest untouched. */
export function keepDepositFields<T extends DepositValues>(values: T): T {
  const out: DepositValues = { ...values };
  for (const f of strayDepositFields(values)) out[f] = Array.isArray(values[f]) ? [] : '';
  return out as T;
}

/** Names shown in « Champs requis manquants : … ». */
export const DEPOSIT_FIELD_LABELS: Record<string, string> = {
  category: 'Catégorie',
  ...Object.fromEntries(RULES.map((r) => [r.field, r.label])),
  city: 'Ville',
  latitude: 'Position sur la carte',
  longitude: 'Position sur la carte',
  address: 'Adresse',
};

/**
 * Required fields of one step for the values typed so far. On the technical
 * step only the category until one is chosen: the other fields appear then.
 * Equipment and recap have none.
 */
export function depositStepFields(step: DepositStepId, values: DepositValues): string[] {
  if (step === 'technical' && !values.category) return ['category'];
  return RULES.filter((r) => r.step === step && (!r.when || r.when(values))).map((r) => r.field);
}

/** Conditional fields the schema must report, with their message. */
export function depositMissingConditional(values: DepositValues): { path: string; message: string }[] {
  return RULES
    .filter((r) => r.message && (!r.when || r.when(values)) && !(r.filled ?? notEmpty)(values[r.field]))
    .map((r) => ({ path: r.field, message: r.message! }));
}

/** True while a photo is still being sent: « Suivant » and « Publier » wait. */
export const photosStillUploading = (media: { status: string }[]): boolean =>
  media.some((m) => m.status === 'uploading');
