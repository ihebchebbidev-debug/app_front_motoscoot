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


/** One bar per day of the period (zeros included), oldest first. */
export function dailyTotals(rows: { day: string; n: number }[], days: number, today = new Date()): { day: string; label: string; n: number }[] {
  const byDay = new Map<string, number>();
  for (const r of rows) byDay.set(r.day, (byDay.get(r.day) || 0) + Number(r.n || 0));
  const out: { day: string; label: string; n: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i));
    const key = d.toISOString().slice(0, 10);
    out.push({ day: key, label: d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' }), n: byDay.get(key) || 0 });
  }
  return out;
}

type Counts = { calls: number; whatsapp_taps: number; quotes: number; compares: number };

/** Short text the owner pastes in a WhatsApp or an e-mail to the importer. */
export function reportSummary(name: string, days: number, t: Counts, models: (Counts & { brand: string; model: string })[] = []): string {
  const top = [...models].sort((a, b) => (b.calls + b.whatsapp_taps + b.quotes + b.compares) - (a.calls + a.whatsapp_taps + a.quotes + a.compares))[0];
  const lines = [
    `${name} — ${days} derniers jours sur Moto-Scoot.tn`,
    `• ${t.calls} appel${t.calls > 1 ? 's' : ''}`,
    `• ${t.whatsapp_taps} message${t.whatsapp_taps > 1 ? 's' : ''} WhatsApp`,
    `• ${t.quotes} demande${t.quotes > 1 ? 's' : ''} de devis`,
    `• ${t.compares} comparaison${t.compares > 1 ? 's' : ''}`,
  ];
  if (top) lines.push(`Modèle le plus demandé : ${top.brand} ${top.model}`);
  return lines.join('\n');
}

/** End date after adding months to max(today, current end), YYYY-MM-DD. */
export function extendSubscription(current: string | null | undefined, months: number, today = new Date()): string {
  const t = today.toISOString().slice(0, 10);
  const base = current && /^\d{4}-\d{2}-\d{2}$/.test(current) && current > t ? current : t;
  const [y, m, d] = base.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return target.toISOString().slice(0, 10);
}

/** Days left until the end date (0 on the last day), null when none or past. */
export function daysLeft(until: string | null | undefined, today = new Date()): number | null {
  const d = String(until || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  const n = Math.round((Date.parse(d) - Date.parse(today.toISOString().slice(0, 10))) / 86_400_000);
  return n >= 0 ? n : null;
}
