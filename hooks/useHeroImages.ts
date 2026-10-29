/**
 * useHeroImages — fetches the admin-configured hero background URLs and
 * falls back to the shipped defaults when the admin hasn't set one.
 *
 * Cached aggressively (15 min) since the value almost never changes; the
 * Apparence tab in admin invalidates this query after a successful save.
 */
import { useQuery } from '@tanstack/react-query';
import { siteSettingsApi, HERO_DEFAULTS, HeroImagesSettings } from '../services/siteSettingsApi';

export const HERO_QUERY_KEY = ['site-settings', 'hero'] as const;

export interface ResolvedHeroImages {
  desktopUrl: string;
  mobileUrl: string;
  backgroundColor: string;
  /** True when the admin has uploaded at least one custom image. */
  isCustomDesktop: boolean;
  isCustomMobile: boolean;
  raw?: HeroImagesSettings;
}

export function useHeroImages(): ResolvedHeroImages {
  const { data } = useQuery({
    queryKey: HERO_QUERY_KEY,
    queryFn: ({ signal }) => siteSettingsApi.getHero(signal),
    staleTime: 15 * 60 * 1000,
    gcTime:    60 * 60 * 1000,
    retry: 1,
  });

  return {
    desktopUrl: data?.desktop_url || HERO_DEFAULTS.desktop_url,
    mobileUrl:  data?.mobile_url  || HERO_DEFAULTS.mobile_url,
    backgroundColor: data?.background_color || HERO_DEFAULTS.background_color,
    isCustomDesktop: !!data?.desktop_url,
    isCustomMobile:  !!data?.mobile_url,
    raw: data,
  };
}
