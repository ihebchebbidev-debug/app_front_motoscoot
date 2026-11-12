import React, { createContext, useContext, useEffect, useMemo, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi, type UserProfile } from '../services/authApi';
import { tokenStorage } from '../services/apiClient';
import { analytics } from '../src/lib/posthog';

export type { UserProfile };

interface UserContextType {
  user: UserProfile | undefined;
  isLoading: boolean;
  isError: boolean;
  isAuthenticated: boolean;
  refetch: () => Promise<unknown>;
  updateProfile: (data: Partial<UserProfile>) => Promise<UserProfile>;
  changePassword: (payload: { oldPassword: string; newPassword: string }) => Promise<void>;
  isUpdating: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

interface UserProviderProps {
  children: React.ReactNode;
  isLoggedIn: boolean;
  /** Notified when the backend says the current token is invalid (401). */
  onAuthLost?: () => void;
}

export const UserProvider: React.FC<UserProviderProps> = ({ children, isLoggedIn, onAuthLost }) => {
  const queryClient = useQueryClient();
  const identifiedUserIdRef = useRef<string | null>(null);

  const hasToken = isLoggedIn && !!tokenStorage.get();

  const profileQuery = useQuery<UserProfile>({
    queryKey: ['auth', 'me'],
    queryFn: ({ signal }) => authApi.me(signal),
    enabled: hasToken,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    retry: (failureCount, error: any) => {
      if (error?.status === 401 || error?.status === 403) return false;
      return failureCount < 2;
    },
  });

  // If the backend rejects our token, surface it so the app can log out cleanly.
  useEffect(() => {
    const err: any = profileQuery.error;
    if (err && (err.status === 401 || err.status === 403)) {
      tokenStorage.clear();
      queryClient.removeQueries({ queryKey: ['auth', 'me'] });
      onAuthLost?.();
    }
  }, [profileQuery.error, queryClient, onAuthLost]);

  // This profile is populated after login and restored on page refresh. Identify
  // once per authenticated user (after cookie consent) by the backend's stable
  // user ID only: no email or name is sent to PostHog.
  useEffect(() => {
    const user = profileQuery.data;
    if (!user) {
      identifiedUserIdRef.current = null;
      return;
    }
    if (identifiedUserIdRef.current === user.id) return;

    if (identifiedUserIdRef.current) analytics.reset();

    analytics.identify(String(user.id), {
      member_type: user.memberType,
      ...(user.role ? { role: user.role } : {}),
    });
    identifiedUserIdRef.current = user.id;
  }, [profileQuery.data]);

  const updateMutation = useMutation({
    mutationFn: (updates: Partial<UserProfile>) => authApi.updateProfile(updates),
    onSuccess: (next) => {
      queryClient.setQueryData(['auth', 'me'], next);
    },
  });

  const passwordMutation = useMutation({
    mutationFn: (p: { oldPassword: string; newPassword: string }) => authApi.changePassword(p),
  });

  const updateProfile = useCallback(
    (data: Partial<UserProfile>) => updateMutation.mutateAsync(data),
    [updateMutation],
  );

  const changePassword = useCallback(
    (payload: { oldPassword: string; newPassword: string }) => passwordMutation.mutateAsync(payload),
    [passwordMutation],
  );

  // `profileQuery.refetch` is a stable function from react-query, but TS
  // sees it as a brand new ref each render, which would invalidate the memo
  // every render and churn every consumer. Wrap it in a useCallback whose
  // identity is tied to the query key only.
  const refetch = useCallback(() => profileQuery.refetch(), [profileQuery.refetch]);

  const value = useMemo<UserContextType>(
    () => ({
      user: profileQuery.data,
      isLoading: profileQuery.isLoading,
      isError: profileQuery.isError,
      isAuthenticated: hasToken && !!profileQuery.data,
      refetch,
      updateProfile,
      changePassword,
      isUpdating: updateMutation.isPending || passwordMutation.isPending,
    }),
    [
      profileQuery.data,
      profileQuery.isLoading,
      profileQuery.isError,
      hasToken,
      refetch,
      updateProfile,
      changePassword,
      updateMutation.isPending,
      passwordMutation.isPending,
    ],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};

export const useUser = (): UserContextType => {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used within a UserProvider');
  return ctx;
};
