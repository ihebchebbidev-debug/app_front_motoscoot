import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useAds } from '../context/AdsContext';
import { useExitIntent } from '../hooks/useExitIntent';
import { useAppNavigation } from '../context/NavigationContext';

export const PopupAd: React.FC = () => {
  const { getAdByZone, trackView, trackClick } = useAds();
  const { currentView } = useAppNavigation();
  const [isVisible, setIsVisible] = useState(false);
  const [hasShownInSession, setHasShownInSession] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const isHome = currentView === 'home';
  
  // Display limit configuration
  const MAX_DISPLAYS_PER_SESSION = 4;
  
  // Helper to get/set session display count
  const getSessionDisplayCount = () => {
    if (typeof window === 'undefined') return 0;
    return parseInt(sessionStorage.getItem('motoscoot_ad_display_count') || '0', 10);
  };

  const incrementSessionDisplayCount = () => {
    if (typeof window === 'undefined') return;
    const count = getSessionDisplayCount();
    sessionStorage.setItem('motoscoot_ad_display_count', (count + 1).toString());
  };

  const isLimitReached = getSessionDisplayCount() >= MAX_DISPLAYS_PER_SESSION;
  
  // Check if user opted out for this session or if limit reached
  const isOptedOut = (typeof window !== 'undefined' && sessionStorage.getItem('motoscoot_hide_ads_session') === 'true') || isLimitReached;

  // Determine if current view is a detail page where scroll-up popup is allowed
  const isDetailPage = [
    'listing-details',
    'article-details',
    'tip-details',
    'garage-details',
    'tech-specs-details',
    'comparator',
    'deposit'
  ].includes(currentView);

  // Only enable scroll-up intent on detail pages, and if it hasn't been shown yet
  const { isTriggered, reset } = useExitIntent({
    disabled: !isDetailPage || hasShownInSession || isOptedOut,
    scrollThreshold: 50, // Trigger when scrolling up 50px
  });

  const ad = getAdByZone('popup');

  useEffect(() => {
    // Reset state when navigating to a new page
    setIsVisible(false);
    setHasShownInSession(false);
    reset();
  }, [currentView, reset]);

  useEffect(() => {
    if (!ad || hasShownInSession || isOptedOut) return;

    if (isHome) {
      // Show immediately on home after a tiny delay for better UX
      const timer = setTimeout(() => {
        setIsVisible(true);
        setHasShownInSession(true);
        incrementSessionDisplayCount();
        trackView(ad.id);
      }, 800);
      return () => clearTimeout(timer);
    } else if (isDetailPage && isTriggered) {
      // Show on detail pages when scroll-up intent is triggered
      setIsVisible(true);
      setHasShownInSession(true);
      incrementSessionDisplayCount();
      trackView(ad.id);
    }
  }, [isHome, isDetailPage, isTriggered, ad, hasShownInSession, trackView, isOptedOut]);

  if (!isVisible || !ad) return null;

  const handleClose = () => {
    if (dontShowAgain) {
      sessionStorage.setItem('motoscoot_hide_ads_session', 'true');
    }
    setIsVisible(false);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    trackClick(ad.id, ad.linkUrl);
    if (ad.linkUrl) {
      window.open(ad.linkUrl, '_blank', 'noopener,noreferrer');
    }
    if (dontShowAgain) {
      sessionStorage.setItem('motoscoot_hide_ads_session', 'true');
    }
    setIsVisible(false);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
      <div className="bg-card rounded-xl shadow-2xl max-w-md w-full overflow-hidden relative animate-in zoom-in-95 duration-300">
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 z-10 p-2 bg-black/20 hover:bg-black/40 text-white rounded-full transition-colors"
          aria-label="Fermer"
        >
          <X className="w-5 h-5" />
        </button>

        {ad.mediaUrl && (
          <div 
            className="w-full h-48 sm:h-56 bg-gray-100 relative cursor-pointer"
            onClick={handleClick}
          >
            <img 
              src={ad.mediaUrl} 
              alt={ad.title} 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="absolute top-3 left-3 bg-card/90 backdrop-blur-sm px-2 py-1 rounded text-xs font-bold text-gray-800 shadow-sm">
              Sponsorisé
            </div>
          </div>
        )}

        <div className="p-6 text-center">
          <h3 className="text-2xl font-bold text-gray-900 mb-2">{ad.title}</h3>
          <p className="text-gray-600 mb-6">{ad.description}</p>
          
          <button
            onClick={handleClick}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-6 rounded-lg transition-colors shadow-md hover:shadow-lg"
          >
            {ad.ctaText || 'Découvrir'}
          </button>
          
          <div className="mt-4 flex flex-col items-center gap-3">
            <button
              onClick={handleClose}
              className="text-sm text-gray-500 hover:text-gray-700 underline transition-colors"
            >
              Non merci, je continue ma visite
            </button>

            <label className="flex items-center gap-2 cursor-pointer group">
              <input 
                type="checkbox" 
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500 cursor-pointer"
              />
              <span className="text-xs text-gray-400 group-hover:text-gray-600 transition-colors">
                Ne plus afficher de pub dans cette session
              </span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};
