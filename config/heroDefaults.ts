/**
 * Default hero images shipped with the frontend bundle. Used whenever the
 * admin hasn't uploaded a custom one (so a fresh DB still looks correct).
 * Shared by the app (services/siteSettingsApi.ts) and the build-time home
 * page (src/seo/vitePluginSeoSnapshots.ts).
 */
export const HERO_DEFAULTS = {
  desktop_url: 'https://www.moto-scoot.tn/hero-assets/-hero-background.webp',
  mobile_url:  '/images/hero-mobile-828.webp',
  background_color: '#ea580c',
} as const;
