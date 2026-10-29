/**
 * useListingStats — owner-only listing performance metrics.
 *
 * Fetches GET /api/listings/:id/stats (auth required). The query is only enabled
 * when the caller is logged in AND owns the listing. The widget that uses this
 * hook silently hides for everyone else.
 */
import { useQuery } from '@tanstack/react-query';
import { listingsApi, type ListingStats } from '../services/listingsApi';
import { tokenStorage } from '../services/apiClient';

interface UseListingStatsOptions {
  enabled?: boolean;
}

export const useListingStats = (
  listingId: string | number | undefined,
  options: UseListingStatsOptions = {},
) => {
  const hasToken = !!tokenStorage.get();
  const enabled = !!listingId && hasToken && options.enabled !== false;

  return useQuery<ListingStats>({
    queryKey: ['listing', listingId, 'stats'],
    queryFn: ({ signal }) => listingsApi.getStats(listingId!, signal),
    enabled,
    staleTime: 1000 * 60, // 1 min — sellers refresh often
    retry: (failureCount, error: any) => {
      // 401/403/404 are deterministic — don't retry
      if ([401, 403, 404].includes(error?.status)) return false;
      return failureCount < 2;
    },
  });
};
