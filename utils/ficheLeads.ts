/**
 * Fiche technique contact buttons (owner, 2026-11-19): WhatsApp link,
 * « Demande de devis » form checks and the tab-scoped id that lets the
 * server count one person tapping several times as one.
 */

/** wa.me link with a ready-made message naming the model and its page. */
export function whatsappHref(number: string | null | undefined, model: string, pageUrl: string): string | null {
  let digits = String(number || '').replace(/[^\d]/g, '');
  if (!digits) return null;
  if (digits.startsWith('00')) digits = digits.slice(2);
  // Tunisian 8-digit number without the country code.
  if (digits.length === 8) digits = `216${digits}`;
  const text = `Bonjour, je suis intéressé(e) par le ${model} vu sur Moto-Scoot.tn : ${pageUrl}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export interface QuoteForm { firstName: string; lastName: string; phone: string; email: string; consent: boolean }
export type QuoteErrors = Partial<Record<keyof QuoteForm, string>>;

/** Same rules as the server (techSpecLeadsController.validateQuote). */
export function validateQuoteForm(f: QuoteForm): QuoteErrors {
  const e: QuoteErrors = {};
  if (!f.firstName.trim()) e.firstName = 'Indiquez votre prénom.';
  if (!f.lastName.trim()) e.lastName = 'Indiquez votre nom.';
  if (!/^\+?[0-9]{8,15}$/.test(f.phone.replace(/[\s().-]/g, ''))) e.phone = 'Numéro à 8 chiffres au moins, par exemple 22 123 456.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim())) e.email = 'Adresse e-mail incomplète, par exemple nom@gmail.com.';
  if (!f.consent) e.consent = 'Cochez la case pour que l’importateur puisse vous répondre.';
  return e;
}

/** Random id kept for this tab only (no cookie, nothing personal). */
export function leadSessionId(): string {
  const key = 'ms_lead_session';
  try {
    let id = sessionStorage.getItem(key);
    if (!id) {
      id = (crypto.randomUUID?.() || `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`).slice(0, 64);
      sessionStorage.setItem(key, id);
    }
    return id;
  } catch {
    return '';
  }
}
