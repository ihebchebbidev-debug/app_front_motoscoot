/**
 * Admin API — wraps every endpoint mounted under `/api/admin/*` plus
 * the public `/api/site-reviews` and `/api/garages/:id/reviews/:rid/reply`
 * endpoints used by the admin / owner moderation screens.
 *
 * Every call requires an authenticated request with an admin JWT
 * (the backend enforces this via `authenticate` + `requireAdmin`).
 */
import { apiClient, deleteWithPayload } from './apiClient';

export interface AdminStats {
  users: { total: number; banned: number };
  listings: { total: number; active: number; pending: number };
  reports: { total: number; unresolved: number };
  sessions_30d: number;
  /** Optional — present once the backend bundling garage stats is deployed. */
  garages?: { total: number; verified: number };
}

export interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  seller_type?: string;
  city?: string;
  avatar_url?: string | null;
  is_verified: boolean;
  is_active: boolean;
  created_at: string;
  last_login_at?: string | null;
  roles?: string[] | null;
}

export interface AdminListing {
  id: string;
  title: string;
  brand: string;
  model: string;
  type: string;
  price: number | string;
  status: 'pending' | 'active' | 'rejected' | 'sold' | 'expired';
  condition?: string;
  city?: string;
  governorate?: string;
  address?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  images?: string[];
  created_at: string;
  seller_name?: string;
  seller_email?: string;
}

export interface AdminSiteReview {
  id: number | string;
  user_id?: number | string;
  name: string;
  role?: string;
  avatar_url?: string;
  content: string;
  rating: number;
  is_published: boolean;
  created_at: string;
}

export interface AdminGarage {
  id: string;
  name: string;
  city?: string;
  governorate?: string;
  phone?: string;
  email?: string;
  image?: string;
  is_verified: boolean;
  rating?: number | string;
  reviews_count?: number;
  created_at: string;
  owner_id?: string;
  owner_name?: string;
}

/**
 * Payload accepted by `POST /admin/garages`. Mirrors the columns of the
 * `garages` table; everything except `name` is optional.
 */
export interface AdminGarageCreatePayload {
  name: string;
  description?: string;
  address?: string;
  city?: string;
  governorate?: string;
  phone?: string;
  email?: string;
  website?: string;
  image?: string;
  cover_image?: string;
  logo?: string;
  images?: string[];
  specialties?: string[];
  latitude?: number | null;
  longitude?: number | null;
  hours?: string;
  opening_hours?: Record<string, string>;
  services?: Array<{ name: string; price?: string }>;
  status?: 'active' | 'pending' | 'suspended' | 'closed';
  is_verified?: boolean;
  /** Optional — attach an existing user (must already exist in `users`). */
  owner_id?: string;
}

export interface AdminReport {
  id: number | string;
  reason: string;
  description?: string;
  is_resolved: boolean;
  created_at: string;
  reporter_name?: string;
  listing_title?: string;
  listing_id?: string;
}

export interface AdminAdCampaign {
  id: string;
  title: string;
  client: string;
  zone: string;
  description?: string;
  media_type?: string;
  media_url?: string;
  link_url?: string;
  cta_text?: string;
  target_location?: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  views: number;
  clicks: number;
  created_at: string;
}

export interface AdminAdCampaignAnalytics {
  campaign: AdminAdCampaign;
  period_days: number;
  totals: { impressions: number; clicks: number; ctr: number };
  daily: Array<{ day: string; impressions: number; clicks: number; ctr: number }>;
  top_landing_pages: Array<{ landing_page: string; clicks: number }>;
}

export interface AdminFaq {
  id: string;
  question: string;
  answer: string;
  category: string;
  position: number;
  is_published: boolean;
  created_at?: string;
}

export interface AdminContactMessage {
  id: string;
  name: string;
  email: string;
  subject?: string;
  message: string;
  is_resolved: boolean;
  resolved_by?: string | null;
  created_at: string;
}

export interface AdminNewsletterSubscriber {
  id: string;
  email: string;
  is_active: boolean;
  subscribed_at: string;
  unsubscribed_at?: string | null;
}

export type DevTicketStatus = 'nouveau' | 'en_cours' | 'done' | 'refuse';

export interface AdminDevTicket {
  id: string;
  title: string;
  description: string;
  image_url?: string | null;
  status: DevTicketStatus;
  created_by?: string | null;
  creator_email?: string | null;
  creator_full_name?: string | null;
  created_at: string;
  updated_at: string;
}

export const adminApi = {
  // Dashboard
  getStats: (signal?: AbortSignal) =>
    apiClient.get<AdminStats>('/admin/stats', { signal }),

  // Users
  // Backend now returns { users, total, page, limit, total_pages } so the admin
  // UI can render proper pagination. We unwrap to AdminUser[] when callers don't
  // need the meta, and expose `getUsersPaginated` for cases that do.
  getUsers: async (
    params?: { page?: number; limit?: number; search?: string; role?: string },
    signal?: AbortSignal,
  ): Promise<AdminUser[]> => {
    const data = await apiClient.get<AdminUser[] | { users: AdminUser[]; total: number }>(
      '/admin/users',
      { query: params as any, signal },
    );
    if (Array.isArray(data)) return data;        // legacy shape
    return data?.users || [];
  },
  getUsersPaginated: (
    params?: { page?: number; limit?: number; search?: string; role?: string },
    signal?: AbortSignal,
  ) =>
    apiClient.get<{ users: AdminUser[]; total: number; page: number; limit: number; total_pages: number }>(
      '/admin/users',
      { query: params as any, signal },
    ),
  setUserRole: (userId: string, role: 'user' | 'pro' | 'admin' | 'moderator') =>
    apiClient.patch(`/admin/users/${userId}/role`, { role }),
  removeUserRole: (userId: string, role: string) =>
    // Send role via query string — DELETE bodies get stripped by some proxies.
    deleteWithPayload(`/admin/users/${userId}/role`, { role }),
  banUser: (userId: string, ban: boolean) =>
    apiClient.patch(`/admin/users/${userId}/ban`, { ban }),
  /**
   * Set or remove a client's profile photo. Upload the file first via
   * uploadsApi.single (same storage as every other image), then pass the
   * returned URL here — or null to remove the photo.
   */
  setUserAvatar: (userId: string, avatarUrl: string | null) =>
    apiClient.patch<{ message: string; avatar_url: string | null }>(`/admin/users/${userId}/avatar`, { avatar_url: avatarUrl }),
  deleteUser: (userId: string) =>
    apiClient.delete<{ message: string; listings_deleted: number }>(`/admin/users/${userId}`),

  // Listings moderation
  getAllListings: (
    params?: { status?: string; search?: string; limit?: number },
    signal?: AbortSignal,
  ) => apiClient.get<AdminListing[]>('/admin/listings', { query: params as any, signal }),
  // Paginated variant — backend returns { listings, total, page, limit, total_pages }
  // when `page` is provided. Mirrors `getUsersPaginated`.
  getAllListingsPaginated: (
    params: { page: number; limit: number; status?: string; search?: string },
    signal?: AbortSignal,
  ) =>
    apiClient.get<{ listings: AdminListing[]; total: number; page: number; limit: number; total_pages: number }>(
      '/admin/listings',
      { query: params as any, signal },
    ),
  getPendingListings: (signal?: AbortSignal) =>
    apiClient.get<AdminListing[]>('/admin/listings/pending', { signal }),
  moderateListing: (id: string, action: 'approve' | 'reject', reason?: string) =>
    apiClient.patch(`/admin/listings/${id}/moderate`, { action, reason }),
  deleteListing: (id: string, reason?: string) =>
    apiClient.delete<{ message: string }>(
      `/admin/listings/${id}${reason ? `?reason=${encodeURIComponent(reason)}` : ''}`,
    ),

  // Site reviews moderation
  getSiteReviews: (status: 'pending' | 'published' = 'pending', signal?: AbortSignal) =>
    apiClient.get<AdminSiteReview[]>('/admin/site-reviews', { query: { status }, signal }),
  publishSiteReview: (id: number | string, isPublished: boolean) =>
    apiClient.patch(`/admin/site-reviews/${id}/publish`, { is_published: isPublished }),
  deleteSiteReview: (id: number | string) => apiClient.delete(`/admin/site-reviews/${id}`),
  createSiteReview: (payload: { name: string; role?: string; content: string; rating: number; is_published: boolean; created_at?: string }) =>
    apiClient.post('/admin/site-reviews', payload),

  // Garages admin
  getAllGarages: (
    params?: { search?: string; verified?: 'true' | 'false' },
    signal?: AbortSignal,
  ) => apiClient.get<AdminGarage[]>('/admin/garages', { query: params as any, signal }),
  getAllGaragesPaginated: (
    params: { page: number; limit: number; search?: string; verified?: 'true' | 'false' },
    signal?: AbortSignal,
  ) =>
    apiClient.get<{ garages: AdminGarage[]; total: number; page: number; limit: number; total_pages: number }>(
      '/admin/garages',
      { query: params as any, signal },
    ),
  setGarageVerified: (id: string, verified: boolean) =>
    apiClient.patch(`/admin/garages/${id}/verify`, { verified }),
  /**
   * Admin-only garage creation. Bypasses the Pro-account gate enforced by the
   * public POST /garages route, lets the admin attach an existing user as
   * owner, and accepts the full set of garage fields (status, services,
   * opening hours, gallery, etc.).
   */
  createGarage: (payload: AdminGarageCreatePayload) =>
    apiClient.post<AdminGarage>('/admin/garages', payload),

  // Reports
  getReports: (resolved = false, signal?: AbortSignal) =>
    apiClient.get<AdminReport[]>('/admin/reports', {
      query: { resolved: String(resolved) },
      signal,
    }),
  resolveReport: (id: number | string) => apiClient.patch(`/admin/reports/${id}/resolve`),

  // Ad campaigns (CRUD)
  getAdCampaigns: (active?: boolean, signal?: AbortSignal) =>
    apiClient.get<AdminAdCampaign[]>('/admin/ad-campaigns', {
      query: active != null ? { active: String(active) } : undefined,
      signal,
    }),
  createAdCampaign: (payload: Partial<AdminAdCampaign>) =>
    apiClient.post<AdminAdCampaign>('/admin/ad-campaigns', payload),
  updateAdCampaign: (id: string, payload: Partial<AdminAdCampaign>) =>
    apiClient.patch<AdminAdCampaign>(`/admin/ad-campaigns/${id}`, payload),
  deleteAdCampaign: (id: string) => apiClient.delete(`/admin/ad-campaigns/${id}`),
  getAdCampaignAnalytics: (id: string, period = 30, signal?: AbortSignal) =>
    apiClient.get<AdminAdCampaignAnalytics>(`/admin/ad-campaigns/${id}/analytics`, {
      query: { period: String(period) },
      signal,
    }),

  // FAQ admin
  getFaqs: (signal?: AbortSignal) =>
    apiClient.get<AdminFaq[]>('/admin/faqs', { query: { all: 'true' }, signal }),
  createFaq: (payload: Partial<AdminFaq>) =>
    apiClient.post<AdminFaq>('/admin/faqs', payload),
  updateFaq: (id: string, payload: Partial<AdminFaq>) =>
    apiClient.put<AdminFaq>(`/admin/faqs/${id}`, payload),
  deleteFaq: (id: string) => apiClient.delete(`/admin/faqs/${id}`),

  // Contact messages
  getContactMessages: (signal?: AbortSignal) =>
    apiClient.get<AdminContactMessage[]>('/admin/contact-messages', { signal }),
  resolveContactMessage: (id: string) =>
    apiClient.patch(`/admin/contact-messages/${id}/resolve`),

  // Newsletter
  getNewsletterSubscribers: (active?: boolean, signal?: AbortSignal) =>
    apiClient.get<AdminNewsletterSubscriber[]>('/admin/newsletter', {
      query: active != null ? { active: String(active) } : undefined,
      signal,
    }),
  deleteNewsletterSubscriber: (id: string) =>
    apiClient.delete(`/admin/newsletter/${id}`),

  // ---------- Reference data CRUD ----------
  refList:   (resource: string, signal?: AbortSignal) =>
    apiClient.get<any[]>(`/admin/reference/${resource}`, { signal }),
  refCreate: (resource: string, payload: any) =>
    apiClient.post(`/admin/reference/${resource}`, payload),
  refUpdate: (resource: string, id: number | string, payload: any) =>
    apiClient.patch(`/admin/reference/${resource}/${id}`, payload),
  refDelete: (resource: string, id: number | string) =>
    apiClient.delete(`/admin/reference/${resource}/${id}`),

  // ---------- Brand visit trends (admin Reference tab chart) ----------
  getBrandTrends: (days = 30, signal?: AbortSignal) =>
    apiClient.get<{
      days: number;
      top: { brand: string; visits: number }[];
      series: Array<Record<string, string | number>>;
      all: { brand: string; visits: number }[];
    }>('/admin/brand-trends', { query: { days: String(days) }, signal }),

  /** Per-model breakdown for a single brand — visitor clicks on each fiche. */
  getBrandModelsBreakdown: (brand: string, signal?: AbortSignal) =>
    apiClient.get<{
      brand: string;
      models: { model: string; visits: number }[];
      total_visits: number;
    }>(`/admin/brand-trends/${encodeURIComponent(brand)}/models`, { signal }),

  // ---------- Articles (actualités) ----------
  getArticles: (
    params?: { page?: number; limit?: number; search?: string; category?: string; status?: 'published' | 'draft' },
    signal?: AbortSignal,
  ) =>
    apiClient.get<{ articles: any[]; total: number; page: number; limit: number; total_pages: number }>(
      '/admin/articles',
      { query: params as any, signal },
    ),
  createArticle: (payload: any) => apiClient.post<any>('/admin/articles', payload),
  updateArticle: (id: number | string, payload: any) =>
    apiClient.put<any>(`/admin/articles/${id}`, payload),
  deleteArticle: (id: number | string) => apiClient.delete(`/admin/articles/${id}`),

  // ---------- Tech specs (fiches techniques) ----------
  getTechSpecs: (
    params?: { page?: number; limit?: number; search?: string; brand?: string; category?: string },
    signal?: AbortSignal,
  ) =>
    apiClient.get<{ specs: any[]; total: number; page: number; limit: number; total_pages: number }>(
      '/admin/tech-specs',
      { query: params as any, signal },
    ),
  createTechSpec: (payload: any) => apiClient.post<any>('/admin/tech-specs', payload),
  updateTechSpec: (id: number | string, payload: any) =>
    apiClient.put<any>(`/admin/tech-specs/${id}`, payload),
  deleteTechSpec: (id: number | string) => apiClient.delete(`/admin/tech-specs/${id}`),

  // ---------- Importateurs (catalog of brand importers) ----------
  getImporters: (
    params?: { search?: string; active?: 'true' | 'false' },
    signal?: AbortSignal,
  ) =>
    apiClient.get<{ importers: any[] }>('/admin/importers', {
      query: params as any,
      signal,
    }),
  createImporter: (payload: any) => apiClient.post<any>('/admin/importers', payload),
  updateImporter: (id: string, payload: any) =>
    apiClient.put<any>(`/admin/importers/${id}`, payload),
  deleteImporter: (id: string) => apiClient.delete(`/admin/importers/${id}`),

  // ---------- Tips (conseils) ----------
  getTips: (
    params?: { page?: number; limit?: number; search?: string; category?: string; difficulty?: string; status?: 'published' | 'draft' },
    signal?: AbortSignal,
  ) =>
    apiClient.get<{ tips: any[]; total: number; page: number; limit: number; total_pages: number }>(
      '/admin/tips',
      { query: params as any, signal },
    ),
  createTip: (payload: any) => apiClient.post<any>('/admin/tips', payload),
  updateTip: (id: number | string, payload: any) =>
    apiClient.put<any>(`/admin/tips/${id}`, payload),
  deleteTip: (id: number | string) => apiClient.delete(`/admin/tips/${id}`),

  // ---------- Developer tickets ----------
  getDevTickets: (status?: DevTicketStatus | 'all', signal?: AbortSignal) =>
    apiClient.get<AdminDevTicket[]>('/admin/dev-tickets', {
      query: status && status !== 'all' ? { status } : undefined,
      signal,
    }),
  createDevTicket: (payload: { title: string; description: string; image_url?: string | null }) =>
    apiClient.post<AdminDevTicket>('/admin/dev-tickets', payload),
  updateDevTicket: (id: string, payload: Partial<{ title: string; description: string; image_url: string | null }>) =>
    apiClient.patch<AdminDevTicket>(`/admin/dev-tickets/${id}`, payload),
  updateDevTicketStatus: (id: string, status: DevTicketStatus) =>
    apiClient.patch<AdminDevTicket>(`/admin/dev-tickets/${id}/status`, { status }),
  deleteDevTicket: (id: string) =>
    apiClient.delete(`/admin/dev-tickets/${id}`),
};

/** Garage-owner reply (PATCH /garages/:id/reviews/:reviewId/reply) — not admin. */
export const garageOwnerApi = {
  replyToReview: (garageId: number | string, reviewId: number | string, reply: string) =>
    apiClient.patch(`/garages/${garageId}/reviews/${reviewId}/reply`, { reply }),
};
