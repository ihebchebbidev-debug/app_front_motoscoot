
import React, { memo, useCallback, useMemo } from 'react';
import { Listing } from '../../types';
import { Reveal } from '../ui/Reveal';
import { ListingThumbnail } from './ListingThumbnail';
import { ListingInfo } from './ListingInfo';
import { ListingPriceActions } from './ListingPriceActions';
import { tracker } from '../../services/trackingService';
import { getUrlFromState } from '../../utils/urlUtils';

interface ListingCardProps {
  listing: Listing & { distance?: number | null };
  viewMode: 'grid' | 'list';
  favorited: boolean;
  onFavoriteToggle: (id: string | number) => void;
  onClick: (id: string | number, title: string) => void;
  priority?: boolean;
  isLoggedIn?: boolean;
  onTriggerLogin?: () => void;
  /** Where this card is displayed — used for analytics (e.g. 'search', 'home-popular'). */
  source?: string;
  /** Whether this favorite is currently being toggled (loading state) */
  isToggling?: boolean;
}

export const ListingCard = memo(({ 
  listing, 
  viewMode,
  favorited, 
  onFavoriteToggle, 
  onClick,
  priority = false,
  isLoggedIn = false,
  onTriggerLogin,
  source = 'search',
  isToggling = false,
}: ListingCardProps) => {
  const isGrid = viewMode === 'grid';

  // Real URL so right-click → "Open in new tab", middle-click, cmd/ctrl-click,
  // and "Copy link" all work natively. SPA navigation still happens on plain
  // left clicks via the handler below.
  const href = useMemo(
    () => getUrlFromState('listing-details', { id: listing.id, slug: listing.title }),
    [listing.id, listing.title],
  );

  const handleItemClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      // Let the browser handle modifier-clicks (new tab/window), middle-click,
      // and right-click natively. Only intercept the plain left click for SPA.
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }
      e.preventDefault();
      try { tracker.trackListingClick(String(listing.id), source); } catch {}
      onClick(listing.id, listing.title);
    },
    [onClick, listing.id, listing.title, source],
  );

  const handleFavClick = useCallback(() => {
    onFavoriteToggle(listing.id);
  }, [onFavoriteToggle, listing.id]);

  return (
    <Reveal animation="fade-in-up" className={isGrid ? "h-full" : "w-full"}>
      <a
        href={href}
        onClick={handleItemClick}
        aria-label={listing.title}
        className={`group bg-card rounded-[14px] border border-gray-100 overflow-hidden transition-all duration-300 cursor-pointer flex shadow-sm hover:shadow-[0_4px_12px_rgba(0,0,0,0.05)] hover:border-primary-100 active:scale-[0.98] no-underline text-inherit ${
          isGrid ? 'flex-col h-full' : 'flex-col md:flex-row min-h-[220px]'
        }`}
        style={{ 
          contentVisibility: 'auto', 
          containIntrinsicSize: isGrid ? '0 400px' : '0 220px' 
        }}
      >
        <ListingThumbnail 
          image={listing.image}
          title={listing.title}
          distance={listing.distance ?? null}
          isNear={listing.distance != null && listing.distance < 20}
          favorited={favorited}
          onFavoriteToggle={handleFavClick}
          viewMode={viewMode}
          condition={listing.condition}
          priority={priority}
          isLoggedIn={isLoggedIn}
          onTriggerLogin={onTriggerLogin}
          isToggling={isToggling}
        />

        <div className={`flex flex-1 flex-col ${isGrid ? 'p-5 pt-4' : 'p-4 md:p-0 md:flex-row md:gap-4'}`}>
          <ListingInfo 
            brand={listing.brand}
            model={listing.model}
            price={listing.price}
            location={listing.location}
            date={listing.date}
            year={listing.year}
            mileage={listing.mileage}
            cc={listing.cc}
            condition={listing.condition}
            type={listing.type}
            seller={listing.seller}
            sellerType={listing.sellerType}
            sellerImage={listing.sellerImage}
            sellerPhone={listing.phone}
            contactMethod={listing.contactMethod}
            attributes={listing.attributes}
            viewMode={viewMode}
            favorited={favorited}
            onFavoriteToggle={handleFavClick}
            isLoggedIn={isLoggedIn}
            onTriggerLogin={onTriggerLogin}
          />
          
          {!isGrid && (
            <ListingPriceActions 
              price={listing.price}
              sellerPhone={listing.phone}
              contactMethod={listing.contactMethod}
              favorited={favorited}
              onFavoriteToggle={handleFavClick}
            />
          )}
        </div>
      </a>
    </Reveal>
  );
}, (prev, next) => {
  return prev.listing.id === next.listing.id && 
         prev.listing.distance === next.listing.distance &&
         prev.favorited === next.favorited && 
         prev.isLoggedIn === next.isLoggedIn &&
         prev.viewMode === next.viewMode &&
         prev.isToggling === next.isToggling;
});
