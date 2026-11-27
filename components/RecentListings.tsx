import React from 'react';
import { ArrowRight } from 'lucide-react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { listingsApi } from '../services/listingsApi';
import { ListingCard } from './search/ListingCard';
import { Link } from 'react-router-dom';
import { Button } from './ui/Button';
import { SectionHeader, SECTION_SPACING } from './home/SectionHeader';
import { getUrlFromState } from '../utils/urlUtils';
import { SkeletonCard } from './ui/Skeleton';
import { tracker } from '../services/trackingService';
import { useFavorites } from '../context/FavoritesContext';
import type { Listing } from '../types';

interface RecentListingsProps {
  onNavigate?: (view: any, params?: any) => void;
}

const MAX_COUNT = 6;

const RecentListings: React.FC<RecentListingsProps> = ({ onNavigate }) => {
  const { data, isLoading } = useQuery<{ listings: Listing[] }>({
    queryKey: ['listings', 'recent', MAX_COUNT],
    queryFn: ({ signal }) => listingsApi.list({ page: 1, limit: MAX_COUNT, sort: 'newest' }, signal),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 2,
  });

  const { isFavorite, toggleFavorite } = useFavorites();

  const items = data?.listings || [];

  if (!isLoading && items.length === 0) return null;

  return (
    <section className={`${SECTION_SPACING} bg-background overflow-hidden`}>
      <div className="max-w-7xl mx-auto px-6 md:px-20 lg:px-32">
        <SectionHeader
          title="Annonces récentes"
          subtitle="Les annonces de motos et scooters occasion les plus récentes."
          action={
            <Button
              variant="ghost"
              onClick={() => onNavigate?.('search')}
              className="hidden md:flex text-primary-600 hover:bg-primary-50"
              rightIcon={<ArrowRight className="w-5 h-5 ml-1" />}
            >
              Tout voir
            </Button>
          }
        />

        {/* Phones: one swipeable row (same pattern as « Modèles populaires »)
            instead of six full-width cards stacked over ~3 300 px.
            md and up: the grid. */}
        <div className="flex md:grid md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 xl:gap-8 overflow-x-auto md:overflow-visible no-scrollbar snap-x snap-mandatory scroll-px-6 -mx-6 px-6 md:mx-0 md:px-0 pb-2 md:pb-0">
          {isLoading
            ? Array.from({ length: MAX_COUNT }).map((_, i) => (
                <div key={i} className="shrink-0 w-[88%] sm:w-[340px] md:w-auto snap-start"><SkeletonCard variant="compact" imageAspect="aspect-[16/10]" /></div>
              ))
            : items.map((item) => (
                <div key={item.id} className="shrink-0 w-[88%] sm:w-[340px] md:w-auto snap-start animate-fade-in-up">
                  <ListingCard
                    listing={item}
                    viewMode="grid"
                    source="home-recent"
                    favorited={isFavorite('listing', item.id)}
                    onFavoriteToggle={() => toggleFavorite('listing', item.id)}
                    onClick={() => {
                      onNavigate?.('listing-details', { id: item.id, title: item.title });
                    }}
                  />
                </div>
              ))}
        </div>

        {/* Phones had no way on to the full list after this row. A real link
            (crawlable, same URL as the « Annonces » menu entry). */}
        <div className="mt-8 flex justify-center md:hidden">
          <Link
            to={getUrlFromState('search')}
            className="inline-flex items-center gap-2 h-12 px-7 rounded-full bg-primary-600 hover:bg-primary-700 text-white text-[13px] font-extrabold uppercase tracking-wider shadow-[0_8px_20px_-6px_rgba(255,107,0,0.5)] active:scale-[0.98] transition-all duration-200"
          >
            Voir toutes les annonces
            <ArrowRight size={16} strokeWidth={3} />
          </Link>
        </div>
      </div>
    </section>
  );
};

export default RecentListings;
