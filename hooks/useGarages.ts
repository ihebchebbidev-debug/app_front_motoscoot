import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { garagesApi } from '../services/garagesApi';
import { Garage } from '../types';

const retryStrategy = (failureCount: number, error: any) => {
  if (error?.status >= 400 && error?.status < 500) return false;
  return failureCount < 3;
};

export const useGarages = (params?: { city?: string; specialty?: string; search?: string }) => {
  return useQuery<Garage[]>({
    queryKey: ['garages', params || {}],
    queryFn: ({ signal }) => garagesApi.list(params, signal),
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
    retry: retryStrategy,
    retryDelay: (i) => Math.min(1000 * 2 ** i, 15000),
  });
};

/**
 * Cursor-paginated infinite garages.
 *
 * Returns a flat `garages` array plus React Query metadata to drive a
 * sentinel-based loader. The list invalidates when filter params change.
 */
export const useGaragesInfinite = (
  params?: { city?: string; specialty?: string; search?: string; limit?: number },
) => {
  const query = useInfiniteQuery({
    queryKey: ['garages', 'infinite', params || {}],
    queryFn: ({ pageParam, signal }) =>
      garagesApi.listPage(
        { ...params, cursor: (pageParam as string | null) ?? null },
        signal,
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    retry: retryStrategy,
    retryDelay: (i) => Math.min(1000 * 2 ** i, 15000),
  });

  const garages = useMemo<Garage[]>(
    () => query.data?.pages.flatMap((p) => p.items) ?? [],
    [query.data],
  );

  return { ...query, garages };
};

export const useGarage = (id?: number) => {
  return useQuery<Garage | null>({
    queryKey: ['garage', id],
    queryFn: ({ signal }) => {
      if (!id) return Promise.resolve(null);
      return garagesApi.getById(id, signal);
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
    retry: retryStrategy,
  });
};

export const usePopularGarages = () => {
  return useQuery<Garage[]>({
    queryKey: ['garages', 'popular'],
    queryFn: ({ signal }) => garagesApi.getPopular(signal),
    staleTime: 1000 * 60 * 15,
    retry: retryStrategy,
  });
};

export const useGarageReviews = (id?: number) => {
  return useQuery<any[]>({
    queryKey: ['garage', id, 'reviews'],
    queryFn: ({ signal }) => {
      if (!id) return Promise.resolve([]);
      return garagesApi.getReviews(id, signal);
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
    retry: retryStrategy,
  });
};

/** POST /api/garages/:id/reviews — submit a review for a specific garage. */
export const useSubmitGarageReview = (garageId?: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { rating: number; content: string }) => {
      if (!garageId) return Promise.reject(new Error('garageId required'));
      return garagesApi.addReview(garageId, payload);
    },
    onSuccess: () => {
      if (garageId) {
        qc.invalidateQueries({ queryKey: ['garage', garageId, 'reviews'] });
        qc.invalidateQueries({ queryKey: ['garage', garageId] });
      }
    },
  });
};

