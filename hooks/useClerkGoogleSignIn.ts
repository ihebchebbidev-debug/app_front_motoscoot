/**
 * useClerkGoogleSignIn — opens Clerk's Google OAuth popup and exchanges the
 * resulting Clerk session with our backend. Safe to call even when Clerk is
 * not configured (no VITE_CLERK_PUBLISHABLE_KEY) — in that case the hook
 * returns a no-op `start` and `isReady: false` instead of throwing.
 */
import { useCallback, useState } from 'react';
import * as Clerk from '@clerk/clerk-react';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from '../services/authApi';
import { getClerkPublishableKey, getClerkUnavailableMessage } from '../utils/clerkConfig';

const isClerkConfigured = (): boolean => {
  return Boolean(getClerkPublishableKey());
};

export const useClerkGoogleSignIn = () => {
  const clerkReady = isClerkConfigured();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only call Clerk hooks when a ClerkProvider is actually mounted.
  // Calling them outside the provider throws — we guard with the env check.
  let signIn: any = null;
  let isLoaded = false;
  let user: any = null;
  let userLoaded = false;
  let getToken: (() => Promise<string | null>) | null = null;

  if (clerkReady) {
    try {
      const s = (Clerk as any).useSignIn?.();
      signIn = s?.signIn ?? null;
      isLoaded = Boolean(s?.isLoaded);
      const u = (Clerk as any).useUser?.();
      user = u?.user ?? null;
      userLoaded = Boolean(u?.isLoaded);
      const a = (Clerk as any).useAuth?.();
      getToken = a?.getToken ?? null;
    } catch {
      // ClerkProvider not mounted — fall back to disabled state.
    }
  }

  const start = useCallback(async (provider: 'google' | 'apple' = 'google') => {
    if (!clerkReady) {
      setError(getClerkUnavailableMessage() || "La connexion sociale n'est pas configurée.");
      return null;
    }
    setLoading(true);
    setError(null);
    try {
      if (user && getToken) {
        const clerkToken = await getToken();
        const data = await authApi.exchangeClerk(
          {
            clerk_id: user.id,
            email: user.primaryEmailAddress?.emailAddress,
            full_name: user.fullName || user.firstName || '',
            avatar_url: user.imageUrl,
            provider,
          },
          clerkToken || undefined,
        );
        if (data?.token) queryClient.setQueryData(['auth', 'me'], data.user);
        setLoading(false);
        return data;
      }

      if (!isLoaded || !signIn) {
        throw new Error("La connexion sociale n'est pas encore prête. Réessayez dans un instant.");
      }

      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://www.moto-scoot.tn';
      // Use Clerk's high-level helper: it handles BOTH sign-in (existing users)
      // AND sign-up (first-time Google users) in a single round-trip, by
      // automatically transferring the OAuth attempt to a SignUp when the
      // email isn't yet known to Clerk. The previous low-level
      // `signIn.create()` + manual redirect URL extraction only worked for
      // existing users — new users were redirected back unauthenticated.
      await signIn.authenticateWithRedirect({
        strategy: provider === 'apple' ? 'oauth_apple' : 'oauth_google',
        redirectUrl: `${origin}/sso-callback`,
        redirectUrlComplete: `${origin}/sso-callback`,
      });
      return null;
    } catch (e: any) {
      setError(e?.message || 'Échec de la connexion sociale.');
      setLoading(false);
      return null;
    }
  }, [clerkReady, isLoaded, signIn, user, getToken, queryClient]);

  const exchangeWithBackend = useCallback(async () => {
    if (!user || !getToken) return null;
    const clerkToken = await getToken();
    const data = await authApi.exchangeClerk(
      {
        clerk_id: user.id,
        email: user.primaryEmailAddress?.emailAddress,
        full_name: user.fullName || user.firstName || '',
        avatar_url: user.imageUrl,
        provider: 'google',
      },
      clerkToken || undefined,
    );
    if (data?.token) queryClient.setQueryData(['auth', 'me'], data.user);
    return data;
  }, [user, getToken, queryClient]);

  return { start, exchangeWithBackend, loading, error, isReady: clerkReady && (isLoaded || userLoaded) };
};
