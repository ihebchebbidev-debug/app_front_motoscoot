import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useAds } from '../context/AdsContext';
import { useAppNavigation } from '../context/NavigationContext';

/**
 * FullscreenAd — large near-fullscreen overlay campaign.
 *
 * UX:
 *  - Backdrop is darker + blurred (backdrop-blur-md) so the ad reads
 *    as a "takeover" without literally hiding the entire viewport
 *    (small transparent margins remain on every side).
 *  - Mobile: ~96vw / 92vh card, image fills the top half.
 *  - Desktop: capped at max-w-5xl / max-h-[88vh], 16:9 hero image.
 *  - Big tap-target X close, plus "skip" link and an opt-out checkbox
 *    to silence the zone for the rest of the session (matches PopupAd).
 *
 * Display rules: shown once per session on the home view (after a short
 * delay) and respects a hard cap stored in sessionStorage so users are
 * never bombarded.
 */
export const FullscreenAd: React.FC = () => {
  const { getAdByZone, trackView, trackClick } = useAds();
  const { currentView } = useAppNavigation();
  const [isVisible, setIsVisible] = useState(false);
  const [hasShownInSession, setHasShownInSession] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const MAX_DISPLAYS_PER_SESSION = 1;
  const SESSION_COUNT_KEY = 'motoscoot_fullscreen_ad_count';
  const SESSION_OPTOUT_KEY = 'motoscoot_hide_fullscreen_session';

  const getCount = () => {
    if (typeof window === 'undefined') return 0;
    return parseInt(sessionStorage.getItem(SESSION_COUNT_KEY) || '0', 10);
  };
  const incCount = () => {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem(SESSION_COUNT_KEY, String(getCount() + 1));
  };

  const isOptedOut =
    (typeof window !== 'undefined' && sessionStorage.getItem(SESSION_OPTOUT_KEY) === 'true') ||
    getCount() >= MAX_DISPLAYS_PER_SESSION;

  const ad = getAdByZone('fullscreen');
  const isHome = currentView === 'home';

  useEffect(() => {
    if (!ad || hasShownInSession || isOptedOut || !isHome) return;
    const t = setTimeout(() => {
      setIsVisible(true);
      setHasShownInSession(true);
      incCount();
      trackView(ad.id);
    }, 1200);
    return () => clearTimeout(t);
  }, [ad, hasShownInSession, isOptedOut, isHome, trackView]);

  // Lock body scroll while open
  useEffect(() => {
    if (!isVisible) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isVisible]);

  if (!isVisible || !ad) return null;

  const close = () => {
    if (dontShowAgain) sessionStorage.setItem(SESSION_OPTOUT_KEY, 'true');
    setIsVisible(false);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    trackClick(ad.id, ad.linkUrl);
    if (ad.linkUrl) window.open(ad.linkUrl, '_blank', 'noopener,noreferrer');
    if (dontShowAgain) sessionStorage.setItem(SESSION_OPTOUT_KEY, 'true');
    setIsVisible(false);
  };

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-md p-2 sm:p-6 md:p-10 animate-in fade-in duration-300"
      role="dialog"
      aria-modal="true"
      aria-label={ad.title}
      onClick={close}
    >
      <div
        className="relative bg-card rounded-2xl shadow-2xl overflow-hidden w-full h-full sm:h-auto sm:max-h-[92vh] md:max-h-[88vh] sm:max-w-2xl md:max-w-4xl lg:max-w-5xl flex flex-col animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={close}
          className="absolute top-3 right-3 z-20 p-3 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors shadow-lg"
          aria-label="Fermer la publicité"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="absolute top-3 left-3 z-20 bg-card/90 backdrop-blur-sm px-3 py-1 rounded-full text-[11px] font-bold text-gray-800 shadow">
          Sponsorisé
        </div>

        {ad.mediaUrl && (
          <div
            className="w-full bg-gray-100 cursor-pointer flex-shrink-0 h-[55vh] sm:h-72 md:h-96"
            onClick={handleClick}
          >
            <img
              src={ad.mediaUrl}
              alt={ad.title}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
        )}

        <div className="p-5 sm:p-8 text-center flex-1 flex flex-col justify-center overflow-y-auto">
          <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3">{ad.title}</h3>
          {ad.description && (
            <p className="text-gray-600 text-sm sm:text-base md:text-lg mb-6 max-w-2xl mx-auto">{ad.description}</p>
          )}

          <button
            onClick={handleClick}
            className="mx-auto w-full sm:w-auto sm:px-12 bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 sm:py-4 rounded-lg transition-colors shadow-md hover:shadow-lg text-base sm:text-lg"
          >
            {ad.ctaText || 'Découvrir'}
          </button>

          <div className="mt-5 flex flex-col items-center gap-3">
            <button
              onClick={close}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Non merci, je continue ma visite
            </button>
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
              />
              <span className="text-xs text-gray-400 group-hover:text-gray-600">
                Ne plus afficher dans cette session
              </span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};
