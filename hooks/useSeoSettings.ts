/**
 * Public SEO settings hook + cached query for the entire app.
 * Used by:
 *   • SEO.tsx — to merge admin defaults (title template, OG image, GSC meta)
 *   • analytics service — to read the GA4 measurement ID
 */
import { useQuery } from '@tanstack/react-query';
import { seoSettingsApi, PublicSeoSettings } from '../services/seoSettingsApi';

export const SEO_SETTINGS_QUERY_KEY = ['site-settings', 'seo'] as const;

export function useSeoSettings() {
  return useQuery<PublicSeoSettings>({
    queryKey: SEO_SETTINGS_QUERY_KEY,
    queryFn: () => seoSettingsApi.getPublic(),
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 60,
    retry: 1,
  });
}
