import React, { useEffect, useId, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { ChoiceSheet } from '../search/ChoiceSheet';
import { getOptimizedImageUrl } from '../../utils/urlUtils';
import { validateQuoteForm, type QuoteErrors, type QuoteForm } from '../../utils/ficheLeads';
import { requestQuote } from '../../services/techSpecLeadsApi';

/**
 * « Demande de devis » (owner, 2026-11-19): the model of the page on top,
 * then prénom, nom, téléphone, e-mail and the consent box. The server
 * stores it and e-mails the importer from devis@moto-scoot.tn (Reply-To:
 * the visitor), a copy to Moto-Scoot and a confirmation to the visitor.
 * Same sheet as Trier / Filtrer (rises from the bottom, drag to close).
 */
interface Props {
  open: boolean;
  onClose: () => void;
  specId: string | number;
  brand: string;
  model: string;
  image?: string | null;
  /** « 7 099 DT », « En arrivage »… as shown in the capsule. */
  priceText?: string;
  importerName?: string;
  pageUrl: string;
  /** Back to the « Devis » button on close. */
  returnFocus?: React.RefObject<HTMLElement | null>;
}

const EMPTY: QuoteForm = { firstName: '', lastName: '', phone: '', email: '', consent: false };
const FIELD = 'w-full h-12 px-3.5 rounded-xl border bg-card text-[16px] text-gray-900 placeholder:text-gray-500 outline-none transition-colors focus:border-gray-900 focus-visible:ring-2 focus-visible:ring-gray-900/10';
const LABEL = 'block mb-1.5 text-[14px] font-semibold text-gray-900';
const ERROR = 'mt-1.5 text-[13px] leading-5 text-red-700';

export const QuoteRequestSheet: React.FC<Props> = ({ open, onClose, specId, brand, model, image, priceText, importerName, pageUrl, returnFocus }) => {
  const [form, setForm] = useState<QuoteForm>(EMPTY);
  const [errors, setErrors] = useState<QuoteErrors>({});
  const [trap, setTrap] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [serverError, setServerError] = useState('');
  const [sentTo, setSentTo] = useState('');
  const uid = useId();
  const modelName = `${brand} ${model}`.trim();

  // A new opening after a sent request starts a fresh form.
  useEffect(() => {
    if (open && state === 'sent') { setForm(EMPTY); setState('idle'); }
    if (open) { setServerError(''); setErrors({}); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = <K extends keyof QuoteForm>(k: K, v: QuoteForm[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (state === 'sending') return;
    const found = validateQuoteForm(form);
    setErrors(found);
    const firstBad = (['firstName', 'lastName', 'phone', 'email', 'consent'] as const).find((k) => found[k]);
    if (firstBad) {
      document.getElementById(`${uid}-${firstBad}`)?.focus();
      return;
    }
    setState('sending');
    setServerError('');
    try {
      const r = await requestQuote(specId, {
        first_name: form.firstName.trim(), last_name: form.lastName.trim(),
        phone: form.phone.trim(), email: form.email.trim(),
        consent: form.consent, website: trap, page_url: pageUrl,
      });
      setSentTo(r?.importer || importerName || '');
      setState('sent');
    } catch (err: any) {
      setServerError(err?.message || 'La demande n’a pas pu être envoyée. Réessayez dans un instant.');
      setState('idle');
    }
  };

  const field = (k: 'firstName' | 'lastName' | 'phone' | 'email', label: string, extra: React.InputHTMLAttributes<HTMLInputElement>) => (
    <div>
      <label htmlFor={`${uid}-${k}`} className={LABEL}>{label}</label>
      <input
        id={`${uid}-${k}`}
        value={form[k]}
        onChange={(e) => set(k, e.target.value)}
        aria-invalid={!!errors[k] || undefined}
        aria-describedby={errors[k] ? `${uid}-${k}-err` : undefined}
        className={`${FIELD} ${errors[k] ? 'border-red-600' : 'border-gray-300'}`}
        {...extra}
      />
      {errors[k] && <p id={`${uid}-${k}-err`} className={ERROR}>{errors[k]}</p>}
    </div>
  );

  const sent = state === 'sent';

  return (
    <ChoiceSheet
      open={open}
      label={sent ? 'Demande envoyée' : 'Demande de devis'}
      onClose={onClose}
      listbox={false}
      returnFocus={returnFocus}
      footer={(
        <div className="px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-gray-100">
          {sent ? (
            <button type="button" onClick={onClose} className="w-full min-h-12 rounded-2xl bg-gray-900 text-white text-[16px] font-semibold active:scale-[0.98] transition-transform duration-100 ease-out">
              Fermer
            </button>
          ) : (
            <button
              type="submit"
              form={`${uid}-form`}
              disabled={state === 'sending'}
              className="w-full min-h-12 rounded-2xl bg-primary-700 text-white text-[16px] font-semibold active:scale-[0.98] transition-[transform,opacity] duration-100 ease-out disabled:opacity-70"
            >
              {state === 'sending' ? 'Envoi…' : 'Envoyer la demande'}
            </button>
          )}
        </div>
      )}
    >
      <div className="px-5 pt-3 pb-5">
        {/* The model of the page, filled in automatically. */}
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-gray-50">
          {image && (
            <img
              src={getOptimizedImageUrl(image, 160, 120, 80, undefined, modelName)}
              alt=""
              className="w-16 h-16 rounded-xl object-contain bg-white shrink-0"
              decoding="async"
            />
          )}
          <div className="min-w-0">
            <p className="text-[15px] leading-5 font-semibold text-gray-900 line-clamp-2">{modelName}</p>
            {priceText && <p className="mt-0.5 text-[15px] leading-5 font-bold text-primary-700 tabular-nums">{priceText}</p>}
            {importerName && <p className="mt-0.5 text-[13px] leading-5 text-gray-600">Importateur : {importerName}</p>}
          </div>
        </div>

        {sent ? (
          <div className="pt-8 pb-4 text-center" role="status">
            <CheckCircle2 size={44} className="mx-auto text-green-700" aria-hidden="true" />
            <p className="mt-3 text-[17px] font-semibold text-gray-900">Votre demande est partie</p>
            <p className="mt-1.5 text-[15px] leading-6 text-gray-600">
              {sentTo ? `${sentTo} a reçu votre demande` : 'L’importateur a reçu votre demande'} pour le {modelName} et vous recontactera.
              Un e-mail de confirmation vous a été envoyé.
            </p>
          </div>
        ) : (
          <form id={`${uid}-form`} onSubmit={submit} noValidate className="mt-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {field('firstName', 'Prénom', { autoComplete: 'given-name', enterKeyHint: 'next' })}
              {field('lastName', 'Nom', { autoComplete: 'family-name', enterKeyHint: 'next' })}
            </div>
            {field('phone', 'Téléphone', { type: 'tel', inputMode: 'tel', autoComplete: 'tel', placeholder: '22 123 456', enterKeyHint: 'next' })}
            {field('email', 'E-mail', { type: 'email', inputMode: 'email', autoComplete: 'email', autoCapitalize: 'none', spellCheck: false, placeholder: 'nom@gmail.com', enterKeyHint: 'send' })}

            {/* Trap for robots: off screen, skipped by Tab and screen readers. */}
            <div aria-hidden="true" className="absolute -left-[9999px] w-px h-px overflow-hidden">
              <label>Site web<input tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} name="website" /></label>
            </div>

            <div>
              <label htmlFor={`${uid}-consent`} className="flex items-start gap-3 min-h-11 py-1 cursor-pointer">
                <input
                  id={`${uid}-consent`}
                  type="checkbox"
                  checked={form.consent}
                  onChange={(e) => set('consent', e.target.checked)}
                  aria-invalid={!!errors.consent || undefined}
                  aria-describedby={errors.consent ? `${uid}-consent-err` : undefined}
                  className="mt-0.5 w-5 h-5 shrink-0 rounded border-gray-400 accent-primary-700"
                />
                <span className="text-[14px] leading-5 text-gray-800">J’accepte que mes coordonnées soient utilisées pour répondre à cette demande.</span>
              </label>
              {errors.consent && <p id={`${uid}-consent-err`} className={ERROR}>{errors.consent}</p>}
            </div>

            {serverError && <p role="alert" className="text-[14px] leading-5 text-red-700">{serverError}</p>}
          </form>
        )}
      </div>
    </ChoiceSheet>
  );
};

export default QuoteRequestSheet;
