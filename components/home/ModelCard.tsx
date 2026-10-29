
import React, { useState } from 'react';
import { ArrowRight, Heart } from 'lucide-react';
import { BikeModel } from '../../types';
import { Badge } from '../ui/Badge';
import { getOptimizedImageUrl, PLACEHOLDER_LISTING } from '../../utils/urlUtils';

interface ModelCardProps {
  model: BikeModel;
  onClick: () => void;
  /** When provided, displays a favorite (heart) button on the image. */
  favorited?: boolean;
  onFavoriteToggle?: () => void;
  /** Top-right badge label. Defaults to "Populaire". */
  badgeLabel?: string;
}

export const ModelCard: React.FC<ModelCardProps> = ({ model, onClick, favorited, onFavoriteToggle, badgeLabel = 'Populaire' }) => {
  const [imgError, setImgError] = useState(false);
  
  // Image optimisée pour les cartes de la home
  const optimizedSrc = imgError
    ? PLACEHOLDER_LISTING
    : getOptimizedImageUrl(model.image, 500, 375, 75, PLACEHOLDER_LISTING, `${model.brand || ''} ${model.name || ''}`.trim());

  const showFav = typeof onFavoriteToggle === 'function';

  return (
    <div 
      className="group relative bg-card rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 border border-gray-100 cursor-pointer h-full"
      onClick={onClick}
    >
      <div className="aspect-[4/3] overflow-hidden relative bg-card">
        <div className="absolute inset-0 bg-black/5 z-10" />
        <img 
          src={optimizedSrc} 
          alt={model.name} 
          loading="lazy"
          onError={() => setImgError(true)}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
        />
        {showFav && (
          <button
            type="button"
            aria-label={favorited ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            aria-pressed={!!favorited}
            onClick={(e) => {
              e.stopPropagation();
              onFavoriteToggle?.();
            }}
            className={`absolute top-3 left-3 z-20 w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-md shadow-sm transition-all duration-200 active:scale-90 ${
              favorited
                ? 'bg-primary-600 text-white hover:bg-primary-700'
                : 'bg-card/90 text-gray-700 hover:bg-card hover:text-primary-600'
            }`}
          >
            <Heart size={16} strokeWidth={2.5} fill={favorited ? 'currentColor' : 'none'} />
          </button>
        )}
        <div className="absolute top-3 right-3 z-20">
          <Badge variant="primary" className="border-none shadow-sm">
            {badgeLabel}
          </Badge>
        </div>
      </div>

      <div className="p-5">
        <div className="text-[12px] font-black text-primary-600 uppercase tracking-[0.2em] mb-1.5">
          {model.brand}
        </div>
        <h3 className="text-xl font-black text-gray-900 mb-2 group-hover:text-primary-600 transition-colors tracking-tight">
          {(() => {
            const brand = (model.brand || '').trim();
            const name = (model.name || '').trim();
            if (brand && name.toLowerCase().startsWith(brand.toLowerCase())) {
              return name.slice(brand.length).trim() || name;
            }
            return name;
          })()}
        </h3>
        <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-50">
          <span className="text-sm text-gray-500 font-bold">
            {model.price}
          </span>
          <span className="p-2 bg-primary-50 rounded-full text-primary-600 group-hover:bg-primary-600 group-hover:text-white transition-all shadow-sm">
            <ArrowRight size={16} strokeWidth={3} />
          </span>
        </div>
      </div>
    </div>
  );
};
