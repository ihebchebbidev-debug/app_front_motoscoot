import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi, Notification } from '../services/miscApi';
import { useUser } from '../context/UserContext';

/**
 * Notifications hook - polls the backend for the current user's notifications.
 * Disabled when no user is logged in.
 */
export const useNotifications = () => {
  const { user } = useUser() as any;
  const isLoggedIn = !!user;

  return useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: async ({ signal }) => {
      try {
        return await notificationsApi.list(signal);
      } catch (err: any) {
        if (err?.status === 401) return [];
        throw err;
      }
    },
    enabled: isLoggedIn,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
};

export const useUnreadNotificationsCount = () => {
  const { user } = useUser() as any;
  const isLoggedIn = !!user;

  return useQuery<number>({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async ({ signal }) => {
      try {
        return await notificationsApi.getUnreadCount(signal);
      } catch (err: any) {
        if (err?.status === 401) return 0;
        throw err;
      }
    },
    enabled: isLoggedIn,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
};

export const useNotificationActions = () => {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['notifications'] });
  };

  const markRead = useMutation({
    mutationFn: (id: number | string) => notificationsApi.markRead(id),
    onSuccess: invalidate,
  });
  const markAllRead = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: number | string) => notificationsApi.remove(id),
    onSuccess: invalidate,
  });

  return { markRead, markAllRead, remove };
};
