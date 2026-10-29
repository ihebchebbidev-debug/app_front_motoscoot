import { registerListingNumber } from '../utils/publicIds';
import { formatListingPrice } from '../utils/priceUtils';
/**
 * Listings API + mapper between backend (snake_case PostgreSQL row)
 * and the frontend Listing type used by the UI.
 */
import { apiClient } from './apiClient';
import { Listing } from '../types';

export interface BackendListing {
  // UUID strings in the new backend; kept loose for legacy numeric ids.
  id: number | string;
  user_id?: number | string;
  title: string;
  description?: string;
  brand: string;
  model: string;
  type: string;
  price: number | string;
  condition: string;
  year?: number | null;
  mileage?: number | null;
  cc?: number | null;
  color?: string | null;
  city?: string | null;
  governorate?: string | null;
  /** Free-text street address — set in the deposit wizard's "Localisation" step. */
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  images?: string[] | null;
  equipment?: string[] | null;
  status?: string;
  views_count?: number;
  favorites_count?: number;
  is_featured?: boolean;
  created_at?: string;
  /** Per-listing contact preference (migration 023). */
  contact_method?: 'phone' | 'callback';
  /**
   * Free-form per-category metadata (migration 024). Currently used to store
   * accessory-specific fields collected by the deposit wizard:
   *   accessoryType, helmetType, visorType[], size, gender, shoeSize,
   *   antiTheftType, intercomFeatures[]
   */
  attributes?: Record<string, string | string[]> | null;
  updated_at?: string;
  // joined seller fields
  seller_name?: string;
  seller_avatar?: string;
  seller_phone?: string;
  seller_type?: string;
  seller_city?: string;
  seller_governorate?: string;
  seller_verified?: boolean;
  seller_since?: string;
  seller_rating?: number | string;
  seller_reviews_count?: number;
  seller_listings_count?: number;
  seller_facebook?: string;
  seller_instagram?: string;
  seller_tiktok?: string;
  /** Pro-only joined fields (from migration 011). */
  seller_shop_name?: string;
  seller_shop_address?: string;
  seller_shop_logo?: string;
  /** Present when GET /listings was called with lat/lng */
  distance_km?: number | string | null;
}

export interface ListingsListParams {
  page?: number;
  limit?: number;
  type?: string;
  brand?: string;
  model?: string;
  city?: string;
  governorate?: string;
  min_price?: number;
  max_price?: number;
  min_year?: number;
  max_year?: number;
  min_mileage?: number;
  max_mileage?: number;
  min_cc?: number;
  max_cc?: number;
  condition?: string;
  sort?: 'newest' | 'oldest' | 'price_asc' | 'price_desc' | 'mileage_asc' | 'year_desc' | 'popular' | 'distance';
  search?: string;
  status?: string;
  /** Server-side geo filter / sort */
  lat?: number;
  lng?: number;
  radius_km?: number;
  /** Pro filter — backend interprets `only_pro=true` as seller_type=pro */
  only_pro?: boolean;
  seller_type?: 'pro' | 'particulier';
  /** Filter by exact owner id (used by "Accéder à la boutique"). */
  user_id?: string | number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ListingFacets {
  total: number;
  brand: { key: string; count: number }[];
  type: { key: string; count: number }[];
  governorate: { key: string; count: number }[];
  condition: { key: string; count: number }[];
  seller_type: { key: string; count: number }[];
}

const FALLBACK_IMAGE =
  'https://www.moto-scoot.tn/content-fallbacks/MT07.jpg';

/** Format a number as a localized price with currency suffix used in the app. */
function formatPrice(value: number | string | undefined | null): string {
  return formatListingPrice(value);
}

function formatRelativeDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const diffMs = Date.now() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return "Aujourd'hui";
  if (diffDays === 1) return 'Hier';
  if (diffDays < 7) return `Il y a ${diffDays} jours`;
  if (diffDays < 30) return `Il y a ${Math.floor(diffDays / 7)} sem.`;
  return d.toLocaleDateString('fr-FR');
}

const VALID_CONDITIONS = [
  'Excellent', 'Très bon', 'Bon', 'Neuf', 'État neuf', 'Correct', 'À réparer', 'Pour pièces',
] as const;

function normalizeCondition(c?: string): Listing['condition'] {
  if (!c) return 'Bon';
  const found = VALID_CONDITIONS.find((v) => v.toLowerCase() === c.toLowerCase());
  return (found || 'Bon') as Listing['condition'];
}

function normalizeType(t?: string): Listing['type'] {
  const v = (t || '').toLowerCase();
  if (v.includes('scoot')) return 'Scooter';
  if (v.includes('quad')) return 'Quad';
  if (v.includes('access')) return 'Accessoires';
  return 'Moto';
}

/**
 * Privacy-preserving coordinate fuzzing.
 *
 * The exact GPS point chosen by a seller is private — only an approximate
 * neighborhood should ever leave the API mapper. We deterministically jitter
 * the point by up to ~500m using a hash of the listing id as the seed, so
 * the same listing always lands on the same fuzzed dot (no jitter on
 * refresh, no way to triangulate by hammering refresh).
 *
 * Server-side distance calculations still use the precise lat/lng (they
 * never leave the DB), so the radius filter remains accurate.
 */
const FUZZ_RADIUS_KM = 0.5;
function hashSeed(id: string | number): number {
  const s = String(id);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}
function fuzzCoords(lat: number, lng: number, id: string | number) {
  const seed = hashSeed(id);
  // Two pseudo-random values in [0,1) from the seed
  const r1 = ((seed & 0xffff) / 0xffff);
  const r2 = (((seed >>> 16) & 0xffff) / 0xffff);
  // Uniform random point inside a circle of radius FUZZ_RADIUS_KM
  const r = FUZZ_RADIUS_KM * Math.sqrt(r1);
  const theta = 2 * Math.PI * r2;
  const dLat = (r / 111) * Math.cos(theta); // 1° lat ≈ 111 km
  const dLng = (r / (111 * Math.cos((lat * Math.PI) / 180))) * Math.sin(theta);
  return { lat: +(lat + dLat).toFixed(4), lng: +(lng + dLng).toFixed(4) };
}

/** Convert a raw backend listing row to the frontend Listing shape. */
export function mapBackendListing(b: BackendListing): Listing {
  registerListingNumber(b.id, (b as any).listing_number);
  const images = Array.isArray(b.images) && b.images.length ? b.images : [];
  const firstImage = images[0] || FALLBACK_IMAGE;

  const sellerType: Listing['sellerType'] =
    (b.seller_type || '').toLowerCase().includes('pro') ? 'Pro' : 'Particulier';

  // For Pro accounts, prefer the shop branding (name + logo) over the personal
  // name + avatar so the listing card and seller box show "Tunis Moto Shop"
  // with the boutique logo. BUT: if a Pro hasn't filled in a shop name yet,
  // fall back to their personal name instead of showing "Vendeur" — same
  // rule for the logo (fall back to the personal avatar). We trim before
  // testing so a row that holds "   " (whitespace-only) is treated as empty
  // and the personal name surfaces correctly.
  const isPro = sellerType === 'Pro';
  const shopName = typeof b.seller_shop_name === 'string' ? b.seller_shop_name.trim() : '';
  const shopLogo = typeof b.seller_shop_logo === 'string' ? b.seller_shop_logo.trim() : '';
  const personalName = typeof b.seller_name === 'string' ? b.seller_name.trim() : '';
  const sellerName = (isPro && shopName) ? shopName : (personalName || 'Vendeur');
  const sellerImage = (isPro && shopLogo) ? shopLogo : (b.seller_avatar || undefined);

  return {
    id: b.id,
    listingNumber: (b as any).listing_number != null ? Number((b as any).listing_number) : undefined,
    title: b.title,
    brand: b.brand,
    model: b.model,
    price: formatPrice(b.price),
    image: firstImage,
    images: images.length ? images : undefined,
    year: b.year ? String(b.year) : undefined,
    mileage: b.mileage != null ? `${b.mileage.toLocaleString('fr-FR')} km` : undefined,
    cc: b.cc != null ? `${b.cc} cc` : undefined,
    location: b.city || b.governorate || b.seller_city || b.seller_governorate || '—',
    date: formatRelativeDate(b.created_at),
    seller: sellerName,
    sellerId: b.user_id,
    sellerType,
    sellerImage,
    sellerVerified: !!b.seller_verified,
    sellerSince: b.seller_since,
    sellerRating: b.seller_rating != null ? (typeof b.seller_rating === 'string' ? parseFloat(b.seller_rating) : b.seller_rating) : undefined,
    sellerReviewsCount: b.seller_reviews_count,
    sellerListingsCount: b.seller_listings_count,
    sellerFacebook: b.seller_facebook,
    sellerInstagram: b.seller_instagram,
    sellerTiktok: b.seller_tiktok,
    phone: b.seller_phone || undefined,
    contactMethod: b.contact_method === 'callback' ? 'callback' : 'phone',
    condition: normalizeCondition(b.condition),
    equipment: Array.isArray(b.equipment) ? b.equipment : undefined,
    type: normalizeType(b.type),
    description: b.description || undefined,
    coordinates:
      b.latitude != null && b.longitude != null
        ? fuzzCoords(Number(b.latitude), Number(b.longitude), b.id)
        : undefined,
    distance: b.distance_km != null ? Number(b.distance_km) : null,
    attributes: (b.attributes && typeof b.attributes === 'object') ? b.attributes as any : undefined,
  };
}

export interface PriceEstimate {
  avg: number | null;
  min: number | null;
  max: number | null;
  n: number;
  confidence: 'high' | 'medium' | 'low';
}

export const listingsApi = {
  async list(
    params?: ListingsListParams,
    signal?: AbortSignal,
  ): Promise<{ listings: Listing[]; pagination: PaginationMeta }> {
    const data = await apiClient.get<{ listings: BackendListing[]; pagination: PaginationMeta }>(
      '/listings',
      { query: params as any, signal },
    );
    return {
      listings: (data.listings || []).map(mapBackendListing),
      pagination: data.pagination,
    };
  },

  async facets(params?: ListingsListParams, signal?: AbortSignal): Promise<ListingFacets> {
    return apiClient.get<ListingFacets>('/listings/facets', { query: params as any, signal });
  },

  async getById(id: string | number, signal?: AbortSignal): Promise<Listing> {
    const data = await apiClient.get<BackendListing>(`/listings/${id}`, { signal });
    return mapBackendListing(data);
  },

  async getPopular(signal?: AbortSignal): Promise<Listing[]> {
    const data = await apiClient.get<BackendListing[] | { listings: BackendListing[] }>(
      '/listings/popular',
      { signal },
    );
    const arr = Array.isArray(data) ? data : data.listings || [];
    return arr.map(mapBackendListing);
  },

  async getSimilar(id: string | number, signal?: AbortSignal): Promise<Listing[]> {
    const data = await apiClient.get<BackendListing[] | { listings: BackendListing[] }>(
      `/listings/${id}/similar`,
      { signal },
    );
    const arr = Array.isArray(data) ? data : data.listings || [];
    return arr.map(mapBackendListing);
  },

  async toggleFavorite(id: string | number): Promise<{ favorited: boolean }> {
    return apiClient.post<{ favorited: boolean }>(`/listings/${id}/favorite`);
  },

  async getFavorites(signal?: AbortSignal): Promise<Listing[]> {
    const data = await apiClient.get<BackendListing[]>('/listings/favorites', { signal });
    return (data || []).map(mapBackendListing);
  },

  async create(payload: Partial<BackendListing>): Promise<Listing> {
    const data = await apiClient.post<BackendListing>('/listings', payload);
    return mapBackendListing(data);
  },

  async update(id: string | number, payload: Partial<BackendListing>): Promise<Listing> {
    const data = await apiClient.put<BackendListing>(`/listings/${id}`, payload);
    return mapBackendListing(data);
  },

  async remove(id: string | number): Promise<void> {
    await apiClient.delete(`/listings/${id}`);
  },

  async estimatePrice(
    params: { brand: string; model?: string; year?: number; mileage?: number; condition?: string },
    signal?: AbortSignal,
  ): Promise<PriceEstimate> {
    return apiClient.post<PriceEstimate>('/listings/estimate-price', params, { signal });
  },

  async getStats(id: string | number, signal?: AbortSignal): Promise<ListingStats> {
    return apiClient.get<ListingStats>(`/listings/${id}/stats`, { signal });
  },
};

/** Aggregated owner-only metrics returned by GET /api/listings/:id/stats. */
export interface ListingStatsDayPoint {
  day: string; // YYYY-MM-DD
  count: number;
}

export interface ListingStats {
  views_count: number;
  favorites_count: number;
  contacts_count: number;
  shares_count: number;
  views_by_day: ListingStatsDayPoint[];
  contacts_by_day: ListingStatsDayPoint[];
  shares_by_day: ListingStatsDayPoint[];
  window_days: number;
}

export default listingsApi;
