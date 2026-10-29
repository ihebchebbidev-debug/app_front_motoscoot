/**
 * AdsContext
 *
 * Live ad campaigns, fetched per "zone" from the backend on demand:
 *   GET  /api/ads/active?zone=<zone>
 *   POST /api/ads/:id/impression  (fire-and-forget, optional auth)
 *   POST /api/ads/:id/click       (fire-and-forget, optional auth)
 *
 * Replaces the previous mock localStorage-only implementation. Components
 * (PopupAd, AdBanner) call `getAdByZone(zone)` which is asynchronous.
 *
 * The provider keeps a small in-memory cache keyed by zone so that the same
 * zone rendered on the same page does not refetch.
 */
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import { adsApi, type AdCampaignResponse } from '../services/miscApi';

export interface ZoneAd {
  // Ad ids are UUIDs in the backend (Postgres uuid_generate_v4). Coercing to
  // Number used to produce NaN, which then made trackImpression POST to
  // `/ads/NaN/impression` and crash with a 500. Always treat as string.
  id: string;
  title: string;
  zone: string;
  mediaType?: string;
  mediaUrl: string;
  linkUrl: string;
  ctaText?: string;
  description?: string;
}

interface AdsContextType {
  /** Resolved ad for a zone, or null while loading / not found. */
  getAdByZone: (zone: string) => ZoneAd | null;
  /** Imperatively (re)load the ad for a given zone. */
  loadZone: (zone: string) => Promise<ZoneAd | null>;
  /** True while a given zone is being fetched. */
  isLoadingZone: (zone: string) => boolean;
  trackView: (id: string) => void;
  trackClick: (id: string, landingPage?: string) => void;
}

const AdsContext = createContext<AdsContextType | undefined>(undefined);

function mapAd(raw: AdCampaignResponse | null | undefined): ZoneAd | null {
  if (!raw) return null;
  return {
    id: String(raw.id),
    title: raw.title,
    zone: raw.zone,
    mediaType: raw.media_type,
    mediaUrl: raw.media_url,
    linkUrl: raw.link_url,
    ctaText: raw.cta_text,
    description: raw.description,
  };
}

export const AdsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // In-memory cache: zone -> ZoneAd | null (null = fetched, no ad available).
  const [zoneCache, setZoneCache] = useState<Record<string, ZoneAd | null>>({});
  // Mirror of zoneCache in a ref so loadZone can read the freshest value
  // without depending on `zoneCache` (which would re-create the callback on
  // every cache update and churn every memoized consumer downstream).
  const zoneCacheRef = useRef<Record<string, ZoneAd | null>>({});
  const inFlight = useRef<Record<string, Promise<ZoneAd | null>>>({});
  const [loadingZones, setLoadingZones] = useState<Record<string, boolean>>({});

  // Keep the ref in sync — runs after render so subsequent loadZone() calls
  // see the latest cache without us re-binding the callback identity.
  React.useEffect(() => {
    zoneCacheRef.current = zoneCache;
  }, [zoneCache]);

  // STABLE callback — no dependencies, identity never changes for the lifetime
  // of the provider. This means consumers that destructure `loadZone` from
  // useAds() can list it in effect deps without triggering re-runs every
  // time another zone resolves.
  const loadZone = useCallback(async (zone: string): Promise<ZoneAd | null> => {
    if (!zone) return null;
    if (zone in zoneCacheRef.current) return zoneCacheRef.current[zone];
    const existing = inFlight.current[zone];
    if (existing) return existing;

    setLoadingZones((s) => ({ ...s, [zone]: true }));

    const promise = adsApi
      .getActive(zone)
      .then((list) => {
        const ad = mapAd(Array.isArray(list) ? list[0] : list);
        setZoneCache((c) => {
          const next = { ...c, [zone]: ad };
          zoneCacheRef.current = next;
          return next;
        });
        return ad;
      })
      .catch(() => {
        // Ad fetch failures should never block the page.
        setZoneCache((c) => {
          const next = { ...c, [zone]: null };
          zoneCacheRef.current = next;
          return next;
        });
        return null;
      })
      .finally(() => {
        delete inFlight.current[zone];
        setLoadingZones((s) => {
          const { [zone]: _omit, ...rest } = s;
          return rest;
        });
      });

    inFlight.current[zone] = promise;
    return promise;
  }, []);

  const getAdByZone = useCallback(
    (zone: string): ZoneAd | null => {
      if (zone in zoneCache) return zoneCache[zone];
      // Defer the fetch to a microtask so we never call setState while a
      // parent component is still rendering (React would warn otherwise).
      if (typeof queueMicrotask === 'function') {
        queueMicrotask(() => { void loadZone(zone); });
      } else {
        Promise.resolve().then(() => { void loadZone(zone); });
      }
      return null;
    },
    [zoneCache, loadZone],
  );

  const isLoadingZone = useCallback((zone: string) => !!loadingZones[zone], [loadingZones]);

  const trackView = useCallback((id: string) => {
    if (!id || id === 'NaN' || id === 'undefined') return;
    void adsApi.trackImpression(id);
  }, []);

  const trackClick = useCallback((id: string, landingPage?: string) => {
    if (!id || id === 'NaN' || id === 'undefined') return;
    void adsApi.trackClick(id, landingPage);
  }, []);

  const value = useMemo<AdsContextType>(
    () => ({ getAdByZone, loadZone, isLoadingZone, trackView, trackClick }),
    [getAdByZone, loadZone, isLoadingZone, trackView, trackClick],
  );

  return <AdsContext.Provider value={value}>{children}</AdsContext.Provider>;
};

// Safe no-op fallback so a stray <AdBanner /> rendered outside the provider
// (e.g. during a transient route transition or in an isolated test mount)
// never crashes the page. The real provider always wins when present.
const NOOP_ADS: AdsContextType = {
  getAdByZone: () => null,
  loadZone: async () => null,
  isLoadingZone: () => false,
  trackView: () => {},
  trackClick: () => {},
};

export const useAds = () => {
  const context = useContext(AdsContext);
  return context ?? NOOP_ADS;
};
