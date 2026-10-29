/**
 * Notifications + Ads + Reference API services (lightweight, no mapper needed).
 */
import { apiClient } from './apiClient';

export interface Notification {
  id: number | string;
  user_id?: number | string;
  type: string;
  title: string;
  body?: string;
  link?: string;
  is_read: boolean;
  created_at: string;
  data?: Record<string, any>;
}

export const notificationsApi = {
  async list(signal?: AbortSignal): Promise<Notification[]> {
    const data = await apiClient.get<Notification[] | { notifications: Notification[] }>(
      '/notifications',
      { signal },
    );
    return Array.isArray(data) ? data : data.notifications || [];
  },

  async getUnreadCount(signal?: AbortSignal): Promise<number> {
    const data = await apiClient.get<{ count: number } | number>('/notifications/unread-count', { signal });
    if (typeof data === 'number') return data;
    return data?.count || 0;
  },

  markRead: (id: number | string) => apiClient.patch(`/notifications/${id}/read`),
  markAllRead: () => apiClient.patch('/notifications/read-all'),
  remove: (id: number | string) => apiClient.delete(`/notifications/${id}`),
};

export interface AdCampaignResponse {
  // UUIDs in the backend.
  id: string;
  title: string;
  zone: string;
  media_type?: string;
  media_url: string;
  link_url: string;
  cta_text?: string;
  description?: string;
}

export const adsApi = {
  async getActive(zone?: string, signal?: AbortSignal): Promise<AdCampaignResponse[]> {
    const data = await apiClient.get<AdCampaignResponse[] | { ads: AdCampaignResponse[] }>(
      '/ads/active',
      { query: zone ? { zone } : undefined, signal },
    );
    return Array.isArray(data) ? data : data.ads || [];
  },

  trackImpression: (id: string | number) =>
    apiClient.post(`/ads/${id}/impression`, undefined, { noAuth: true }).catch(() => {}),
  trackClick: (id: string | number, landingPage?: string) =>
    apiClient.post(`/ads/${id}/click`, landingPage ? { landing_page: landingPage } : undefined, { noAuth: true }).catch(() => {}),
};

export interface SiteReview {
  id: number;
  name: string;
  role?: string;
  image?: string;
  avatar?: string;
  content: string;
  rating: number;
  created_at?: string;
  date?: string;
  is_admin_entry?: boolean;
}

export const siteReviewsApi = {
  async list(signal?: AbortSignal): Promise<SiteReview[]> {
    const data = await apiClient.get<SiteReview[] | { reviews: SiteReview[] }>(
      '/site-reviews',
      { signal },
    );
    return Array.isArray(data) ? data : data?.reviews || [];
  },
  async create(payload: { rating: number; content: string; role?: string }) {
    return apiClient.post('/site-reviews', payload);
  },
};

export interface BrandRef { id: number; name: string; logo_url?: string | null; categories?: string[]; accessory_types?: string[] }
export interface ModelRef { id: number; brand_id: number; brand_name?: string; name: string; category?: string | null; accessory_types?: string[] }
export interface CityRef { id: number; name: string; governorate: string }
export interface NamedRef { id: number; name: string; position?: number; is_active?: boolean }
export interface EquipmentRef { id: number; name: string; category?: string; accessory_type?: string | null }
export interface ColorRef { id: number; name: string; hex?: string }
/**
 * Vehicle category as curated by admins in /admin/reference/vehicle-categories.
 * The backend may also return the legacy `string[]` form — `useVehicleCategories`
 * normalises both into this object shape so consumers don't need to branch.
 */
export interface VehicleCategoryRef {
  id?: number;
  name: string;
  position?: number;
  /** Optional hero image (used by deposit wizard, search filters, etc.). */
  image_url?: string | null;
  /** Optional small icon (used by the home category nav strip). */
  icon_url?: string | null;
  /** Short tagline shown beneath the category card. */
  description?: string | null;
}

export const referenceApi = {
  /**
   * `category` filters by vehicle category (Moto/Scooter/Quad).
   * `accessoryType` (sent as ?accessory_type=…) narrows the brand list to
   * those tagged with that accessory type when category=Accessoires.
   */
  getBrands: (category?: string, signal?: AbortSignal, accessoryType?: string) =>
    apiClient.get<BrandRef[]>('/reference/brands', {
      query: {
        ...(category ? { category } : {}),
        ...(accessoryType ? { accessory_type: accessoryType } : {}),
      },
      signal,
    }),
  getModels: (brand?: string, signal?: AbortSignal, accessoryType?: string) =>
    apiClient.get<ModelRef[]>('/reference/models', {
      query: {
        ...(brand ? { brand } : {}),
        ...(accessoryType ? { accessory_type: accessoryType } : {}),
      },
      signal,
    }),
  getCities: (governorate?: string, signal?: AbortSignal) =>
    apiClient.get<CityRef[]>('/reference/cities', {
      query: governorate ? { governorate } : undefined,
      signal,
    }),
  getGovernorates: (signal?: AbortSignal) =>
    apiClient.get<string[]>('/reference/governorates', { signal }),
  /**
   * Returns the admin-curated vehicle category list. Backend may respond with
   * either the legacy `string[]` shape or the richer `VehicleCategoryRef[]`
   * shape (name + image_url + icon_url + description). The hook normalises
   * both into objects so UI code can rely on a single contract.
   */
  getCategories: (signal?: AbortSignal) =>
    apiClient.get<string[] | VehicleCategoryRef[]>('/reference/categories', { signal }),
  getEquipment: (signal?: AbortSignal, accessoryType?: string) =>
    apiClient.get<EquipmentRef[]>('/reference/equipment', {
      query: accessoryType ? { accessory_type: accessoryType } : undefined,
      signal,
    }),
  getColors: (signal?: AbortSignal) =>
    apiClient.get<ColorRef[]>('/reference/colors', { signal }),
  getConditions: (signal?: AbortSignal) =>
    apiClient.get<string[]>('/reference/conditions', { signal }),
  getAccessoryTypes: (signal?: AbortSignal) =>
    apiClient.get<NamedRef[]>('/reference/accessory-types', { signal }),
  getGarageSpecialties: (signal?: AbortSignal) =>
    apiClient.get<NamedRef[]>('/reference/garage-specialties', { signal }),
  getGarageServices: (signal?: AbortSignal) =>
    apiClient.get<NamedRef[]>('/reference/garage-services', { signal }),
};

export interface PopularBrand {
  id: number;
  name: string;
  logo_url?: string | null;
  visits?: number;
}

export const brandsApi = {
  async getPopularDetailed(limit = 12, signal?: AbortSignal): Promise<PopularBrand[]> {
    const data = await apiClient.get<{ brands: PopularBrand[] }>(
      '/brands/popular',
      { query: { detailed: '1', limit }, signal },
    );
    return data?.brands || [];
  },
};

// ---------------- FAQ ----------------
export interface FaqItem {
  id: number;
  question: string;
  answer: string;
  category: string;
  position?: number;
  is_published?: boolean;
}

export const faqApi = {
  async list(category?: string, signal?: AbortSignal): Promise<FaqItem[]> {
    const data = await apiClient.get<FaqItem[] | { faqs: FaqItem[] }>(
      '/faq',
      { query: category && category !== 'Tous' ? { category } : undefined, signal },
    );
    return Array.isArray(data) ? data : data?.faqs || [];
  },
};

// ---------------- Contact ----------------
export interface ContactPayload {
  name: string;
  email: string;
  message: string;
  phone?: string;
  subject?: string;
}

export const contactApi = {
  async send(payload: ContactPayload): Promise<{ success: true; id?: number }> {
    return apiClient.post<{ success: true; id?: number }>('/contact', payload, { noAuth: true });
  },
};

// ---------------- Newsletter (public) ----------------
export const reportsApi = {
  async create(payload: { listing_id: string | number; reason: string; details?: string }): Promise<{ id: string | number }> {
    return apiClient.post('/reports', payload);
  },
};

export const newsletterApi = {
  subscribe: (email: string) =>
    apiClient.post('/newsletter/subscribe', { email }, { noAuth: true }),
  unsubscribe: (email: string) =>
    apiClient.post('/newsletter/unsubscribe', { email }, { noAuth: true }),
};

// ---------------- User stats (dashboard) ----------------
export interface UserStats {
  listings: {
    total: number;
    active: number;
    sold: number;
    total_views: number;
    total_favorites: number;
    total_contacts: number;
  };
  favorites_count: number;
  conversations_count: number;
  unread_notifications: number;
}

export const userStatsApi = {
  async me(signal?: AbortSignal): Promise<UserStats> {
    return apiClient.get<UserStats>('/users/me/stats', { signal });
  },
};
