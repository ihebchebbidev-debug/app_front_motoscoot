import { useQuery } from '@tanstack/react-query';
import { articlesApi } from '../services/articlesApi';
import { Article } from '../types';

const retryStrategy = (failureCount: number, error: any) => {
  if (error?.status >= 400 && error?.status < 500) return false;
  return failureCount < 3;
};

export const useArticles = (params?: { category?: string; search?: string }) => {
  return useQuery<Article[]>({
    queryKey: ['articles', params || {}],
    queryFn: ({ signal }) => articlesApi.list(params, signal),
    staleTime: 1000 * 60 * 10,
    retry: retryStrategy,
    retryDelay: (i) => Math.min(1000 * 2 ** i, 15000),
  });
};

export const useArticle = (id?: number | string) => {
  return useQuery<Article | null>({
    queryKey: ['article', String(id ?? '')],
    queryFn: ({ signal }) => {
      if (id == null || id === '') return Promise.resolve(null);
      // Pass id through as-is — backend resolves both UUIDs and slugs.
      return articlesApi.getById(id, signal);
    },
    enabled: id != null && id !== '',
    staleTime: 1000 * 60 * 5,
    retry: retryStrategy,
  });
};

export const useRelatedArticles = (id?: number | string) => {
  return useQuery<Article[]>({
    queryKey: ['articles', 'related', String(id ?? '')],
    queryFn: ({ signal }) => {
      if (id == null || id === '') return Promise.resolve([]);
      return articlesApi.getRelated(id, signal);
    },
    enabled: id != null && id !== '',
    staleTime: 1000 * 60 * 10,
    retry: retryStrategy,
  });
};

export const useFeaturedArticles = () => {
  return useQuery<Article[]>({
    queryKey: ['articles', 'featured'],
    queryFn: ({ signal }) => articlesApi.getFeatured(signal),
    staleTime: 1000 * 60 * 15,
    retry: retryStrategy,
  });
};
