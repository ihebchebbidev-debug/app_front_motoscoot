import React, { useMemo, useCallback } from 'react';
import { useListings } from '../../hooks/useListings';
import { useFavorites } from '../../context/FavoritesContext';
import { ArrowRight } from 'lucide-react';
import { Reveal } from '../ui/Reveal';
import { ListingCard } from '../search/ListingCard';
import { useToast } from '../../context/ToastContext';
import { getRecentlyViewed } from '../../utils/recentSearches';

interface ListingSimilarAdsProps {
  currentListingId: string | number;
  brand: string;
  type: string;
  price: string;
  onNavigate?: (view: any, params?: any) => void;
  isLoading?: boolean;
  isLoggedIn?: boolean;
  onTriggerLogin?: () => void;
}

const S = {
  Section: "mt-12 md:mt-16 bg-muted border-t border-gray-100 py-12 md:py-12 -mx-6 md:-mx-16 lg:-mx-32 px-6 md:px-16 lg:px-32",
  Header: "flex justify-between items-end mb-10",
  Title: "text-2xl md:text-[28px] font-black text-foreground tracking-tight",
  Grid: "flex md:grid md:grid-cols-3 lg:grid-cols-4 gap-6 overflow-x-auto no-scrollbar snap-x snap-mandatory -mx-6 px-6 md:mx-0 md:px-0",
};

export const ListingSimilarAds: React.FC<ListingSimilarAdsProps> = ({ 
  currentListingId, 
  brand, 
  type,
  price,
  onNavigate,
  isLoading = false,
  isLoggedIn = false,
  onTriggerLogin
}) => {
  const { isFavorite, toggleFavorite, isToggling } = useFavorites();
  const { addToast } = useToast();

  const handleFavoriteToggle = useCallback((id: string | number) => {
    const currentlyFavorite = isFavorite('listing', id);
    toggleFavorite('listing', id);
    if (!currentlyFavorite) {
      addToast("Annonce ajoutée à vos favoris", "success", 3000);
    } else {
      addToast("Annonce retirée de vos favoris", "info", 2000);
    }
  }, [toggleFavorite, isFavorite, addToast]);

  const { data: listingsResp } = useListings({ limit: 100 });
  const sourceListings = listingsResp?.listings ?? [];

  const similarListings = useMemo(() => {
    // Build a brand/type signal from the buyer's recent browsing history so
    // we re-rank similar ads toward what they were *just* exploring, not
    // only the current listing's category. Recent views weigh more than
    // older ones (linear decay on position).
    const recent = getRecentlyViewed().filter(v => String(v.id) !== String(currentListingId));
    const brandWeights = new Map<string, number>();
    const typeWeights = new Map<string, number>();
    recent.slice(0, 10).forEach((v, i) => {
      const w = (10 - i) / 10; // 1.0 → 0.1
      if (v.brand) brandWeights.set(v.brand.toLowerCase(), (brandWeights.get(v.brand.toLowerCase()) || 0) + w);
      if (v.type) typeWeights.set(v.type.toLowerCase(), (typeWeights.get(v.type.toLowerCase()) || 0) + w);
    });

    return sourceListings
      .filter(l => l.id !== currentListingId)
      .map(l => {
        let score = 0;
        // Base similarity (current listing context).
        if (l.brand.toLowerCase() === brand.toLowerCase()) score += 10;
        if (l.type === type) score += 5;
        // Buyer-history boost — capped so the current listing context still
        // dominates when the user has only viewed unrelated stuff.
        score += (brandWeights.get(l.brand.toLowerCase()) || 0) * 6;
        score += (typeWeights.get((l.type || '').toLowerCase()) || 0) * 3;
        return { ...l, score, distance: null };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);
  }, [currentListingId, brand, type, sourceListings]);

  if (similarListings.length === 0) return null;

  return (
    <section className={S.Section}>
      <Reveal animation="fade-in-up">
        <div className={S.Header}>
          <div>
            <h2 className={S.Title}>Annonces similaires</h2>
            <p className="text-gray-500 text-sm font-medium mt-1">Sélectionnées selon vos préférences.</p>
          </div>
          <button 
            onClick={() => onNavigate?.('search', { brand })}
            className="hidden md:flex items-center gap-2 text-xs font-black uppercase tracking-widest text-gray-400 hover:text-primary-600 transition-colors"
          >
            Tout voir <ArrowRight size={14} />
          </button>
        </div>
      </Reveal>

      <div className={S.Grid}>
        {similarListings.map((l) => (
          <div key={l.id} className="flex-shrink-0 w-[285px] md:w-full snap-center">
            <ListingCard 
              listing={l as any} 
              viewMode="grid"
              favorited={isFavorite('listing', l.id as any)}
              onFavoriteToggle={handleFavoriteToggle}
              onClick={(id, title) => onNavigate?.('listing-details', { id, title })}
              isLoggedIn={isLoggedIn}
              onTriggerLogin={onTriggerLogin}
              isToggling={isToggling('listing', l.id as any)}
            />
          </div>
        ))}
      </div>

      <div className="mt-10 md:hidden flex justify-center">
        <button 
          onClick={() => onNavigate?.('search', { brand })}
          className="px-8 py-3 border border-gray-200 rounded-full text-[12px] font-black uppercase tracking-widest text-gray-600 active:bg-gray-50"
        >
          Voir plus d'annonces
        </button>
      </div>
    </section>
  );
};