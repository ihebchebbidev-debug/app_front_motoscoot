import React, { memo } from 'react';
import { Heart, ArrowRight } from 'lucide-react';
import { Button } from '../ui/Button';
import { getOptimizedImageUrl } from '../../utils/urlUtils';

interface FavoritesTabProps {
  listings: any[];
  onToggleFavorite: (type: any, id: number) => void;
  onNavigate: (view: any, params?: any) => void;
}

const FavoritesTab: React.FC<FavoritesTabProps> = ({ listings, onToggleFavorite, onNavigate }) => {
  return (
    <div className="animate-fade-in font-['Inter']">
      <div className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-foreground">Ma sélection</h2>
          <p className="text-sm text-gray-500 font-medium mt-1">Toutes vos annonces sauvegardées pour une consultation ultérieure.</p>
        </div>
        {listings.length > 0 && (
          <div className="bg-orange-50 text-primary-600 px-4 py-2 rounded-xl font-bold border border-orange-100 text-xs uppercase">
            {listings.length} {listings.length > 1 ? 'annonces' : 'annonce'}
          </div>
        )}
      </div>

      {listings.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {listings.map((listing, idx) => (
            <article 
              key={listing.id} 
              onClick={() => onNavigate('listing-details', { id: listing.id, title: listing.title })}
              className="group bg-card rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 border border-gray-100 cursor-pointer h-full flex flex-col animate-fade-in-up" 
              style={{ animationDelay: `${idx * 100}ms` }}
            >
              <div className="relative aspect-[4/3] bg-card overflow-hidden">
                <img 
                  src={getOptimizedImageUrl(listing.image, 500, 375, 75, undefined, listing.title)} 
                  alt={listing.title} 
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                  loading="lazy"
                />
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite('listing', listing.id);
                  }} 
                  className="absolute top-3 right-3 p-2.5 bg-card/90 backdrop-blur-sm rounded-full text-red-500 shadow-sm z-10 active:scale-90 transition-transform"
                  aria-label="Retirer des favoris"
                >
                  <Heart size={18} fill="currentColor" />
                </button>
              </div>

              <div className="p-5 flex-1 flex flex-col">
                <div className="text-[12px] font-bold text-primary-600 uppercase mb-1.5">
                  {listing.brand}
                </div>
                
                <h3 className="text-[18.5px] font-bold text-foreground mb-2 group-hover:text-primary-600 transition-colors line-clamp-1 leading-tight">
                  {listing.model || listing.title}
                </h3>

                <div className="mt-auto pt-4 flex items-center justify-between border-t border-gray-50">
                  <span className="text-[12.5px] font-bold text-gray-500">
                    {listing.price}
                  </span>
                  
                  <div className="flex items-center gap-2 text-primary-600 group/btn">
                    <span className="text-[12px] font-bold uppercase opacity-0 group-hover:opacity-100 transition-opacity">Voir</span>
                    <div className="p-2 bg-orange-50 rounded-full group-hover:bg-primary-600 group-hover:text-white transition-all shadow-sm">
                      <ArrowRight size={16} strokeWidth={3} />
                    </div>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-32 bg-card rounded-2xl border-2 border-dashed border-gray-100 shadow-sm">
          <Heart size={72} className="text-gray-100 mb-8" />
          <h2 className="text-2xl font-bold text-gray-400 uppercase mb-3">Votre liste est vide</h2>
          <p className="text-gray-400 font-medium mb-10 text-center px-6">Les annonces que vous sauvegardez apparaîtront ici.</p>
          <Button variant="dark" onClick={() => onNavigate('search')} className="rounded-2xl px-12 h-14">Parcourir les annonces</Button>
        </div>
      )}
    </div>
  );
};

export default memo(FavoritesTab);