import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '../services/analyticsApi';

const baseOpts = { staleTime: 1000 * 60, retry: 1 } as const;

export const useAudience = (period: number = 30) =>
  useQuery({
    queryKey: ['admin', 'analytics', 'audience', period],
    queryFn: ({ signal }) => analyticsApi.getAudience(period, signal),
    ...baseOpts,
  });

export const useFunnel = (period: number = 30) =>
  useQuery({
    queryKey: ['admin', 'analytics', 'funnel', period],
    queryFn: ({ signal }) => analyticsApi.getFunnel(period, signal),
    ...baseOpts,
  });

export const useFunnelBySource = (period: number = 30) =>
  useQuery({
    queryKey: ['admin', 'analytics', 'funnel', 'by-source', period],
    queryFn: ({ signal }) => analyticsApi.getFunnelBySource(period, signal),
    ...baseOpts,
  });

export const useVisitors = (params: {
  country_code?: string;
  search?: string;
  limit?: number;
  offset?: number;
}) =>
  useQuery({
    queryKey: ['admin', 'analytics', 'visitors', params],
    queryFn: ({ signal }) => analyticsApi.listVisitors(params, signal),
    ...baseOpts,
  });

export const useVisitorDetail = (fingerprint: string | null) =>
  useQuery({
    queryKey: ['admin', 'analytics', 'visitor', fingerprint],
    queryFn: ({ signal }) =>
      analyticsApi.getVisitor(fingerprint as string, signal),
    enabled: !!fingerprint,
    ...baseOpts,
  });
