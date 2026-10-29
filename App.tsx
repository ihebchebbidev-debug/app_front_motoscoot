
import React, { Suspense } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PageLayout } from './components/ui/Layout';
import { needsClerkNow } from './utils/clerkLoad';
// Sign-in (Clerk) is lazy: its runtime only downloads when login is needed (PageSpeed).
const ClerkIsland = React.lazy(() => import('./components/auth/ClerkIsland'));
import { FavoritesProvider } from './context/FavoritesContext';
import { AdsProvider } from './context/AdsContext';
import { UserProvider, useUser } from './context/UserContext';
import { ToastProvider } from './context/ToastContext';
import { NavigationProvider, useAppNavigation } from './context/NavigationContext';
import { ThemeProvider } from './context/ThemeContext';
import { useAppVersion } from './hooks/useAppVersion';
import { useVisitorTracking } from './hooks/useVisitorTracking';
import { useAppBackground } from './hooks/useAppBackground';
import { ToastContainer } from './components/ui/ToastContainer';
// Overlays never paint on first load — split out of the first-load bundle.
const CookieConsent = React.lazy(() => import('./components/ui/CookieConsent').then(m => ({ default: m.CookieConsent })));
const PopupAd = React.lazy(() => import('./components/PopupAd').then(m => ({ default: m.PopupAd })));
const FullscreenAd = React.lazy(() => import('./components/FullscreenAd').then(m => ({ default: m.FullscreenAd })));

import { ROUTES } from './config/routes';
import SEO from './components/common/SEO';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { SearchFilters, BasePageProps, NavigationParams } from './types';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      retry: 2,
      refetchOnWindowFocus: false
    },
  },
});

// Skeleton-based fallback (no spinner). Uses semantic tokens so it adapts to theme.
import { Skeleton } from './components/ui/Skeleton';

const LoadingSpinner = () => (
  <div className="flex flex-col gap-4 p-6 max-w-3xl mx-auto min-h-[60vh] animate-fade-in">
    <Skeleton className="h-8 w-1/2" />
    <Skeleton className="h-4 w-3/4" />
    <Skeleton className="h-4 w-2/3" />
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
      <Skeleton className="h-40 rounded-xl" />
      <Skeleton className="h-40 rounded-xl" />
    </div>
    <Skeleton className="h-4 w-1/3 mt-2" />
  </div>
);

const AppContent: React.FC = () => {
  const { 
    currentView, 
    params, 
    isLoggedIn, 
    setIsLoggedIn, 
    isLoginModalOpen, 
    closeLoginModal,
    navigateTo,
    triggerLogin,
    logout,
    goBack
  } = useAppNavigation();

  // Seamless deploy updates: detects new builds and reloads only on safe
  // moments (route change / tab refocus) so the user is never interrupted.
  useAppVersion();

  // Visitor tracking: session, page views, IP/country (via backend), duration.
  useVisitorTracking();

  // Apply admin-controlled global app background (the "gray" surface
  // behind cards). Updates live without redeploy via the Apparence tab.
  useAppBackground();

  const route = ROUTES[currentView] || ROUTES['home'];

  // Auth gate: if a route requires login (or admin) and the user is anonymous,
  // bounce to home and pop the login modal. Avoids dead-ends like /deposit -> 401
  // on submit after the user filled the entire 5-step form. We also gate
  // `isAdminOnly` routes here so anonymous users never trigger admin-only API
  // calls (which previously caused a flood of 401s and a flashed admin shell).
  React.useEffect(() => {
    if ((route.isProtected || route.isAdminOnly) && !isLoggedIn) {
      triggerLogin();
      navigateTo('home');
    }
  }, [route.isProtected, route.isAdminOnly, isLoggedIn, triggerLogin, navigateTo]);

  // Admin shortcut lives in <AdminRedirect /> below — it must run INSIDE the
  // UserProvider tree to call useUser(), so we can't put it here in AppContent
  // (which renders UserProvider as a child).

  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
    // Source of truth is `tokenStorage` (auth_token in localStorage). The legacy
    // `motoscoot_auth_session` flag was a duplicate that never got cleared on
    // logout, causing isLoggedIn to desync. Removed.
    closeLoginModal();
  };

  // When the user logs out (or auth is lost), tear down the live socket so the
  // server stops receiving authenticated events on a stale token.
  React.useEffect(() => {
    if (!isLoggedIn) {
      try { localStorage.removeItem('motoscoot_auth_session'); } catch {}
      try { sessionStorage.removeItem('admin_auto_redirected'); } catch {}
      // Lazy: keeps socket.io out of the first-load bundle (PageSpeed).
      import('./services/conversationsApi').then(m => m.disconnectSocket()).catch(() => {});
    }
  }, [isLoggedIn]);

  // Préparation des props pour les composants de page (Restauration des actions)
  const pageProps: BasePageProps = {
    onNavigate: navigateTo,
    onSearch: (filters: SearchFilters) => navigateTo('search', filters as NavigationParams),
    onGoHome: () => navigateTo('home'),
    onBack: goBack,
    onTriggerLogin: triggerLogin,
    onLogout: logout,
    isLoggedIn,
    initialFilters: currentView === 'search' ? (params as SearchFilters) : null,
    listingId: params.id,
    articleId: params.id,
    tipId: params.id,
    garageId: params.id,
    specId: params.id,
    ids: params.ids,
    brand: params.brand,
    availableInTunisia: params.available_in_tunisia === true || params.availableInTunisia === true,
    initialTab: params.tab,
  };

  // Once needed, Clerk stays mounted for the rest of the visit.
  const clerkNeededNow = needsClerkNow({
    loginOpen: isLoginModalOpen,
    pathname: typeof window !== 'undefined' ? window.location.pathname : '',
    cookie: typeof document !== 'undefined' ? document.cookie : '',
  });
  const [clerkSticky, setClerkSticky] = React.useState(false);
  React.useEffect(() => { if (clerkNeededNow) setClerkSticky(true); }, [clerkNeededNow]);
  const clerkNeeded = clerkNeededNow || clerkSticky;

  return (
    <UserProvider isLoggedIn={isLoggedIn} onAuthLost={() => setIsLoggedIn(false)}>
      <AdminRedirect isLoggedIn={isLoggedIn} currentView={currentView} navigateTo={navigateTo} />
      <SEO title={currentView === 'home' ? 'Achetez et vendez votre moto' : undefined} />
      
      {clerkNeeded && (
        <Suspense fallback={null}>
          <ClerkIsland
            isOpen={isLoginModalOpen}
            onClose={closeLoginModal}
            onLogin={handleLoginSuccess}
          />
        </Suspense>
      )}

      <PageLayout 
        variant={route.layoutVariant} 
        hideFooter={route.hideFooter}
        hideHeader={route.hideHeader}
        onNavigate={navigateTo}
        onGoHome={pageProps.onGoHome}
        isLoggedIn={isLoggedIn}
        onTriggerLogin={triggerLogin}
        onLogout={logout}
      >
        <Suspense fallback={<LoadingSpinner />}>
          <route.component {...pageProps} />
        </Suspense>
      </PageLayout>
      
      <Suspense fallback={null}>
        <PopupAd />
        <FullscreenAd />
      </Suspense>
      <ToastContainer />
      <Suspense fallback={null}>
        <CookieConsent />
      </Suspense>
    </UserProvider>
  );
};

/**
 * Admin shortcut: when an admin lands on the public home, send them straight
 * to their console. Lives inside <UserProvider> so it can read user.role.
 * Guarded by sessionStorage so we only auto-redirect once per session,
 * letting the admin click the logo to come back to the public site.
 */
const AdminRedirect: React.FC<{
  isLoggedIn: boolean;
  currentView: string;
  navigateTo: (view: any, params?: any) => void;
}> = ({ isLoggedIn, currentView, navigateTo }) => {
  const { user } = useUser();
  const isAdminUser = user?.role === 'admin' || user?.role === 'moderator';
  React.useEffect(() => {
    if (!isLoggedIn || !isAdminUser) return;
    if (currentView !== 'home') return;
    try {
      if (sessionStorage.getItem('admin_auto_redirected') === '1') return;
      sessionStorage.setItem('admin_auto_redirected', '1');
    } catch {}
    navigateTo('admin');
  }, [isLoggedIn, isAdminUser, currentView, navigateTo]);
  return null;
};

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <NavigationProvider>
            <ToastProvider>
              <FavoritesProvider>
                <AdsProvider>
                  <ErrorBoundary>
                    <AppContent />
                  </ErrorBoundary>
                </AdsProvider>
              </FavoritesProvider>
            </ToastProvider>
          </NavigationProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  );
};

export default App;
