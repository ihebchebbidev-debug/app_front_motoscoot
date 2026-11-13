import { z } from 'zod';
import DOMPurify from 'dompurify';
import { isValidTunisiaPhone, TUNISIA_PHONE_ERROR } from '../utils/phoneUtils';
import { depositFieldBelongs, depositMissingConditional } from '../utils/depositRules';
import { CC_MESSAGE, ccIsValid } from '../utils/depositOptions';

export interface UploadedMedia {
  id: string;
  url: string;
  status: 'uploading' | 'success' | 'error';
  error?: string;
  /** Original File kept in memory so a failed upload can be retried without
   *  asking the user to re-pick the photo. Not serialized to localStorage. */
  file?: File;
}

export const MAX_IMAGES = 10;

/** 0 to 999 999 km. */
export const MILEAGE_PATTERN = /^\d{1,6}$/;
export const MILEAGE_MESSAGE = 'Kilométrage : un nombre entier entre 0 et 999 999';

export const listingSchema = z.object({
  // errorMap: an empty choice must not show zod's English "Invalid enum value".
  category: z.enum(['Moto', 'Scooter', 'Quad', 'Accessoires'], { errorMap: () => ({ message: 'Veuillez choisir une catégorie' }) }),
  // 100: brands.name / listings.model are VARCHAR(100) (migrations/001).
  brand: z.string().trim().min(1, "Veuillez choisir une marque").max(100, 'Marque trop longue (100 caractères max)'),
  model: z.string().trim().min(1, "Veuillez choisir un modèle").max(100, 'Modèle trop long (100 caractères max)'),
  condition: z.string().min(1, "État requis"),
  equipment: z.array(z.string()).default([]),
  price: z.string().min(1, "Le prix est requis"),
  // No city field in the deposit form any more: the governorate is enough.
  city: z.string().optional().or(z.literal('')),
  governorate: z.string().trim().min(1, 'Veuillez choisir un gouvernorat'),
  phone: z
    .string()
    .min(1, 'Numéro de téléphone requis')
    .refine((v) => isValidTunisiaPhone(v), { message: TUNISIA_PHONE_ERROR }),
  /**
   * How buyers can contact the seller about this specific ad:
   *  - 'phone'    → number is shown publicly + tap-to-call works
   *  - 'callback' → number stays private, buyers must request a callback
   *                 or send an in-app message
   * Default is 'phone' to preserve historical behavior.
   */
  contactMethod: z.enum(['phone', 'callback']).default('phone'),
  description: z.string({ required_error: 'La description est obligatoire' })
    .transform((val) => {
      if (!val) return '';
      // Sanitization simple si DOMPurify est dispo côté client
      try {
        const sanitized = DOMPurify.sanitize(val, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
        return sanitized.replace(/(https?:\/\/[^\s]+)/gi, '[lien retiré]').trim();
      } catch (e) {
        return val.trim();
      }
    })
    .pipe(
      z.string()
        .min(20, 'La description doit contenir au moins 20 caractères')
        .max(5000, 'La description est trop longue (5000 caractères max)')
    ),
  images: z.array(z.string()).min(1, "Ajoutez au moins une photo").max(MAX_IMAGES, `Maximum ${MAX_IMAGES} photos autorisées`),

  // Localisation step (last step of the wizard) — address is free-text and
  // optional, lat/lng are required so buyers can filter by radius.
  address: z.string().trim().max(500, 'Adresse trop longue').optional().or(z.literal('')),
  latitude: z.number().min(-90).max(90, 'Latitude invalide').optional().nullable(),
  longitude: z.number().min(-180).max(180, 'Longitude invalide').optional().nullable(),

  // Optional base fields
  year: z.string().optional(),
  // A whole number of km (listings.mileage is an INTEGER): no sign, no decimal, no « 1e6 ».
  mileage: z.string().optional(), // format checked below, only when it belongs (a vehicle)
  // A size from the list, « Électrique », « Autre », or a typed number of cc (30 to 3 000).
  cc: z.string().optional(), // a list size, « Électrique », « Autre » or 30 to 3 000: checked below, only for a vehicle
  
  // Accessory specific fields
  accessoryType: z.string().optional(),
  helmetType: z.string().optional(),
  visorType: z.array(z.string()).optional(),
  size: z.string().optional(),
  gender: z.string().optional(),
  shoeSize: z.string().optional(),
  antiTheftType: z.string().optional(),
  intercomFeatures: z.array(z.string()).optional(),
}).superRefine((data, ctx) => {
  // Which conditional field is required, and its message: utils/depositRules.ts
  // (the deposit's « Suivant » and « Publier » read the same rules).
  for (const { path, message } of depositMissingConditional(data)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message, path: [path] });
  }
  // A hidden field is never checked: a bad mileage left on a moto turned into
  // a helmet used to block the publish on a field the seller could not see.
  if (depositFieldBelongs('mileage', data) && data.mileage && !MILEAGE_PATTERN.test(data.mileage.trim())) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: MILEAGE_MESSAGE, path: ['mileage'] });
  }
  if (depositFieldBelongs('cc', data) && !ccIsValid(data.cc)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: CC_MESSAGE, path: ['cc'] });
  }
  if (data.category === 'Accessoires' && data.accessoryType === 'Casque' && (data.visorType?.length ?? 0) > 2) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Maximum 2 types de visière", path: ['visorType'] });
  }
});

export type ListingFormData = z.infer<typeof listingSchema>;
