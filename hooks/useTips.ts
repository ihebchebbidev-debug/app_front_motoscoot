import { useQuery } from '@tanstack/react-query';
import { tipsApi } from '../services/tipsApi';
import { Tip } from '../types';

const retryStrategy = (failureCount: number, error: any) => {
  if (error?.status >= 400 && error?.status < 500) return false;
  return failureCount < 3;
};

export const useTips = (params?: { category?: string; search?: string }) => {
  return useQuery<Tip[]>({
    queryKey: ['tips', params || {}],
    queryFn: ({ signal }) => tipsApi.list(params, signal),
    staleTime: 1000 * 60 * 10,
    retry: retryStrategy,
    retryDelay: (i) => Math.min(1000 * 2 ** i, 15000),
  });
};

export const useTip = (id?: number | string) => {
  return useQuery<Tip | null>({
    queryKey: ['tip', id],
    queryFn: ({ signal }) => {
      if (id == null) return Promise.resolve(null);
      return tipsApi.getById(id, signal);
    },
    enabled: id != null,
    staleTime: 1000 * 60 * 5,
    retry: retryStrategy,
  });
};

export const useRelatedTips = (id?: number | string) => {
  return useQuery<Tip[]>({
    queryKey: ['tips', 'related', id],
    queryFn: ({ signal }) => {
      if (id == null) return Promise.resolve([]);
      return tipsApi.getRelated(id, signal);
    },
    enabled: id != null,
    staleTime: 1000 * 60 * 10,
    retry: retryStrategy,
  });
};
