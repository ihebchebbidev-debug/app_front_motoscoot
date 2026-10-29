import { displayPhone } from '../utils/phoneUtils';
import React, { useEffect, useMemo, useState, memo, useCallback } from 'react';
import { 
  ChevronLeft, 
  Share2, 
  Heart,
  MapPin,
  Star,
  ArrowRight,
  ArrowLeft,
  Home,
  ChevronRight,
  Phone,
  Mail
} from 'lucide-react';
import { useTechSpec } from '../hooks/useTechSpecs';
import { techSpecsApi } from '../services/techSpecsApi';
import SEO from './common/SEO';
import { getOptimizedImageUrl } from '../utils/urlUtils';
import { BasePageProps, Importer } from '../types';
import { Reveal } from './ui/Reveal';
import { Section } from './ui/Section';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { TechSpecsDetailsSkeleton } from './tech-specs/TechSpecsSkeletons';
import { TechSpecsErrorRetry } from './tech-specs/TechSpecsErrorRetry';
import SocialShareModal from './common/SocialShareModal';
import AdBanner from './common/AdBanner';
import { ListingGallery } from './listing/ListingGallery';
import { getUrlFromState } from '../utils/urlUtils';

/** Quick-stat cards (vitesse, puissance, poids, couple) with brand icons from public/icons/specs. */
const quickStats = (spec: any) => {
  const ft = (v?: string) => (v ? String(v).trim().split(/\s+/)[0] : '') || 'N/A';
  return [
    { key: 'speed', label: 'Vitesse Max', short: 'Vitesse', icon: '/icons/specs/vitesse-max.svg', value: `${ft(spec.topSpeed)} km/h` },
    { key: 'power', label: 'Puissance', short: 'Puiss.', icon: '/icons/specs/puissance.svg', value: `${ft(spec.engine?.power)} cv` },
    { key: 'weight', label: 'Poids', short: 'Poids', icon: '/icons/specs/poids.svg', value: `${ft(spec.dimensions?.weight)} kg` },
    { key: 'torque', label: 'Couple', short: 'Couple', icon: '/icons/specs/couple.svg', value: `${ft(spec.engine?.torque)} Nm` },
  ];
};

const WhatsAppIcon = ({ size = 20, className }: { size?: number, className?: string }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" className={className}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

/**
 * Renders the importer/distributor contact card on the tech-spec details
 * sidebar. Returns null when no importer has been assigned (admin can
 * attach one via /admin → Importateurs → Fiches techniques selector).
 */
const ImporterCard: React.FC<{ importer?: Importer | null }> = ({ importer }) => {
  if (!importer) return null;
  const initials = importer.name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const rating = importer.rating != null ? Number(importer.rating) : null;
  const fullStars = rating != null ? Math.round(rating) : 0;
  const cleanWhatsapp = (importer.whatsapp || '').replace(/\s|\+/g, '');
  return (
    <div className="bg-gray-900 rounded-2xl p-6 md:p-8 flex flex-col gap-6 shadow-xl relative overflow-hidden">
      <div className="absolute -right-10 -top-10 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
      <div className="flex items-center gap-4 relative z-10">
        <div className="w-14 h-14 rounded-full bg-card flex items-center justify-center font-black text-xl text-gray-900 shrink-0 shadow-sm overflow-hidden">
          {importer.logo_url
            ? <img src={importer.logo_url} alt={importer.name} className="w-full h-full object-cover" />
            : initials || '—'}
        </div>
        <div className="min-w-0">
          <h4 className="text-white font-bold text-lg leading-tight mb-1 truncate">{importer.name}</h4>
          {rating != null && (
            <div className="flex items-center gap-1">
              <div className="flex text-orange-500">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Star key={i} size={12} fill="currentColor" className={i < fullStars ? '' : 'text-gray-600'} />
                ))}
              </div>
              <span className="text-gray-400 text-xs ml-1 font-medium">
                {rating.toFixed(1)}{importer.reviews_count ? ` (${importer.reviews_count} avis)` : ''}
              </span>
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-3 relative z-10 pt-2 border-t border-gray-800">
        {importer.address && (
          <div className="flex items-start gap-3 text-gray-300">
            <MapPin size={16} className="mt-0.5 shrink-0 text-gray-500" />
            <span className="text-sm">{importer.address}{importer.city ? `, ${importer.city}` : ''}</span>
          </div>
        )}
        {importer.phone && (
          <div className="flex items-center gap-3 text-gray-300">
            <Phone size={16} className="shrink-0 text-gray-500" />
            <a href={`tel:${importer.phone.replace(/\s/g, '')}`} className="text-sm hover:text-white transition-colors">{displayPhone(importer.phone)}</a>
          </div>
        )}
        {importer.email && (
          <div className="flex items-center gap-3 text-gray-300">
            <Mail size={16} className="shrink-0 text-gray-500" />
            <a href={`mailto:${importer.email}`} className="text-sm hover:text-white transition-colors">{importer.email}</a>
          </div>
        )}
        {importer.whatsapp && (
          <div className="flex items-center gap-3 text-gray-300">
            <WhatsAppIcon size={16} className="shrink-0 text-green-500" />
            <a href={`https://wa.me/${cleanWhatsapp}`} target="_blank" rel="noopener noreferrer" className="text-sm hover:text-white transition-colors">{displayPhone(importer.whatsapp)}</a>
          </div>
        )}
      </div>
    </div>
  );
};

const S = {
  Wrapper: "min-h-screen bg-[#F8F9F9] md:bg-muted font-sans pb-32 md:pb-20",
  Container: "max-w-[1440px] mx-auto px-6 md:px-16 lg:px-32 pt-3 md:pt-8",
  Header: "flex items-center justify-between mb-3 md:mb-6",
  Breadcrumb: "flex items-center gap-2 text-[12px] md:text-[13px] font-medium text-gray-400 md:text-muted-foreground",
  BackBtn: "p-2.5 md:p-2 bg-card border border-gray-100 md:border-border rounded-2xl md:rounded-xl text-gray-700 md:text-foreground hover:bg-gray-50 hover:text-primary shadow-sm transition-all active:scale-95",
  ContentBlock: "bg-card rounded-2xl border border-border overflow-hidden shadow-sm",
  BlockBody: "px-6 md:px-8 pt-3 pb-6 md:pt-4 md:pb-8 animate-fade-in",
  SpecRow: "flex justify-between items-center py-3 md:py-4 border-b border-border/50 last:border-0",
  SpecLabel: "font-sans text-[14px] font-normal text-muted-foreground leading-[20px]",
  SpecValue: "font-sans text-[14px] font-extrabold text-foreground text-right",
};

const SpecRow = memo(({ label, value, badge }: { label: string, value?: string, badge?: string }) => {
  if (!value && !badge) return null;
  return (
    <div className={S.SpecRow}>
      <span className={S.SpecLabel}>{label}</span>
      <div className="flex items-center gap-2">
        {value && <span className={S.SpecValue}>{value}</span>}
        {badge && <Badge variant="default" className="text-[10px] uppercase tracking-wider bg-muted border-border text-foreground">{badge}</Badge>}
      </div>
    </div>
  );
});

/**
 * Section sub-header inside the unified spec sheet (mimics the printed
 * dealer brochure layout). No icon, no card border — just an uppercase
 * label with a primary accent line, sitting flush with the rows below it.
 */
const SpecGroup: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => {
  // Hide the whole group when every child SpecRow short-circuits to null
  // (i.e. all values are empty). React.Children.toArray + filter handles
  // both real elements and conditional nulls.
  const rendered = React.Children.toArray(children).filter((c) => {
    if (!React.isValidElement(c)) return false;
    const props: any = c.props;
    return !!(props?.value || props?.badge);
  });
  if (rendered.length === 0) return null;
  return (
    <section className="pt-6 first:pt-0">
      <h3 className="font-sans text-[12px] font-extrabold uppercase tracking-[0.08em] text-foreground border-b-2 border-primary-600 pb-2 mb-3">
        {title}
      </h3>
      <div>{rendered}</div>
    </section>
  );
};

const TechSpecsDetails: React.FC<BasePageProps> = ({ specId, onNavigate }) => {
  const {
    data: fetchedSpec,
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useTechSpec(specId);
  const spec = fetchedSpec;
  const [shareOpen, setShareOpen] = useState(false);


  useEffect(() => {
    window.scrollTo(0, 0);
  }, [specId]);

  // Track a model visit (best-effort) once we know the spec id. Powers the
  // admin BrandTrendsPanel "Modèles de <marque>" drill-down.
  useEffect(() => {
    if (!spec?.id) return;
    techSpecsApi.trackVisit(spec.id);
  }, [spec?.id]);

  // Old long links (/fiche-technique/<slug>-<uuid>) switch to the short link.
  useEffect(() => {
    if (!spec?.slug) return;
    const shortPath = `/fiche-technique/${spec.slug}`;
    if (window.location.pathname.replace(/\/+$/, '') !== shortPath) {
      window.history.replaceState(null, '', shortPath + window.location.search);
    }
  }, [spec?.slug]);

  // Cover first, then gallery extras, without duplicates.
  const images = useMemo(() => {
    if (!spec) return [];
    const all = [spec.image, ...(spec.gallery || [])].filter(Boolean) as string[];
    return Array.from(new Set(all));
  }, [spec]);

  // Model favourites are kept on this device (the account favourites API
  // only covers listings and garages).
  const [specFavorited, setSpecFavorited] = useState(false);
  useEffect(() => {
    if (!spec?.id) return;
    try {
      const list: string[] = JSON.parse(localStorage.getItem('ms_fav_specs') || '[]');
      setSpecFavorited(list.includes(String(spec.id)));
    } catch { /* ignore */ }
  }, [spec?.id]);
  const toggleSpecFavorite = useCallback(() => {
    if (!spec?.id) return;
    try {
      const id = String(spec.id);
      const list: string[] = JSON.parse(localStorage.getItem('ms_fav_specs') || '[]');
      const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
      localStorage.setItem('ms_fav_specs', JSON.stringify(next));
      setSpecFavorited(next.includes(id));
    } catch { /* ignore */ }
  }, [spec?.id]);


  const productSchema = useMemo(() => {
    if (!spec) return null;
    const name = `${spec.brand} ${spec.model} ${spec.year}`;
    const images = [
      ...(spec.image ? [getOptimizedImageUrl(spec.image, 1200, 800, 80, undefined, name)] : []),
      ...((spec.gallery || []).slice(0, 5).map((g) => getOptimizedImageUrl(g, 1200, 800, 80, undefined, name))),
    ];
    const priceDigits = (spec.priceNew || '').replace(/[^\d]/g, '');
    const price = priceDigits ? parseInt(priceDigits, 10) : 0;
    const canonical = typeof window !== 'undefined'
      ? `https://www.moto-scoot.tn${window.location.pathname}`
      : `https://www.moto-scoot.tn/fiche-technique/${spec.id}`;
    const description = `Fiche technique complète ${name}. Moteur ${spec.engine?.cc || 'N/A'}, puissance ${spec.engine?.power || 'N/A'}${price ? `, prix neuf ${price.toLocaleString('fr-FR')} DT en Tunisie` : ''}.`;

    // Emit Product + Offer when we have a valid price (Google requires
    // offers / review / aggregateRating on Product). Otherwise downgrade
    // to Vehicle to keep the structured-data check green.
    if (price > 0) {
      const validUntil = new Date(Date.now() + 180 * 86400_000).toISOString().slice(0, 10);
      return {
        "@context": "https://schema.org/",
        "@type": "Product",
        name,
        description,
        image: images,
        sku: `MS-${spec.id}`,
        mpn: spec.model,
        category: (spec as any).category || 'Motorcycle',
        brand: { "@type": "Brand", "name": spec.brand },
        url: canonical,
        offers: {
          "@type": "Offer",
          priceCurrency: "TND",
          price,
          availability: "https://schema.org/InStock",
          itemCondition: "https://schema.org/NewCondition",
          url: canonical,
          priceValidUntil: validUntil,
          seller: { "@type": "Organization", name: "MotoScoot.tn", url: "https://www.moto-scoot.tn" },
        },
      };
    }
    return {
      "@context": "https://schema.org/",
      "@type": "Vehicle",
      name,
      description,
      image: images,
      url: canonical,
      brand: { "@type": "Brand", "name": spec.brand },
      manufacturer: { "@type": "Organization", "name": spec.brand },
      model: spec.model,
      vehicleModelDate: spec.year,
      bodyType: (spec as any).category || 'Motorcycle',
      fuelType: 'Petrol',
      ...(spec.engine?.cc ? {
        vehicleEngine: {
          "@type": "EngineSpecification",
          engineDisplacement: {
            "@type": "QuantitativeValue",
            value: parseInt(String(spec.engine.cc).replace(/[^\d]/g, ''), 10) || undefined,
            unitCode: "CMQ",
          },
        },
      } : {}),
    };
  }, [spec]);


  const handleBack = useCallback(() => {
    if (spec) {
      onNavigate?.('tech-specs-models', { brand: spec.brand });
    }
  }, [onNavigate, spec]);

  const handleShare = useCallback(() => {
    if (!spec) return;
    setShareOpen(true);
  }, [spec]);

  const handleCompare = useCallback(() => {
    if (!spec) return;
    const stored = localStorage.getItem('compare_ids');
    let ids: string[] = [];
    if (stored) {
      ids = stored.split(',').filter(Boolean);
    }
    const specIdStr = String(spec.id);
    if (!ids.includes(specIdStr)) {
      ids.push(specIdStr);
    }
    if (ids.length > 2) {
      ids = ids.slice(ids.length - 2);
    }
    localStorage.setItem('compare_ids', ids.join(','));
    onNavigate?.('comparator', { ids: ids.join(',') });
  }, [spec, onNavigate]);

  if (isLoading) {
    return (
      <main className={S.Wrapper}>
        <TechSpecsDetailsSkeleton />
      </main>
    );
  }

  // Network/server error — distinct from "spec not found". The fetch
  // never resolved, so we show a retry button instead of a dead-end
  // "introuvable" page.
  if (isError) {
    return (
      <main className={S.Wrapper}>
        <Section variant="none" className="bg-[#F8F9F9] md:bg-card pt-32 pb-20">
          <div className="max-w-2xl mx-auto">
            <TechSpecsErrorRetry
              title="Fiche technique indisponible"
              description="Impossible de charger cette fiche pour le moment. Vérifiez votre connexion et réessayez."
              onRetry={() => refetch()}
              isRetrying={isFetching}
            />
            <div className="text-center mt-6">
              <Button onClick={() => onNavigate?.('tech-specs-brands')} variant="outline">
                Retour au catalogue
              </Button>
            </div>
          </div>
        </Section>
      </main>
    );
  }

  if (!spec) {
    return (
      <main className={S.Wrapper}>
        <Section variant="none" className="bg-[#F8F9F9] md:bg-card pt-32 pb-20 text-center flex flex-col items-center justify-center min-h-[60vh]">
          <SEO title="Modèle introuvable" description="Cette page n'existe pas ou n'est plus disponible." noIndex />
          <h1 className="text-2xl font-black text-foreground mb-4">Modèle introuvable</h1>
          <p className="text-muted-foreground mb-8">La fiche technique que vous recherchez n'existe pas ou a été supprimée.</p>
          <Button onClick={() => onNavigate?.('tech-specs-brands')} variant="primary">
            Retour au catalogue
          </Button>
        </Section>
      </main>
    );
  }

  // Safe getters — every spec field can be an empty string when the admin
  // hasn't filled it in. The previous code called `.split(' ')` directly
  // on these values, which is fine for "" but produced ugly empty cells.
  const firstToken = (v?: string) => {
    const str = (v || '').trim();
    if (!str) return 'N/A';
    return str.split(/\s+/)[0];
  };
  const beforeComma = (v?: string) => {
    const str = (v || '').trim();
    return str ? str.split(',')[0] : 'N/A';
  };

  // Indicative monthly installment (price spread over 60 months, no interest).
  // Purely informational — not a financing offer.
  const priceRaw = (spec.priceNew || '').replace(/[^\d]/g, '');
  const priceNumber = priceRaw ? parseInt(priceRaw, 10) : 0;
  const monthlyPayment = priceNumber ? Math.round(priceNumber / 60) : null;

  return (
    <main className={S.Wrapper}>
      <SEO 
        title={`${spec.brand} ${spec.model} (${spec.year}) - Fiche Technique & Prix`}
        description={`Découvrez la fiche technique complète de la ${spec.brand} ${spec.model} (${spec.year}). Caractéristiques, moteur ${spec.engine?.cc || 'N/A'}, puissance ${spec.engine?.power || 'N/A'}, et prix neuf en Tunisie.`}
        image={spec.image}
        type="product"
        url={getUrlFromState('tech-specs-details', { id: spec.id, specSlug: spec.slug, slug: `${spec.brand} ${spec.model}` })}
        schema={productSchema || undefined}
      />

      <article className={S.Container}>
        {/* Navigation Header */}
        <header className={S.Header}>
           <div className="flex items-center gap-3 md:gap-4">
              <button onClick={handleBack} className={S.BackBtn} aria-label="Retour"><ArrowLeft size={18} className="md:w-5 md:h-5"/></button>
              <nav className={S.Breadcrumb}>
                 <span className="flex items-center gap-1.5 hover:text-primary-600 cursor-pointer transition-colors" onClick={() => onNavigate?.('home')}>
                   <Home size={14} className="md:w-3.5 md:h-3.5" /> Accueil
                 </span>
                 <ChevronRight size={12} className="md:w-3.5 md:h-3.5 text-gray-300"/>
                 <span className="hover:text-primary-600 cursor-pointer transition-colors" onClick={() => onNavigate?.('tech-specs-brands')}>Fiches Techniques</span>
                 <ChevronRight size={12} className="md:w-3.5 md:h-3.5 text-gray-300"/>
                 <span className="text-foreground font-extrabold truncate max-w-[100px] md:max-w-none">{spec.brand}</span>
              </nav>
           </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* LEFT COLUMN */}
          <div className="lg:col-span-8 space-y-8">
            {/* IMAGE GALLERY — same viewer as the listing details page */}
            <Reveal animation="fade-in-up">
              <div className="flex flex-col gap-3">
                <ListingGallery
                  images={images}
                  title={`${spec.brand} ${spec.model} ${spec.year}`}
                  brand={spec.brand}
                  model={spec.model}
                  favorited={specFavorited}
                  onFavoriteToggle={(e) => { e?.stopPropagation?.(); toggleSpecFavorite(); }}
                  onShare={handleShare}
                  showFavorite={false}
                  overlayTopLeft={spec.normLogo ? (
                    <img src={spec.normLogo} alt="Norme environnementale" className="h-6 md:h-8 w-auto object-contain" referrerPolicy="no-referrer" />
                  ) : undefined}
                />
              </div>
            </Reveal>

            {/* MOBILE HEADER INFO (Visible only on mobile/tablet) */}
            <div className="lg:hidden mb-8">
              <div className="flex justify-between items-center mb-1">
                <span className="font-sans text-[14px] font-bold text-primary-600 tracking-[0px]">
                  {spec.brand}
                </span>
              </div>
              <h1 className="font-sans text-[24px] font-extrabold text-foreground leading-tight tracking-[0px] mb-2">
                {spec.model}
              </h1>
              <p className="text-gray-500 font-medium mb-6 text-sm">
                {spec.engine.cc || 'N/A'} · {beforeComma(spec.engine.type)} · {spec.engine.power || 'N/A'}
              </p>

              {/* 4 CARREAUX (Mobile/Tablet) */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                {quickStats(spec).map((s) => (
                  <div key={s.key} className="bg-card rounded-2xl border border-gray-100 flex items-center gap-3 p-3 transition-all shadow-sm overflow-hidden">
                    <img src={s.icon} alt="" aria-hidden="true" width={36} height={36} className="w-9 h-9 shrink-0" />
                    <div className="flex flex-col min-w-0">
                      <span className="font-sans text-[10px] font-bold text-gray-400 uppercase tracking-wider">{s.label}</span>
                      <span className="font-sans text-sm font-black text-gray-700 truncate">{s.value}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* DETAILED SPECS */}
            {/* Unified spec sheet — mirrors the printed dealer brochure look:
                one card, multiple section groups separated by uppercase
                headers + a thin primary underline. No per-section icons. */}
            <Reveal animation="fade-in-up" delay={150}>
              <div className={S.ContentBlock}>
                <div className="px-6 md:px-8 py-4 border-b border-border">
                  <h2 className="font-sans text-[15px] font-extrabold uppercase tracking-[0.06em] text-foreground">
                    Caractéristiques
                  </h2>
                </div>
                <br></br>
                <div className="px-6 md:px-8 pb-6 md:pb-8 divide-y divide-transparent">
                  <SpecGroup title="Motorisation">                   
                    <SpecRow label="Type moteur" value={spec.engine.type} />
                    <SpecRow label="Cylindrée" value={spec.engine.cc} />
                    <SpecRow label="Puissance max" value={spec.engine.power} />
                    <SpecRow label="Couple max" value={spec.engine.torque} />
                    <SpecRow label="Refroidissement" value={spec.engine.cooling} />
                    <SpecRow label="Alimentation" value={spec.engine.fuelSystem} />
                    <SpecRow label="Consommation" value={spec.consumption} />
                    <SpecRow label="Vitesse maxi" value={spec.topSpeed} />
                  </SpecGroup>

                  <SpecGroup title="Transmission">
                    <SpecRow label="Boîte de vitesses" value={spec.engine.transmission} />
                  </SpecGroup>

                  <SpecGroup title="Châssis">
                    <SpecRow label="Type de cadre" value={spec.chassis.frame} />
                    <SpecRow label="Suspension avant" value={spec.chassis.suspensionFront} />
                    <SpecRow label="Débattement avant" value={spec.chassis.travelFront} />
                    <SpecRow label="Suspension arrière" value={spec.chassis.suspensionRear} />
                    <SpecRow label="Débattement arrière" value={spec.chassis.travelRear} />
                  </SpecGroup>

                  <SpecGroup title="Roues & Freins">
                    <SpecRow label="Pneu avant" value={spec.chassis.tireFront} />
                    <SpecRow label="Pneu arrière" value={spec.chassis.tireRear} />
                    <SpecRow label="Frein avant" value={spec.chassis.brakesFront} />
                    <SpecRow label="Frein arrière" value={spec.chassis.brakesRear} />
                    <SpecRow label="ABS" value={spec.electronics.abs} />
                  </SpecGroup>

                  <SpecGroup title="Dimensions & Poids">
                    <SpecRow label="Longueur" value={spec.dimensions.length} />
                    <SpecRow label="Empattement" value={spec.dimensions.wheelbase} />
                    <SpecRow label="Hauteur selle" value={spec.dimensions.seatHeight} />
                    <SpecRow label="Poids à vide" value={spec.dimensions.weight} />
                    <SpecRow label="Réservoir" value={spec.dimensions.tank} />
                  </SpecGroup>

                  <SpecGroup title="Électronique & Équipements">
                    <SpecRow label="Modes de conduite" value={spec.electronics.ridingModes} />
                    <SpecRow label="Contrôle de traction" value={spec.electronics.tcs} />
                    <SpecRow label="Quick shifter" value={spec.electronics.quickshifter} />
                    <SpecRow label="Éclairage" value={spec.electronics.lighting} />
                    <SpecRow label="Prise USB" value={spec.electronics.usb} />
                    <SpecRow label="Tableau de bord" value={spec.electronics.dashboard} />
                    <SpecRow label="Connectivité" value={spec.electronics.connectivity} />
                    <SpecRow label="Régulateur de vitesse" value={spec.electronics.cruiseControl} />
                    <SpecRow label="Démarrage sans clé" value={spec.electronics.keyless} />
                    <SpecRow label="Autres équipements" value={spec.electronics.other} />
                  </SpecGroup>

                  {(spec.maintenance?.warranty || spec.maintenance?.firstService || spec.maintenance?.serviceInterval) && (
                    <SpecGroup title="Garantie & Entretien">
                      <SpecRow label="Garantie constructeur" value={spec.maintenance?.warranty} />
                      <SpecRow label="1ère révision" value={spec.maintenance?.firstService} />
                      <SpecRow label="Révisions suivantes" value={spec.maintenance?.serviceInterval} />
                    </SpecGroup>
                  )}
                </div>
              </div>
            </Reveal>
          </div>

          {/* RIGHT COLUMN (SIDEBAR) */}
          <div className="lg:col-span-4">
            <div className="sticky top-28 space-y-6">
              {/* HEADER INFO CARD (Desktop Only) */}
              <Reveal animation="fade-in-up" delay={100}>
                <div className="hidden lg:block bg-card rounded-2xl border border-gray-100 shadow-sm p-6 md:p-8">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-sans text-[14px] font-bold text-primary-600 tracking-[0px]">{spec.brand}</span>
                  </div>
                  
                  <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight mb-2 leading-tight">{spec.model}</h1>
                  <p className="text-gray-500 font-medium mb-8 text-sm md:text-base">
                    {spec.engine.cc || 'N/A'} · {beforeComma(spec.engine.type)} · {spec.engine.power || 'N/A'}
                  </p>

                  {/* QUICK STATS (Sidebar) */}
                  <div className="grid grid-cols-4 gap-0 mb-8">
                    {quickStats(spec).map((s, i) => (
                      <div key={s.key} className={`flex flex-col items-center justify-center px-1 gap-1 ${i < 3 ? 'border-r border-primary-600' : ''}`}>
                        <img src={s.icon} alt="" aria-hidden="true" width={22} height={22} className="w-[22px] h-[22px]" />
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider text-center">{s.short}</span>
                        <span className="text-xs font-black text-gray-900">{s.value}</span>
                      </div>
                    ))}
                  </div>

                  {/* PRICE & ACTION */}
                  <div className="pt-6 border-t border-gray-100 flex flex-col gap-4">
                    <div className="flex flex-col">
                      <span className="text-2xl font-black text-gray-900 leading-none truncate">{spec.priceNew}</span>
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mt-1">Prix public TTC</span>
                    </div>
                    <Button 
                      variant="primary" 
                      className="w-full rounded-xl py-4 text-sm shadow-md shadow-orange-500/20 font-bold"
                      onClick={handleCompare}
                    >
                      Comparer ce modèle
                    </Button>
                  </div>
                </div>
              </Reveal>

              {/* Publicité — Format Carré (visible sur mobile, tablette et desktop) */}
              <div className="block">
                <AdBanner 
                  zone="listing_sidebar" 
                  variant="banner" 
                  className="aspect-square w-full rounded-[24px] border border-gray-100 shadow-sm overflow-hidden" 
                />
              </div>

              {/* IMPORTER CARD — populated from tech_specs.importer_id.
                  When no importer is assigned the whole card is hidden
                  (the admin can attach one from /admin → Importateurs). */}
              <Reveal animation="fade-in-up" delay={200}>
                <ImporterCard importer={spec.importer} />
              </Reveal>
            </div>
          </div>
        </div>
      </article>

      {/* STICKY BOTTOM BAR (Mobile Only) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-card/90 backdrop-blur-lg border-t border-gray-200 p-4 z-50 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)]">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <div className="flex flex-col min-w-0">
            <span className="text-lg font-black text-gray-900 leading-none truncate">{spec.priceNew}</span>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mt-1">TTC</span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {spec.importer?.phone && (
              <a
                href={`tel:${spec.importer.phone.replace(/\s/g, '')}`}
                className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-900 text-white shadow-md hover:bg-gray-800 transition-colors shrink-0"
                aria-label={`Contacter ${spec.importer.name}`}
                title={`Contacter ${spec.importer.name}`}
              >
                <Phone size={18} />
              </a>
            )}
            <Button
              variant="primary"
              className="rounded-xl px-6 py-3 text-[13px] font-extrabold uppercase tracking-wider shadow-md shadow-orange-500/20"
              onClick={handleCompare}
            >
              Comparer
            </Button>
          </div>
        </div>
      </div>

      {spec && (
        <SocialShareModal
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          content={{
            kind: 'techspec',
            id: spec.id,
            title: `${spec.brand} ${spec.model} ${spec.year || ''}`.trim(),
            subtitle: [spec.engine?.cc, spec.engine?.power, spec.priceNew].filter(Boolean).join(' • '),
            summary: `Fiche technique complète : ${spec.brand} ${spec.model}${spec.year ? ` ${spec.year}` : ''}.`,
            image: spec.image,
            tags: [spec.brand, spec.model].filter(Boolean) as string[],
          }}
        />
      )}
    </main>
  );
};

export default memo(TechSpecsDetails);
