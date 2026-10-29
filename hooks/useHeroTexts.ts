/**
 * useHeroTexts — fetches the admin-configured hero texts (title, subtitle,
 * badge suffix) and falls back to shipped defaults when null/empty.
 *
 * Perf: the last successful response is persisted to localStorage and used
 * as `initialData`, so returning visitors see the real copy instantly
 * (no 1-2 s flicker while the network call resolves). The query still
 * revalidates in the background.
 */
import { useQuery } from '@tanstack/react-query';
import { siteSettingsApi, HERO_TEXTS_DEFAULTS, HeroTextsSettings } from '../services/siteSettingsApi';

export const HERO_TEXTS_QUERY_KEY = ['site-settings', 'hero-texts'] as const;
const LS_KEY = 'ms.heroTexts.v1';

export interface ResolvedHeroTexts {
  title: string;
  subtitle: string;
  badgeSuffix: string;
  isLoaded: boolean;
  raw?: HeroTextsSettings;
}

function readCache(): HeroTextsSettings | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : undefined;
  } catch { return undefined; }
}

function writeCache(data: HeroTextsSettings | undefined) {
  if (typeof window === 'undefined' || !data) return;
  try { window.localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch { /* ignore */ }
}

export function useHeroTexts(): ResolvedHeroTexts {
  const cached = readCache();

  const { data, isSuccess, isError } = useQuery({
    queryKey: HERO_TEXTS_QUERY_KEY,
    queryFn: async ({ signal }) => {
      const result = await siteSettingsApi.getHeroTexts(signal);
      writeCache(result);
      return result;
    },
    staleTime: 5 * 60 * 1000,
    gcTime:    30 * 60 * 1000,
    retry: 1,
    initialData: cached,
    initialDataUpdatedAt: cached ? 0 : undefined, // mark stale so a background refresh still runs
  });

  return {
    title:       (data?.title       && data.title.trim())       || HERO_TEXTS_DEFAULTS.title,
    subtitle:    (data?.subtitle    && data.subtitle.trim())    || HERO_TEXTS_DEFAULTS.subtitle,
    badgeSuffix: (data?.badge_suffix && data.badge_suffix.trim()) || HERO_TEXTS_DEFAULTS.badge_suffix,
    isLoaded: Boolean(data) || isSuccess || isError,
    raw: data,
  };
}
