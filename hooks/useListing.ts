import { useQuery } from '@tanstack/react-query';
import { listingsApi } from '../services/listingsApi';
import { Listing } from '../types';

/**
 * Fetch a single listing by id.
 * IMPORTANT: ids are UUID strings from the backend. Do NOT coerce them to
 * Number — that produces NaN and the request would silently bail with null.
 */
export const useListing = (id?: number | string) => {
  const safeId = id != null && id !== '' ? id : undefined;
  return useQuery<Listing | null>({
    queryKey: ['listing', String(safeId ?? '')],
    queryFn: ({ signal }) => {
      if (safeId == null) return Promise.resolve(null);
      return listingsApi.getById(safeId, signal);
    },
    enabled: !!safeId,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    retry: (failureCount, error: any) => {
      if (error?.status === 404) return false;
      if (error?.status >= 400 && error?.status < 500) return false;
      return failureCount < 2;
    },
  });
};
