import React, { useEffect, useRef, useState } from 'react';
import { Eye, Plus, Share2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { getUrlFromState } from '../../utils/urlUtils';
import SocialShareModal, { shareNatively, type ShareContent } from '../common/SocialShareModal';
import { SentEnvelope } from './SentEnvelope';
import { playSentSound } from '../../utils/successSound';

export interface PublishedListing {
  id: string | number;
  listingNumber?: number;
  title: string;
  subtitle?: string;
  image?: string;
}

interface DepositSuccessProps {
  listing: PublishedListing;
  onView: () => void;
  onDepositAnother: () => void;
}

/** Public path of a listing, the same one the cards and the page use. */
export const publishedListingPath = (l: PublishedListing): string =>
  getUrlFromState('listing-details', { id: l.id, title: l.title, listingNumber: l.listingNumber });

/**
 * End of the deposit: replaces the wizard once the listing is sent. New
 * listings wait for moderation, and the seller gets an e-mail once it is
 * approved (backend adminController → sendListingApprovedEmail).
 */
export const DepositSuccess: React.FC<DepositSuccessProps> = ({ listing, onView, onDepositAnother }) => {
  const [shareOpen, setShareOpen] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const soundPlayed = useRef(false);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // Once per publish (StrictMode runs effects twice in development).
    if (!soundPlayed.current) {
      soundPlayed.current = true;
      playSentSound();
    }
  }, []);

  const shareContent: ShareContent = {
    kind: 'listing',
    id: listing.id,
    title: listing.title,
    subtitle: listing.subtitle,
    url: `${window.location.origin}${publishedListingPath(listing)}`,
    image: listing.image,
  };

  const share = async () => {
    if (!(await shareNatively(shareContent))) setShareOpen(true);
  };

  return (
    <div className="px-6 py-10 md:px-12 md:py-14 flex flex-col items-center text-center" role="status">
      <div className="mb-4">
        <SentEnvelope photo={listing.image} />
      </div>
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight outline-none"
      >
        Annonce envoyée !
      </h2>
      <p className="mt-3 max-w-[46ch] text-[15px] leading-relaxed text-gray-600 font-medium">
        Notre équipe la vérifie avant sa mise en ligne. Vous recevrez un e-mail dès qu'elle sera visible
        par les acheteurs.
      </p>

      <div className="mt-10 w-full max-w-sm flex flex-col gap-3">
        <Button type="button" variant="primary" size="lg" fullWidth onClick={onView} leftIcon={<Eye size={18} />} className="bg-primary-700 dark:text-gray-50 dark:hover:bg-primary-600">
          Voir mon annonce
        </Button>
        <Button type="button" variant="outline" size="lg" fullWidth onClick={share} leftIcon={<Share2 size={18} />}>
          Partager
        </Button>
        <Button type="button" variant="ghost" size="lg" fullWidth onClick={onDepositAnother} leftIcon={<Plus size={18} />}>
          Déposer une autre
        </Button>
      </div>

      <SocialShareModal open={shareOpen} onClose={() => setShareOpen(false)} content={shareContent} />
    </div>
  );
};
