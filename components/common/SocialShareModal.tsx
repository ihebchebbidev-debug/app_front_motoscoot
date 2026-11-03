import React, { useEffect, useState } from 'react';
import { X, Facebook, Linkedin, Check, MessageCircle, MessagesSquare, Link2, ImageIcon } from 'lucide-react';
import { monitoring } from '../../utils/monitoring';
import { apiClient } from '../../services/apiClient';
import { shareLink, NATIVE_SHARE_SOURCE } from '../../utils/shareLinks';
import { copyText } from '../../utils/clipboard';

/**
 * Generic, content-type-agnostic share modal (listings, articles, tips,
 * tech-specs). One click shares the page: no caption to write or paste.
 * Every network builds its own preview card (image, title, description) from
 * the page's og:* tags (<SEO /> and the prerender), so we only hand it the
 * link. The modal shows that card so the user knows what friends will see.
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
  /** Hero/cover image for the preview card. */
  image?: string;
}

export type SharePlatform = 'facebook' | 'messenger' | 'linkedin' | 'whatsapp';

interface SocialShareModalProps {
  open: boolean;
  onClose: () => void;
  content: ShareContent;
}

const SITE = 'Moto-Scoot.tn';

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

/**
 * Opens the network's own share flow with the page link:
 *  - Facebook / LinkedIn: their share dialog (URL only).
 *  - WhatsApp: wa.me with the title and the link, which unfurls into the card.
 *  - Messenger: the web send dialog needs a Facebook app id, which the site
 *    has none of. Phones get the app's deep link; desktops get the link
 *    copied and messenger.com opened, where pasting it shows the same card.
 * Resolves whether the link was copied (Messenger on desktop only).
 */
export const shareTo = async (platform: SharePlatform, content: ShareContent): Promise<{ copied?: boolean }> => {
  const url = shareLink(shareUrlFor(content), platform, content.kind);
  trackShare(platform, content);
  switch (platform) {
    case 'facebook':
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank', 'noopener,noreferrer,width=620,height=640');
      return {};
    case 'linkedin':
      window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, '_blank', 'noopener,noreferrer,width=620,height=640');
      return {};
    case 'whatsapp':
      window.open(`https://wa.me/?text=${encodeURIComponent(`${content.title}\n${url}`)}`, '_blank', 'noopener,noreferrer');
      return {};
    case 'messenger': {
      if (isTouchDevice()) {
        window.location.href = `fb-messenger://share/?link=${encodeURIComponent(url)}`;
        return {};
      }
      const copied = await copyText(url);
      window.open('https://www.messenger.com/', '_blank', 'noopener,noreferrer');
      return { copied };
    }
  }
};

/**
 * Touch devices get their own share sheet (WhatsApp, Messenger, Instagram,
 * SMS…) through the Web Share API, with the page title and link. Resolves
 * false when there is none, so the caller opens <SocialShareModal /> instead.
 * Mouse-driven desktops keep the modal.
 */
export const shareNatively = async (content: ShareContent): Promise<boolean> => {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return false;
  if (!isTouchDevice()) return false;
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

const NETWORKS: Array<{ id: SharePlatform; label: string; icon: React.ReactNode; color: string }> = [
  { id: 'facebook', label: 'Facebook', icon: <Facebook size={22} />, color: 'text-[#1877F2]' },
  { id: 'whatsapp', label: 'WhatsApp', icon: <MessageCircle size={22} />, color: 'text-[#25D366]' },
  { id: 'messenger', label: 'Messenger', icon: <MessagesSquare size={22} />, color: 'text-[#0084FF]' },
  { id: 'linkedin', label: 'LinkedIn', icon: <Linkedin size={22} />, color: 'text-[#0A66C2]' },
];

export const SocialShareModal: React.FC<SocialShareModalProps> = ({ open, onClose, content }) => {
  const [linkCopied, setLinkCopied] = useState(false);
  // Shown under the buttons: Messenger's "paste the link" hint, or the link
  // itself when the browser refused to copy it.
  const [notice, setNotice] = useState<null | 'messenger' | 'copy-blocked'>(null);
  const [imgError, setImgError] = useState(false);

  const url = shareUrlFor(content);

  useEffect(() => { setImgError(false); }, [content.image]);
  useEffect(() => { if (open) setNotice(null); }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const share = async (platform: SharePlatform) => {
    setNotice(null);
    const { copied } = await shareTo(platform, content);
    if (copied !== undefined) setNotice(copied ? 'messenger' : 'copy-blocked');
  };

  const copyLink = async () => {
    if (!(await copyText(url))) {
      setLinkCopied(false);
      setNotice('copy-blocked');
      return;
    }
    setNotice(null);
    setLinkCopied(true);
    trackShare('copy_link', content);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-0 md:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Partager"
    >
      <div
        className="bg-card w-full md:max-w-lg md:rounded-3xl rounded-t-3xl shadow-2xl border border-gray-100 overflow-hidden animate-slide-up max-h-[95vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-card z-10">
          <div>
            <h2 className="font-sans font-black text-[18px] text-foreground tracking-tight">Partager</h2>
            <p className="text-[12px] font-medium text-gray-500 mt-0.5">Choisissez où partager</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors"
            aria-label="Fermer"
          >
            <X size={20} />
          </button>
        </div>

        {/* OG Preview card — what FB/LinkedIn/WhatsApp/Messenger will render */}
        <div className="px-6 pt-5">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em]">Aperçu du partage</span>
          <div className="mt-2 rounded-2xl border border-gray-200 overflow-hidden bg-gray-50">
            <div className="aspect-[1.91/1] bg-gradient-to-br from-gray-100 to-gray-200 relative overflow-hidden">
              {content.image && !imgError ? (
                <img
                  src={content.image}
                  alt={content.title}
                  className="w-full h-full object-cover"
                  onError={() => setImgError(true)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  <ImageIcon size={42} />
                </div>
              )}
              <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur text-white text-[10px] font-bold uppercase tracking-wider">
                {SITE}
              </div>
            </div>
            <div className="px-4 py-3 bg-card">
              <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider truncate">moto-scoot.tn</div>
              <div className="text-[14px] font-extrabold text-gray-900 leading-tight line-clamp-2 mt-0.5">{content.title}</div>
              {content.subtitle && (
                <div className="text-[12px] text-gray-500 font-medium line-clamp-1 mt-0.5">{content.subtitle}</div>
              )}
            </div>
          </div>
        </div>

        {/* One click per network */}
        <div className="px-4 sm:px-6 pt-5">
          <div className="grid grid-cols-4 gap-2">
            {NETWORKS.map((n) => (
              <button
                key={n.id}
                onClick={() => share(n.id)}
                aria-label={`Partager sur ${n.label}`}
                className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl border border-gray-100 bg-gray-50 hover:bg-gray-100 hover:border-gray-200 text-gray-700 transition-all active:scale-95"
              >
                <span className={n.color}>{n.icon}</span>
                <span className="text-[10px] font-extrabold uppercase tracking-tight sm:tracking-wider">{n.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Link */}
        <div className="px-6 pt-4 pb-6 space-y-3">
          {notice === 'messenger' && (
            <p role="status" className="text-[12px] font-medium text-blue-900 leading-snug bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
              Lien copié : collez-le dans la conversation Messenger, l'aperçu s'affichera.
            </p>
          )}
          {notice === 'copy-blocked' && (
            <div role="alert" className="text-[12px] font-medium text-amber-900 leading-snug bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 space-y-2">
              <p>Ce navigateur bloque la copie automatique. Copiez le lien ci-dessous :</p>
              <input
                readOnly
                value={url}
                aria-label="Lien de la page"
                onFocus={(e) => e.currentTarget.select()}
                className="w-full px-2 py-1.5 rounded-md border border-amber-200 bg-white text-[12px] text-gray-700 outline-none"
              />
            </div>
          )}
          <button
            onClick={copyLink}
            className="w-full h-11 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-100 text-gray-700 font-bold text-[12px] uppercase tracking-wider flex items-center justify-center gap-2 transition-all"
          >
            {linkCopied ? <Check size={14} className="text-emerald-600" /> : <Link2 size={14} />}
            {linkCopied ? 'Lien copié !' : 'Copier le lien'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SocialShareModal;
