import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { tracker } from '../services/trackingService';
import { useAppNavigation } from '../context/NavigationContext';
import { useSeoSettings } from './useSeoSettings';
import { initGA4, trackPageView as gaTrackPageView, HARDCODED_GA4_MEASUREMENT_ID } from '../services/analytics';

/**
 * Boots the tracker once and reports a page view on every route change.
 * Also bootstraps Google Analytics 4 (GA4) using the hardcoded measurement
 * ID (see services/analytics.ts) and forwards every page view to it.
 * Mount once at the top of the app tree (inside NavigationProvider).
 */
export function useVisitorTracking() {
  const location = useLocation();
  const { currentView } = useAppNavigation();
  const { data: seo } = useSeoSettings();

  useEffect(() => {
    tracker.boot();
  }, []);

  // GA4 uses a hardcoded measurement ID — admin cannot change it.
  // The admin toggle `enable_analytics` still works as a kill switch.
  useEffect(() => {
    if (seo?.enable_analytics === false) return;
    initGA4(HARDCODED_GA4_MEASUREMENT_ID);
  }, [seo?.enable_analytics]);

  useEffect(() => {
    const path = location.pathname + location.search;
    tracker.trackPageView(path, currentView);
    gaTrackPageView(path, currentView);
  }, [location.pathname, location.search, currentView]);
}
