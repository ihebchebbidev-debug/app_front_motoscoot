/**
 * Site settings (hero images, etc.) — public read + admin write.
 *
 * The backend stores values in a JSONB blob (table `site_settings`,
 * key `hero_images`). Both URLs may be null when the admin hasn't
 * uploaded a custom image yet — callers fall back to the hard-coded
 * defaults shipped in the frontend (see HERO_DEFAULTS below).
 */
import { apiClient } from './apiClient';

export interface HeroImagesSettings {
  desktop_url: string | null;
  mobile_url: string | null;
  background_color: string | null;
  updated_at?: string | null;
}

/**
 * Default hero images shipped with the frontend bundle. Used whenever the
 * admin hasn't uploaded a custom one (so a fresh DB still looks correct).
 */
export const HERO_DEFAULTS = {
  desktop_url: 'https://www.moto-scoot.tn/hero-assets/-hero-background.webp',
  mobile_url:  '/images/hero-mobile-828.webp',
  background_color: '#ea580c',
} as const;

/**
 * Editable hero copy (title / subtitle / badge suffix). Stored under the
 * `hero_texts` key in the same JSONB site_settings store. All fields are
 * nullable — frontend falls back to HERO_TEXTS_DEFAULTS when null/empty.
 */
export interface HeroTextsSettings {
  title: string | null;
  subtitle: string | null;
  badge_suffix: string | null;
  updated_at?: string | null;
}

export const HERO_TEXTS_DEFAULTS = {
  title: 'Achetez ou vendez\nvotre moto',
  subtitle: 'La référence en Tunisie pour acheter ou vendre votre moto en quelques clics.',
  badge_suffix: 'annonces en ligne',
} as const;

/**
 * Admin-controlled app background (the "gray" surface behind cards on
 * listing/dashboard pages — i.e. the `bg-muted` Tailwind token). When null,
 * the frontend falls back to APP_BG_DEFAULT below.
 */
export interface AppBackgroundSettings {
  color: string | null;
  updated_at?: string | null;
}

// Matches the default `--muted` token in src/styles/globals.css (≈ #F8FAFC).
export const APP_BG_DEFAULT = '#F8FAFC';

export type SocialNetwork = 'facebook' | 'instagram' | 'tiktok' | 'youtube' | 'linkedin' | 'x';
export type SocialLinks = Partial<Record<SocialNetwork, string | null>>;
export const SOCIAL_NETWORKS: { key: SocialNetwork; label: string; placeholder: string }[] = [
  { key: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/motoscoot.tn' },
  { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/motoscoot.tn' },
  { key: 'tiktok', label: 'TikTok', placeholder: 'https://tiktok.com/@motoscoot.tn' },
  { key: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/@motoscoot' },
  { key: 'linkedin', label: 'LinkedIn', placeholder: 'https://linkedin.com/company/motoscoot' },
  { key: 'x', label: 'X (Twitter)', placeholder: 'https://x.com/motoscoot' },
];

export const siteSettingsApi = {
  getSocialLinks: (signal?: AbortSignal) =>
    apiClient.get<SocialLinks>('/site-settings/social-links', { signal }),
  updateSocialLinks: (payload: SocialLinks) =>
    apiClient.put<SocialLinks>('/admin/site-settings/social-links', payload),

  getHero: (signal?: AbortSignal) =>
    apiClient.get<HeroImagesSettings>('/site-settings/hero', { signal }),

  // Admin only — backend enforces requireAdmin on /admin/* routes.
  updateHero: (payload: { desktop_url: string | null; mobile_url: string | null; background_color: string | null }) =>
    apiClient.put<HeroImagesSettings>('/admin/site-settings/hero', payload),

  getHeroTexts: (signal?: AbortSignal) =>
    apiClient.get<HeroTextsSettings>('/site-settings/hero-texts', { signal }),

  updateHeroTexts: (payload: { title: string | null; subtitle: string | null; badge_suffix: string | null }) =>
    apiClient.put<HeroTextsSettings>('/admin/site-settings/hero-texts', payload),

  getAppBackground: (signal?: AbortSignal) =>
    apiClient.get<AppBackgroundSettings>('/site-settings/app-background', { signal }),

  updateAppBackground: (payload: { color: string | null }) =>
    apiClient.put<AppBackgroundSettings>('/admin/site-settings/app-background', payload),
};
