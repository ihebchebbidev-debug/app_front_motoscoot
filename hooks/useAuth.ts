/**
 * useAuth — login / register / logout helpers backed by the real API.
 *
 * Use alongside `useUser()` (which exposes the current profile from React Query).
 * After successful login/register, this hook seeds the React Query cache and
 * calls the optional `onSuccess` callback so the app can flip to logged-in state.
 */
import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authApi, type UserProfile, type LoginPayload, type RegisterPayload } from '../services/authApi';
import { tokenStorage } from '../services/apiClient';

export interface UseAuthOptions {
  onSuccess?: (user: UserProfile) => void;
  onLogout?: () => void;
}

export const useAuth = (opts: UseAuthOptions = {}) => {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(async (payload: LoginPayload): Promise<UserProfile> => {
    setLoading(true);
    setError(null);
    try {
      const { user } = await authApi.login(payload);
      queryClient.setQueryData(['auth', 'me'], user);
      opts.onSuccess?.(user);
      return user;
    } catch (e: any) {
      const msg = e?.message || 'Identifiants invalides.';
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [queryClient, opts]);

  const register = useCallback(async (payload: RegisterPayload): Promise<UserProfile> => {
    setLoading(true);
    setError(null);
    try {
      const { user } = await authApi.register(payload);
      queryClient.setQueryData(['auth', 'me'], user);
      opts.onSuccess?.(user);
      return user;
    } catch (e: any) {
      const msg = e?.message || 'Inscription impossible. Réessayez.';
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [queryClient, opts]);

  const logout = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      await authApi.logout();
    } finally {
      tokenStorage.clear();
      queryClient.removeQueries({ queryKey: ['auth', 'me'] });
      queryClient.clear();
      opts.onLogout?.();
      setLoading(false);
    }
  }, [queryClient, opts]);

  const exchangeClerk = useCallback(async (
    clerkUser: { id: string; email?: string; full_name?: string; avatar_url?: string },
    clerkToken?: string,
  ): Promise<UserProfile> => {
    setLoading(true);
    setError(null);
    try {
      const { user } = await authApi.exchangeClerk(
        {
          clerk_id: clerkUser.id,
          email: clerkUser.email,
          full_name: clerkUser.full_name,
          avatar_url: clerkUser.avatar_url,
          provider: 'google',
        },
        clerkToken,
      );
      queryClient.setQueryData(['auth', 'me'], user);
      opts.onSuccess?.(user);
      return user;
    } catch (e: any) {
      const msg = e?.message || 'Connexion Google impossible.';
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [queryClient, opts]);

  return {
    login,
    register,
    logout,
    exchangeClerk,
    loading,
    error,
    setError,
  };
};
