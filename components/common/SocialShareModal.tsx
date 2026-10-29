import React, { useEffect, useMemo, useState } from 'react';
import { X, Facebook, Instagram, Linkedin, Copy, Check, MessageCircle, Link2, Send, ImageIcon } from 'lucide-react';
import { monitoring } from '../../utils/monitoring';
import { apiClient } from '../../services/apiClient';

/**
 * Generic, content-type-agnostic social share modal.
 *
 * Why this exists
 * ---------------
 * Listings, articles, tips, and tech-specs all need the same "share to FB /
 * LinkedIn / Instagram / WhatsApp" UX. Each platform has very different
 * sharing semantics:
 *   - Facebook & LinkedIn: real share dialog, scrape the URL's OG tags
 *     server-side. We just need to pass the URL — the OG image/title come
 *     from the page's <meta og:*> tags (set by <SEO />).
 *   - WhatsApp: text-only deep link; the URL inside the text auto-expands
 *     into a preview card on mobile/desktop using the OG tags.
 *   - Instagram: no public web share endpoint at all. The only working
 *     pattern is "copy the caption + open Instagram so the user pastes".
 *
 * The OG image (og:image) is the single most important thing for a polished
 * share — that's what becomes the preview banner on every network. We
 * surface a live preview of it inside the modal so the user knows exactly
 * what their friends will see before they hit "Share".
 */

export type ShareContentKind = 'listing' | 'article' | 'tip' | 'techspec';

export interface ShareContent {
  kind: ShareContentKind;
  /** Stable ID — used for analytics + server-side share counting. */
  id: string | number;
  /** Headline shown in modal + used in captions. */
  title: string;
  /** Optional secondary line (e.g. "Yamaha MT-07 2022 • 12 000 km"). */
  subtitle?: string;
  /** Optional short summary used in long-form captions (FB/LinkedIn). */
  summary?: string;
  /** Canonical URL of the page (defaults to window.location.href). */
  url?: string;
  /** Hero/cover image — also used as og:image fallback for the preview. */
  image?: string;
  /** Optional 1-3 hashtag-friendly keywords (e.g. ['Yamaha','MT07']). */
  tags?: string[];
}

interface SocialShareModalProps {
  open: boolean;
  onClose: () => void;
  content: ShareContent;
}

type Platform = 'facebook' | 'linkedin' | 'instagram' | 'whatsapp';

const SITE = 'Moto-Scoot.tn';

const kindLabel = (k: ShareContentKind) => {
  switch (k) {
    case 'listing': return { fr: 'annonce', emoji: '🏍️' };
    case 'article': return { fr: 'article', emoji: '📰' };
    case 'tip': return { fr: 'guide', emoji: '💡' };
    case 'techspec': return { fr: 'fiche technique', emoji: '⚙️' };
  }
};

const buildHashtags = (content: ShareContent): string => {
  const base = ['MotoScootTN', 'Tunisie'];
  const extra = (content.tags || [])
    .map((t) => t.replace(/[^A-Za-z0-9À-ÿ]+/g, ''))
    .filter(Boolean);
  return [...base, ...extra].slice(0, 6).map((t) => `#${t}`).join(' ');
};

const buildCaption = (content: ShareContent, platform: Platform, url: string): string => {
  const { emoji, fr } = kindLabel(content.kind);
  const head = `${emoji} ${content.title}`;
  const sub = content.subtitle ? `\n${content.subtitle}` : '';
  const sum = content.summary ? `\n\n${content.summary}` : '';
  const tags = buildHashtags(content);

  switch (platform) {
    case 'facebook':
      return `${head}${sub}${sum}\n\n👉 Lire / voir sur ${SITE}\n${url}\n\n${tags}`;

    case 'linkedin':
      return `${head}${sub}${sum}\n\nDécouvrez cette ${fr} sur ${SITE} — la 1ʳᵉ marketplace tunisienne dédiée aux motos & scooters.\n\n${url}\n\n${tags}`;

    case 'instagram':
      return `${head}${sub}${sum}\n\n👉 Lien dans la bio · ${SITE}\n\n.\n.\n.\n${tags} #motoTunisie #scootertunisie #ridetunisia`;

    case 'whatsapp':
      return `Salut 👋\nÀ voir sur ${SITE} :\n\n${head}${sub}${content.summary ? `\n\n${content.summary}` : ''}\n\n${url}`;
  }
};

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

export const SocialShareModal: React.FC<SocialShareModalProps> = ({ open, onClose, content }) => {
  const [activeTab, setActiveTab] = useState<Platform>('facebook');
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [imgError, setImgError] = useState(false);

  // Prefer the canonical URL set by <SEO/> over window.location — it's the
  // exact URL FB/LinkedIn will scrape for og:* tags, so the share preview
  // matches what the user sees in the modal.
  const canonical = typeof document !== 'undefined'
    ? (document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null)?.href
    : undefined;
  const url = content.url || canonical || (typeof window !== 'undefined' ? window.location.href : '');
  const caption = useMemo(() => buildCaption(content, activeTab, url), [content, activeTab, url]);

  useEffect(() => { setImgError(false); }, [content.image]);

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

  const copyCaption = async () => {
    try {
      await navigator.clipboard.writeText(caption);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      trackShare('copy_link', content);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch { /* ignore */ }
  };

  /**
   * Per-platform deep-link strategy:
   *  - Facebook: sharer.php with `quote` (caption appears pre-filled).
   *  - LinkedIn: share-offsite uses only the URL — LinkedIn fetches OG tags.
   *    We auto-copy the caption so users can paste a richer commentary.
   *  - WhatsApp: wa.me with the text — the URL inside it auto-expands into
   *    a preview using OG tags.
   *  - Instagram: no web share endpoint exists. Copy + open the app.
   */
  const handlePlatformAction = async () => {
    trackShare(activeTab, content);
    if (activeTab === 'facebook') {
      const u = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(caption)}`;
      window.open(u, '_blank', 'noopener,noreferrer,width=620,height=640');
      return;
    }
    if (activeTab === 'linkedin') {
      await copyCaption();
      const u = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
      window.open(u, '_blank', 'noopener,noreferrer,width=620,height=640');
      return;
    }
    if (activeTab === 'whatsapp') {
      const u = `https://wa.me/?text=${encodeURIComponent(caption)}`;
      window.open(u, '_blank', 'noopener,noreferrer');
      return;
    }
    // Instagram — no web share endpoint
    await copyCaption();
    window.open('https://www.instagram.com/', '_blank', 'noopener,noreferrer');
  };

  const tabs: Array<{ id: Platform; label: string; icon: React.ReactNode; brand: string }> = [
    { id: 'facebook', label: 'Facebook', icon: <Facebook size={18} />, brand: 'hover:bg-[#1877F2] hover:text-white hover:border-[#1877F2]' },
    { id: 'linkedin', label: 'LinkedIn', icon: <Linkedin size={18} />, brand: 'hover:bg-[#0A66C2] hover:text-white hover:border-[#0A66C2]' },
    { id: 'instagram', label: 'Instagram', icon: <Instagram size={18} />, brand: 'hover:bg-gradient-to-tr hover:from-[#feda75] hover:via-[#d62976] hover:to-[#4f5bd5] hover:text-white hover:border-transparent' },
    { id: 'whatsapp', label: 'WhatsApp', icon: <MessageCircle size={18} />, brand: 'hover:bg-[#25D366] hover:text-white hover:border-[#25D366]' },
  ];

  const ctaLabel = (() => {
    switch (activeTab) {
      case 'facebook': return 'Partager sur Facebook';
      case 'linkedin': return copied ? 'Texte copié — Ouvrir LinkedIn' : 'Copier le texte & ouvrir LinkedIn';
      case 'instagram': return copied ? 'Texte copié — Ouvrir Instagram' : 'Copier le texte & ouvrir Instagram';
      case 'whatsapp': return 'Envoyer sur WhatsApp';
    }
  })();

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
            <p className="text-[12px] font-medium text-gray-500 mt-0.5">Texte & visuel prêts à publier</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors"
            aria-label="Fermer"
          >
            <X size={20} />
          </button>
        </div>

        {/* OG Preview card — exactly what FB/LinkedIn/WhatsApp will render */}
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

        {/* Tabs */}
        <div className="px-6 pt-5">
          <div className="grid grid-cols-4 gap-2">
            {tabs.map((t) => {
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl border transition-all ${
                    active
                      ? 'bg-primary-50 border-primary-600 text-primary-600 shadow-sm'
                      : `bg-gray-50 border-gray-100 text-gray-500 ${t.brand}`
                  }`}
                  aria-pressed={active}
                >
                  {t.icon}
                  <span className="text-[10px] font-extrabold uppercase tracking-wider">{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Caption preview */}
        <div className="px-6 py-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Texte du post</span>
            <button
              type="button"
              onClick={copyCaption}
              className="flex items-center gap-1.5 text-[11px] font-extrabold text-primary-600 hover:text-primary-700 transition-colors"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copié !' : 'Copier'}
            </button>
          </div>
          <textarea
            readOnly
            value={caption}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full min-h-[160px] p-4 rounded-xl border border-gray-200 bg-gray-50/50 text-[13px] leading-relaxed font-medium text-gray-700 outline-none focus:border-primary-600 transition resize-none whitespace-pre-wrap"
          />
          {activeTab === 'instagram' && (
            <p className="text-[11px] font-medium text-gray-500 leading-snug bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              💡 Instagram ne permet pas le partage automatique depuis le web. Le texte sera copié — collez-le dans votre publication ou story.
            </p>
          )}
          {activeTab === 'linkedin' && (
            <p className="text-[11px] font-medium text-gray-500 leading-snug bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
              💼 LinkedIn récupère automatiquement l'image et le titre. Le texte sera copié — collez-le comme commentaire pour un post plus engageant.
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 space-y-3">
          <button
            onClick={handlePlatformAction}
            className="w-full h-12 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-extrabold text-[13px] uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-md"
          >
            <Send size={16} />
            {ctaLabel}
          </button>
          <button
            onClick={copyLink}
            className="w-full h-11 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-100 text-gray-700 font-bold text-[12px] uppercase tracking-wider flex items-center justify-center gap-2 transition-all"
          >
            {linkCopied ? <Check size={14} className="text-emerald-600" /> : <Link2 size={14} />}
            {linkCopied ? 'Lien copié !' : 'Copier uniquement le lien'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SocialShareModal;
