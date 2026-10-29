/**
 * Audience analytics API — wraps `/api/analytics/audience`, `/visitors`, etc.
 * Admin-only (server enforces).
 */
import { apiClient } from './apiClient';

export interface AudienceKpis {
  unique_visitors: number;
  total_sessions: number;
  avg_duration: number;
  avg_pages: number;
  logged_in_sessions: number;
}

export interface AudienceCountryRow {
  country_code: string;
  country: string | null;
  sessions: number;
  unique_visitors: number;
}

export interface AudienceCityRow { city: string; sessions: number; }
export interface AudienceDeviceRow { device: string; sessions: number; }
export interface AudienceOsRow { os: string; sessions: number; }
export interface AudienceBrowserRow { browser: string; sessions: number; }

export interface AudiencePageRow {
  view_name: string;
  views: number;
  unique_visitors: number;
  avg_duration_ms: number | null;
}

export interface AudienceClickedListingRow {
  id: string;
  title: string;
  brand: string;
  model: string;
  price: number | string;
  clicks: number;
  unique_clicks: number;
}

export interface AudienceDailyTrafficRow {
  day: string;
  sessions: number;
  visitors: number;
}

export interface AudienceResponse {
  period_days: number;
  kpis: AudienceKpis;
  by_country: AudienceCountryRow[];
  by_city: AudienceCityRow[];
  by_device: AudienceDeviceRow[];
  by_os: AudienceOsRow[];
  by_browser: AudienceBrowserRow[];
  top_pages: AudiencePageRow[];
  top_clicked_listings: AudienceClickedListingRow[];
  daily_traffic: AudienceDailyTrafficRow[];
}

export interface VisitorRow {
  fingerprint: string;
  ip_address: string | null;
  country: string | null;
  country_code: string | null;
  city: string | null;
  region: string | null;
  total_visits: number;
  total_duration: number;
  first_seen: string;
  last_seen: string;
  user_id: string | null;
  user_email: string | null;
  user_name: string | null;
}

export interface VisitorListResponse {
  total: number;
  visitors: VisitorRow[];
}

export interface VisitorDetail {
  profile: VisitorRow;
  sessions: any[];
  page_views: any[];
  listing_clicks: any[];
  listing_views: any[];
}

export interface FunnelStep {
  key: 'visitor' | 'search' | 'tech_spec' | 'detail' | 'contact';
  label: string;
  description: string;
  count: number;
  rate_from_top: number;
  drop_off: number;
}

export interface FunnelResponse {
  period_days: number;
  steps: FunnelStep[];
  overall_conversion_rate: number;
}

export interface FunnelSourceBucket {
  key: 'organic' | 'social' | 'direct' | 'referral';
  label: string;
  description: string;
  sources: string[];
  steps: FunnelStep[];
  overall_conversion_rate: number;
}

export interface FunnelBySourceResponse {
  period_days: number;
  buckets: FunnelSourceBucket[];
}

export const analyticsApi = {
  getAudience: (period: number = 30, signal?: AbortSignal) =>
    apiClient.get<AudienceResponse>('/analytics/audience', {
      query: { period: String(period) },
      signal,
    }),

  getFunnel: (period: number = 30, signal?: AbortSignal) =>
    apiClient.get<FunnelResponse>('/analytics/funnel', {
      query: { period: String(period) },
      signal,
    }),

  getFunnelBySource: (period: number = 30, signal?: AbortSignal) =>
    apiClient.get<FunnelBySourceResponse>('/analytics/funnel/by-source', {
      query: { period: String(period) },
      signal,
    }),

  listVisitors: (
    params: { country_code?: string; search?: string; limit?: number; offset?: number } = {},
    signal?: AbortSignal,
  ) =>
    apiClient.get<VisitorListResponse>('/analytics/visitors', {
      query: params as any,
      signal,
    }),

  getVisitor: (fingerprint: string, signal?: AbortSignal) =>
    apiClient.get<VisitorDetail>(`/analytics/visitors/${encodeURIComponent(fingerprint)}`, { signal }),
};
