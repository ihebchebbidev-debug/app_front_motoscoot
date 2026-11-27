import { apiClient } from './apiClient';
import { leadSessionId } from '../utils/ficheLeads';

export type ListingContactChannel = 'phone' | 'whatsapp' | 'message';

/**
 * Counts a tap on Appeler / WhatsApp / Message for the seller's contact
 * figures (POST /api/listings/:id/contact). Server-side, so it works without
 * the cookie banner. The tab id lets the server count one person tapping
 * several times as one, the same way as the fiches techniques. Never blocks
 * nor fails the tap.
 */
export function trackListingContact(listingId: string | number, channel: ListingContactChannel): void {
  try {
    apiClient
      .post(`/listings/${encodeURIComponent(String(listingId))}/contact`, { channel, session_id: leadSessionId() })
      .catch(() => {});
  } catch { /* not counted */ }
}
