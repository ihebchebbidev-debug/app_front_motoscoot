import { z } from 'zod';
import DOMPurify from 'dompurify';
import { isValidTunisiaPhone, TUNISIA_PHONE_ERROR } from '../utils/phoneUtils';

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

export const listingSchema = z.object({
  category: z.enum(['Moto', 'Scooter', 'Quad', 'Accessoires']).refine(val => val !== undefined, "Veuillez choisir une catégorie"),
  brand: z.string().min(1, "Veuillez choisir une marque"),
  model: z.string().min(1, "Veuillez choisir un modèle"),
  condition: z.string().min(1, "État requis"),
  equipment: z.array(z.string()).default([]),
  price: z.string().min(1, "Le prix est requis"),
  city: z.string().min(1, "La ville est requise"),
  governorate: z.string().optional().default(''),
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
  mileage: z.string().optional(),
  cc: z.string().optional(),
  
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
  if (data.category !== 'Accessoires') {
    if (!data.year || !/^\d{4}$/.test(data.year)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Année requise (4 chiffres)", path: ['year'] });
    }
    if (!data.mileage) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Kilométrage requis", path: ['mileage'] });
    }
    if (!data.cc) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Cylindrée requise", path: ['cc'] });
    }
  } else {
    if (!data.accessoryType) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Type d'accessoire requis", path: ['accessoryType'] });
    }
    if (data.accessoryType === 'Casque') {
      if (!data.helmetType) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Type de casque requis", path: ['helmetType'] });
      }
      if (!data.visorType || data.visorType.length === 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Type de visière requis", path: ['visorType'] });
      } else if (data.visorType.length > 2) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Maximum 2 types de visière", path: ['visorType'] });
      }
    }
    
    // Add validation for new specific accessory fields if needed
    if (['Gant', 'Veste', 'Pantalons'].includes(data.accessoryType || '')) {
      if (!data.size) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Taille requise", path: ['size'] });
    }
    if (['Veste', 'Pantalons', 'Chaussures'].includes(data.accessoryType || '')) {
      if (!data.gender) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Genre requis", path: ['gender'] });
    }
    if (data.accessoryType === 'Chaussures' && !data.shoeSize) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Pointure requise", path: ['shoeSize'] });
    }
    if (data.accessoryType === 'Antivol' && !data.antiTheftType) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Type d'antivol requis", path: ['antiTheftType'] });
    }
    if (data.accessoryType === 'Intercom' && (!data.intercomFeatures || data.intercomFeatures.length === 0)) {
       ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Sélectionner au moins une option", path: ['intercomFeatures'] });
    }
  }
});

export type ListingFormData = z.infer<typeof listingSchema>;
