import { displayPhone } from '../../utils/phoneUtils';
import React, { useState, useEffect, useCallback } from 'react';
import { Phone, ShieldCheck, Star, Store, ChevronRight, Facebook, Instagram, User, Clock, MapPin, MessageSquare, Lock, CheckCircle2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { monitoring } from '../../utils/monitoring';
import { useAppNavigation } from '../../context/NavigationContext';
import { Listing } from '../../types';
import { formatWhatsAppLink, formatMemberSince } from '../../utils/formatUtils';
import { getOptimizedImageUrl } from '../../utils/urlUtils';
import { useStartConversation } from '../../hooks/useConversations';
import { useUser } from '../../context/UserContext';
import { useToast } from '../../context/ToastContext';
import { apiClient } from '../../services/apiClient';
import { tracker } from '../../services/trackingService';
import AuthLockOverlay from '../common/AuthLockOverlay';
import { MemberSinceSkeleton } from '../ui/Skeleton';

interface ListingSellerCardProps {
  listing: Listing;
  onShare?: () => void;
  className?: string;
}

const TikTokIcon = ({ size = 20 }: { size?: number }) => (
  <img 
    src="https://www.magma-studio.tn/portfolio2/moto/icons/tiktok-icon-normal.svg" 
    alt="TikTok" 
    width={size} 
    height={size}
    className="brightness-0 invert-[0.5] group-hover:brightness-100 group-hover:invert-0 transition-all duration-300 object-contain"
  />
);

const S = {
  SidebarCard: (isPro: boolean, className: string = "") => `bg-card rounded-[24px] border ${isPro ? 'border-primary-100 border-t-4 border-t-primary-600' : 'border-gray-100'} shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden flex flex-col ${className}`,
  PriceSection: "hidden md:block px-6 py-4 bg-gray-50/50 border-b border-gray-100",
  PriceLabel: "text-[12px] font-black text-gray-400 uppercase tracking-widest mb-1 block",
  PriceValue: "text-[28px] md:text-[30px] font-black text-primary-600 tracking-tighter leading-none",
  
  SellerContent: "p-6 space-y-4 flex-1 flex flex-col",
  ProfileHeader: "flex items-center gap-4",
  LogoBox: "w-14 h-14 rounded-[100px] bg-card border border-gray-100 shadow-sm flex items-center justify-center p-1 overflow-hidden shrink-0 group-hover:border-primary-200 transition-colors",
  Avatar: "w-14 h-14 rounded-[100px] bg-gradient-to-br from-gray-900 to-gray-700 text-white flex items-center justify-center text-xl font-black shadow-inner border-2 border-white shrink-0 overflow-hidden",
  AvatarImg: "w-full h-full object-cover rounded-[100px]",
  
  SellerName: "font-sans font-[800] text-[18px] text-foreground leading-tight tracking-[0px] block mb-0.5 truncate",
  VerifiedMention: "text-[12px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5",
  
  ProStats: "flex items-center justify-between py-3 border-y border-gray-50",
  StatItem: "flex flex-col",
  StatLabel: "text-[12px] font-black text-gray-400 uppercase tracking-wider mb-0.5",
  StatValue: "text-[12px] font-extrabold text-gray-800 flex items-center gap-1",
  
  ActionStack: "hidden md:block flex flex-col gap-3 pt-2 mt-auto",
  
  ParticularLabel: "font-sans font-semibold text-[12px] text-muted-foreground leading-[14px] tracking-[0px]",
  ParticularIcon: "text-gray-400 md:text-primary-600",
  
  CallBtn: "h-14 !bg-primary-600 !text-white border !border-primary-600 !rounded-[10px] hover:!bg-primary-700 !font-extrabold !text-[12px] !tracking-[0px] !normal-case shadow-none transition-all duration-200",
  WhatsAppBtn: "h-14 !bg-primary-50 !text-primary-600 border !border-primary-600 !rounded-[10px] hover:!bg-primary-100 !font-extrabold !text-[12px] !tracking-[0px] !normal-case shadow-none transition-all duration-200",
  
  StoreAccessRow: "flex items-center justify-between p-3 bg-primary-50/50 rounded-xl border border-primary-100/50 hover:bg-primary-100 transition-all cursor-pointer group",
  SocialGrid: "grid grid-cols-3 gap-2",
  SocialBtn: (color: string) => `flex items-center justify-center h-11 bg-gray-50 rounded-xl border border-gray-100 text-gray-400 hover:text-white transition-all active:scale-95 group ${color}`
};

const WhatsAppIcon = ({ size = 20 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

export const ListingSellerCard: React.FC<ListingSellerCardProps> = ({ 
  listing,
  className,
  onShare
}) => {
  const { triggerLogin, isLoggedIn, navigateTo } = useAppNavigation();
  const { user } = useUser();
  const { addToast } = useToast();
  const [phoneRevealed, setPhoneRevealed] = useState(true);
  const [contacting, setContacting] = useState(false);
  // "Call back later" capture — desktop users without a tel: handler often
  // can't actually click-to-call. We let them leave a callback request that
  // we persist locally (and could later sync via a backend endpoint).
  const [showCallbackForm, setShowCallbackForm] = useState(false);
  const [callbackPhone, setCallbackPhone] = useState(user?.phone || '');
  const [callbackSlot, setCallbackSlot] = useState<'asap' | 'morning' | 'afternoon' | 'evening' | 'custom'>('asap');
  const [callbackTime, setCallbackTime] = useState('');
  const [callbackMessage, setCallbackMessage] = useState('');
  const [callbackSubmitting, setCallbackSubmitting] = useState(false);
  const startConversation = useStartConversation();
  const isPro = listing.sellerType === 'Pro';
  const sameId = (a: unknown, b: unknown) => a != null && b != null && String(a) === String(b);
  const canMessage =
    !!listing.sellerId && (!user?.id || !sameId(user.id, listing.sellerId));

  // ----- Callback request status tracking ---------------------------------
  // Each request lives in localStorage with a status: 'pending' | 'sent' | 'failed'.
  // We surface them inline under the form so the user always knows the state
  // of every rappel they've sent for *this listing* (and can retry failures).
  type CallbackStatus = 'pending' | 'sent' | 'failed';
  type CallbackRequest = {
    id: string;
    listingId: string | number;
    sellerId?: string | number | null;
    sellerPhone?: string | null;
    callbackPhone: string;
    slot: 'asap' | 'morning' | 'afternoon' | 'evening' | 'custom';
    customTime: string | null;
    message: string | null;
    composed: string;
    status: CallbackStatus;
    error?: string | null;
    ts: number;
  };
  const STORAGE_KEY = 'motoscoot.callbackRequests.v1';
  const [requests, setRequests] = useState<CallbackRequest[]>([]);

  // Hydrate from localStorage on mount and re-filter to this listing only.
  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      const mine = (Array.isArray(raw) ? raw : [])
        .filter((r: any) => r && String(r.listingId) === String(listing.id))
        .slice(0, 10);
      setRequests(mine);
    } catch { /* ignore */ }
  }, [listing.id]);

  // Persist a single request (insert or update) keeping at most 50 globally.
  const persistRequest = useCallback((req: CallbackRequest) => {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      const all: CallbackRequest[] = Array.isArray(raw) ? raw : [];
      const idx = all.findIndex((r) => r.id === req.id);
      if (idx >= 0) all[idx] = req; else all.unshift(req);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all.slice(0, 50)));
    } catch { /* ignore */ }
    setRequests((prev) => {
      const idx = prev.findIndex((r) => r.id === req.id);
      const next = idx >= 0 ? prev.map((r) => (r.id === req.id ? req : r)) : [req, ...prev];
      return next.slice(0, 10);
    });
  }, []);

  // Coarse mobile detection — desktop users get the callback form by default
  // because their browser likely won't dial a tel: link.
  const isLikelyMobile = typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  const handlePhoneClick = () => {
    // Persist contact intent (server dedupes per viewer/channel/1h)
    apiClient.post(`/listings/${listing.id}/contact`, { channel: 'phone' }).catch(() => {});
    try { tracker.trackListingEvent(String(listing.id), phoneRevealed ? 'call' : 'phone_reveal'); } catch {}
    if (!phoneRevealed) {
      setPhoneRevealed(true);
      monitoring.trackEvent('ListingPhoneRevealed', {
        listingId: listing.id,
        sellerType: listing.sellerType,
        seller: listing.seller,
        device: isLikelyMobile ? 'mobile' : 'desktop',
      });
      return;
    }
    monitoring.trackEvent('ListingCallInitiated', {
        seller: listing.seller,
        listingId: listing.id,
        sellerType: listing.sellerType,
        device: isLikelyMobile ? 'mobile' : 'desktop',
    });
    if (isLikelyMobile && listing.phone) {
      window.location.href = `tel:${listing.phone}`;
    } else {
      setShowCallbackForm(true);
    }
  };

  const SLOT_LABELS: Record<typeof callbackSlot, string> = {
    asap: 'Dès que possible',
    morning: 'Matin (9h–12h)',
    afternoon: 'Après-midi (12h–17h)',
    evening: 'Soirée (17h–20h)',
    custom: 'Heure précise',
  };

  // Single delivery routine — used by both initial submit and retry.
  const sendCallback = useCallback(async (req: CallbackRequest) => {
    if (!listing.sellerId) {
      const failed: CallbackRequest = { ...req, status: 'failed', error: 'Vendeur introuvable' };
      persistRequest(failed);
      addToast('Vendeur introuvable pour cette annonce.', 'error', 3000);
      return;
    }
    // Mark as in-flight so the chip flips to "En cours".
    persistRequest({ ...req, status: 'pending', error: null });
    try {
      await startConversation.mutateAsync({
        listing_id: listing.id,
        seller_id: listing.sellerId,
        message: req.composed,
      });
      persistRequest({ ...req, status: 'sent', error: null });
      monitoring.trackEvent('ListingCallbackRequested', {
        listingId: listing.id,
        sellerType: listing.sellerType,
        slot: req.slot,
        hasMessage: !!req.message,
      });
      addToast('Demande envoyée au vendeur. Il recevra votre rappel.', 'success', 4000);
    } catch (err: any) {
      const msg = err?.message || 'Échec de l\'envoi';
      persistRequest({ ...req, status: 'failed', error: msg });
      addToast(`${msg}. Vous pouvez réessayer.`, 'error', 4000);
    }
  }, [listing.id, listing.sellerId, listing.sellerType, startConversation, persistRequest, addToast]);

  const handleCallbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoggedIn) { triggerLogin(); return; }
    const cleaned = callbackPhone.replace(/[^\d+\s]/g, '').trim();
    if (cleaned.replace(/\D/g, '').length < 6) {
      addToast('Numéro invalide — entrez au moins 6 chiffres.', 'error', 3000);
      return;
    }
    if (callbackMessage.length > 500) {
      addToast('Message trop long (500 caractères max).', 'error', 3000);
      return;
    }
    if (!listing.sellerId) {
      addToast('Vendeur introuvable pour cette annonce.', 'error', 3000);
      return;
    }

    const slotLabel = callbackSlot === 'custom' && callbackTime
      ? `À ${callbackTime}`
      : SLOT_LABELS[callbackSlot];

    const composed =
      `📞 Demande de rappel\n` +
      `• Téléphone : ${cleaned}\n` +
      `• Créneau souhaité : ${slotLabel}` +
      (callbackMessage.trim() ? `\n\n${callbackMessage.trim()}` : '');

    const req: CallbackRequest = {
      id: `cb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      listingId: listing.id,
      sellerId: listing.sellerId,
      sellerPhone: listing.phone,
      callbackPhone: cleaned,
      slot: callbackSlot,
      customTime: callbackTime || null,
      message: callbackMessage.trim() || null,
      composed,
      status: 'pending',
      ts: Date.now(),
    };

    setCallbackSubmitting(true);
    try {
      await sendCallback(req);
      // Reset only the message field so users can quickly send another with
      // the same phone/slot if needed.
      setCallbackMessage('');
    } finally {
      setCallbackSubmitting(false);
    }
  };

  const handleRetry = (req: CallbackRequest) => {
    sendCallback(req);
  };


  const handleContactSeller = async () => {
    if (!isLoggedIn) { triggerLogin(); return; }
    if (!listing.sellerId) return;
    try {
      setContacting(true);
      await startConversation.mutateAsync({
        listing_id: listing.id,
        seller_id: listing.sellerId,
      });
      monitoring.trackEvent('ListingMessageInitiated', { listingId: listing.id });
      apiClient.post(`/listings/${listing.id}/contact`, { channel: 'message' }).catch(() => {});
      try { tracker.trackListingEvent(String(listing.id), 'message_seller'); } catch {}
      navigateTo('dashboard', { tab: 'messages' });
    } finally {
      setContacting(false);
    }
  };

  const whatsappLink = formatWhatsAppLink(listing.phone, `Bonjour, je suis intéressé par votre annonce ${listing.title} sur moto-scoot.tn`);

  return (
    <div id="seller-contact" className={S.SidebarCard(isPro, className)}>
      {/* SECTION PRIX */}
      <div className={S.PriceSection}>
        <span className={S.PriceLabel}>Prix de vente</span>
        <h2 className={S.PriceValue}>{listing.price}</h2>
      </div>

      {/* CONTENU VENDEUR */}
      <div className={S.SellerContent}>
        {/* PROFIL — avatar + nom + type + ancienneté + ville. Affiché pour
            tout type de vendeur (Particulier comme Pro) sur mobile et
            desktop, pour que l'acheteur identifie le vendeur avant de
            cliquer sur "Appeler". */}
        <div className="pb-4 border-b border-gray-50">
          <div className={S.ProfileHeader}>
            <div className={S.Avatar}>
              {(isPro && (listing as any).shopLogo) ? (
                <img src={getOptimizedImageUrl((listing as any).shopLogo, 120, 120, 80, undefined, listing.seller)} alt={listing.seller} className={S.AvatarImg} />
              ) : listing.sellerImage ? (
                <img src={getOptimizedImageUrl(listing.sellerImage, 120, 120, 80, undefined, listing.seller)} alt={listing.seller} className={S.AvatarImg} />
              ) : (
                <span>{(listing.seller || '?').trim().charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div className="min-w-0">
              <span className={S.VerifiedMention}>Profil</span>
              <span className={S.SellerName} title={listing.seller}>{listing.seller}</span>
            </div>
          </div>
          <ul className="mt-4 flex flex-col gap-2.5">
            <li className="flex items-center gap-2 text-[13px] font-semibold text-gray-600">
              <User size={15} className="text-primary-600 shrink-0" strokeWidth={2.25} />
              <span>{listing.sellerType}</span>
              {listing.sellerVerified && (
                <Badge variant="success" size="xs" className="ml-1 px-1.5 py-0.5 rounded-md font-extrabold tracking-[1px] text-[8px]">
                  <CheckCircle2 size={10} className="mr-0.5" /> VÉRIFIÉ
                </Badge>
              )}
            </li>
            {listing.sellerSince ? (
              <li className="flex items-center gap-2 text-[13px] font-semibold text-gray-600">
                <Clock size={15} className="text-primary-600 shrink-0" strokeWidth={2.25} />
                <span>Membre depuis {formatMemberSince(listing.sellerSince)}</span>
              </li>
            ) : (
              <li className="flex items-center gap-2"><Clock size={15} className="text-primary-600 shrink-0" strokeWidth={2.25} /><MemberSinceSkeleton /></li>
            )}
            {listing.location && (
              <li className="flex items-center gap-2 text-[13px] font-semibold text-gray-600">
                <MapPin size={15} className="text-primary-600 shrink-0" strokeWidth={2.25} />
                <span className="truncate">{listing.location}</span>
              </li>
            )}
          </ul>
        </div>

        <div className="space-y-4">

            {/* ACTIONS PRO : ACCÈS BOUTIQUE + RÉSEAUX SOCIAUX */}
            {isPro && (
              <div className="space-y-3">
                <div 
                  onClick={() => navigateTo('search', { sellerId: listing.sellerId as any, seller: listing.seller })}
                  className={S.StoreAccessRow}
                >
                  <div className="flex items-center gap-3">
                    <Store size={16} className="text-primary-600" />
                    <span className="text-[12px] font-black text-primary-900 uppercase tracking-tight">Accéder à la boutique</span>
                  </div>
                  <div className="w-6 h-6 rounded-full bg-card border border-primary-100 flex items-center justify-center text-primary-600 shadow-sm group-hover:bg-primary-600 group-hover:text-white transition-all">
                    <ChevronRight size={14} strokeWidth={3} />
                  </div>
                </div>

                {/* Boutons Réseaux Sociaux — only render if real URLs exist, gated behind login */}
                {(listing.sellerFacebook || listing.sellerInstagram || listing.sellerTiktok) && (
                  isLoggedIn ? (
                    <div className={S.SocialGrid}>
                       {listing.sellerFacebook && (
                         <a href={listing.sellerFacebook} target="_blank" rel="noopener noreferrer" className={S.SocialBtn('hover:bg-brand-facebook hover:border-brand-facebook')} aria-label="Facebook">
                            <Facebook size={20} />
                         </a>
                       )}
                       {listing.sellerInstagram && (
                         <a href={listing.sellerInstagram} target="_blank" rel="noopener noreferrer" className={S.SocialBtn('hover:bg-brand-instagram hover:border-brand-instagram')} aria-label="Instagram">
                            <Instagram size={20} />
                         </a>
                       )}
                       {listing.sellerTiktok && (
                         <a href={listing.sellerTiktok} target="_blank" rel="noopener noreferrer" className={S.SocialBtn('hover:bg-black hover:border-black')} aria-label="TikTok">
                            <TikTokIcon size={20} />
                         </a>
                       )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={triggerLogin}
                      className="group relative w-full flex items-center justify-center gap-2 h-11 rounded-xl bg-gray-50 border border-gray-100 hover:bg-primary-50 hover:border-primary-200 transition-all duration-200"
                      aria-label="Se connecter pour voir les réseaux sociaux"
                    >
                      <Lock size={14} className="text-gray-400 group-hover:text-primary-600 transition-colors" />
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-gray-500 group-hover:text-primary-600 transition-colors">
                        Connectez-vous pour voir les réseaux
                      </span>
                    </button>
                  )
                )}
              </div>
            )}
        </div>

        {/* ACTIONS BOUTONS — phone and WhatsApp are open to all visitors. */}
        <div className={S.ActionStack}>
          <div className="flex flex-col gap-3">
              <Button 
                variant="primary" 
                fullWidth
                className={`${S.CallBtn} !text-[11px]`} 
                onClick={handlePhoneClick}
                leftIcon={<Phone size={18} fill="currentColor" />}
                disabled={!listing.phone}
              >
                <span className="whitespace-nowrap">
                  {listing.phone ? displayPhone(listing.phone) : 'Téléphone indisponible'}
                </span>
              </Button>

              <a 
                href={whatsappLink} 
                target="_blank"
                rel="noreferrer"
                className="block"
              >
                <Button 
                  variant="outline" 
                  fullWidth 
                  className={S.WhatsAppBtn}
                  leftIcon={<WhatsAppIcon size={18}/>}
                  disabled={!listing.phone}
                >
                  WhatsApp
                </Button>
              </a>
          </div>

              {/* Callback capture for desktop users (or when the user clicks
                  the revealed number on a non-mobile browser). Hidden by
                  default — opened on demand via handlePhoneClick. */}
              {showCallbackForm && (
                <form onSubmit={handleCallbackSubmit} className="mt-3 p-4 rounded-xl bg-primary-50/60 border border-primary-100 space-y-3 animate-fade-in">
                  <div>
                    <p className="text-[12px] font-black text-primary-900 uppercase tracking-widest mb-1">Demander un rappel</p>
                    <p className="text-[11px] font-medium text-gray-600 leading-snug">
                      Laissez votre numéro et un créneau — le vendeur recevra votre demande dans sa messagerie.
                    </p>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">Téléphone</label>
                    <input
                      type="tel"
                      inputMode="tel"
                      value={callbackPhone}
                      onChange={(e) => setCallbackPhone(e.target.value)}
                      placeholder="Votre numéro de téléphone"
                      className="w-full px-3 h-11 rounded-lg border border-gray-200 bg-white text-sm font-bold text-gray-700 outline-none focus:border-primary-600 transition"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">Créneau souhaité</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(['asap', 'morning', 'afternoon', 'evening', 'custom'] as const).map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => setCallbackSlot(slot)}
                          className={`h-9 px-2 rounded-lg text-[11px] font-bold transition border ${
                            callbackSlot === slot
                              ? 'bg-primary-600 text-white border-primary-600'
                              : 'bg-white text-gray-700 border-gray-200 hover:border-primary-300'
                          }`}
                        >
                          {SLOT_LABELS[slot]}
                        </button>
                      ))}
                    </div>
                    {callbackSlot === 'custom' && (
                      <input
                        type="time"
                        value={callbackTime}
                        onChange={(e) => setCallbackTime(e.target.value)}
                        className="mt-2 w-full px-3 h-10 rounded-lg border border-gray-200 bg-white text-sm font-bold text-gray-700 outline-none focus:border-primary-600 transition"
                        required
                      />
                    )}
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">Message (optionnel)</label>
                    <textarea
                      value={callbackMessage}
                      onChange={(e) => setCallbackMessage(e.target.value.slice(0, 500))}
                      rows={3}
                      placeholder="Précisez votre demande, vos disponibilités…"
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 outline-none focus:border-primary-600 transition resize-none"
                    />
                    <p className="text-[10px] text-gray-400 text-right mt-0.5">{callbackMessage.length}/500</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="submit"
                      variant="primary"
                      className="!h-10 !text-[12px] !rounded-lg flex-1"
                      disabled={callbackSubmitting}
                    >
                      {callbackSubmitting ? 'Envoi…' : 'Envoyer la demande'}
                    </Button>
                    <button
                      type="button"
                      onClick={() => setShowCallbackForm(false)}
                      className="h-10 px-3 text-[12px] font-bold text-gray-500 hover:text-gray-800"
                      disabled={callbackSubmitting}
                    >
                      Annuler
                    </button>
                  </div>
                </form>
              )}
              {requests.length > 0 && (
                <div className="mt-3 space-y-2 animate-fade-in">
                  <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Vos demandes de rappel</p>
                  {requests.map((r) => {
                    const slotLabel =
                      r.slot === 'custom' && r.customTime ? `À ${r.customTime}` : SLOT_LABELS[r.slot];
                    const when = new Date(r.ts).toLocaleString('fr-FR', {
                      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                    });
                    const chip =
                      r.status === 'sent'
                        ? { label: 'Envoyée', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
                        : r.status === 'pending'
                        ? { label: 'En cours', cls: 'bg-amber-50 text-amber-700 border-amber-200' }
                        : { label: 'Échec', cls: 'bg-red-50 text-red-700 border-red-200' };
                    return (
                      <div
                        key={r.id}
                        className="p-3 rounded-xl bg-white border border-gray-100 flex items-start gap-3"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${chip.cls}`}>
                              {r.status === 'pending' && (
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse mr-1 align-middle" />
                              )}
                              {chip.label}
                            </span>
                            <span className="text-[10px] text-gray-400 font-medium">{when}</span>
                          </div>
                          <p className="text-[12px] font-bold text-gray-800 truncate">{r.callbackPhone}</p>
                          <p className="text-[11px] text-gray-500 truncate">{slotLabel}{r.message ? ` — ${r.message}` : ''}</p>
                          {r.status === 'failed' && r.error && (
                            <p className="text-[10px] text-red-600 mt-1 truncate">{r.error}</p>
                          )}
                        </div>
                        {r.status === 'failed' && (
                          <button
                            type="button"
                            onClick={() => handleRetry(r)}
                            className="text-[11px] font-bold text-primary-700 hover:text-primary-900 underline shrink-0"
                          >
                            Réessayer
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {canMessage && (
                <Button
                  variant="outline"
                  fullWidth
                  onClick={handleContactSeller}
                  disabled={contacting || startConversation.isPending}
                  leftIcon={<MessageSquare size={18} />}
                  className="h-12 mt-3 !rounded-[10px] !font-extrabold !text-[12px] !tracking-[0px] !normal-case !border-gray-200 hover:!border-primary-600 hover:!text-primary-600"
                >
                  {contacting ? 'Ouverture…' : 'Envoyer un message'}
                </Button>
          )}
        </div>
      </div>
    </div>
  );
};