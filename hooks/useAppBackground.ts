/**
 * useAppBackground — fetches the admin-managed global app background colour
 * and injects it into the document as the `--muted` design token so every
 * `bg-muted` surface (search results, dashboard, listing pages…) updates
 * without a redeploy.
 *
 * The colour is stored as a hex string in `site_settings.app_background`.
 * We convert it to the HSL channel triple expected by Tailwind's
 * `hsl(var(--muted))` wrapper. Refetched on window focus / every 30 s so
 * admin changes propagate to live visitors quickly (real-time enough for a
 * cosmetic setting, without hammering the API).
 */
import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  siteSettingsApi,
  APP_BG_DEFAULT,
  AppBackgroundSettings,
} from '../services/siteSettingsApi';

export const APP_BG_QUERY_KEY = ['site-settings', 'app-background'] as const;

/** Convert "#RRGGBB" to "H S% L%" (the channel format our CSS tokens expect). */
export function hexToHslChannels(hex: string): string | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const int = parseInt(m[1], 16);
  const r = ((int >> 16) & 255) / 255;
  const g = ((int >> 8) & 255) / 255;
  const b = (int & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h *= 60;
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function applyAppBackground(hex: string | null | undefined) {
  if (typeof document === 'undefined') return;
  const value = hex && /^#[0-9a-f]{6}$/i.test(hex) ? hex : APP_BG_DEFAULT;
  const channels = hexToHslChannels(value);
  if (!channels) return;
  // `bg-muted` uses hsl(var(--muted)). Override at :root so every page picks it up.
  document.documentElement.style.setProperty('--muted', channels);
}

export function useAppBackground() {
  const { data } = useQuery<AppBackgroundSettings>({
    queryKey: APP_BG_QUERY_KEY,
    queryFn: ({ signal }) => siteSettingsApi.getAppBackground(signal),
    staleTime: 30 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchInterval: 30 * 1000,
    retry: 1,
  });

  useEffect(() => {
    applyAppBackground(data?.color ?? null);
  }, [data?.color]);

  return data;
}

/** Helper for the admin tab: sets the CSS var locally without waiting for the API. */
export function previewAppBackground(hex: string) {
  applyAppBackground(hex);
}

/** After admin save, force-refresh the cached value for everyone on the same tab. */
export function useInvalidateAppBackground() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: APP_BG_QUERY_KEY });
}