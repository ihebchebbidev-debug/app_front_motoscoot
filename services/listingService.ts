import type { ListingFormData } from '../types/listing';
import { listingsApi, BackendListing } from './listingsApi';
import { authApi } from './authApi';
import { formatTunisiaPhone } from '../utils/phoneUtils';

/**
 * High-level service for publishing a listing from the deposit wizard.
 *
 * Maps the validated `ListingFormData` (frontend-friendly shape used by the
 * multi-step form) into the backend payload expected by `POST /api/listings`,
 * then delegates to `listingsApi.create()`.
 *
 * Side-effect: if the user typed a phone number that differs from the one on
 * their profile, we sync it via `PUT /users/profile` BEFORE creating the
 * listing, so the joined `seller_phone` returned for this listing is correct.
 */

function toNumber(v: unknown): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^\d.-]/g, ''));
  return isFinite(n) ? n : undefined;
}

function buildTitle(data: ListingFormData): string {
  if (data.category === 'Accessoires') {
    return [data.accessoryType, data.brand, data.model].filter(Boolean).join(' ').trim() || 'Accessoire';
  }
  return [data.brand, data.model, data.year].filter(Boolean).join(' ').trim() || 'Annonce';
}

class ListingService {
  /**
   * Publishes a new listing through the real backend API.
   * Throws on network / validation / server errors so the caller can show a toast.
   */
  async publishListing(data: ListingFormData): Promise<{ success: true; id: string | number; publishedAt: string }> {
    // Persist the seller phone on the user profile so it shows up on the
    // listing card (the backend joins users.phone as seller_phone). Best-effort
    // — we don't fail the publish if this update fails.
    if (data.phone) {
      const normalizedPhone = formatTunisiaPhone(data.phone);
      try {
        await authApi.updateProfile({ phone: normalizedPhone });
      } catch {
        // Non-blocking: the listing still publishes, the user can fix their
        // profile later from Settings.
      }
    }

    // Accessory-specific fields land in the JSONB `attributes` column on the
    // listings table (backend migration 024). Only the keys the backend
    // whitelists are kept; empty values are dropped so the column stays small.
    const attributes: Record<string, string | string[]> = {};
    if (data.category === 'Accessoires') {
      const set = (k: string, v: unknown) => {
        if (typeof v === 'string' && v.trim()) attributes[k] = v.trim();
        else if (Array.isArray(v) && v.length) attributes[k] = v.filter((s) => typeof s === 'string');
      };
      set('accessoryType', data.accessoryType);
      set('helmetType', data.helmetType);
      set('visorType', data.visorType);
      set('size', data.size);
      set('gender', data.gender);
      set('shoeSize', data.shoeSize);
      set('antiTheftType', data.antiTheftType);
      set('intercomFeatures', data.intercomFeatures);
    }

    const payload: Partial<BackendListing> & Record<string, any> = {
      title: buildTitle(data),
      description: data.description || '',
      brand: data.brand,
      model: data.model,
      type: data.category,
      price: toNumber(data.price) ?? 0,
      condition: data.condition,
      year: toNumber(data.year) ?? null,
      mileage: toNumber(data.mileage) ?? null,
      cc: toNumber(data.cc) ?? null,
      city: data.city,
      // Governorate is now collected explicitly by StepPublish; fall back to city only
      // if it's a known governorate name (city dropdown also lists governorate names).
      governorate: (data.governorate && String(data.governorate).trim()) || data.city || null,
      // Localisation step (last step of the wizard). The backend whitelists
      // these fields in `LISTING_FIELDS` (controllers/listingsController.js)
      // and migration 017 adds the `address` column on listings.
      address: (data.address && String(data.address).trim()) || null,
      latitude: typeof data.latitude === 'number' ? data.latitude : null,
      longitude: typeof data.longitude === 'number' ? data.longitude : null,
      images: Array.isArray(data.images) ? data.images.filter((s) => typeof s === 'string') : [],
      equipment: Array.isArray(data.equipment) ? data.equipment.filter((s) => typeof s === 'string') : [],
      contact_method: data.contactMethod === 'callback' ? 'callback' : 'phone',
      attributes: Object.keys(attributes).length ? attributes : undefined,
      status: 'active',
    };

    const created = await listingsApi.create(payload);

    return {
      success: true,
      id: created.id, // UUID string from backend; do NOT coerce to Number (would yield NaN)
      publishedAt: new Date().toISOString(),
    };
  }
}

export const listingService = new ListingService();
