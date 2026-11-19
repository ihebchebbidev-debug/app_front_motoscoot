/**
 * Importer subscription badge in the admin (owner, 2026-11-19). The fiche
 * shows Appel, WhatsApp and Devis while subscription_until >= today.
 */
export interface SubscriptionStatus { tone: 'on' | 'soon' | 'off' | 'none'; label: string }

const fr = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

/** « Jusqu'au 31/01/2027 », « Expire le … » within 14 days, « Expiré le … », « — ». */
export function subscriptionStatus(until: string | null | undefined, today = new Date()): SubscriptionStatus {
  const d = String(until || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return { tone: 'none', label: 'Aucun' };
  const t = today.toISOString().slice(0, 10);
  if (d < t) return { tone: 'off', label: `Expiré le ${fr(d)}` };
  const days = Math.round((Date.parse(d) - Date.parse(t)) / 86_400_000);
  return days <= 14 ? { tone: 'soon', label: `Expire le ${fr(d)}` } : { tone: 'on', label: `Jusqu'au ${fr(d)}` };
}

/** « 12 appels · 5 WhatsApp · 3 devis · 8 comparaisons », zeros left out. */
export function leadsLine(c: { calls: number; whatsapp_taps: number; quotes: number; compares: number }): string {
  const parts = [
    c.calls ? `${c.calls} appel${c.calls > 1 ? 's' : ''}` : '',
    c.whatsapp_taps ? `${c.whatsapp_taps} WhatsApp` : '',
    c.quotes ? `${c.quotes} devis` : '',
    c.compares ? `${c.compares} comparaison${c.compares > 1 ? 's' : ''}` : '',
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'Aucun contact';
}

