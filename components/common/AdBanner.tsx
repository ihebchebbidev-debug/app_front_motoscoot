import React, { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { useAds, type ZoneAd } from '../../context/AdsContext';

interface AdBannerProps {
  zone: 'news_top' | 'search_feed' | 'garage_sidebar' | 'listing_sidebar' | 'search_sidebar';
  className?: string;
  variant?: 'native' | 'banner'; // Native looks like app content, banner looks like an image
}

const AdBanner: React.FC<AdBannerProps> = ({ zone, className = '', variant = 'banner' }) => {
  const { loadZone, trackView, trackClick } = useAds();
  const [ad, setAd] = useState<ZoneAd | null>(null);

  // Fetch the ad for this zone once. The provider caches by zone, so this is
  // cheap on re-mount.
  useEffect(() => {
    let cancelled = false;
    loadZone(zone).then((resolved) => {
      if (!cancelled) setAd(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [zone, loadZone]);

  // Fire impression once when an ad is rendered.
  useEffect(() => {
    if (!ad) return;
    const timer = setTimeout(() => trackView(ad.id), 1000);
    return () => clearTimeout(timer);
  }, [ad?.id, trackView]);

  if (!ad) return null;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    trackClick(ad.id, ad.linkUrl);
    if (ad.linkUrl) {
      window.open(ad.linkUrl, '_blank', 'noopener,noreferrer');
    }
  };

  // NATIVE STYLE (For Feeds and Sidebars - Text heavy)
  if (variant === 'native') {
    return (
      <div className={`bg-gray-900 rounded-2xl p-6 text-white relative overflow-hidden shadow-md ${className}`}>
         <div className="absolute top-0 right-0 w-32 h-32 bg-primary-600 blur-[50px] opacity-30 rounded-full pointer-events-none"></div>
         <div className="relative z-10">
            <div className="mb-2">
                <span className="text-[12px] font-bold uppercase tracking-wider text-gray-400 inline-block border border-gray-700 px-1.5 py-0.5 rounded">Publicité</span>
            </div>
            <h4 className="font-bold text-lg mb-2">{ad.title}</h4>
            <p className="text-sm text-gray-300 mb-4 leading-relaxed">{ad.description || "Découvrez nos offres exceptionnelles dès maintenant."}</p>
            <button
                onClick={handleClick}
                className="w-full py-3 bg-card text-gray-900 font-bold rounded-lg text-sm hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
            >
               {ad.ctaText || "En savoir plus"} <ExternalLink size={14} />
            </button>
         </div>
      </div>
    );
  }

  // BANNER STYLE (For Top Headers - Image heavy)
  return (
    <div
        onClick={handleClick}
        className={`w-full relative overflow-hidden group cursor-pointer ${className}`}
    >
        {ad.mediaUrl ? (
            <img
              src={ad.mediaUrl}
              alt={ad.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
            />
        ) : (
            // Fallback if no image URL provided for a banner type
            <div className="w-full h-full bg-gray-800 flex flex-col items-center justify-center p-6 text-center">
                <span className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-2">Publicité</span>
                <h3 className="text-white text-2xl font-bold">{ad.title}</h3>
            </div>
        )}

        <div className="absolute bottom-0 right-0 bg-card/90 backdrop-blur-sm px-2 py-1 rounded-tl-lg text-[12px] font-bold text-gray-500 uppercase">
            Sponsorisé
        </div>
    </div>
  );
};

export default AdBanner;
