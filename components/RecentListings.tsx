import React from 'react';
import { ArrowRight } from 'lucide-react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { listingsApi } from '../services/listingsApi';
import { ListingCard } from './search/ListingCard';
import { Button } from './ui/Button';
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
    <section className="py-16 md:py-20 bg-background overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 md:px-20 lg:px-32">
        <div className="flex flex-col md:flex-row justify-between items-end mb-10 gap-4">
          <div>
            <h2 className="text-[36px] font-extrabold text-gray-900 tracking-normal">
              Annonces récentes
            </h2>
            <p className="text-gray-500 mt-2 text-[17px] font-normal tracking-normal">
              Les annonces de motos et scooters occasion les plus récentes.
            </p>
          </div>
          <Button
            variant="ghost"
            onClick={() => onNavigate?.('search')}
            className="hidden md:flex text-primary-600 hover:bg-primary-50"
            rightIcon={<ArrowRight className="w-5 h-5 ml-1" />}
          >
            Tout voir
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 xl:gap-8">
          {isLoading
            ? Array.from({ length: MAX_COUNT }).map((_, i) => (
                <SkeletonCard key={i} variant="compact" imageAspect="aspect-[16/10]" />
              ))
            : items.map((item) => (
                <div key={item.id} className="animate-fade-in-up">
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
      </div>
    </section>
  );
};

export default RecentListings;
