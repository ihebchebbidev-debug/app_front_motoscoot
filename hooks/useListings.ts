import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { listingsApi, ListingsListParams, ListingFacets, PaginationMeta } from '../services/listingsApi';
import { Listing } from '../types';

/**
 * Server-paginated listings query.
 * Returns the page of listings + pagination meta. Uses `keepPreviousData` so
 * the previous page stays visible during a fetch (avoids skeleton flicker
 * when the user just changes page or tweaks a filter).
 */
export const useListings = (params?: ListingsListParams) => {
  const effectiveParams: ListingsListParams = { page: 1, limit: 12, ...(params || {}) };
  return useQuery<{ listings: Listing[]; pagination: PaginationMeta }>({
    queryKey: ['listings', effectiveParams],
    queryFn: ({ signal }) => listingsApi.list(effectiveParams, signal),
    placeholderData: keepPreviousData,
    retry: (failureCount, error: any) => {
      if (error?.status >= 400 && error?.status < 500) return false;
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 15000),
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 30,
  });
};

/**
 * Aggregated facet counts for the current filter set. Excludes the dimensions
 * we enumerate (brand/type/governorate/condition/seller_type) so toggling one
 * doesn't zero-out the other counts. Use to drive sidebar facet badges and
 * the visible total in the header.
 */
export const useListingFacets = (params?: ListingsListParams) => {
  return useQuery<ListingFacets>({
    queryKey: ['listings', 'facets', params || {}],
    queryFn: ({ signal }) => listingsApi.facets(params, signal),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 2,
  });
};

/** Returns the total number of active listings (used by hero badge etc.). */
export const useListingsCount = () => {
  return useQuery<number>({
    queryKey: ['listings', 'count'],
    queryFn: async ({ signal }) => {
      const { pagination } = await listingsApi.list({ page: 1, limit: 1 }, signal);
      return pagination?.total ?? 0;
    },
    staleTime: 1000 * 60 * 10,
  });
};

/** Featured / popular listings for the home page. */
export const usePopularListings = () => {
  return useQuery<Listing[]>({
    queryKey: ['listings', 'popular'],
    queryFn: ({ signal }) => listingsApi.getPopular(signal),
    retry: (failureCount, error: any) => {
      if (error?.status >= 400 && error?.status < 500) return false;
      return failureCount < 3;
    },
    staleTime: 1000 * 60 * 10,
  });
};

/** Similar listings (right column on details page). */
export const useSimilarListings = (id?: number | string) => {
  return useQuery<Listing[]>({
    queryKey: ['listings', 'similar', id],
    queryFn: ({ signal }) => listingsApi.getSimilar(id as number, signal),
    enabled: !!id,
    staleTime: 1000 * 60 * 10,
  });
};
