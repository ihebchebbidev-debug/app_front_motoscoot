import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { techSpecsApi } from '../services/techSpecsApi';
import { TechSpec } from '../types';

const retryStrategy = (failureCount: number, error: any) => {
  if (error?.status >= 400 && error?.status < 500) return false;
  return failureCount < 3;
};

/** Popular tech specs across brands — used as a representative dataset. */
/** Every public fiche — the comparator must list all brands. */
export const useCatalogTechSpecs = () => {
  return useQuery<TechSpec[]>({
    queryKey: ['tech-specs', 'catalog'],
    queryFn: ({ signal }) => techSpecsApi.getAll(signal),
    staleTime: 1000 * 60 * 30,
    retry: retryStrategy,
  });
};

export const useAllTechSpecs = () => {
  return useQuery<TechSpec[]>({
    queryKey: ['tech-specs', 'all'],
    queryFn: ({ signal }) => techSpecsApi.getPopular(signal),
    staleTime: 1000 * 60 * 30,
    retry: retryStrategy,
  });
};

/** Latest uploaded tech specs (newest fiches techniques). */
export const useLatestTechSpecs = (limit = 3) => {
  return useQuery<TechSpec[]>({
    queryKey: ['tech-specs', 'latest', limit],
    queryFn: ({ signal }) => techSpecsApi.getLatest(limit, signal),
    staleTime: 1000 * 60 * 5,
    retry: retryStrategy,
  });
};

/** Cursor-paginated popular tech specs for infinite scroll feeds. */
export const usePopularTechSpecsInfinite = (params?: { limit?: number }) => {
  const query = useInfiniteQuery({
    queryKey: ['tech-specs', 'popular', 'infinite', params || {}],
    queryFn: ({ pageParam, signal }) =>
      techSpecsApi.getPopularPage(
        { limit: params?.limit, cursor: (pageParam as string | null) ?? null },
        signal,
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    staleTime: 1000 * 60 * 15,
    retry: retryStrategy,
  });

  const specs = useMemo<TechSpec[]>(
    () => query.data?.pages.flatMap((p) => p.items) ?? [],
    [query.data],
  );

  return { ...query, specs };
};

type TechSpecsVisibilityOptions = { availableInTunisia?: boolean };

export const useTechSpecsBrands = (options: TechSpecsVisibilityOptions = {}) => {
  const availableInTunisia = options.availableInTunisia === true;
  return useQuery<string[]>({
    queryKey: ['tech-specs', 'brands', { availableInTunisia }],
    queryFn: ({ signal }) => techSpecsApi.getBrands({ availableInTunisia, signal }),
    // Keep short (2 min) so admin removals propagate quickly to public
    // pages without forcing a hard refresh.
    staleTime: 1000 * 60 * 2,
    refetchOnWindowFocus: true,
    retry: retryStrategy,
  });
};

export const useTechSpecsByBrand = (brand?: string, options: TechSpecsVisibilityOptions = {}) => {
  const availableInTunisia = options.availableInTunisia === true;
  return useQuery<TechSpec[]>({
    queryKey: ['tech-specs', 'brand', brand, { availableInTunisia }],
    queryFn: ({ signal }) => {
      if (!brand) return Promise.resolve([]);
      return techSpecsApi.getModels(brand, { availableInTunisia, signal });
    },
    enabled: !!brand,
    staleTime: 1000 * 60 * 30,
    retry: retryStrategy,
  });
};

/**
 * Cross-field public search hook. Disabled when the term is shorter than
 * 2 chars to avoid one-letter floods. Stale time kept short — fresh results
 * matter more here than cache hit-rate.
 */
export const useTechSpecsSearch = (query?: string, options: TechSpecsVisibilityOptions = {}) => {
  const term = (query || '').trim();
  const availableInTunisia = options.availableInTunisia === true;
  return useQuery<TechSpec[]>({
    queryKey: ['tech-specs', 'search', term, { availableInTunisia }],
    queryFn: ({ signal }) => techSpecsApi.searchAll(term, 30, { availableInTunisia, signal }),
    enabled: term.length >= 2,
    staleTime: 1000 * 60 * 2,
    retry: retryStrategy,
  });
};

/**
 * Fetch a single tech spec by id. Accepts either a numeric (legacy) id or a
 * UUID string (current Postgres schema). Previously this hook coerced the id
 * via `Number(id)`, which turned UUIDs into NaN and silently disabled the
 * query — making `/fiche-technique/<slug>-<uuid>` always render the
 * "Modèle introuvable" empty state. We now pass the id through as-is and let
 * the backend route validate it.
 */
export const useTechSpec = (id?: number | string) => {
  const normalizedId =
    id == null || id === '' ? undefined : typeof id === 'number' ? id : String(id).trim();
  return useQuery<TechSpec | null>({
    queryKey: ['tech-spec', normalizedId],
    queryFn: ({ signal }) => {
      if (normalizedId === undefined) return Promise.resolve(null);
      return techSpecsApi.getById(normalizedId, signal);
    },
    enabled: normalizedId !== undefined,
    staleTime: 1000 * 60 * 10,
    retry: retryStrategy,
  });
};

export const useCompareTechSpecs = (ids?: number[]) => {
  return useQuery<TechSpec[]>({
    queryKey: ['tech-specs', 'compare', ids],
    queryFn: () => {
      if (!ids || !ids.length) return Promise.resolve([]);
      return techSpecsApi.compare(ids);
    },
    enabled: !!ids && ids.length > 0,
    staleTime: 1000 * 60 * 10,
    retry: retryStrategy,
  });
};
