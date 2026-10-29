import React, { useEffect, useMemo, useState } from 'react';
import { X, Facebook, Instagram, Copy, Check, MessageCircle, Mail, Link2, Send } from 'lucide-react';
import { Listing } from '../../types';
import { monitoring } from '../../utils/monitoring';
import { apiClient } from '../../services/apiClient';

interface ShareModalProps {
  listing: Listing;
  open: boolean;
  onClose: () => void;
}

const TikTokIcon = ({ size = 22 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.84-.1z"/>
  </svg>
);

const XIcon = ({ size = 22 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

/**
 * Build a polished French caption tuned for each network. Instagram/TikTok
 * favour vertical, hashtag-heavy text; Facebook/WhatsApp prefer prose.
 */
const buildCaption = (listing: Listing, platform: 'facebook' | 'instagram' | 'tiktok' | 'whatsapp' | 'x' | 'email' | 'generic') => {
  const url = window.location.href;
  const title = `${listing.brand} ${listing.model}`.trim();
  const year = (listing as any).year ? ` ${(listing as any).year}` : '';
  const km = (listing as any).mileage ? ` • ${(listing as any).mileage} km` : '';
  const price = listing.price || '';
  const city = listing.location || '';

  switch (platform) {
    case 'facebook':
      return `🏍️ À vendre : ${title}${year}${km}\n💰 ${price}${city ? `\n📍 ${city}` : ''}\n\nDécouvrez tous les détails et contactez le vendeur sur Moto-Scoot.tn 👇\n${url}\n\n#MotoScootTN #${listing.brand?.replace(/\s+/g, '') || 'Moto'} #Tunisie`;

    case 'instagram':
      return `🏍️ ${title}${year} à vendre\n💰 ${price}${city ? `\n📍 ${city}` : ''}${km}\n\n👉 Lien dans la bio ou sur Moto-Scoot.tn\n\n.\n.\n.\n#MotoScootTN #motoTunisie #${listing.brand?.replace(/\s+/g, '') || 'moto'} #${listing.model?.replace(/\s+/g, '') || ''} #motoavendre #scootertunisie #occasionmoto #tunisie #𝕄𝕆𝕋𝕆 #ridetunisia`;

    case 'tiktok':
      return `${title}${year} à vendre 🏍️🔥\nPrix : ${price}${city ? ` • ${city}` : ''}\n\nPlus d'infos sur Moto-Scoot.tn\n${url}\n\n#motoscoottn #motoTunisie #${listing.brand?.replace(/\s+/g, '').toLowerCase() || 'moto'} #fyp #pourtoi #tunisie #motorcycle #occasion`;

    case 'whatsapp':
      return `Salut 👋\nJ'ai vu cette annonce sur Moto-Scoot.tn qui pourrait t'intéresser :\n\n🏍️ ${title}${year}${km}\n💰 ${price}${city ? `\n📍 ${city}` : ''}\n\n${url}`;

    case 'x':
      return `🏍️ ${title}${year} • ${price}${city ? ` • ${city}` : ''}\nÀ vendre sur @MotoScootTN 👇`;

    case 'email':
      return `Bonjour,\n\nJe voulais te partager cette annonce que j'ai trouvée sur Moto-Scoot.tn :\n\n${title}${year}${km}\nPrix : ${price}${city ? `\nLieu : ${city}` : ''}\n\nLien : ${url}\n\nÀ bientôt !`;

    default:
      return `${title}${year} à vendre sur Moto-Scoot.tn — ${price}\n${url}`;
  }
};

const trackShare = (platform: string, listingId: string | number) => {
  monitoring.trackEvent('ContentShared', { method: platform, listingId });
  apiClient.post(`/listings/${listingId}/share`, { platform }).catch(() => {});
};

export const ShareModal: React.FC<ShareModalProps> = ({ listing, open, onClose }) => {
  const [activeTab, setActiveTab] = useState<'facebook' | 'instagram' | 'tiktok' | 'whatsapp' | 'x' | 'email'>('facebook');
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const url = typeof window !== 'undefined' ? window.location.href : '';
  const caption = useMemo(() => buildCaption(listing, activeTab), [listing, activeTab]);

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
    } catch {
      /* ignore */
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      trackShare('copy_link', listing.id);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch { /* ignore */ }
  };

  /**
   * Facebook supports a real share dialog with a quote; Instagram & TikTok
   * have no web share endpoint, so the universal pattern is: copy the
   * caption to the clipboard, then open the app/site so the user can paste
   * into a new post or story.
   */
  const handlePlatformAction = async () => {
    trackShare(activeTab, listing.id);
    if (activeTab === 'facebook') {
      const fb = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(caption)}`;
      window.open(fb, '_blank', 'noopener,noreferrer,width=600,height=600');
      return;
    }
    if (activeTab === 'whatsapp') {
      const wa = `https://wa.me/?text=${encodeURIComponent(caption)}`;
      window.open(wa, '_blank', 'noopener,noreferrer');
      return;
    }
    if (activeTab === 'x') {
      const x = `https://twitter.com/intent/tweet?text=${encodeURIComponent(caption)}&url=${encodeURIComponent(url)}`;
      window.open(x, '_blank', 'noopener,noreferrer');
      return;
    }
    if (activeTab === 'email') {
      const subject = `Annonce Moto-Scoot.tn — ${listing.brand} ${listing.model}`;
      window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(caption)}`;
      return;
    }
    // Instagram / TikTok — copy then open app
    await copyCaption();
    if (activeTab === 'instagram') {
      window.open('https://www.instagram.com/', '_blank', 'noopener,noreferrer');
    } else if (activeTab === 'tiktok') {
      window.open('https://www.tiktok.com/upload', '_blank', 'noopener,noreferrer');
    }
  };

  const tabs: Array<{ id: typeof activeTab; label: string; icon: React.ReactNode; color: string }> = [
    { id: 'facebook', label: 'Facebook', icon: <Facebook size={18} />, color: 'hover:bg-[#1877F2] hover:text-white hover:border-[#1877F2]' },
    { id: 'instagram', label: 'Instagram', icon: <Instagram size={18} />, color: 'hover:bg-gradient-to-tr hover:from-[#feda75] hover:via-[#d62976] hover:to-[#4f5bd5] hover:text-white hover:border-transparent' },
    { id: 'tiktok', label: 'TikTok', icon: <TikTokIcon size={18} />, color: 'hover:bg-black hover:text-white hover:border-black' },
    { id: 'whatsapp', label: 'WhatsApp', icon: <MessageCircle size={18} />, color: 'hover:bg-[#25D366] hover:text-white hover:border-[#25D366]' },
    { id: 'x', label: 'X', icon: <XIcon size={18} />, color: 'hover:bg-black hover:text-white hover:border-black' },
    { id: 'email', label: 'Email', icon: <Mail size={18} />, color: 'hover:bg-primary-600 hover:text-white hover:border-primary-600' },
  ];

  const ctaLabel = (() => {
    switch (activeTab) {
      case 'facebook': return 'Partager sur Facebook';
      case 'instagram': return copied ? 'Texte copié — Ouvrir Instagram' : 'Copier le texte & ouvrir Instagram';
      case 'tiktok': return copied ? 'Texte copié — Ouvrir TikTok' : 'Copier le texte & ouvrir TikTok';
      case 'whatsapp': return 'Envoyer sur WhatsApp';
      case 'x': return 'Publier sur X';
      case 'email': return 'Envoyer par email';
    }
  })();

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-0 md:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Partager l'annonce"
    >
      <div
        className="bg-card w-full md:max-w-lg md:rounded-3xl rounded-t-3xl shadow-2xl border border-gray-100 overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-sans font-black text-[18px] text-foreground tracking-tight">Partager cette annonce</h2>
            <p className="text-[12px] font-medium text-gray-500 mt-0.5">Texte prêt à publier en français</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors"
            aria-label="Fermer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-6 pt-4">
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {tabs.map((t) => {
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl border transition-all ${
                    active
                      ? 'bg-primary-50 border-primary-600 text-primary-600 shadow-sm'
                      : `bg-gray-50 border-gray-100 text-gray-500 ${t.color}`
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
            <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Aperçu du post</span>
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
            className="w-full min-h-[180px] p-4 rounded-xl border border-gray-200 bg-gray-50/50 text-[13px] leading-relaxed font-medium text-gray-700 outline-none focus:border-primary-600 transition resize-none whitespace-pre-wrap"
          />
          {(activeTab === 'instagram' || activeTab === 'tiktok') && (
            <p className="text-[11px] font-medium text-gray-500 leading-snug bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              💡 {activeTab === 'instagram' ? 'Instagram' : 'TikTok'} ne permet pas le partage automatique depuis le web. Le texte sera copié — collez-le dans votre publication.
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

export default ShareModal;
