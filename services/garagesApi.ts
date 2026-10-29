/**
 * Garages API + mapper between backend rows and the frontend Garage type.
 */
import { apiClient } from './apiClient';
import { Garage } from '../types';

const FALLBACK_IMAGE = 'https://www.moto-scoot.tn/content-fallbacks/garage-default.jpg';

export interface BackendGarage {
  // Backend now returns UUID strings; keep `number` for legacy seeds.
  id: number | string;
  name: string;
  slug?: string;
  description?: string;
  image?: string;
  logo?: string;
  cover_image?: string;
  images?: string[];
  rating?: number | string;
  reviews_count?: number;
  address?: string;
  city?: string;
  governorate?: string;
  phone?: string;
  email?: string;
  website?: string;
  latitude?: number;
  longitude?: number;
  hours?: string;
  opening_hours?: any;
  specialties?: string[];
  specialty?: string;
  services?: any[];
  is_verified?: boolean;
  status?: string;
  created_at?: string;
}

export function mapBackendGarage(g: BackendGarage): Garage {
  const images = Array.isArray(g.images) && g.images.length ? g.images : [];
  return {
    id: g.id,
    name: g.name,
    image: g.cover_image || g.image || g.logo || images[0] || FALLBACK_IMAGE,
    rating: typeof g.rating === 'string' ? parseFloat(g.rating) : g.rating || 0,
    description: g.description,
    address: g.address,
    location: g.city || g.governorate,
    hours: g.hours || (typeof g.opening_hours === 'string' ? g.opening_hours : undefined),
    reviewsCount: g.reviews_count,
    specialties: g.specialties,
    specialty: g.specialty || (g.specialties && g.specialties[0]),
    isVerified: g.is_verified,
    images: images.length ? images : undefined,
    phone: g.phone,
    website: g.website,
    email: g.email,
    coordinates:
      g.latitude != null && g.longitude != null
        ? { lat: Number(g.latitude), lng: Number(g.longitude) }
        : undefined,
    services: Array.isArray(g.services)
      ? g.services.map((s: any) => ({
          name: s.name || String(s),
          price: s.price,
        }))
      : undefined,
  };
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

export const garagesApi = {
  async list(params?: { city?: string; specialty?: string; search?: string; page?: number; limit?: number }, signal?: AbortSignal): Promise<Garage[]> {
    const data = await apiClient.get<BackendGarage[] | { garages: BackendGarage[] }>(
      '/garages',
      { query: params as any, signal },
    );
    const arr = Array.isArray(data) ? data : data.garages || [];
    return arr.map(mapBackendGarage);
  },

  /**
   * Cursor-paginated listing for infinite scroll.
   * `cursor` is opaque — pass back what the previous page returned.
   * Returns `nextCursor === null` once the dataset is exhausted.
   */
  async listPage(
    params: {
      city?: string;
      specialty?: string;
      search?: string;
      limit?: number;
      cursor?: string | null;
    } = {},
    signal?: AbortSignal,
  ): Promise<CursorPage<Garage>> {
    const query: Record<string, any> = {
      mode: 'cursor',
      limit: params.limit ?? 20,
    };
    if (params.cursor) query.cursor = params.cursor;
    if (params.city) query.city = params.city;
    if (params.specialty) query.specialty = params.specialty;
    if (params.search) query.search = params.search;

    const data = await apiClient.get<{ garages: BackendGarage[]; nextCursor: string | null }>(
      '/garages',
      { query, signal },
    );
    return {
      items: (data.garages || []).map(mapBackendGarage),
      nextCursor: data.nextCursor ?? null,
    };
  },

  async getById(id: number | string, signal?: AbortSignal): Promise<Garage> {
    const data = await apiClient.get<BackendGarage>(`/garages/${id}`, { signal });
    return mapBackendGarage(data);
  },

  async getPopular(signal?: AbortSignal): Promise<Garage[]> {
    const data = await apiClient.get<BackendGarage[] | { garages: BackendGarage[] }>(
      '/garages/popular',
      { signal },
    );
    const arr = Array.isArray(data) ? data : data.garages || [];
    return arr.map(mapBackendGarage);
  },

  async getReviews(id: number | string, signal?: AbortSignal): Promise<any[]> {
    const data = await apiClient.get<any[]>(`/garages/${id}/reviews`, { signal });
    return Array.isArray(data) ? data : [];
  },

  async addReview(id: number | string, payload: { rating: number; content: string }) {
    return apiClient.post(`/garages/${id}/reviews`, payload);
  },

  async getSpecialties(signal?: AbortSignal): Promise<string[]> {
    const data = await apiClient.get<string[] | { specialties: string[] }>('/garages/specialties', { signal });
    return Array.isArray(data) ? data : data.specialties || [];
  },
};

export default garagesApi;
