/**
 * Which app events reach Google Analytics 4, and under which name.
 *
 * Owner, 2026-11-21: GA4 showed 0 key events, because the contact clicks
 * (call, WhatsApp, message, callback) were only sent to utils/monitoring,
 * whose trackEvent did nothing in production. They now go to GA4 under one
 * name, `contact_vendeur`, with the channel in `methode`, so a single key
 * event counts every buyer → seller contact. `annonce_publiee` counts the
 * deposits. Mark both as key events in GA4 › Admin › Events.
 *
 * Only non-personal parameters are forwarded (listing id, brand, model,
 * channel): never the seller's name, phone or the user id.
 */
export type Ga4Event = { name: string; params: Record<string, string | number> };

const CONTACT_CHANNEL: Record<string, string> = {
  ListingCallInitiated: 'appel',
  ListingWhatsAppInitiated: 'whatsapp',
  ListingMessageInitiated: 'message',
  ListingCallbackRequested: 'rappel',
};

function pick(props: Record<string, unknown>): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  const id = props.listingId ?? props.listing_id;
  if (typeof id === 'string' || typeof id === 'number') out.listing_id = String(id);
  if (typeof props.brand === 'string' && props.brand) out.marque = props.brand;
  if (typeof props.model === 'string' && props.model) out.modele = props.model;
  return out;
}

/** Translate a monitoring event into a GA4 event, or null when it is not sent. */
export function toGa4Event(name: string, props: Record<string, unknown> = {}): Ga4Event | null {
  const channel = CONTACT_CHANNEL[name];
  if (channel) return { name: 'contact_vendeur', params: { methode: channel, ...pick(props) } };
  if (name === 'ListingPhoneRevealed') return { name: 'afficher_numero', params: pick(props) };
  if (name === 'ListingPublished') {
    const params: Record<string, string | number> = {};
    if (typeof props.category === 'string' && props.category) params.categorie = props.category;
    return { name: 'annonce_publiee', params };
  }
  if (name === 'ContentShared') {
    const params: Record<string, string | number> = {};
    if (typeof props.method === 'string' && props.method) params.method = props.method;
    if (typeof props.kind === 'string' && props.kind) params.content_type = props.kind;
    return { name: 'share', params };
  }
  return null;
}
