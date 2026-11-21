import { apiClient, API_BASE_URL } from './apiClient';
import { leadSessionId } from '../utils/ficheLeads';
import { monitoring } from '../utils/monitoring';

export type LeadKind = 'call' | 'whatsapp' | 'compare';

const SPEC_LEAD_EVENT: Record<LeadKind, string> = {
  call: 'SpecImporterCallInitiated',
  whatsapp: 'SpecImporterWhatsAppInitiated',
  compare: 'SpecCompareAdded',
};

/**
 * Counts a tap on Appel / WhatsApp / Comparer for the importer's figures.
 * keepalive: the call and WhatsApp links leave the page at once, a normal
 * request would be cancelled. Never blocks nor fails the tap.
 */
export function trackLead(
  specId: string | number,
  kind: LeadKind,
  fiche?: { brand?: string | null; model?: string | null },
): void {
  // Also to Google Analytics (utils/ga4Events.ts): contact_importateur / comparer_modeles.
  monitoring.trackEvent(SPEC_LEAD_EVENT[kind], { specId, brand: fiche?.brand, model: fiche?.model });
  try {
    void fetch(`${API_BASE_URL}/tech-specs/${encodeURIComponent(String(specId))}/lead`, {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, session_id: leadSessionId() }),
    }).catch(() => {});
  } catch { /* old browser: not counted */ }
}

export interface QuoteRequestBody {
  first_name: string; last_name: string; phone: string; email: string;
  consent: boolean; website: string; page_url: string;
}

/** Sends the « Demande de devis » form; resolves to the importer's name. */
export async function requestQuote(specId: string | number, body: QuoteRequestBody): Promise<{ importer?: string }> {
  return apiClient.post(`/tech-specs/${encodeURIComponent(String(specId))}/quote`, { ...body, session_id: leadSessionId() });
}
