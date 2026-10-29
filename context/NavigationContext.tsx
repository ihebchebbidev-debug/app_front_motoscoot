import React, { createContext, useContext, useCallback, useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation, useNavigationType } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ViewStateName, NavigationParams, SearchFilters } from '../types';
import { getUrlFromState, getStateFromUrl } from '../utils/urlUtils';
import { ROUTES } from '../config/routes';
import { tokenStorage } from '../services/apiClient';
import { authApi } from '../services/authApi';
import { readSearchBackContext } from '../utils/searchBackContext';

export interface NavigationContextType {
  currentView: ViewStateName;
  params: NavigationParams;
  isLoggedIn: boolean;
  navigateTo: (view: ViewStateName, params?: NavigationParams) => void;
  goBack: () => void;
  triggerLogin: () => void;
  logout: () => Promise<void>;
  setIsLoggedIn: (val: boolean) => void;
  isLoginModalOpen: boolean;
  closeLoginModal: () => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const navigationType = useNavigationType();
  const queryClient = useQueryClient();

  // Saved scroll positions per location key — restored on POP (back/forward).
  const scrollPositionsRef = useRef<Map<string, number>>(new Map());
  const lastLocationKeyRef = useRef<string>(location.key);

  const viewState = useMemo(() => {
    try {
      const state = getStateFromUrl(location.pathname, location.search);
      return (state as NavigationParams & { view: ViewStateName }) || { view: 'home' as ViewStateName };
    } catch (e) {
      return { view: 'home' as ViewStateName };
    }
  }, [location.pathname, location.search]);

  const prevViewRef = useRef<ViewStateName>(viewState.view);

  // Source of truth for auth: presence of a backend-issued JWT in localStorage.
  const [isLoggedIn, setIsLoggedInState] = useState<boolean>(() => !!tokenStorage.get());

  // Keep state in sync with token changes from other tabs and same-tab auth
  // writes. The native `storage` event only fires in other tabs, so the API
  // client also dispatches `motoscoot:auth-token-changed` locally.
  useEffect(() => {
    const sync = () => setIsLoggedInState(!!tokenStorage.get());
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'auth_token') sync();
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('motoscoot:auth-token-changed', sync);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('motoscoot:auth-token-changed', sync);
    };
  }, []);

  const setIsLoggedIn = useCallback((val: boolean) => {
    setIsLoggedInState(val);
    if (!val) tokenStorage.clear();
  }, []);

  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  // Save the current scroll position before navigating away. We track scroll
  // continuously (throttled via rAF) so the most recent value is captured for
  // the *outgoing* location key right before the URL changes.
  useEffect(() => {
    let rafId: number | null = null;
    const onScroll = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        scrollPositionsRef.current.set(lastLocationKeyRef.current, window.scrollY);
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);

  // Scroll handling on URL change:
  // - PUSH/REPLACE (new navigation): snap to top synchronously, no animation.
  // - POP (browser back/forward): restore the previously-saved scroll position
  //   for that history entry, falling back to top if none is recorded.
  // Synchronous (useLayoutEffect) so the new page renders already at the
  // correct scroll position — no visible jump.
  React.useLayoutEffect(() => {
    prevViewRef.current = viewState.view;
    const prevHtmlBehavior = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = 'auto';

    if (navigationType === 'POP') {
      const saved = scrollPositionsRef.current.get(location.key);
      const target = typeof saved === 'number' ? saved : 0;
      window.scrollTo(0, target);
      if (document.documentElement) document.documentElement.scrollTop = target;
      if (document.body) document.body.scrollTop = target;
    } else {
      window.scrollTo(0, 0);
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
    }

    lastLocationKeyRef.current = location.key;

    const t = setTimeout(() => {
      document.documentElement.style.scrollBehavior = prevHtmlBehavior;
    }, 0);
    return () => clearTimeout(t);
  }, [location.key, location.pathname, location.search, viewState.view, navigationType]);

  const navigateTo = useCallback((view: ViewStateName, params: NavigationParams = {}) => {
    const nextView = ROUTES[view] ? view : 'home';
    const urlPath = getUrlFromState(nextView, params);
    navigate(urlPath);
  }, [navigate]);

  const goBack = useCallback(() => {
    // When leaving a detail view, prefer the persisted "back context" so we
    // restore the EXACT URL the user came from — including filters and
    // pagination (e.g., `?brand=Yamaha&page=100`). This works even after a
    // hard refresh on the detail page, where `navigate(-1)` would otherwise
    // leave the SPA entirely or reset us to page 1.
    // The persisted "back context" is only set by the search/listings page,
    // so only restore it when leaving a listing detail. For articles, tips,
    // and garages we want to fall back to their own index pages, never to
    // the listings search results.
    if (viewState.view === 'listing-details') {
      const ctx = readSearchBackContext();
      if (ctx?.url) {
        navigate(ctx.url);
        return;
      }
    }

    // Otherwise prefer the browser's actual history so we restore the
    // previous URL exactly. Only fall back to the static map when there's no
    // prior history entry to pop (e.g. opened in a fresh tab via deep link).
    const hasPriorHistory =
      typeof window !== 'undefined' &&
      window.history.length > 1 &&
      (document.referrer ? document.referrer.startsWith(window.location.origin) : true);

    if (hasPriorHistory) {
      navigate(-1);
      return;
    }

    const backMap: Partial<Record<ViewStateName, ViewStateName>> = {
      'listing-details': 'search',
      'article-details': 'news',
      'tip-details': 'tips',
      'garage-details': 'garages',
    };
    navigateTo(backMap[viewState.view] || 'home');
  }, [viewState.view, navigateTo, navigate]);

  const triggerLogin = useCallback(() => {
    setIsLoginModalOpen(true);
  }, []);

  const closeLoginModal = useCallback(() => setIsLoginModalOpen(false), []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // already cleared locally inside authApi.logout
    }
    queryClient.removeQueries({ queryKey: ['auth', 'me'] });
    queryClient.clear();
    setIsLoggedInState(false);
    navigateTo('home');
  }, [navigateTo, queryClient]);

  const value: NavigationContextType = {
    currentView: viewState.view,
    params: viewState,
    isLoggedIn,
    navigateTo,
    goBack,
    triggerLogin,
    logout,
    setIsLoggedIn,
    isLoginModalOpen,
    closeLoginModal,
  };

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
};

export const useAppNavigation = () => {
  const context = useContext(NavigationContext);
  if (context === undefined) {
    throw new Error('useAppNavigation must be used within a NavigationProvider');
  }
  return context;
};

export const useOptionalAppNavigation = () => useContext(NavigationContext);
