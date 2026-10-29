import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { listingsApi } from '../services/listingsApi';
import { tokenStorage } from '../services/apiClient';

type FavoriteType = 'listing' | 'garage';
type FavoriteId = string | number;

interface FavoritesData {
  listings: FavoriteId[];
  garages: FavoriteId[];
}

interface FavoritesContextType {
  favorites: FavoritesData;
  toggleFavorite: (type: FavoriteType, id: FavoriteId) => void;
  isFavorite: (type: FavoriteType, id: FavoriteId) => boolean;
  favoritesCount: number;
  /** Listings hydrated from backend (only when logged in) — mapped Listing objects. */
  favoriteListings: Awaited<ReturnType<typeof listingsApi.getFavorites>> | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
  /** Set of favorite IDs currently being toggled (in-flight requests) */
  togglingFavorites: Set<string>;
  /** Check if a specific favorite is currently being toggled */
  isToggling: (type: FavoriteType, id: FavoriteId) => boolean;
}

const CACHE_KEY = 'motoscoot_favorites_v1.1';
const OLD_CACHE_KEY = 'motoscoot_favorites';
const MIGRATED_KEY = 'motoscoot_favorites_migrated_v1';

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

function readCache(): FavoritesData {
  try {
    const oldSaved = localStorage.getItem(OLD_CACHE_KEY);
    if (oldSaved) localStorage.removeItem(OLD_CACHE_KEY);
    const saved = localStorage.getItem(CACHE_KEY);
    const parsed = saved ? JSON.parse(saved) : { listings: [], garages: [] };
    return {
      listings: Array.isArray(parsed.listings) ? parsed.listings : [],
      garages: Array.isArray(parsed.garages) ? parsed.garages : [],
    };
  } catch {
    return { listings: [], garages: [] };
  }
}

export const FavoritesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [favorites, setFavorites] = useState<FavoritesData>(readCache);
  const [favoriteListings, setFavoriteListings] = useState<any[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  // Track which individual favorites are currently being toggled (in-flight)
  const [togglingFavorites, setTogglingFavorites] = useState<Set<string>>(new Set());
  // Listing IDs currently being toggled against the backend. While a toggle
  // is in flight, refresh() must NOT overwrite the local optimistic state
  // for those IDs — otherwise a quick second click on a different favorite
  // would get reverted by the server snapshot from the first click.
  const pendingTogglesRef = useRef<Set<string>>(new Set());

  // Persist to localStorage on every change
  useEffect(() => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(favorites));
    } catch {
      // localStorage may be full or disabled (private mode); silently ignore.
    }
  }, [favorites]);

  // One-shot migration: if the user has anonymous favorites in localStorage
  // and just logged in, push them to the backend BEFORE we hydrate from the
  // server. Without this step, the very next refresh() would overwrite the
  // local list with the (empty) server set and the user's hearts vanish —
  // exactly the "favorites not saving" complaint reported by users who
  // hearted items as guests then signed up.
  const migrateLocalFavorites = useCallback(async (): Promise<void> => {
    if (!tokenStorage.get()) return;
    if (localStorage.getItem(MIGRATED_KEY) === '1') return;
    const local = readCache().listings || [];
    if (local.length === 0) {
      localStorage.setItem(MIGRATED_KEY, '1');
      return;
    }
    try {
      // Fetch server set first so we only POST what's actually missing —
      // toggle is a flip, so POSTing an already-favorited item would
      // un-favorite it. We must intersect carefully.
      const serverList = await listingsApi.getFavorites();
      const serverIds = new Set(serverList.map((l: any) => String(l.id)));
      const toAdd = local.filter((id) => !serverIds.has(String(id)));
      // Sequential to avoid hammering the API and to keep the favorites_count
      // counter consistent (UPDATEs on the same listing row would lock).
      for (const id of toAdd) {
        try {
          await listingsApi.toggleFavorite(id);
        } catch {
          // best-effort migration; skip failures
        }
      }
      localStorage.setItem(MIGRATED_KEY, '1');
    } catch {
      // If migration fails we DON'T set the flag — try again next session.
    }
  }, []);

  // Sync with backend whenever a JWT exists (login state)
  const refresh = useCallback(async () => {
    if (!tokenStorage.get()) {
      setFavoriteListings(null);
      return;
    }
    setIsLoading(true);
    try {
      // Always migrate before hydrating, so server snapshot is a superset.
      await migrateLocalFavorites();
      const list = await listingsApi.getFavorites();
      setFavoriteListings(list);
      // Hydrate ID set from server (server is source of truth when logged in)
      // EXCEPT for any IDs whose toggle is still in flight — preserving the
      // local optimistic value avoids a flicker / revert when a parallel
      // refresh races with a different in-progress toggle.
      setFavorites((prev) => {
        const pending = pendingTogglesRef.current;
        const serverIds = list.map((l: any) => String(l.id));
        const prevIds = (prev.listings || []).map(String);
        // Start from the server set, then re-apply pending optimistic state.
        const next = new Set(serverIds);
        pending.forEach((pid) => {
          // Whatever the optimistic value currently is, keep it.
          if (prevIds.includes(pid)) next.add(pid);
          else next.delete(pid);
        });
        return { ...prev, listings: Array.from(next) };
      });
    } catch (e) {
      // Silent: keep localStorage view
    } finally {
      setIsLoading(false);
    }
  }, [migrateLocalFavorites]);

  useEffect(() => {
    refresh();
    // Re-check on storage events (login from another tab, logout)
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'auth_token') {
        // On logout (token removed) reset the migration flag so a *future*
        // login session migrates again — and clear the server-hydrated list.
        if (!e.newValue) {
          try { localStorage.removeItem(MIGRATED_KEY); } catch {}
          setFavoriteListings(null);
        }
        refresh();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [refresh]);

  const toggleFavorite = useCallback((type: FavoriteType, id: FavoriteId) => {
    // Capture the pre-click state so we can revert exactly to it on failure
    // (instead of blindly re-flipping current state, which can corrupt if a
    // racing refresh already corrected the value in the meantime).
    const key = type === 'listing' ? 'listings' : 'garages';
    let wasFavoritedBefore = false;
    setFavorites((prev) => {
      const list = prev[key] || [];
      wasFavoritedBefore = list.some((x) => String(x) === String(id));
      return {
        ...prev,
        [key]: wasFavoritedBefore
          ? list.filter((itemId) => String(itemId) !== String(id))
          : [...list, id],
      };
    });

    // Sync with backend if logged in (only listings supported server-side currently)
    if (type === 'listing' && tokenStorage.get()) {
      const pid = String(id);
      pendingTogglesRef.current.add(pid);
      setTogglingFavorites((prev) => new Set(prev).add(pid));
      listingsApi
        .toggleFavorite(id)
        .then((res) => {
          pendingTogglesRef.current.delete(pid);
          setTogglingFavorites((prev) => {
            const next = new Set(prev);
            next.delete(pid);
            return next;
          });
          // Use the backend's authoritative `favorited` value — this is the
          // ONLY way to stay correct when the optimistic flip drifted from
          // server state (e.g. local cache was stale from a guest session,
          // or another tab toggled the same item). Without this, repeated
          // clicks could end up "stuck" because the server is in the
          // opposite state of what we think.
          if (typeof res?.favorited === 'boolean') {
            setFavorites((prev) => {
              const list = prev.listings || [];
              const exists = list.some((x) => String(x) === String(id));
              if (res.favorited && !exists) return { ...prev, listings: [...list, id] };
              if (!res.favorited && exists) {
                return { ...prev, listings: list.filter((x) => String(x) !== String(id)) };
              }
              return prev;
            });
          }
          // Refresh hydrated listings (for the Favorites page) without
          // racing the ID set — the response above already corrected it.
          listingsApi.getFavorites().then(setFavoriteListings).catch(() => {});
        })
        .catch(() => {
          pendingTogglesRef.current.delete(pid);
          setTogglingFavorites((prev) => {
            const next = new Set(prev);
            next.delete(pid);
            return next;
          });
          // Revert exactly to the pre-click state (not a blind flip).
          setFavorites((prev) => {
            const list = prev.listings || [];
            const exists = list.some((x) => String(x) === String(id));
            if (wasFavoritedBefore && !exists) return { ...prev, listings: [...list, id] };
            if (!wasFavoritedBefore && exists) {
              return { ...prev, listings: list.filter((x) => String(x) !== String(id)) };
            }
            return prev;
          });
        });
    }
  }, []);

  const isFavorite = useCallback((type: FavoriteType, id: FavoriteId) => {
    const list = type === 'listing' ? favorites.listings : favorites.garages;
    return (list || []).some((x) => String(x) === String(id));
  }, [favorites]);

  const isToggling = useCallback((type: FavoriteType, id: FavoriteId) => {
    if (type !== 'listing') return false;
    return togglingFavorites.has(String(id));
  }, [togglingFavorites]);

  const favoritesCount = useMemo(
    () => (favorites.listings?.length || 0) + (favorites.garages?.length || 0),
    [favorites],
  );

  const contextValue = useMemo(
    () => ({
      favorites,
      toggleFavorite,
      isFavorite,
      favoritesCount,
      favoriteListings,
      isLoading,
      refresh,
      togglingFavorites,
      isToggling,
    }),
    [favorites, toggleFavorite, isFavorite, favoritesCount, favoriteListings, isLoading, refresh, togglingFavorites, isToggling],
  );

  return <FavoritesContext.Provider value={contextValue}>{children}</FavoritesContext.Provider>;
};

export const useFavorites = () => {
  const context = useContext(FavoritesContext);
  if (context === undefined) {
    throw new Error('useFavorites must be used within a FavoritesProvider');
  }
  return context;
};
