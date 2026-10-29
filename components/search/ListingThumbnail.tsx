
import React, { useState } from 'react';
import { Heart, Navigation, Loader2 } from 'lucide-react';
import { getOptimizedImageUrl, PLACEHOLDER_LISTING } from '../../utils/urlUtils';

interface ListingThumbnailProps {
  image: string;
  title: string;
  distance: number | null;
  isNear: boolean;
  favorited: boolean;
  onFavoriteToggle: () => void;
  viewMode: 'grid' | 'list';
  condition: string;
  priority?: boolean;
  isLoggedIn?: boolean;
  onTriggerLogin?: () => void;
  /** Whether this favorite is currently being toggled (loading state) */
  isToggling?: boolean;
}

/**
 * ListingThumbnail - Version résiliente.
 * Gère les erreurs de chargement d'image pour éviter les espaces vides.
 */
export const ListingThumbnail: React.FC<ListingThumbnailProps> = ({
  image,
  title,
  distance,
  isNear,
  favorited,
  onFavoriteToggle,
  viewMode,
  condition,
  priority = false,
  isLoggedIn = false,
  onTriggerLogin,
  isToggling = false,
}) => {
  const [imgError, setImgError] = useState(false);
  const isGrid = viewMode === 'grid';
  
  const optimizedSrc = imgError 
    ? PLACEHOLDER_LISTING
    : getOptimizedImageUrl(image, isGrid ? 400 : 300, isGrid ? 300 : 225, 80, PLACEHOLDER_LISTING, title);
  
  const seoAlt = `Photo moto d'occasion : ${title} - ${condition} en Tunisie | moto-scoot.tn`;

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isLoggedIn) {
      onTriggerLogin?.();
    } else {
      onFavoriteToggle();
    }
  };

  return (
    <div className={`relative flex-shrink-0 bg-card overflow-hidden isolate transform translate-z-0 ${
      isGrid 
        ? 'w-full aspect-[4/3] rounded-t-[14px]' 
        : 'w-full aspect-[16/9] rounded-t-[14px] md:rounded-t-none md:rounded-l-[14px] md:aspect-[4/3] lg:aspect-[4/3] lg:w-72'
    }`}>
      <img 
        src={optimizedSrc} 
        alt={seoAlt} 
        loading={priority ? "eager" : "lazy"}
        // @ts-ignore
        fetchPriority={priority ? "high" : "auto"}
        onError={() => setImgError(true)}
        className="w-full h-full object-cover transform translate-z-0" 
      />
      
      {distance !== null && (
        <div className={`absolute left-0 top-0 z-20 px-3.5 py-2 rounded-br-2xl border-b border-r flex items-center gap-1.5 text-[12px] font-black uppercase tracking-tight shadow-sm ${
          isNear ? 'bg-primary-50 text-primary-600 border-primary-100' : 'bg-card/95 backdrop-blur-md text-gray-700 border-gray-100'
        }`}>
            <Navigation size={12} className={isNear ? 'text-white' : 'text-primary-500'} fill={isNear ? 'currentColor' : 'none'} />
            <span>{(distance >= 10 ? Math.round(distance).toString() : parseFloat(distance.toFixed(2)).toString())} km</span>
        </div>
      )}

      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 px-2 py-1.5 bg-black/30 backdrop-blur-md rounded-full z-20">
        <div className="w-1.5 h-1.5 rounded-full bg-card shadow-sm"></div>
        <div className="w-1.5 h-1.5 rounded-full bg-white/40"></div>
        <div className="w-1.5 h-1.5 rounded-full bg-white/40"></div>
      </div>

      <button 
        onClick={handleFavoriteClick} 
        disabled={isToggling}
        className={`absolute top-3 right-3 w-10 h-10 flex items-center justify-center backdrop-blur-md rounded-full transition-all active:scale-90 shadow-lg z-30 disabled:opacity-70 disabled:cursor-not-allowed ${
          favorited 
            ? 'bg-red-500 text-white shadow-red-200/50 animate-heartbeat' 
            : 'bg-card/90 text-gray-400 hover:text-red-500 border border-gray-100'
        }`}
        aria-label={favorited ? "Retirer des favoris" : "Ajouter aux favoris"}
      >
        {isToggling ? (
          <Loader2 size={18} className="animate-spin" />
        ) : (
          <Heart size={18} fill={favorited ? "currentColor" : "none"} />
        )}
      </button>
    </div>
  );
};
