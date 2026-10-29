import React, { useEffect, useMemo, useState } from 'react';
import { 
  MapPin, 
  Phone, 
  Star, 
  ShieldCheck, 
  CheckCircle2,
  ChevronRight,
  Clock,
  Store,
  Facebook,
  Instagram,
  MessageCircle,
  Map,
  ThumbsUp,
  MoreVertical,
  User,
  ArrowLeft,
  Home
} from 'lucide-react';
import { useGarage, useGarageReviews, useSubmitGarageReview } from '../hooks/useGarages';
import { useReplyToGarageReview } from '../hooks/useAdmin';
import { useListings } from '../hooks/useListings';
import { useSubmitSiteReview } from '../hooks/useSiteReviews';
import { useToast } from '../context/ToastContext';
import SEO from './common/SEO';
import AdBanner from './common/AdBanner';
import AuthLockOverlay from './common/AuthLockOverlay';
import { useNativeShare } from '../hooks/useNativeShare';
import { ReviewModal } from './ReviewModal';
import { publishedReviewAverage, verifiedReviewMarkup } from '../utils/reviewUtils';

const GarageDetails: React.FC<any> = ({ garageId, onNavigate, isLoggedIn, onTriggerLogin }) => {
  const { data: fetchedGarage } = useGarage(garageId);
  const { data: listingsResp } = useListings({ limit: 100 });
  const relatedListings = listingsResp?.listings ?? [];
  const { data: backendReviews = [] } = useGarageReviews(garageId);
  const submitGarageReview = useSubmitGarageReview(garageId);
  const submitSiteReview = useSubmitSiteReview();
  const replyToReview = useReplyToGarageReview(garageId);
  const { addToast } = useToast();
  const garage = fetchedGarage;
  const share = useNativeShare();
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [replyingToIndex, setReplyingToIndex] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');

  useEffect(() => { window.scrollTo(0, 0); }, [garageId]);

  type ReviewType = {
    id?: number;
    name: string;
    date: string;
    verified: boolean;
    rating: number;
    text: string;
    likes: number;
    ownerReply?: { text: string; date: string };
  };

  const reviews = useMemo<ReviewType[]>(() => {
    if (!backendReviews.length) return [];
    return backendReviews.map((r: any) => ({
      id: r.id,
      name: r.author_name || r.name || 'Utilisateur',
      date: r.created_at ? new Date(r.created_at).toLocaleDateString('fr-FR') : '',
      verified: !!r.is_verified,
      rating: Number(r.rating) || 0,
      text: r.content || r.text || '',
      likes: r.helpful_count || 0,
      ownerReply: r.owner_reply
        ? { text: r.owner_reply, date: r.owner_reply_at ? new Date(r.owner_reply_at).toLocaleDateString('fr-FR') : '' }
        : undefined,
    }));
  }, [backendReviews]);
  const averageRating = publishedReviewAverage(reviews);

  // Backend exposes `is_owner` on the garage payload when the authenticated user owns it
  const isOwner = !!(garage as any)?.is_owner;

  const handleShare = () => {
    if (!garage) return;
    share({
      title: `${garage.name} - Expert Moto`,
      text: garage.description || `Découvrez ${garage.name} sur moto-scoot.tn`,
      url: window.location.href,
    });
  };

  const handleOpenReviewModal = () => {
    if (!isLoggedIn) {
      onTriggerLogin?.();
      return;
    }
    setIsReviewModalOpen(true);
  };

  const handleReviewSubmit = async (newReview: { name: string; rating: number; text: string }) => {
    try {
      // Persist to the garage AND publish a public testimonial in parallel
      await Promise.all([
        submitGarageReview.mutateAsync({ rating: newReview.rating, content: newReview.text }),
        submitSiteReview.mutateAsync({
          rating: newReview.rating,
          content: newReview.text,
          role: garage ? `Client de ${garage.name}` : undefined,
        }).catch(() => null), // site-review is best-effort
      ]);
      addToast('Merci ! Votre avis a été publié.', 'success');
      setIsReviewModalOpen(false);
    } catch (err: any) {
      addToast(err?.message || "Impossible d'envoyer l'avis. Réessayez.", 'error');
    }
  };

  const handleReplySubmit = async (index: number) => {
    const review = reviews[index];
    const trimmed = replyText.trim();
    if (!review?.id) {
      addToast('Avis invalide.', 'error');
      return;
    }
    if (!trimmed) {
      addToast('Veuillez écrire une réponse.', 'error');
      return;
    }
    try {
      await replyToReview.mutateAsync({ reviewId: review.id, reply: trimmed });
      addToast('Votre réponse a été publiée.', 'success');
      setReplyingToIndex(null);
      setReplyText('');
    } catch (err: any) {
      addToast(err?.message || "Impossible d'envoyer la réponse.", 'error');
    }
  };

  if (!garage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted text-center px-6">
        <div>
          <SEO title="Garage introuvable" description="Cette page n'existe pas ou n'est plus disponible." noIndex />
          <h1 className="text-2xl font-black text-gray-900 mb-2">Garage introuvable</h1>
          <p className="text-gray-500 text-sm">Ce garage n'existe pas ou n'est plus disponible.</p>
        </div>
      </div>
    );
  }

  // Fallback presentation data (until backend exposes per-garage services/pricing)
  const servicesCles = garage.specialties && garage.specialties.length
    ? garage.specialties
    : ['Diagnostic', 'Entretien', 'Réparation', 'Pieces detachés', 'Accesoires', 'Vente scooter'];
  const tarifs = garage.services && garage.services.length
    ? garage.services.map((s: any) => ({ name: s.name, price: s.price ? `${s.price} DT` : 'Sur devis' }))
    : [
        { name: 'Vidange + controle', price: 'À partir de 45 DT' },
        { name: 'Changement chaine', price: 'Sur devis' },
        { name: 'Diagnostic Valise', price: '60 DT' },
        { name: 'Montage Pneumatique...', price: '15 DT / roue' },
      ];

  const garageListings = relatedListings.slice(0, 3);

  return (
    <div className="min-h-screen bg-muted font-sans pb-12">
      <SEO
        title={`${garage.name} - Expert Moto`}
        description={(garage as any).description || `${garage.name} - Garage moto expert en Tunisie. Services, tarifs, avis clients et coordonnées.`}
        image={garage.image}
        schema={{
          "@context": "https://schema.org",
          "@type": "AutoRepair",
          name: garage.name,
          image: garage.image ? [garage.image] : undefined,
          description: (garage as any).description,
          telephone: (garage as any).phone,
          address: {
            "@type": "PostalAddress",
            streetAddress: (garage as any).address,
            addressLocality: (garage as any).city,
            addressCountry: "TN",
          },
          geo: ((garage as any).lat && (garage as any).lng) ? {
            "@type": "GeoCoordinates",
            latitude: (garage as any).lat,
            longitude: (garage as any).lng,
          } : undefined,
          ...verifiedReviewMarkup(backendReviews),
          areaServed: { "@type": "Country", name: "Tunisia" },
        }}
      />
      
      <div className="max-w-[1280px] mx-auto px-4 md:px-6 pt-6">
        {/* Navigation Header */}
        <header className="flex items-center justify-between mb-4 md:mb-6">
           <div className="flex items-center gap-3 md:gap-4">
              <button onClick={() => onNavigate?.('garages')} className="p-1.5 md:p-2 bg-card border border-gray-100 rounded-lg md:rounded-xl text-gray-700 hover:text-primary-600 shadow-sm transition-all active:scale-95" aria-label="Retour"><ArrowLeft size={16} className="md:w-5 md:h-5"/></button>
              <nav className="flex items-center gap-1.5 md:gap-2 text-[11px] md:text-[13px] font-medium text-gray-400">
                 <span className="flex items-center gap-1 hover:text-primary-600 cursor-pointer" onClick={() => onNavigate?.('home')}>
                   <Home size={12} className="md:w-3.5 md:h-3.5" /> Accueil
                 </span>
                 <ChevronRight size={12} className="md:w-3.5 md:h-3.5 text-gray-300"/>
                 <span className="hover:text-primary-600 cursor-pointer" onClick={() => onNavigate?.('garages')}>Garages</span>
                 <ChevronRight size={12} className="md:w-3.5 md:h-3.5 text-gray-300"/>
                 <span className="hover:text-primary-600 cursor-pointer">Tunisie</span>
                 <ChevronRight size={12} className="md:w-3.5 md:h-3.5 text-gray-300"/>
                 <span className="text-gray-900 font-extrabold truncate max-w-[100px] md:max-w-none">{garage.name}</span>
              </nav>
           </div>
        </header>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-[20px] md:text-[30px] font-black text-gray-900 tracking-tight leading-none">{garage.name}</h1>
            {garage.isVerified && (
              <div className="text-green-600">
                <ShieldCheck size={24} className="fill-green-50" />
              </div>
            )}
            <div className="flex items-center gap-1.5 bg-green-50 px-2.5 py-1 rounded-md border border-green-100">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-[10px] font-black text-green-700 uppercase tracking-widest">Ouvert</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5 text-[16px] font-normal">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star key={star} size={14} className={star <= Math.floor(garage.rating) ? "text-warning-400 fill-warning-400" : "text-gray-200 fill-gray-200"} />
              ))}
            </div>
            <span className="text-[10px] font-bold text-gray-400">{(garage.rating ?? 0).toFixed(1)} / 5.0 • {reviews.length} AVIS</span>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* Hero Image */}
            <div className="w-full h-[200px] md:h-[400px] rounded-3xl overflow-hidden shadow-sm">
              <img src={garage.image} alt={garage.name} className="w-full h-full object-cover" />
            </div>

            {/* L'EXPERTISE DU GARAGE */}
            <div className="bg-card rounded-3xl p-8 border border-gray-100 shadow-sm">
              <h2 className="text-[15px] font-black text-gray-900 uppercase tracking-widest mb-2">L'expertise du garage</h2>
              <div className="w-12 h-1 bg-primary-600 rounded-full mb-6"></div>
              <p className="text-[15px] text-gray-600 leading-relaxed font-medium">
                Réparation et Maintenance de Scooter, Maxiscooter et Moto. Spécialiste certifié Yamaha et Honda. Nous utilisons uniquement des pièces d'origine pour garantir la longévité de votre deux-roues.
              </p>
            </div>

            {/* SERVICES */}
            <div className="bg-card rounded-3xl p-8 border border-gray-100 shadow-sm">
              <h2 className="text-[15px] font-black text-gray-900 uppercase tracking-widest mb-2">Services</h2>
              <div className="w-12 h-1 bg-primary-600 rounded-full mb-6"></div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {servicesCles.map((service, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <CheckCircle2 size={20} className="text-green-500" />
                    <span className="text-[15px] font-bold text-gray-800">{service}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* TARIFS DES PRESTATIONS */}
            <div className="bg-card rounded-3xl p-8 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-[15px] font-black text-gray-900 uppercase tracking-widest">Tarifs des prestations</h2>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50 px-3 py-1 rounded-full border border-gray-100">* TARIFS INDICATIFS</span>
              </div>
              <div className="w-12 h-1 bg-primary-600 rounded-full mb-6"></div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-6 mb-8">
                {tarifs.map((tarif, idx) => (
                  <div key={idx} className="flex items-center justify-between border-b border-gray-50 pb-4">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 size={18} className="text-green-500" />
                      <span className="text-[14px] font-bold text-gray-700">{tarif.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-black text-primary-600">{tarif.price}</span>
                      <ChevronRight size={16} className="text-gray-300" />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between bg-gray-50 rounded-2xl p-4 border border-gray-100 gap-4">
                <div className="flex items-center gap-3">
                  <ShieldCheck size={24} className="text-green-500" />
                  <span className="text-[13px] font-medium text-gray-600">Garantie sur toutes les interventions effectuées dans<br/>notre atelier.</span>
                </div>
                <button className="w-full sm:w-auto bg-success-500 hover:bg-success-600 text-white px-6 py-3 rounded-xl font-black text-[13px] uppercase tracking-widest transition-colors flex items-center justify-center gap-2">
                  <MessageCircle size={18} />
                  Rendez vous
                </button>
              </div>
            </div>

            {/* ARTICLES LES PLUS CONSULTÉS */}
            <div className="bg-card rounded-3xl p-8 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-[15px] font-black text-gray-900 uppercase tracking-widest">Articles les plus consultés</h2>
                <span className="text-[10px] font-bold text-primary-600 uppercase tracking-widest bg-orange-50 px-3 py-1 rounded-full border border-orange-100 cursor-pointer hover:bg-orange-100 transition-colors">Visiter notre boutique</span>
              </div>
              <div className="w-12 h-1 bg-primary-600 rounded-full mb-6"></div>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {garageListings.map((listing) => (
                  <div key={listing.id} className="group cursor-pointer" onClick={() => onNavigate?.('listing-details', { id: listing.id })}>
                    <div className="relative aspect-[4/3] rounded-2xl overflow-hidden mb-3">
                      <img src={listing.images?.[0] || listing.image} alt={listing.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      <div className="absolute bottom-2 left-2 bg-card/90 backdrop-blur-sm px-2 py-1 rounded-lg text-[11px] font-black text-primary-600">
                        {listing.price.toLocaleString()} TND
                      </div>
                    </div>
                    <h3 className="text-[14px] font-bold text-gray-900 mb-1 line-clamp-1">{listing.title}</h3>
                    <div className="flex items-center gap-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                      <span className="flex items-center gap-1"><Clock size={12} /> {listing.year}</span>
                      <span className="flex items-center gap-1"><MapPin size={12} /> {(listing.mileage ?? 0).toLocaleString()} KM</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* AVIS CLIENTS */}
            <div className="mt-12">
              <div className="flex items-center gap-3 mb-8">
                <MessageCircle size={24} className="text-primary-600" />
                <h2 className="text-[20px] font-black text-gray-900 uppercase tracking-widest">Avis clients ({reviews.length})</h2>
              </div>

              {/* Overall Rating Card */}
              <div className="bg-card rounded-3xl p-8 border border-gray-100 shadow-sm mb-6 flex flex-col md:flex-row items-center justify-between gap-8">
                <div className="flex items-center gap-8 w-full md:w-auto">
                  <div className="text-center">
                    <div className="text-[48px] font-black text-gray-900 leading-none mb-2">{averageRating === null ? '—' : averageRating.toFixed(1)}</div>
                    <div className="flex items-center gap-1 justify-center mb-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star key={star} size={14} className={star <= Math.round(averageRating ?? 0) ? "text-warning-400 fill-warning-400" : "text-gray-200 fill-gray-200"} />
                      ))}
                    </div>
                    <div className="text-[12px] font-bold text-gray-400 uppercase tracking-widest">{reviews.length} avis</div>
                  </div>
                  
                  <div className="flex-1 space-y-2">
                    {[5, 4, 3, 2, 1].map((rating) => (
                      <div key={rating} className="flex items-center gap-3">
                        <span className="text-[12px] font-bold text-gray-500 w-2">{rating}</span>
                        <div className="w-32 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-warning-400 rounded-full" 
                            style={{ width: `${reviews.length ? reviews.filter(review => review.rating === rating).length / reviews.length * 100 : 0}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="w-full md:w-auto text-center md:text-right border-t md:border-t-0 md:border-l border-gray-100 pt-6 md:pt-0 md:pl-8">
                  <div className="text-[14px] font-bold text-gray-900 mb-3">Vous connaissez ce garage ?</div>
                  <button 
                    onClick={handleOpenReviewModal}
                    className="w-full md:w-auto bg-card border border-gray-200 hover:border-gray-300 text-gray-900 px-6 py-2.5 rounded-xl font-bold text-[13px] transition-colors"
                  >
                    Donner mon avis
                  </button>
                </div>
              </div>

              {/* Reviews List */}
              <div className="space-y-4">
                {reviews.length === 0 && (
                  <div className="bg-card rounded-3xl p-8 border border-gray-100 shadow-sm text-center">
                    <p className="text-[14px] font-medium text-gray-500">
                      Aucun avis pour le moment. Soyez le premier à partager votre expérience !
                    </p>
                  </div>
                )}
                {reviews.map((review, idx) => (
                  <div key={idx} className="bg-card rounded-3xl p-6 border border-gray-100 shadow-sm">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                          <User size={20} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-900 text-[15px]">{review.name}</span>
                          </div>
                          <div className="flex items-center gap-2 text-[12px]">
                            <span className="text-gray-400">{review.date}</span>
                            {review.verified && (
                              <span className="flex items-center gap-1 text-green-600 font-medium">
                                <ShieldCheck size={12} /> Client vérifié
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button className="text-gray-400 hover:text-gray-600">
                        <MoreVertical size={20} />
                      </button>
                    </div>
                    
                    <div className="flex items-center gap-0.5 mb-3">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star key={star} size={14} className={star <= review.rating ? "text-warning-400 fill-warning-400" : "text-gray-200 fill-gray-200"} />
                      ))}
                    </div>
                    
                    <p className="text-[14px] text-gray-600 leading-relaxed mb-4">
                      {review.text}
                    </p>
                    
                    {review.ownerReply && (
                      <div className="mt-4 mb-4 bg-gray-50 p-4 rounded-2xl border border-gray-100 relative">
                        <div className="absolute -top-2 left-6 w-4 h-4 bg-gray-50 border-t border-l border-gray-100 transform rotate-45"></div>
                        <div className="flex items-center gap-2 mb-2">
                          <Store size={14} className="text-primary-600" />
                          <span className="text-[13px] font-bold text-gray-900">Réponse du propriétaire</span>
                          <span className="text-[11px] text-gray-400 ml-auto">{review.ownerReply.date}</span>
                        </div>
                        <p className="text-[13px] text-gray-600 leading-relaxed">
                          {review.ownerReply.text}
                        </p>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-4">
                      <button className="flex items-center gap-2 text-[12px] font-bold text-gray-500 hover:text-gray-900 transition-colors">
                        <ThumbsUp size={14} /> Utile ({review.likes})
                      </button>
                      {isOwner && !review.ownerReply && (
                        <button 
                          onClick={() => { setReplyingToIndex(idx); setReplyText(""); }}
                          className="flex items-center gap-2 text-[12px] font-bold text-primary-600 hover:text-orange-700 transition-colors"
                        >
                          <MessageCircle size={14} /> Répondre
                        </button>
                      )}
                    </div>

                    {replyingToIndex === idx && (
                      <div className="mt-4 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                        <textarea
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="Votre réponse..."
                          className="w-full text-sm p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none resize-none"
                          rows={3}
                        />
                        <div className="flex justify-end gap-2 mt-3">
                          <button 
                            onClick={() => setReplyingToIndex(null)}
                            className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-700 transition-colors"
                          >
                            Annuler
                          </button>
                          <button 
                            onClick={() => handleReplySubmit(idx)}
                            disabled={replyToReview.isPending || !replyText.trim()}
                            className="px-4 py-2 text-xs font-bold bg-primary-600 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {replyToReview.isPending ? 'Envoi…' : 'Envoyer'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Right Column (Sidebar) */}
          <aside className="lg:col-span-4">
            <div className="sticky top-24 space-y-6">
              {/* Garage Info Card */}
              <div className="bg-card rounded-3xl p-6 border border-gray-100 shadow-sm">
              
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-2xl bg-brand-plate flex items-center justify-center shrink-0">
                  {/* Placeholder for logo */}
                  <span className="font-black text-xl text-gray-900">GB</span>
                </div>
                <div>
                  <h2 className="text-[20px] font-black text-gray-900 leading-tight">{garage.name}</h2>
                  <div className="flex items-center gap-1 mt-1">
                    <Star size={14} className="text-warning-400 fill-warning-400" />
                    <Star size={14} className="text-warning-400 fill-warning-400" />
                    <Star size={14} className="text-warning-400 fill-warning-400" />
                    <Star size={14} className="text-warning-400 fill-warning-400" />
                    <Star size={14} className="text-warning-400 fill-warning-400" />
                    <span className="text-[11px] font-bold text-gray-400 ml-1">4.8 • 3 AVIS</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center shrink-0 mt-0.5">
                    <MapPin size={16} className="text-primary-600" />
                  </div>
                  {isLoggedIn ? (
                    <span className="text-[14px] font-medium text-gray-700 leading-snug">
                      {(garage as any).address || (garage as any).city || (garage as any).location || 'Adresse non communiquée'}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onTriggerLogin?.()}
                      className="text-[13px] font-bold text-primary-600 hover:text-primary-700 underline decoration-dotted underline-offset-4 leading-snug text-left"
                    >
                      Connectez-vous pour voir l'adresse
                    </button>
                  )}
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center shrink-0 mt-0.5">
                    <Clock size={16} className="text-primary-600" />
                  </div>
                  <div>
                    <span className="text-[14px] font-medium text-gray-700 block mb-1">Lundi-Samedi : 08h-18h</span>
                    <div className="inline-flex items-center gap-1.5 bg-green-50 px-2 py-0.5 rounded border border-green-100">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                      <span className="text-[9px] font-black text-green-700 uppercase tracking-widest">Ouvert</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:bg-gray-100 transition-colors mb-6 border border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-card flex items-center justify-center shadow-sm text-primary-600">
                    <Store size={20} />
                  </div>
                  <div>
                    <div className="text-[13px] font-black text-gray-900">Boutique du garage</div>
                    <div className="text-[11px] font-medium text-gray-500">12 annonces disponibles</div>
                  </div>
                </div>
                <ChevronRight size={20} className="text-gray-300" />
              </div>

              <div className="mb-6">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <User size={12} /> Nous suivre sur :
                </div>
                <div className="flex items-center gap-2">
                  <button className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 hover:text-blue-600 transition-colors">
                    <Facebook size={18} />
                  </button>
                  <button className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 hover:text-pink-600 transition-colors">
                    <Instagram size={18} />
                  </button>
                  <button className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 hover:text-black transition-colors">
                    {/* SVG for TikTok */}
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/></svg>
                  </button>
                  <button className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 hover:text-green-500 transition-colors">
                    <MessageCircle size={18} />
                  </button>
                </div>
              </div>

              {isLoggedIn ? (
                <div className="grid grid-cols-2 gap-3">
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((garage as any).address || (garage as any).city || garage.name)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="bg-brand-facebook hover:bg-brand-facebook-hover text-white rounded-xl py-3 flex items-center justify-center gap-2 font-black text-[13px] uppercase tracking-widest transition-colors"
                  >
                    <Map size={18} /> Maps
                  </a>
                  <a
                    href={(garage as any).phone ? `tel:${(garage as any).phone}` : '#'}
                    className="bg-success-500 hover:bg-success-600 text-white rounded-xl py-3 flex items-center justify-center gap-2 font-black text-[13px] uppercase tracking-widest transition-colors"
                  >
                    <Phone size={18} /> Appeler
                  </a>
                </div>
              ) : (
                <AuthLockOverlay
                  what="la localisation et le numéro"
                  description="Créez un compte gratuit pour voir l'adresse exacte sur Maps et appeler le garage."
                  onLogin={() => onTriggerLogin?.()}
                />
              )}

            </div>

            {/* Publicité (Desktop/Tablette) - Format Carré */}
            <div className="hidden md:block">
              <AdBanner 
                zone="garage_sidebar" 
                variant="banner" 
                className="aspect-square w-full rounded-[24px] border border-gray-100 shadow-sm overflow-hidden" 
              />
            </div>
            </div>
          </aside>

        </div>
      </div>

      <ReviewModal 
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        onSubmit={handleReviewSubmit}
        garageName={garage.name}
        submitting={submitGarageReview.isPending || submitSiteReview.isPending}
      />
    </div>
  );
};

export default GarageDetails;