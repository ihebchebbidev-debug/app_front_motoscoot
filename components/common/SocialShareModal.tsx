import React, { useEffect, useId, useRef, useState } from 'react';
import { X, Check, Copy, Link2, Mail, Share2, ImageIcon, Linkedin } from 'lucide-react';
import { siFacebook, siWhatsapp, siMessenger, siTelegram, siX, siPinterest, type SimpleIcon } from 'simple-icons';
import { monitoring } from '../../utils/monitoring';
import { apiClient } from '../../services/apiClient';
import { shareLink, NATIVE_SHARE_SOURCE } from '../../utils/shareLinks';
import { copyText } from '../../utils/clipboard';

/**
 * Generic, content-type-agnostic share modal (listings, articles, tips,
 * tech-specs). One click shares the page: no caption to write or paste.
 * Every network builds its own preview card (image, title, description) from
 * the page's og:* tags (<SEO /> and the prerender), so we only hand it the
 * link. The modal shows a compact version of that card.
 * Bottom sheet on phones, centred dialog from md up.
 */

export type ShareContentKind = 'listing' | 'article' | 'tip' | 'techspec';

export interface ShareContent {
  kind: ShareContentKind;
  /** Stable ID — used for analytics + server-side share counting. */
  id: string | number;
  /** Page title — shown on the preview card and sent with the link. */
  title: string;
  /** Optional secondary line on the preview card (e.g. "2022 • 12 000 km"). */
  subtitle?: string;
  /** Canonical URL of the page (defaults to the <link rel="canonical">). */
  url?: string;
  /** Hero/cover image for the preview card (and Pinterest's pin image). */
  image?: string;
}

export type SharePlatform = 'facebook' | 'whatsapp' | 'messenger' | 'telegram' | 'x' | 'linkedin' | 'pinterest' | 'email';

interface SocialShareModalProps {
  open: boolean;
  onClose: () => void;
  content: ShareContent;
}

const isTouchDevice = () => typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;

const trackShare = (platform: string, content: ShareContent) => {
  monitoring.trackEvent('ContentShared', {
    method: platform,
    kind: content.kind,
    id: content.id,
  });
  // Only listings have a server-side share counter today. Other kinds are
  // silently no-op tracked client-side via monitoring above.
  if (content.kind === 'listing') {
    apiClient.post(`/listings/${content.id}/share`, { platform }).catch(() => {});
  }
};

// Prefer the canonical URL set by <SEO/> over window.location — it's the
// exact URL FB/LinkedIn will scrape for og:* tags, so the share preview
// matches what the user sees in the modal.
const shareUrlFor = (content: ShareContent): string => {
  const canonical = typeof document !== 'undefined'
    ? (document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null)?.href
    : undefined;
  return content.url || canonical || (typeof window !== 'undefined' ? window.location.href : '');
};

const openPopup = (url: string) => window.open(url, '_blank', 'noopener,noreferrer,width=620,height=640');

/**
 * Opens the network's own share flow with the page link:
 *  - Facebook / LinkedIn: their share dialog (URL only).
 *  - WhatsApp, Telegram, X, e-mail: the page title and the link, which
 *    unfurls into the preview card.
 *  - Pinterest: the link, the title and the page image as the pin.
 *  - Messenger: the web send dialog needs a Facebook app id, which the site
 *    has none of. Phones get the app's deep link; desktops get the link
 *    copied and messenger.com opened, where pasting it shows the same card.
 * Resolves whether the link was copied (Messenger on desktop only).
 */
export const shareTo = async (platform: SharePlatform, content: ShareContent): Promise<{ copied?: boolean }> => {
  const url = shareLink(shareUrlFor(content), platform, content.kind);
  const link = encodeURIComponent(url);
  const title = encodeURIComponent(content.title);
  trackShare(platform, content);
  switch (platform) {
    case 'facebook':
      openPopup(`https://www.facebook.com/sharer/sharer.php?u=${link}`);
      return {};
    case 'linkedin':
      openPopup(`https://www.linkedin.com/sharing/share-offsite/?url=${link}`);
      return {};
    case 'x':
      openPopup(`https://x.com/intent/post?url=${link}&text=${title}`);
      return {};
    case 'pinterest': {
      const media = content.image ? `&media=${encodeURIComponent(new URL(content.image, url).href)}` : '';
      openPopup(`https://www.pinterest.com/pin/create/button/?url=${link}&description=${title}${media}`);
      return {};
    }
    case 'whatsapp':
      window.open(`https://wa.me/?text=${encodeURIComponent(`${content.title}\n${url}`)}`, '_blank', 'noopener,noreferrer');
      return {};
    case 'telegram':
      window.open(`https://t.me/share/url?url=${link}&text=${title}`, '_blank', 'noopener,noreferrer');
      return {};
    case 'email':
      window.location.href = `mailto:?subject=${title}&body=${encodeURIComponent(`${content.title}\n${url}`)}`;
      return {};
    case 'messenger': {
      if (isTouchDevice()) {
        window.location.href = `fb-messenger://share/?link=${link}`;
        return {};
      }
      const copied = await copyText(url);
      window.open('https://www.messenger.com/', '_blank', 'noopener,noreferrer');
      return { copied };
    }
  }
};

/**
 * The device's own share sheet (WhatsApp, Instagram, SMS…) through the Web
 * Share API, with the page title and link. Resolves false when there is none
 * or it failed — not when the user simply closed it.
 */
const openDeviceShare = async (content: ShareContent): Promise<boolean> => {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return false;
  const data: ShareData = { title: content.title, text: content.title, url: shareLink(shareUrlFor(content), NATIVE_SHARE_SOURCE, content.kind) };
  if (navigator.canShare && !navigator.canShare(data)) return false;
  try {
    await navigator.share(data);
    trackShare('native', content);
    return true;
  } catch (e) {
    // Closing the sheet is the user's choice: don't open the modal on top of it.
    return (e as DOMException)?.name === 'AbortError';
  }
};

/**
 * Touch devices go straight to their share sheet; resolves false when there
 * is none, so the caller opens <SocialShareModal /> instead. Mouse-driven
 * desktops keep the modal (it offers the device sheet too, as "Plus d'options").
 */
export const shareNatively = async (content: ShareContent): Promise<boolean> =>
  isTouchDevice() ? openDeviceShare(content) : false;

/** Simple Icons logo (CC0), drawn in the current text colour. */
const BrandLogo: React.FC<{ icon: SimpleIcon; size?: number }> = ({ icon, size = 26 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true" focusable="false">
    <path d={icon.path} />
  </svg>
);

// `tint`: logo in the brand colour on a 10 % wash of it. LinkedIn is not in
// Simple Icons (removed at the brand's request), so it keeps lucide's icon.
const NETWORKS: Array<{ id: SharePlatform; label: string; logo: React.ReactNode; tint: string }> = [
  { id: 'facebook', label: 'Facebook', logo: <BrandLogo icon={siFacebook} />, tint: 'text-[#0866FF] bg-[#0866FF]/10' },
  { id: 'whatsapp', label: 'WhatsApp', logo: <BrandLogo icon={siWhatsapp} />, tint: 'text-[#25D366] bg-[#25D366]/10' },
  { id: 'messenger', label: 'Messenger', logo: <BrandLogo icon={siMessenger} />, tint: 'text-[#0866FF] bg-[#0866FF]/10' },
  { id: 'telegram', label: 'Telegram', logo: <BrandLogo icon={siTelegram} />, tint: 'text-[#26A5E4] bg-[#26A5E4]/10' },
  { id: 'x', label: 'X', logo: <BrandLogo icon={siX} size={22} />, tint: 'text-black bg-black/[0.06] dark:text-white dark:bg-white/10' },
  { id: 'linkedin', label: 'LinkedIn', logo: <Linkedin size={24} />, tint: 'text-[#0A66C2] bg-[#0A66C2]/10' },
  { id: 'pinterest', label: 'Pinterest', logo: <BrandLogo icon={siPinterest} />, tint: 'text-[#BD081C] bg-[#BD081C]/10' },
  { id: 'email', label: 'E-mail', logo: <Mail size={24} />, tint: 'text-primary-600 bg-primary-50' },
];

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2 focus-visible:ring-offset-card';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea, select, [tabindex]:not([tabindex="-1"])';

/** Keeps Tab / Shift+Tab cycling inside the modal panel. */
const trapFocus = (e: KeyboardEvent, panel: HTMLElement | null) => {
  if (!panel) return;
  const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)];
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  const inside = panel.contains(document.activeElement);
  if (e.shiftKey && (!inside || document.activeElement === first)) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && (!inside || document.activeElement === last)) {
    e.preventDefault();
    first.focus();
  }
};

export const SocialShareModal: React.FC<SocialShareModalProps> = ({ open, onClose, content }) => {
  const titleId = useId();
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'blocked'>('idle');
  const [messengerHint, setMessengerHint] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [canUseDeviceShare, setCanUseDeviceShare] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const linkRef = useRef<HTMLInputElement>(null);

  const url = shareUrlFor(content);

  useEffect(() => { setImgError(false); }, [content.image]);
  useEffect(() => {
    if (!open) return;
    setCopyState('idle');
    setMessengerHint(false);
    setCanUseDeviceShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }, [open]);
  useEffect(() => {
    if (copyState !== 'copied') return;
    const t = setTimeout(() => setCopyState('idle'), 2000);
    return () => clearTimeout(t);
  }, [copyState]);

  // Keyboard and screen-reader users: focus moves into the modal when it
  // opens and goes back to the button that opened it when it closes. Kept
  // apart from the effect below, which re-runs whenever onClose changes.
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => { opener?.focus?.(); };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') trapFocus(e, panelRef.current);
    };
    window.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  // The browser refused to copy: select the link so the user can copy it.
  const showBlockedCopy = () => {
    setCopyState('blocked');
    linkRef.current?.focus();
    linkRef.current?.select();
  };

  const share = async (platform: SharePlatform) => {
    setMessengerHint(false);
    const { copied } = await shareTo(platform, content);
    if (copied === true) setMessengerHint(true);
    if (copied === false) showBlockedCopy();
  };

  const copyLink = async () => {
    if (!(await copyText(url))) {
      showBlockedCopy();
      return;
    }
    setCopyState('copied');
    trackShare('copy_link', content);
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in motion-reduce:animate-none md:p-4"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full md:max-w-md bg-card rounded-t-[28px] md:rounded-[28px] shadow-2xl max-h-[92vh] overflow-y-auto overscroll-contain pb-[max(1.5rem,env(safe-area-inset-bottom))] animate-fade-in-up md:animate-scale-in motion-reduce:animate-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Bottom-sheet grabber (phones) */}
        <div aria-hidden="true" className="md:hidden mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-gray-200" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-3 md:pt-6">
          <h2 id={titleId} className="font-sans font-black text-[20px] text-foreground tracking-tight">Partager</h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className={`-mr-2 grid h-10 w-10 place-items-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors ${FOCUS_RING}`}
            aria-label="Fermer"
          >
            <X size={22} />
          </button>
        </div>

        {/* Compact preview: what the networks will show */}
        <div className="mx-6 mt-3 flex items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-2.5">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-gray-200">
            {content.image && !imgError ? (
              <img src={content.image} alt="" className="h-full w-full object-cover" onError={() => setImgError(true)} />
            ) : (
              <div className="grid h-full w-full place-items-center text-gray-400"><ImageIcon size={24} /></div>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">moto-scoot.tn</p>
            <p className="line-clamp-2 text-[14px] font-extrabold leading-snug text-gray-900">{content.title}</p>
            {content.subtitle && <p className="truncate text-[12px] font-medium text-gray-500">{content.subtitle}</p>}
          </div>
        </div>

        {/* One click per network */}
        <ul className="mt-6 grid grid-cols-4 gap-x-1 gap-y-5 px-3 sm:px-5">
          {NETWORKS.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => share(n.id)}
                aria-label={`Partager sur ${n.label}`}
                className={`group flex w-full flex-col items-center gap-2 rounded-2xl py-1 ${FOCUS_RING}`}
              >
                <span className={`grid h-14 w-14 sm:h-16 sm:w-16 place-items-center rounded-full transition-transform duration-150 group-hover:scale-105 group-active:scale-95 motion-reduce:transition-none ${n.tint}`}>
                  {n.logo}
                </span>
                <span className="text-[12px] font-semibold text-gray-700">{n.label}</span>
              </button>
            </li>
          ))}
        </ul>

        {messengerHint && (
          <p className="mx-6 mt-4 rounded-xl bg-[#0866FF]/10 px-3 py-2 text-[12px] font-medium text-blue-900 dark:text-blue-100">
            Lien copié : collez-le dans la conversation Messenger, l'aperçu s'affichera.
          </p>
        )}

        {/* Copy link */}
        <div aria-hidden="true" className="mt-6 flex items-center gap-3 px-6 text-[11px] font-bold uppercase tracking-widest text-gray-400">
          <span className="h-px flex-1 bg-gray-200" />
          ou copier le lien
          <span className="h-px flex-1 bg-gray-200" />
        </div>
        <div className="mx-6 mt-3 flex items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50 p-1.5 pl-3 focus-within:border-primary-600 transition-colors">
          <Link2 size={18} aria-hidden="true" className="shrink-0 text-gray-400" />
          <input
            ref={linkRef}
            readOnly
            value={url}
            aria-label="Lien de la page"
            onFocus={(e) => e.currentTarget.select()}
            className="min-w-0 flex-1 bg-transparent text-[13px] text-gray-700 text-ellipsis outline-none"
          />
          <button
            type="button"
            onClick={copyLink}
            className={`flex h-10 shrink-0 items-center gap-1.5 rounded-xl px-4 text-[13px] font-bold text-white transition-colors ${FOCUS_RING} ${
              copyState === 'copied' ? 'bg-emerald-600' : 'bg-primary-600 hover:bg-primary-700'
            }`}
          >
            {copyState === 'copied' ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
            {copyState === 'copied' ? 'Copié' : 'Copier'}
          </button>
        </div>
        {copyState === 'blocked' && (
          <p role="alert" className="mx-6 mt-2 text-[12px] font-medium text-amber-800 dark:text-amber-300">
            Ce navigateur bloque la copie automatique : le lien est sélectionné, copiez-le (appui long ou Ctrl+C).
          </p>
        )}
        <p role="status" className="sr-only">
          {copyState === 'copied' ? 'Lien copié' : messengerHint ? 'Lien copié pour Messenger' : ''}
        </p>

        {/* The device's own sheet: Instagram, SMS… */}
        {canUseDeviceShare && (
          <div className="px-6 mt-3">
            <button
              type="button"
              onClick={() => openDeviceShare(content)}
              className={`flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-gray-200 text-[13px] font-bold text-gray-700 hover:bg-gray-50 transition-colors ${FOCUS_RING}`}
            >
              <Share2 size={16} aria-hidden="true" />
              Plus d'options (Instagram, SMS…)
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SocialShareModal;
