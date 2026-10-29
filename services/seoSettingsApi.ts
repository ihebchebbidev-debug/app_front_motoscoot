/**
 * SEO + analytics settings API.
 *
 * Public surface (anyone can read):
 *   GET  /api/site-settings/seo         → strips secrets
 *
 * Admin surface (auth + requireAdmin enforced server-side):
 *   GET  /api/admin/site-settings/seo
 *   PUT  /api/admin/site-settings/seo
 *   POST /api/admin/seo/ga4-report
 *   POST /api/admin/seo/gsc-report
 *   GET  /api/admin/seo/test-credentials
 */
import { apiClient } from './apiClient';

export interface PublicSeoSettings {
  default_title: string | null;
  title_template: string | null;
  default_description: string | null;
  default_keywords: string | null;
  default_og_image: string | null;
  twitter_handle: string | null;
  organization_name: string | null;
  organization_logo: string | null;
  organization_phone: string | null;
  organization_email: string | null;
  organization_address: string | null;
  ga4_measurement_id: string | null;
  gsc_verification_code: string | null;
  enable_analytics: boolean;
  enable_organization_jsonld: boolean;
  updated_at?: string | null;
}

export interface AdminSeoSettings extends PublicSeoSettings {
  ga4_api_secret: string | null;
  ga4_property_id: string | null;
  gsc_site_url: string | null;
  google_service_account: any | null;
  robots_extra: string | null;
  _meta?: {
    has_service_account: boolean;
    service_account_email: string | null;
    updated_at: string | null;
  };
}

export const seoSettingsApi = {
  getPublic: () => apiClient.get<PublicSeoSettings>('/site-settings/seo'),
  getAdmin:  () => apiClient.get<AdminSeoSettings>('/admin/site-settings/seo'),
  update:    (patch: Partial<AdminSeoSettings>) =>
    apiClient.put<{ ok: true; value: AdminSeoSettings }>('/admin/site-settings/seo', patch),
  ga4Report: (body?: any) => apiClient.post<any>('/admin/seo/ga4-report', body || {}),
  gscReport: (body?: any) => apiClient.post<any>('/admin/seo/gsc-report', body || {}),
  testCredentials: () => apiClient.get<any>('/admin/seo/test-credentials'),
  robotsPreview: () => apiClient.get<string>('/admin/seo/robots-preview'),
};
