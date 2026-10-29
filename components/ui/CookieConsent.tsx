import React, { useEffect, useState } from 'react';
import { Cookie, X, Check, Settings } from 'lucide-react';

/**
 * CookieConsent
 * --------------------------------------------------------------------
 * Bandeau de consentement cookies — premium, en français, aligné sur
 * la charte (tokens sémantiques + accent primaire orange).
 *
 * - Apparaît en bas de l'écran après 800 ms (laisse le temps au LCP).
 * - Trois actions : Accepter / Refuser / Personnaliser (info uniquement).
 * - Persiste le choix dans localStorage (`motoscoot_cookie_consent`).
 * - Animation d'entrée douce, pleinement responsive (mobile-first).
 */

const STORAGE_KEY = 'motoscoot_cookie_consent';

type Choice = 'accepted' | 'rejected' | null;

function getStoredChoice(): Choice {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'accepted' || v === 'rejected') return v;
  } catch {}
  return null;
}

function persistChoice(value: 'accepted' | 'rejected') {
  try {
    localStorage.setItem(STORAGE_KEY, value);
    localStorage.setItem(`${STORAGE_KEY}_at`, new Date().toISOString());
  } catch {}
  // Notify GA4 (Consent Mode v2) so analytics_storage flips immediately.
  // Lazy-import to avoid circular deps with the visitor-tracking hook.
  import('../../services/analytics').then(({ updateAnalyticsConsent }) => {
    updateAnalyticsConsent(value === 'accepted');
  }).catch(() => {});
}

export const CookieConsent: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (getStoredChoice()) return;
    // PageSpeed: the banner was the mobile "largest paint" (render delay
    // ~2.2 s). Show it on the visitor's first interaction, or 5 s after the
    // page has fully loaded, so it never competes with the real content.
    let done = false;
    let t: number | undefined;
    const events = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const;
    const show = () => {
      if (done) return;
      done = true;
      events.forEach((e) => window.removeEventListener(e, show));
      setVisible(true);
      requestAnimationFrame(() => setMounted(true));
    };
    events.forEach((e) => window.addEventListener(e, show, { once: true, passive: true }));
    const arm = () => { t = window.setTimeout(show, 5000); };
    if (document.readyState === 'complete') arm();
    else window.addEventListener('load', arm, { once: true });
    return () => {
      done = true;
      events.forEach((e) => window.removeEventListener(e, show));
      window.removeEventListener('load', arm);
      if (t) window.clearTimeout(t);
    };
  }, []);

  const handleAccept = () => {
    persistChoice('accepted');
    closeBanner();
  };

  const handleReject = () => {
    persistChoice('rejected');
    closeBanner();
  };

  const closeBanner = () => {
    setMounted(false);
    window.setTimeout(() => setVisible(false), 250);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Préférences de cookies"
      className={[
        'fixed inset-x-0 bottom-0 z-[100] px-3 pb-3 sm:px-6 sm:pb-6 pointer-events-none',
        'transition-all duration-300 ease-out',
        mounted ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0',
      ].join(' ')}
    >
      <div
        className={[
          'pointer-events-auto mx-auto max-w-3xl',
          'rounded-2xl border border-border/70',
          'bg-card/95 backdrop-blur-xl',
          'shadow-[0_20px_60px_-15px_hsl(var(--foreground)/0.25)]',
          'overflow-hidden',
        ].join(' ')}
      >
        {/* Top accent bar */}
        <div className="h-1 w-full bg-gradient-to-r from-primary-500 via-primary to-primary-700" />

        <div className="p-5 sm:p-6">
          <div className="flex items-start gap-4">
            {/* Icon badge */}
            <div className="hidden sm:flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
              <Cookie className="h-6 w-6" aria-hidden="true" />
            </div>

            {/* Copy */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <Cookie
                  className="h-5 w-5 text-primary sm:hidden"
                  aria-hidden="true"
                />
                <h2 className="text-base sm:text-lg font-bold text-foreground tracking-tight">
                  Une expérience sur-mesure 🍪
                </h2>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Nous utilisons des cookies pour vous offrir une expérience{' '}
                <span className="font-semibold text-foreground">premium</span>{' '}
                sur MotoScoot : retenir vos préférences, sécuriser votre compte
                et vous proposer des annonces qui vous correspondent vraiment.
              </p>

              {showDetails && (
                <div className="mt-4 grid gap-2 text-xs sm:text-sm rounded-xl bg-muted/60 border border-border/60 p-4 animate-fade-in">
                  <DetailRow
                    title="Essentiels"
                    desc="Authentification, sécurité, panier — toujours actifs."
                    required
                  />
                  <DetailRow
                    title="Préférences"
                    desc="Thème, langue, recherches sauvegardées."
                  />
                  <DetailRow
                    title="Mesure & amélioration"
                    desc="Statistiques anonymes pour améliorer la plateforme."
                  />
                </div>
              )}
            </div>

            {/* Close (= refuse, since it's the safer default) */}
            <button
              type="button"
              onClick={handleReject}
              aria-label="Refuser les cookies optionnels"
              className="shrink-0 -mr-1 -mt-1 rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Actions */}
          <div className="mt-5 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
            <button
              type="button"
              onClick={() => setShowDetails((v) => !v)}
              className="inline-flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <Settings className="h-4 w-4" />
              {showDetails ? 'Masquer les détails' : 'Personnaliser'}
            </button>

            <div className="flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={handleReject}
                className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-sm font-semibold border border-border bg-background text-foreground hover:bg-muted transition-colors"
              >
                Refuser
              </button>
              <button
                type="button"
                onClick={handleAccept}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-primary to-primary-700 text-primary-foreground shadow-[0_6px_20px_-6px_hsl(var(--primary)/0.6)] hover:shadow-[0_10px_28px_-8px_hsl(var(--primary)/0.7)] hover:-translate-y-0.5 transition-all duration-200"
              >
                <Check className="h-4 w-4" />
                Tout accepter
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const DetailRow: React.FC<{
  title: string;
  desc: string;
  required?: boolean;
}> = ({ title, desc, required }) => (
  <div className="flex items-start gap-3">
    <div
      className={[
        'mt-0.5 inline-flex h-5 items-center rounded-full px-2 text-[10px] font-bold uppercase tracking-wide',
        required
          ? 'bg-primary/15 text-primary'
          : 'bg-muted text-muted-foreground border border-border',
      ].join(' ')}
    >
      {required ? 'Requis' : 'Optionnel'}
    </div>
    <div className="flex-1">
      <p className="font-semibold text-foreground">{title}</p>
      <p className="text-muted-foreground">{desc}</p>
    </div>
  </div>
);

export default CookieConsent;
