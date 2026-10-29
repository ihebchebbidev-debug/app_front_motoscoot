import { displayPhone } from '../utils/phoneUtils';
import React, { useEffect, useState, useCallback } from 'react';
import { 
  Heart, Share2, Phone, FileText, ArrowLeft, ChevronRight, ShieldCheck, AlertCircle, Home, Clock, Cog, AlertTriangle, X, CheckCircle2, ShieldAlert
} from 'lucide-react';
import { Badge } from './ui/Badge';
import { BasePageProps } from '../types';
import SEO from './common/SEO';
import { slugify, getUrlFromState } from '../utils/urlUtils';
import { useListing } from '../hooks/useListing';
import { useListingActions } from '../hooks/useListingActions';
import { useOptionalAppNavigation, type NavigationContextType } from '../context/NavigationContext';
import { Reveal } from './ui/Reveal';
import { useToast } from '../context/ToastContext';

// Organismes
import { ListingGallery } from './listing/ListingGallery';
import { ListingSpecs } from './listing/ListingSpecs';

import { ListingSimilarAds } from './listing/ListingSimilarAds';
import { ListingDetailsSkeleton } from './listing/ListingDetailsSkeleton';
import { ListingSidebar } from './listing/ListingSidebar';
import { ListingSellerCard } from './listing/ListingSellerCard';
import { Button } from './ui/Button';
import { formatWhatsAppLink } from '../utils/formatUtils';
import AdBanner from './common/AdBanner';
import { ListingStatsWidget } from './listing/ListingStatsWidget';
import { ListingViewsBadge } from './listing/ListingViewsBadge';
import SocialShareModal from './common/SocialShareModal';
import { useUser } from '../context/UserContext';
import { reportsApi } from '../services/miscApi';
import { tokenStorage } from '../services/apiClient';
import { trackRecentlyViewed } from '../utils/recentSearches';
import { tracker } from '../services/trackingService';

const S = {
  Wrapper: "min-h-screen bg-muted font-sans pb-32 md:pb-20",
  Container: "max-w-[1440px] mx-auto px-6 md:px-16 lg:px-32 pt-0 md:pt-4",
  Header: "flex items-center justify-between mb-4 md:mb-6",
  Breadcrumb: "flex items-center gap-1.5 md:gap-2 text-[11px] md:text-[13px] font-medium text-gray-400",
  BackBtn: "p-1.5 md:p-2 bg-card border border-gray-100 rounded-lg md:rounded-xl text-gray-700 hover:text-primary-600 shadow-sm transition-all active:scale-95",
  
  MainGrid: "grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-10",
  ContentCol: "md:col-span-7 xl:col-span-8 space-y-6",
  ContentBlock: "bg-card rounded-2xl border border-gray-100 overflow-hidden shadow-sm",
  BlockHeader: "w-full flex items-center justify-between px-6 md:px-8 py-4 md:py-6 text-left border-b border-gray-50/50",
  BlockTitle: "font-sans text-[16px] font-extrabold text-foreground leading-[20px] tracking-normal normal-case text-left flex items-center gap-3",
  BlockBody: "px-6 md:px-8 pt-3 pb-6 md:pt-4 md:pb-8 animate-fade-in",
  MobileFooter: "fixed bottom-0 left-0 right-0 z-[110] bg-card/95 backdrop-blur-xl border-t border-gray-100 p-4 md:hidden flex gap-3 safe-area-bottom shadow-[0_-10px_30px_rgba(0,0,0,0.05)]",
  MobileActionBtn: (variant: 'primary' | 'success') => {
    const base = "flex-1 h-14 rounded-[10px] flex items-center justify-center gap-2 transition-all active:scale-95";
    if (variant === 'primary') {
      return `${base} bg-primary-600 text-white border border-primary-600 hover:bg-primary-700 font-sans font-extrabold text-[12px] tracking-[0px] normal-case`;
    }
    return `${base} bg-primary-50 text-primary-600 border border-primary-600 hover:bg-primary-100 font-sans font-extrabold text-[12px] tracking-[0px] normal-case`;
  },
  NotFound: "flex flex-col items-center justify-center py-20 md:py-32 text-center space-y-6 animate-fade-in",
  
  // Styles Modale Signalement
  ModalOverlay: "fixed inset-0 z-[300] bg-gray-900/60 backdrop-blur-md flex items-end md:items-center justify-center p-0 md:p-6 animate-fade-in",
  ModalContent: "bg-card w-full max-w-lg rounded-t-[2.5rem] md:rounded-[2.5rem] overflow-hidden shadow-2xl animate-fade-in-up flex flex-col max-h-[90vh]",
};

const WhatsAppIcon = ({ size = 20 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

const FALLBACK_NAVIGATION: Pick<NavigationContextType, 'navigateTo' | 'goBack' | 'isLoggedIn' | 'triggerLogin'> = {
  navigateTo: (view, params = {}) => {
    const target = getUrlFromState(view, params);
    if (typeof window !== 'undefined') window.location.assign(target);
  },
  goBack: () => {
    if (typeof window === 'undefined') return;
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    window.location.assign(getUrlFromState('home'));
  },
  isLoggedIn: !!tokenStorage.get(),
  triggerLogin: () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('app:trigger-login'));
    }
  },
};

const reportReasons = [
  { value: 'fraud', label: 'Annonce frauduleuse / Arnaque' },
  { value: 'duplicate', label: 'Véhicule déjà vendu' },
  { value: 'wrong_category', label: 'Informations ou prix erronés' },
  { value: 'inappropriate', label: 'Photos trompeuses ou volées' },
  { value: 'inappropriate', label: 'Contenu inapproprié ou offensant' },
  { value: 'other', label: 'Autre raison' },
];

const ListingDetails: React.FC<BasePageProps> = ({ listingId }) => {
  const optionalNavigation = useOptionalAppNavigation();
  const navigation = optionalNavigation ?? {
    ...FALLBACK_NAVIGATION,
    isLoggedIn: !!tokenStorage.get(),
  };

  const { navigateTo, goBack, isLoggedIn, triggerLogin } = navigation;
  const { addToast } = useToast();
  const { data: listing, isLoading, isError } = useListing(listingId);
  const { user } = useUser();
  const isOwner = !!user && !!listing?.sellerId && String(user.id) === String(listing.sellerId);
  
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [isReporting, setIsReporting] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);

  const { 
    handleFavoriteToggle, 
    handlePhoneAction, 
    handleWhatsAppAction, 
    isFavorited 
  } = useListingActions({ listing });

  // Open the rich share modal instead of the OS share sheet so we can offer
  // ready-to-post French captions tuned per network (FB / IG / TikTok / etc.)
  const handleShare = useCallback(() => setIsShareOpen(true), []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [listingId]);

  useEffect(() => {
    if (listing) {
      const canonicalPath = getUrlFromState('listing-details', { id: listing.id, title: listing.title });
      const currentPath = window.location.pathname;
      if (currentPath !== canonicalPath) {
        window.history.replaceState(null, '', canonicalPath);
      }
      // Log to recently-viewed so the Similar Ads block can re-rank by
      // the buyer's recent browsing history.
      trackRecentlyViewed({
        id: listing.id as any,
        brand: listing.brand,
        model: listing.model,
        type: listing.type,
      });
      // Analytics — listing detail view (fingerprint + session).
      try { tracker.trackListingView(String(listing.id)); } catch {}
    }
  }, [listing]);

  const handleOpenReport = useCallback(() => {
    if (!isLoggedIn) {
      triggerLogin();
      return;
    }
    setIsReportModalOpen(true);
  }, [isLoggedIn, triggerLogin]);

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportReason || !listing) return;

    setIsReporting(true);
    try {
      await reportsApi.create({
        listing_id: listing.id,
        reason: reportReason,
        details: reportDetails || undefined,
      });
      setIsReportModalOpen(false);
      setReportReason("");
      setReportDetails("");
      addToast("Signalement envoyé. Nos modérateurs vont examiner l'annonce.", "success", 5000);
    } catch (err: any) {
      const msg = err?.data?.error || err?.message || "Erreur lors de l'envoi du signalement. Veuillez réessayer.";
      addToast(msg, "error");
    } finally {
      setIsReporting(false);
    }
  };

  const images = listing?.images || (listing ? [listing.image] : []);

  const listingPriceValue = listing
    ? (typeof listing.price === 'number' ? listing.price : parseInt(String(listing.price).replace(/[^\d]/g, ''), 10) || undefined)
    : undefined;
  // Vehicle/Product JSON-LD for Google rich results + LLM understanding.
  const productSchema = listing ? {
    "@context": "https://schema.org",
    "@type": "Vehicle",
    name: listing.title,
    description: listing.description,
    image: images,
    brand: { "@type": "Brand", name: listing.brand },
    model: listing.model,
    vehicleModelDate: (listing as any).year ? String((listing as any).year) : undefined,
    mileageFromOdometer: (listing as any).mileage ? {
      "@type": "QuantitativeValue",
      value: (listing as any).mileage,
      unitCode: "KMT",
    } : undefined,
    offers: listingPriceValue ? {
      "@type": "Offer",
      priceCurrency: "TND",
      price: listingPriceValue,
      availability: "https://schema.org/InStock",
      url: `https://www.moto-scoot.tn${getUrlFromState('listing-details', { id: listing.id, title: listing.title })}`,
      areaServed: { "@type": "Country", name: "Tunisia" },
    } : undefined,
  } : null;

  if (!isLoading && (isError || !listing)) {
    return (
      <div className={S.Wrapper}>
        <SEO title="Annonce introuvable • moto-scoot.tn" description="L'annonce que vous recherchez n'existe pas ou a été supprimée." noIndex />
        <div className={S.Container}>
          <div className={S.NotFound}>
            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-[2.5rem] flex items-center justify-center mb-4 shadow-sm border border-red-100">
              <AlertCircle size={40} />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl md:text-4xl font-extrabold text-gray-900 tracking-normal leading-tight">Oups ! Cette annonce est introuvable</h1>
              <p className="text-gray-500 max-w-md mx-auto font-medium text-sm md:text-base">Il se peut que l'annonce ait été supprimée par le vendeur ou que le lien soit expiré.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button variant="primary" onClick={() => navigateTo('search')} size="lg" className="rounded-2xl px-10 h-14 font-extrabold">
                Voir toutes les annonces
              </Button>
              <Button variant="outline" onClick={() => navigateTo('home')} size="lg" className="rounded-2xl px-10 h-14 font-extrabold" leftIcon={<Home size={18} />}>
                Retour à l'accueil
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={S.Wrapper}>
      {listing && (
        <SEO 
          title={`${listing.title} • Occasion en Tunisie`} 
          description={listing.description}
          image={listing.image}
          url={getUrlFromState('listing-details', { id: listing.id, title: listing.title })}
          type="product"
          schema={productSchema || undefined}
          keywords={[listing.brand, listing.model, listing.type, 'occasion', 'Tunisie', listing.location].filter(Boolean) as string[]}
          breadcrumbs={[
            { name: 'Accueil', url: '/' },
            { name: 'Annonces', url: '/annonces' },
            { name: listing.brand, url: `/annonces?brand=${encodeURIComponent(listing.brand)}` },
            { name: listing.title, url: getUrlFromState('listing-details', { id: listing.id, title: listing.title }) },
          ]}
        />
      )}

      <div className={S.Container}>
        {/* Navigation Header */}
        <header className={S.Header}>
           <div className="flex items-center gap-3 md:gap-4">
              <button onClick={goBack} className={S.BackBtn} aria-label="Retour"><ArrowLeft size={16} className="md:w-5 md:h-5"/></button>
              <nav className={S.Breadcrumb}>
                 <span className="flex items-center gap-1 hover:text-primary-600 cursor-pointer" onClick={() => navigateTo('home')}>
                   <Home size={12} className="md:w-3.5 md:h-3.5" /> Accueil
                 </span>
                 <ChevronRight size={12} className="md:w-3.5 md:h-3.5 text-gray-300"/>
                 <span className="hover:text-primary-600 cursor-pointer" onClick={() => navigateTo('search')}>Annonces</span>
                 <ChevronRight size={12} className="md:w-3.5 md:h-3.5 text-gray-300"/>
                 <span className="text-gray-900 font-extrabold truncate max-w-[100px] md:max-w-none">{isLoading ? '...' : listing?.brand}</span>
              </nav>
           </div>
        </header>

        {isLoading ? (
          <ListingDetailsSkeleton />
        ) : listing && (
          <div className={S.MainGrid}>
            {/* Colonne de gauche : Galerie et Détails */}
            <div className={S.ContentCol}>
              <ListingGallery 
                images={images} 
                title={listing.title} 
                brand={listing.brand}
                model={listing.model}
                favorited={isFavorited} 
                onFavoriteToggle={handleFavoriteToggle} 
                onShare={handleShare}
              />

              <Reveal animation="fade-in-up" delay={100}>
                <div className="pt-0">
                    <div className="mb-4 md:mb-8">
                      {/* Titre Mobile Uniquement */}
                      <div className="md:hidden">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-sans text-[14px] font-bold text-primary-600 tracking-[0px]">
                            {listing.brand}
                          </span>
                          <span className="font-sans text-[18px] font-extrabold text-primary-600 tracking-[0px]">
                            {listing.price}
                          </span>
                        </div>
                        <h1 className="font-sans text-[24px] font-extrabold text-foreground leading-tight tracking-[0px]">
                          {listing.model}
                        </h1>
                      </div>

                      {/* Titre Desktop */}
                      <h1 className="hidden md:block font-sans text-[24px] md:text-[28px] font-extrabold text-foreground leading-[30px] md:leading-[40px] tracking-normal uppercase text-left">
                        {listing.brand} {listing.model}
                      </h1>
                      
                      <div className="flex items-center gap-2 text-gray-400 text-[12px] md:text-[12px] font-bold tracking-widest mt-1">
                        <Clock size={14}/> Publiée {listing.date}
                      </div>
                    </div>
                    
                    <ListingSpecs 
                      year={listing.year} 
                      mileage={listing.mileage} 
                      cc={listing.cc} 
                      condition={listing.condition} 
                      type={listing.type}
                      attributes={listing.attributes}
                    />
                </div>
              </Reveal>

              <div className="space-y-4 md:space-y-6">
                  {/* PERFORMANCE — Pro owner only.
                      Particuliers don't see any stats here; they get the
                      basic dashboard summary instead. Pros keep the full
                      analytics widget (views, favs, contacts, shares,
                      14-day sparklines, conversion). */}
                  {isOwner && (() => {
                    const isPro =
                      typeof user?.memberType === 'string' &&
                      user.memberType.trim().toLowerCase() === 'pro';
                    if (!isPro) return null;
                    return (
                      <Reveal animation="fade-in-up" delay={150}>
                        <ListingStatsWidget listingId={listing.id} />
                      </Reveal>
                    );
                  })()}


                  {/* CARACTÉRISTIQUES ACCESSOIRE — merged inline into the
                      ListingSpecs grid above (État + Catégorie + Taille + …)
                      so accessory specs sit on the same row instead of being
                      isolated in a separate Caractéristiques card. */}

                  {/* DESCRIPTION */}
                  <Reveal animation="fade-in-up" delay={200}>
                    <div className={S.ContentBlock}>
                      <div className="flex items-stretch border-b border-gray-50/50 h-14 md:h-16">
                        <div className="w-[12%] md:w-[49px] flex items-center justify-center border-r border-gray-100 bg-gray-50/20 shrink-0">
                          <FileText size={22} className="text-primary-600" strokeWidth={2.5} />
                        </div>
                        <div className="flex-1 flex items-center px-[10px] md:px-[14px]">
                          <span className="font-sans text-[16px] font-extrabold text-foreground">Description</span>
                        </div>
                      </div>
                      <div className={S.BlockBody}>
                          <p className="font-sans text-foreground font-normal text-[15px] leading-[22px] tracking-normal normal-case whitespace-pre-line">
                            {listing.description || "Véhicule en excellent état, carnet d'entretien à jour. Aucun frais à prévoir."}
                          </p>
                      </div>
                    </div>
                  </Reveal>

                  {/* ÉQUIPEMENTS */}
                  {listing.equipment && listing.equipment.length > 0 && (
                    <Reveal animation="fade-in-up" delay={300}>
                      <div className={S.ContentBlock}>
                        <div className="flex items-stretch border-b border-gray-50/50 h-14 md:h-16">
                          <div className="w-[12%] md:w-[49px] flex items-center justify-center border-r border-gray-100 bg-gray-50/20 shrink-0">
                            <Cog size={22} className="text-primary-600" strokeWidth={2.5} />
                          </div>
                          <div className="flex-1 flex items-center px-[10px] md:px-[14px]">
                            <span className="font-sans text-[16px] font-extrabold text-foreground">Équipements</span>
                          </div>
                        </div>
                        <div className={S.BlockBody}>
                            <div className="flex flex-wrap gap-2">
                              {listing.equipment.map((eq, i) => (
                                  <Badge 
                                    key={i} 
                                    variant="default" 
                                    className="px-3 py-1.5 rounded-xl bg-muted border-gray-100 text-foreground text-[12px] font-semibold leading-[23px] tracking-[0px] normal-case"
                                  >
                                    {eq}
                                  </Badge>
                              ))}
                            </div>
                        </div>
                      </div>
                    </Reveal>
                  )}
              </div>
            </div>

            {/* Sidebar : Vendeur, Prix, Pub et Réassurance */}
            <ListingSidebar 
              listing={listing} 
              onShare={handleShare} 
              onReport={handleOpenReport}
            />
            
            <div className="md:col-span-12">
              <ListingSimilarAds 
                currentListingId={listing.id} 
                brand={listing.brand} 
                type={listing.type}
                price={listing.price}
                onNavigate={navigateTo}
                isLoading={isLoading}
                isLoggedIn={isLoggedIn}
                onTriggerLogin={triggerLogin}
              />
            </div>
          </div>
        )}
      </div>

      {/* MODALE DE PARTAGE */}
      {listing && (
        <SocialShareModal
          open={isShareOpen}
          onClose={() => setIsShareOpen(false)}
          content={{
            kind: 'listing',
            id: listing.id,
            title: `${listing.brand ?? ''} ${listing.model ?? ''}`.trim(),
            subtitle: [
              (listing as any).year,
              (listing as any).mileage ? `${(listing as any).mileage} km` : null,
              listing.price,
              listing.location,
            ].filter(Boolean).join(' • '),
            summary: (listing as any).description?.slice(0, 220),
            image: Array.isArray((listing as any).images) ? (listing as any).images[0] : (listing as any).image,
            tags: [listing.brand, listing.model].filter(Boolean) as string[],
          }}
        />
      )}

      {/* MODALE DE SIGNALEMENT */}
      {isReportModalOpen && (
        <div className={S.ModalOverlay} onClick={(e) => e.target === e.currentTarget && setIsReportModalOpen(false)}>
          <div className={S.ModalContent}>
            <div className="flex items-center justify-between p-6 md:p-8 border-b border-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
                  <ShieldAlert size={22} />
                </div>
                <div>
                  <h3 className="text-lg md:text-xl font-black text-gray-900 leading-tight">Signaler l'annonce</h3>
                  <p className="text-[12px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Votre aide est précieuse</p>
                </div>
              </div>
              <button onClick={() => setIsReportModalOpen(false)} className="p-2 bg-gray-50 rounded-full hover:bg-gray-100 transition-colors">
                <X size={20} className="text-gray-500" strokeWidth={3} />
              </button>
            </div>

            <form onSubmit={handleSubmitReport} className="p-6 md:p-8 space-y-6 overflow-y-auto no-scrollbar">
              <div className="space-y-4">
                <label className="text-[12px] font-black text-primary-600 uppercase tracking-widest ml-1">Pourquoi signalez-vous cette annonce ?</label>
                <div className="grid grid-cols-1 gap-2">
                  {reportReasons.map((reason) => (
                    <button
                      key={reason.label}
                      type="button"
                      onClick={() => setReportReason(reason.value)}
                      className={`flex items-center justify-between p-4 rounded-2xl border transition-all text-left group ${
                        reportReason === reason.value 
                          ? 'border-orange-500 bg-orange-50 text-orange-900 shadow-sm' 
                          : 'border-gray-100 bg-gray-50 text-gray-600 hover:border-orange-200'
                      }`}
                    >
                      <span className="text-sm font-bold">{reason.label}</span>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                        reportReason === reason.value ? 'border-orange-600 bg-orange-600' : 'border-gray-200 bg-card'
                      }`}>
                        {reportReason === reason.value && <CheckCircle2 size={12} className="text-white" strokeWidth={4} />}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[12px] font-black text-primary-600 uppercase tracking-widest ml-1">Précisions (Optionnel)</label>
                <textarea
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  placeholder="Décrivez brièvement le problème..."
                  rows={3}
                  className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-medium focus:bg-card focus:border-orange-500 outline-none transition-all resize-none"
                />
              </div>

              <div className="bg-blue-50 p-4 rounded-2xl flex gap-3 border border-blue-100/50">
                <ShieldCheck size={18} className="text-blue-600 shrink-0 mt-0.5" />
                <p className="text-[12px] font-medium text-blue-700 leading-relaxed">
                  Ce signalement sera traité de manière anonyme. Nos modérateurs examineront cette annonce sous 2h ouvrées. Merci pour votre vigilance.
                </p>
              </div>

              <div className="pt-4 flex gap-3">
                <Button 
                  variant="ghost" 
                  type="button" 
                  fullWidth 
                  onClick={() => setIsReportModalOpen(false)}
                  className="rounded-2xl h-14 font-black"
                >
                  Annuler
                </Button>
                <Button 
                  variant="primary" 
                  type="submit" 
                  fullWidth 
                  disabled={!reportReason || isReporting}
                  isLoading={isReporting}
                  className="rounded-2xl h-14 font-black shadow-xl"
                >
                  Envoyer
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {!isLoading && listing && (
        <div className={S.MobileFooter}>
          <button onClick={handlePhoneAction} className={S.MobileActionBtn('primary')} disabled={!listing.phone}>
              <Phone size={16} fill="currentColor"/> {listing.phone ? displayPhone(listing.phone) : 'Téléphone indisponible'}
          </button>
          <a 
              href={formatWhatsAppLink(listing.phone, `Bonjour, je suis intéressé par votre annonce ${listing.title}`)} 
              target="_blank"
              rel="noreferrer"
              className={S.MobileActionBtn('success')}
              onClick={handleWhatsAppAction}
          >
              <WhatsAppIcon size={18} /> WhatsApp
          </a>
        </div>
      )}
    </div>
  );
};

export default ListingDetails;