import React, { useCallback, useState } from 'react';
import { useFavorites } from '../context/FavoritesContext';
import { useToast } from '../context/ToastContext';
import { useOptionalAppNavigation } from '../context/NavigationContext';
import { Listing } from '../types';
import { monitoring } from '../utils/monitoring';
import { useNativeShare } from './useNativeShare';
import { apiClient } from '../services/apiClient';
import { tracker } from '../services/trackingService';

interface UseListingActionsProps {
  listing?: Listing | null;
}

export const useListingActions = ({ listing }: UseListingActionsProps) => {
  const { isFavorite, toggleFavorite } = useFavorites();
  const { addToast } = useToast();
  const navigation = useOptionalAppNavigation();
  const isLoggedIn = navigation?.isLoggedIn ?? false;
  const triggerLogin = navigation?.triggerLogin ?? (() => {});
  const share = useNativeShare();
  // Phone is always visible — including for anonymous visitors. We keep the
  // state for analytics (first click logs a "reveal" / contact event) but
  // never hide the number behind a login wall.
  const [phoneRevealed, setPhoneRevealed] = useState(true);

  const handleFavoriteToggle = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!isLoggedIn) {
      triggerLogin();
      return;
    }
    if (listing) {
      const currentlyFavorite = isFavorite('listing', listing.id as any);
      toggleFavorite('listing', listing.id as any);
      
      if (!currentlyFavorite) {
        addToast("Annonce ajoutée à vos favoris", "success", 3000);
      } else {
        addToast("Annonce retirée de vos favoris", "info", 2000);
      }
    }
  }, [isLoggedIn, triggerLogin, toggleFavorite, isFavorite, listing, addToast]);

  const handlePhoneAction = useCallback(() => {
    if (!listing) return;
    monitoring.trackEvent('ListingCallInitiated', {
      listingId: listing.id,
      brand: listing.brand,
      model: listing.model,
      price: listing.price,
      context: 'action_handler'
    });
    // Always log the contact intent (dedup is enforced server-side per
    // (listing, viewer, channel) in a 1h window). Previously this only
    // fired on first reveal, but `phoneRevealed` defaults to true, so
    // mobile taps never reached the backend → contacts_count was wrong.
    apiClient.post(`/listings/${listing.id}/contact`, { channel: 'phone' }).catch(() => {});
    try { tracker.trackListingEvent(String(listing.id), phoneRevealed ? 'call' : 'phone_reveal'); } catch {}
    if (!phoneRevealed) {
      setPhoneRevealed(true);
    } else if (listing.phone) {
      window.location.href = `tel:${listing.phone}`;
    }
  }, [listing, phoneRevealed]);

  const handleWhatsAppAction = useCallback((_e?: React.MouseEvent) => {
    if (!listing) return;
    monitoring.trackEvent('ListingWhatsAppInitiated', {
      listingId: listing.id,
      brand: listing.brand,
      model: listing.model,
      context: 'action_handler'
    });
    apiClient.post(`/listings/${listing.id}/contact`, { channel: 'whatsapp' }).catch(() => {});
    try { tracker.trackListingEvent(String(listing.id), 'whatsapp_click'); } catch {}
  }, [listing]);

  const handleShare = useCallback(async () => {
    if (!listing) return;

    await share({
      title: `${listing.brand} ${listing.model} • moto-scoot.tn`,
      text: `Regardez cette annonce sur moto-scoot.tn : ${listing.brand} ${listing.model}`,
      url: window.location.href,
    });
    apiClient.post(`/listings/${listing.id}/share`, { platform: 'native' }).catch(() => {});
    try { tracker.trackListingEvent(String(listing.id), 'share_native'); } catch {}
  }, [listing, share]);

  const isFavorited = listing ? isFavorite('listing', listing.id as any) : false;

  return {
    handleFavoriteToggle,
    handlePhoneAction,
    handleWhatsAppAction,
    handleShare,
    phoneRevealed,
    isFavorited
  };
};