/**
 * ClerkAuthBridge — global handler for the Google/Apple OAuth round-trip.
 *
 * 1. On `/sso-callback`, mount Clerk's <AuthenticateWithRedirectCallback />
 *    so the Clerk session is finalised on this client.
 * 2. Anywhere in the app: as soon as Clerk reports a signed-in user AND we
 *    don't yet hold an internal backend JWT, exchange the Clerk session
 *    against `/auth/clerk` and flip the app to logged-in. The backend will
 *    create the user automatically if their email doesn't exist yet
 *    (passwordless Google signup).
 */
import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AuthenticateWithRedirectCallback, useUser, useAuth, useClerk } from '@clerk/clerk-react';
import { useQueryClient } from '@tanstack/react-query';
import { tokenStorage } from '../../services/apiClient';
import { authApi } from '../../services/authApi';
import { useAppNavigation } from '../../context/NavigationContext';
import SsoLoadingOverlay from './SsoLoadingOverlay';
import { getClerkPublishableKey } from '../../utils/clerkConfig';

interface Props {
  onLogin: () => void;
}

const ClerkAuthBridgeInner: React.FC<Props> = ({ onLogin }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isLoaded: userLoaded, isSignedIn, user } = useUser();
  const { getToken } = useAuth();
  const { signOut } = useClerk();
  const { isLoggedIn } = useAppNavigation();
  const queryClient = useQueryClient();
  const exchangingRef = useRef(false);
  const exchangedRef = useRef(false);
  const wasLoggedInRef = useRef(isLoggedIn);
  const [isExchanging, setIsExchanging] = useState(false);
  const isSsoCallback = location.pathname === '/sso-callback';
  const isFinalising = isExchanging || (isSsoCallback && userLoaded && isSignedIn);

  // Safety net: if the "Finalisation de votre connexion…" state lingers for
  // more than 3s (slow backend exchange, network hiccup), force a full page
  // reload so the user lands on a fresh app shell with the new session
  // cookie/token already applied.
  useEffect(() => {
    if (!isFinalising) return;
    const t = window.setTimeout(() => {
      window.location.replace('/');
    }, 3000);
    return () => window.clearTimeout(t);
  }, [isFinalising]);

  // Only sign out of Clerk on a real logout transition (true -> false).
  // Do NOT sign out on initial mount when isLoggedIn is false but Clerk
  // just finished an OAuth redirect — the exchange effect below needs the
  // Clerk session alive to swap it for our backend JWT.
  useEffect(() => {
    const wasLoggedIn = wasLoggedInRef.current;
    wasLoggedInRef.current = isLoggedIn;
    if (wasLoggedIn && !isLoggedIn) {
      exchangedRef.current = false;
      if (userLoaded && isSignedIn) {
        signOut().catch(() => { /* ignore */ });
      }
    }
  }, [isLoggedIn, userLoaded, isSignedIn, signOut]);

  useEffect(() => {
    if (!userLoaded) return;
    if (!isSignedIn || !user) return;
    // On the callback route, always mint a fresh backend token. A stale local
    // token can make the app think it is connected for a split second, then
    // /auth/me clears it before this exchange runs.
    if (tokenStorage.get() && !isSsoCallback) return;
    if (exchangedRef.current || exchangingRef.current) return;

    exchangingRef.current = true;
    setIsExchanging(true);
    let cancelled = false;
    (async () => {
      try {
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
        if (data?.token) {
          queryClient.setQueryData(['auth', 'me'], data.user);
          exchangedRef.current = true;
          onLogin();
          if (isSsoCallback) navigate('/', { replace: true });
        } else {
          // eslint-disable-next-line no-console
          console.warn('[ClerkAuthBridge] /auth/clerk returned no token', data);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[ClerkAuthBridge] exchange failed:', err);
      } finally {
        exchangingRef.current = false;
        if (!cancelled) setIsExchanging(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userLoaded, isSignedIn, user, getToken, onLogin, queryClient, isSsoCallback, navigate]);

  // Full-screen loading UI on the OAuth callback route. We mount Clerk's
  // <AuthenticateWithRedirectCallback /> only while Clerk hasn't finalised
  // the session yet — once `isSignedIn` flips true, the exchange effect
  // above runs immediately and navigates to "/", skipping the extra
  // `?exchange=1` redirect hop that used to add ~1s to the flow.
  if (isSsoCallback) {
    const needsClerkCallback = !userLoaded || !isSignedIn;
    return (
      <>
        <SsoLoadingOverlay
          label={needsClerkCallback ? 'Connexion Google en cours…' : 'Finalisation de votre connexion…'}
          hint={needsClerkCallback ? 'Vous serez redirigé dans un instant.' : 'Préparation de votre compte moto-scoot.tn.'}
        />
        {needsClerkCallback && (
          <AuthenticateWithRedirectCallback
            signInForceRedirectUrl="/sso-callback"
            signUpForceRedirectUrl="/sso-callback"
            signInFallbackRedirectUrl="/sso-callback"
            signUpFallbackRedirectUrl="/sso-callback"
          />
        )}
      </>
    );
  }

  // Also show the overlay during the post-redirect backend JWT exchange,
  // so the user sees feedback the moment they land back on the app.
  if (isExchanging) {
    return (
      <SsoLoadingOverlay
        label="Finalisation de votre connexion…"
        hint="Préparation de votre compte moto-scoot.tn."
      />
    );
  }
  return null;
};

const ClerkAuthBridge: React.FC<Props> = (props) => {
  if (!getClerkPublishableKey()) return null;
  return <ClerkAuthBridgeInner {...props} />;
};

export default ClerkAuthBridge;
