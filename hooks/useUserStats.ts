import { useQuery } from '@tanstack/react-query';
import { userStatsApi, UserStats } from '../services/miscApi';
import { tokenStorage } from '../services/apiClient';

/** GET /api/users/me/stats — counts for the dashboard (auth required). */
export const useUserStats = () => {
  const enabled = !!tokenStorage.get();
  return useQuery<UserStats>({
    queryKey: ['user', 'me', 'stats'],
    queryFn: ({ signal }) => userStatsApi.me(signal),
    enabled,
    staleTime: 1000 * 60 * 2,
    retry: (failureCount, error: any) => {
      if (error?.status === 401 || error?.status === 403) return false;
      return failureCount < 2;
    },
  });
};
