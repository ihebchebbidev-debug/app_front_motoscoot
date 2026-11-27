import { displayPhone, telHref } from '../utils/phoneUtils';
import React, { useEffect, useMemo, useRef, useState, memo, useCallback } from 'react';
import {
  Share2,
  Heart,
  MapPin,
  Star,
  ArrowRight,
  ChevronRight,
  Phone,
  Mail,
  Scale,
  FileText
} from 'lucide-react';
import { siWhatsapp } from 'simple-icons';
import { QuoteRequestSheet } from './tech-specs/QuoteRequestSheet';
import { trackLead } from '../services/techSpecLeadsApi';
import { whatsappHref } from '../utils/ficheLeads';
import { useTechSpec, useCatalogTechSpecs } from '../hooks/useTechSpecs';
import { capsulePrice } from '../utils/capsulePrice';
import { techSpecsApi } from '../services/techSpecsApi';
import SEO from './common/SEO';
import { getOptimizedImageUrl } from '../utils/urlUtils';
import { BasePageProps, Importer, TechSpec } from '../types';
import { Section } from './ui/Section';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { TechSpecsDetailsSkeleton } from './tech-specs/TechSpecsSkeletons';
import { TechSpecsErrorRetry } from './tech-specs/TechSpecsErrorRetry';
import { ModelCarousel } from './tech-specs/ModelCarousel';
import SocialShareModal from './common/SocialShareModal';
import AdBanner from './common/AdBanner';
import { ListingGallery } from './listing/ListingGallery';
import { getUrlFromState } from '../utils/urlUtils';
import { Link } from 'react-router-dom';
import { parseSpecNumber, parseSpecPrice, techSpecTitle, techSpecDescription, techSpecSummary, formatPowerCh, techSpecPriceBlock, TECH_SPEC_PRICE_LABEL, type TechSpecPriceBlock, similarTechSpecs, SIMILAR_MODELS_HEADING, type SimilarModelSource, techSpecProperties, techSpecShareImage, techSpecGalleryTitle, techSpecFaq, TECH_SPEC_FAQ_HEADING, techSpecVersions, VERSION_COLUMN_LABELS, type TechSpecVersionSource, techSpecPhotos } from '../utils/techSpecSeo';
import { PageBreadcrumb } from './ui/PageBreadcrumb';
import { FloatingCapsule } from './ui/FloatingCapsule';

/** Quick-stat cards (vitesse, puissance, poids, couple) with brand icons from public/icons/specs. */
const quickStats = (spec: any) => {
  const ft = (v?: string) => (v ? String(v).trim().split(/\s+/)[0] : '') || 'N/A';
  return [
    { key: 'speed', label: 'Vitesse Max', short: 'Vitesse', icon: '/icons/specs/vitesse-max.svg', value: `${ft(spec.topSpeed)} km/h` },
    // kW values are converted ("9.3 kW (12.6 ch)" showed as "9.3 cv").
    { key: 'power', label: 'Puissance', short: 'Puiss.', icon: '/icons/specs/puissance.svg', value: formatPowerCh(spec.engine?.power) || 'N/A' },
    { key: 'weight', label: 'Poids', short: 'Poids', icon: '/icons/specs/poids.svg', value: `${ft(spec.dimensions?.weight)} kg` },
    { key: 'torque', label: 'Couple', short: 'Couple', icon: '/icons/specs/couple.svg', value: `${ft(spec.engine?.torque)} Nm` },
  ];
};

const WhatsAppIcon = ({ size = 20, className }: { size?: number, className?: string }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" className={className}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

/** "Prix neuf en Tunisie" block under the header: dated price, availability, dealer, as spec rows. */
const PriceBlock: React.FC<{ block: TechSpecPriceBlock }> = ({ block }) => {
  if (!block.price && !block.availability && !block.dealer) return null;
  return (
    <section aria-labelledby="prix-neuf" className={`${S.ContentBlock} mb-6`}>
      {/* Orange underline, like the spec groups (Motorisation…). */}
      <div className="px-6 md:px-8 pt-5">
        <h2 id="prix-neuf" className="font-sans text-[15px] font-extrabold uppercase tracking-[0.06em] text-foreground border-b-2 border-primary-600 pb-2">
          {TECH_SPEC_PRICE_LABEL}
        </h2>
      </div>
      <div className="px-6 md:px-8 pb-2">
        <table className="w-full border-collapse">
          <caption className="sr-only">{TECH_SPEC_PRICE_LABEL}</caption>
          <tbody>
            <SpecRow label={block.priceLabel} value={block.price || undefined} />
            <SpecRow label="Disponibilité" value={block.availability || undefined} />
            <SpecRow label="Concessionnaire" value={block.dealer || undefined} />
          </tbody>
        </table>
      </div>
    </section>
  );
};

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
            <a href={telHref(importer.phone) || undefined} className="text-sm hover:text-white transition-colors">{displayPhone(importer.phone)}</a>
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
  Wrapper: "min-h-screen bg-page md:bg-muted font-sans pb-[calc(7rem+env(safe-area-inset-bottom))] md:pb-20",
  // Floating capsule: 64 px tall, 6 px inset, fully rounded; price, call (52 px) and « Comparer » (48 px).
  // Material, depth, entrance and accessibility: .ms-capsule in src/styles/globals.css.
  // Shape and position: components/ui/FloatingCapsule.tsx (shared with /mon-compte).
  FloatBar: "justify-between min-[360px]:justify-start gap-1 min-[400px]:gap-1.5",
    FloatPrice: "flex-1 min-w-0 h-[3.25rem] pl-3 pr-1 min-[400px]:pl-4 flex-col justify-center",
  // Round actions (owner, 2026-11-19), shown while the importer is subscribed:
  // call (glass), WhatsApp (brand green), devis (orange, the main action),
  // compare (glass, its word from 430 px). 48 px, 44 under 360 px.
  FloatRound: "relative shrink-0 w-11 h-11 min-[400px]:w-12 min-[400px]:h-12 inline-flex items-center justify-center rounded-full text-white transition-[transform,background-color] duration-100 ease-out active:scale-[0.94] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#1B1F27]",
  FloatGlass: "bg-white/[0.14] ring-1 ring-inset ring-white/[0.10] active:bg-white/[0.24] [@media(hover:hover)]:hover:bg-white/[0.20]",
  FloatWhatsapp: "bg-[#25D366] active:bg-[#1EBE5A] [@media(hover:hover)]:hover:bg-[#1EBE5A]",
  // Same orange as the desktop button (#E65400, primary-600): one orange.
  FloatQuote: "bg-primary-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] active:bg-primary-700 [@media(hover:hover)]:hover:bg-primary-700",
  // Desktop card (light surface): same actions as the phone capsule.
  // « Demander un devis »: the big orange button under the price (owner's
  // model, orange instead of black), then Comparer / WhatsApp / Appeler as
  // three equal light-grey buttons with small capitals.
  CardQuote: "w-full h-14 inline-flex items-center justify-center gap-2.5 rounded-2xl bg-primary-600 text-white text-[0.9375rem] font-semibold tracking-[0.01em] transition-[transform,background-color] duration-100 ease-out hover:bg-primary-700 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2",
  // Icon buttons next to the price (owner, 2026-11-19): same 44 px light-grey
  // square for Comparer, WhatsApp and Appeler, grey icons; on hover WhatsApp
  // turns green and Appeler orange.
  CardIcon: "shrink-0 w-11 h-11 inline-flex items-center justify-center rounded-xl bg-gray-50 text-gray-600 transition-[transform,background-color,color] duration-100 ease-out hover:bg-gray-100 hover:text-gray-900 active:scale-[0.94] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2",
  CardIconWhatsapp: "hover:!text-[#1DA851] focus-visible:!text-[#1DA851]",
  CardIconCall: "hover:!text-primary-600 focus-visible:!text-primary-600",
  // « Devis » always says its word next to its icon (owner, 2026-11-19): the
  // one action with a label, so it reads first; same height as the rounds.
  FloatQuotePill: "relative shrink-0 h-11 min-[400px]:h-12 pl-2.5 pr-3 min-[400px]:pl-3 min-[400px]:pr-3.5 inline-flex items-center gap-1 min-[400px]:gap-1.5 rounded-full text-white text-[0.875rem] min-[400px]:text-[0.9375rem] font-semibold tracking-[0.01em] transition-[transform,background-color] duration-100 ease-out active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#1B1F27]",
  // Top spacing matches the brand page (/fiches-techniques/<marque>): breadcrumb row 24px under the header on mobile, 40px from md.
  Container: "max-w-[1440px] mx-auto px-6 md:px-16 lg:px-32 pt-0 md:pt-9",
  // Phones: no breadcrumb row (its 44 px go to the photo and the title); « ← » sits on the photo
  // and the brand above the title links to the brand page. Kept in the DOM for crawlers.
  Header: "hidden md:flex items-center justify-between mb-3 md:mb-6",
  ContentBlock: "bg-card rounded-2xl border border-border overflow-hidden shadow-sm",
  BlockBody: "px-6 md:px-8 pt-3 pb-6 md:pt-4 md:pb-8 animate-fade-in",
  SpecRow: "border-b border-border/50 last:border-0",
  SpecLabel: "py-3 md:py-4 pr-4 text-left align-middle font-sans text-[14px] font-normal text-muted-foreground leading-[20px]",
  SpecValue: "font-sans text-[14px] font-extrabold text-foreground text-right",
};

const SpecRow = memo(({ label, value, badge }: { label: string, value?: string, badge?: string }) => {
  if (!value && !badge) return null;
  return (
    <tr className={S.SpecRow}>
      <th scope="row" className={S.SpecLabel}>{label}</th>
      <td className="py-3 md:py-4 align-middle">
        <div className="flex items-center justify-end gap-2">
          {value && <span className={S.SpecValue}>{value}</span>}
          {badge && <Badge variant="default" className="text-[10px] uppercase tracking-wider bg-muted border-border text-foreground">{badge}</Badge>}
        </div>
      </td>
    </tr>
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
      {/* A real table (row headers + values) so crawlers and AI answers can lift the specs. */}
      <table className="w-full border-collapse">
        <caption className="sr-only">{title}</caption>
        <tbody>{rendered}</tbody>
      </table>
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
  // Models sold in Tunisia, for "Modèles similaires" (cached, shared with the comparator and price guides).
  const { data: catalogue = [] } = useCatalogTechSpecs({ availableInTunisia: true });
  // Same selection as the crawler HTML (similarTechSpecs), shown with the catalogue's own cards.
  const similar = useMemo<TechSpec[]>(() => {
    if (!spec) return [];
    const source = (m: TechSpec): SimilarModelSource => ({
      id: m.id, slug: m.slug, brand: m.brand, model: m.model, category: m.categoryLabel || m.category, cc: m.engine?.cc, price: m.priceNew,
    });
    const bySlug = new Map(catalogue.map((m) => [`/fiche-technique/${m.slug}`, m]));
    return similarTechSpecs(source(spec), catalogue.map(source))
      .map((m) => bySlug.get(m.href))
      .filter((m): m is TechSpec => !!m);
  }, [spec, catalogue]);
  // « Les versions du SYM Jet 14 »: same rule and order as the crawler HTML (techSpecVersions).
  const versions = useMemo(() => {
    if (!spec) return null;
    const source = (m: TechSpec): TechSpecVersionSource => ({
      id: m.id, slug: m.slug, brand: m.brand, model: m.model, category: m.categoryLabel || m.category, cc: m.engine?.cc, price: m.priceNew,
      power: m.engine?.power, fuelSystem: m.engine?.fuelSystem,
      weight: m.dimensions?.weight,
    });
    return techSpecVersions(source(spec), catalogue.map(source));
  }, [spec, catalogue]);
  const [shareOpen, setShareOpen] = useState(false);
  // « Demande de devis » sheet; focus goes back to its button on close.
  const [quoteOpen, setQuoteOpen] = useState(false);
  // The « Devis » button that opened the sheet (phone capsule or desktop card).
  const quoteButtonRef = useRef<HTMLElement | null>(null);
  const openQuote = (e: React.MouseEvent<HTMLElement>) => { quoteButtonRef.current = e.currentTarget; setQuoteOpen(true); };


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

  // Gallery extras only: the admin "image principale" (spec.image) is for
  // listing cards and is hidden on the details page. Fall back to it when
  // there is no gallery at all so the page never shows an empty viewer.
  const images = useMemo(() => {
    if (!spec) return [];
    // Same photos and order as the crawler HTML (utils/techSpecSeo.ts › techSpecPhotos).
    return techSpecPhotos(spec);
  }, [spec]);
  // Shared preview = the photo the page opens on (first gallery photo).
  const shareImage = spec ? techSpecShareImage(spec) || undefined : undefined;

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
    const price = parseSpecPrice(spec.priceNew) ?? 0;
    const canonical = typeof window !== 'undefined'
      ? `https://www.moto-scoot.tn${window.location.pathname}`
      : `https://www.moto-scoot.tn/fiche-technique/${spec.id}`;
    // Same numeric specs as the crawler JSON-LD (api/og-prerender.ts).
    const properties = techSpecProperties({
      cc: spec.engine?.cc, power: spec.engine?.power, torque: spec.engine?.torque, topSpeed: spec.topSpeed,
      consumption: spec.consumption, weight: spec.dimensions?.weight, tank: spec.dimensions?.tank,
    });
    const description = `Fiche technique complète ${name}. Moteur ${spec.engine?.cc || 'N/A'}, puissance ${spec.engine?.power || 'N/A'}${price ? `, prix neuf ${price.toLocaleString('fr-FR')} DT en Tunisie` : ''}.`;

    // Emit Product + Offer when we have a valid price (Google requires
    // offers / review / aggregateRating on Product). Otherwise downgrade
    // to Vehicle to keep the structured-data check green.
    if (price > 0) {
      return {
        "@context": "https://schema.org/",
        "@type": "Product",
        name,
        description,
        image: images,
        sku: `MS-${spec.id}`,
        // The model name, not a manufacturer part number (mpn).
        model: spec.model,
        category: (spec as any).category || 'Motorcycle',
        brand: { "@type": "Brand", "name": spec.brand },
        url: canonical,
        offers: {
          "@type": "Offer",
          priceCurrency: "TND",
          price,
          // Catalogue price of the new model, as in api/og-prerender.ts:
          // Moto-Scoot.tn does not sell it (no seller, stock or validity date).
          itemCondition: "https://schema.org/NewCondition",
          url: canonical,
        },
        ...(properties.length ? { additionalProperty: properties } : {}),
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
            value: parseSpecNumber(spec.engine.cc) ?? undefined,
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
    trackLead(spec.id, 'compare', spec);
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
        <Section variant="none" className="bg-page md:bg-card pt-32 pb-20">
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
        <Section variant="none" className="bg-page md:bg-card pt-32 pb-20 text-center flex flex-col items-center justify-center min-h-[60vh]">
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
  const priceBlock = techSpecPriceBlock({
    brand: spec.brand, model: spec.model, category: spec.categoryLabel || spec.category, cc: spec.engine?.cc,
    price: spec.priceNew, updatedAt: spec.updatedAt, availableInTunisia: spec.availableInTunisia,
    importerName: spec.importer?.name, importerCity: spec.importer?.city,
  });
  const faq = techSpecFaq({
    brand: spec.brand, model: spec.model, category: spec.categoryLabel || spec.category, price: spec.priceNew,
    updatedAt: spec.updatedAt, topSpeed: spec.topSpeed, consumption: spec.consumption, tank: spec.dimensions?.tank,
    cc: spec.engine?.cc, power: spec.engine?.power, weight: spec.dimensions?.weight,
    warranty: spec.maintenance?.warranty, firstService: spec.maintenance?.firstService, serviceInterval: spec.maintenance?.serviceInterval,
    colors: spec.colors,
    availableInTunisia: spec.availableInTunisia, importerName: spec.importer?.name, importerCity: spec.importer?.city,
  });
  const priceNumber = parseSpecPrice(spec.priceNew) ?? 0;
  const monthlyPayment = priceNumber ? Math.round(priceNumber / 60) : null;

  const brandHref = getUrlFromState('tech-specs-models', { brand: spec.brand });
  // Floating capsule: the price as typed in the admin, sorted (utils/capsulePrice.ts),
  // and a call link to the importer's first number (utils/phoneUtils.ts telHref).
  const capsule = capsulePrice(spec.priceNew);
  // Appel, WhatsApp and Devis only while the importer's subscription runs
  // (owner, 2026-11-19; importers.subscription_until, API field `subscribed`).
  const subscribed = spec.importer?.subscribed === true;
  const modelName = `${spec.brand} ${spec.model}`.trim();
  const pageUrl = `https://www.moto-scoot.tn${getUrlFromState('tech-specs-details', { id: spec.id, specSlug: spec.slug, slug: `${spec.brand} ${spec.model}` })}`;
  const callHref = subscribed ? telHref(spec.importer?.phone) : null;
  const waHref = subscribed ? whatsappHref(spec.importer?.whatsapp, modelName, pageUrl) : null;
  const canQuote = subscribed;

  return (
    <main className={S.Wrapper}>
      <SEO 
        title={techSpecTitle({ brand: spec.brand, model: spec.model, price: spec.priceNew })}
        rawTitle
        description={techSpecDescription({ brand: spec.brand, model: spec.model, category: spec.category, price: spec.priceNew, cc: spec.engine?.cc, power: spec.engine?.power, weight: spec.dimensions?.weight })}
        image={shareImage}
        type="product"
        url={getUrlFromState('tech-specs-details', { id: spec.id, specSlug: spec.slug, slug: `${spec.brand} ${spec.model}` })}
        schema={productSchema || undefined}
      />

      <article className={S.Container}>
        {/* Navigation Header */}
        <header className={S.Header}>
           {/* Real links (crawlable), same targets as the prerendered breadcrumb. */}
           <PageBreadcrumb
             parents={[
               { label: 'Accueil', href: getUrlFromState('home'), onClick: () => onNavigate?.('home') },
               { label: 'Fiches techniques', href: getUrlFromState('tech-specs-brands'), onClick: () => onNavigate?.('tech-specs-brands') },
               { label: spec.brand, href: brandHref, onClick: handleBack },
             ]}
             current={`${spec.model}${spec.year ? ` ${spec.year}` : ''}`}
           />
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* LEFT COLUMN */}
          <div className="lg:col-span-8 space-y-8">
            {/* IMAGE GALLERY — same viewer as the listing details page */}
            <div>
              <div className="flex flex-col gap-3">
                <ListingGallery
                  images={images}
                  title={techSpecGalleryTitle(spec)}
                  thumbnails
                  brand={spec.brand}
                  model={spec.model}
                  favorited={specFavorited}
                  onFavoriteToggle={(e) => { e?.stopPropagation?.(); toggleSpecFavorite(); }}
                  onShare={handleShare}
                  showFavorite={false}
                  backLink={{ href: brandHref, label: spec.brand, onClick: handleBack }}
                  overlayTopLeft={spec.normLogo ? (
                    <img src={spec.normLogo} alt="Norme environnementale" className="h-6 md:h-8 w-auto object-contain" referrerPolicy="no-referrer" />
                  ) : undefined}
                />
              </div>
            </div>

            {/* MOBILE HEADER INFO (Visible only on mobile/tablet) */}
            <div className="lg:hidden mb-8">
              <div className="flex justify-between items-center mb-1">
                {/* The brand is the way up on phones (the breadcrumb row is hidden there). */}
                <a
                  href={brandHref}
                  onClick={(e) => {
                    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                    e.preventDefault();
                    handleBack();
                  }}
                  className="inline-flex items-center gap-0.5 -my-3 py-3 font-sans text-[14px] font-bold text-primary-600 tracking-[0px] active:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 rounded"
                >
                  {spec.brand}
                  <ChevronRight size={15} strokeWidth={2.75} aria-hidden="true" />
                </a>
              </div>
              <h1 className="font-sans text-[24px] font-extrabold text-foreground leading-tight tracking-[0px] mb-2">
                <span className="sr-only">{spec.brand} </span>{spec.model}
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

            {/* "Prix neuf en Tunisie": same block as the crawler HTML (api/og-prerender.ts). */}
            <PriceBlock block={priceBlock} />

            {/* DETAILED SPECS */}
            {/* Unified spec sheet — mirrors the printed dealer brochure look:
                one card, multiple section groups separated by uppercase
                headers + a thin primary underline. No per-section icons. */}
            <div>
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

                  {spec.colors && spec.colors.length > 0 && (
                    <SpecGroup title="Couleurs">
                      <SpecRow label="Couleurs disponibles" value={spec.colors.join(', ')} />
                    </SpecGroup>
                  )}
                </div>
              </div>
            </div>

            {/* « Les versions du … »: same table as the crawler HTML (api/og-prerender.ts). */}
            {versions && (
              <section aria-labelledby="versions-modele" className={`${S.ContentBlock} mt-6`}>
                <div className="px-6 md:px-8 py-4 border-b border-border">
                  <h2 id="versions-modele" className="font-sans text-[15px] font-extrabold uppercase tracking-[0.06em] text-foreground">
                    {versions.heading}
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-sans text-[13px] md:text-sm">
                    <thead className="bg-gray-50 text-gray-500">
                      <tr>
                        <th scope="col" className="px-4 md:px-6 py-3 font-bold">Version</th>
                        {versions.columns.map((c) => (
                          <th key={c} scope="col" className="px-4 py-3 font-bold whitespace-nowrap">{VERSION_COLUMN_LABELS[c]}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {versions.rows.map((r) => (
                        <tr key={r.name} className={r.href ? '' : 'bg-primary-50/40'}>
                          <th scope="row" className="px-4 md:px-6 py-3 font-bold text-gray-900 min-w-[10rem]">
                            {r.href ? (
                              <Link to={r.href} className="text-primary-600 hover:text-primary-700 underline-offset-4 hover:underline">{r.name}</Link>
                            ) : (
                              <span aria-current="page">{r.name}</span>
                            )}
                          </th>
                          {versions.columns.map((c) => (
                            <td key={c} className="px-4 py-3 text-gray-700 whitespace-nowrap">{r[c] || '—'}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Same models as the crawler HTML (api/og-prerender.ts). */}
            <ModelCarousel id="modeles-similaires" heading={SIMILAR_MODELS_HEADING} models={similar} />
          </div>

          {/* RIGHT COLUMN (SIDEBAR) */}
          <div className="lg:col-span-4">
            <div className="sticky top-28 space-y-6">
              {/* HEADER INFO CARD (Desktop Only) */}
              <div>
                <div className="hidden lg:block bg-card rounded-2xl border border-gray-100 shadow-sm p-6">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-sans text-[14px] font-bold text-primary-600 tracking-[0px]">{spec.brand}</span>
                  </div>
                  
                  {/* Le <h1> unique est dans l'en-tête mobile (indexation mobile). */}
                  <p className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight mb-2 leading-tight">{spec.model}</p>
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

                  {/* PRICE & ACTIONS (owner, 2026-11-19): the price with three icon
                      buttons beside it — Comparer (always), WhatsApp and Appeler
                      (subscribed importer) — then « Demander un devis » (#E65400)
                      on the whole width. In a narrow column the icons wrap
                      under the price rather than cut it. */}
                  <div className="pt-6 border-t border-gray-100 flex flex-col gap-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex flex-col flex-1 min-w-[5.5rem]">
                        <span className="text-[1.375rem] font-black text-gray-900 leading-none whitespace-nowrap">{spec.priceNew}</span>
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mt-1">Prix public TTC</span>
                      </div>
                      {canQuote && (
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={handleCompare} className={S.CardIcon} aria-label="Comparer ce modèle" title="Comparer">
                          <Scale size={20} strokeWidth={2} aria-hidden="true" />
                        </button>
                        {waHref && (
                          <a href={waHref} target="_blank" rel="noopener noreferrer" onClick={() => trackLead(spec.id, 'whatsapp', spec)} className={`${S.CardIcon} ${S.CardIconWhatsapp}`} aria-label={`Écrire à ${spec.importer.name} sur WhatsApp`} title="WhatsApp">
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d={siWhatsapp.path} /></svg>
                          </a>
                        )}
                        {callHref && (
                          <a href={callHref} onClick={() => trackLead(spec.id, 'call', spec)} className={`${S.CardIcon} ${S.CardIconCall}`} aria-label={`Appeler ${spec.importer.name}`} title={`Appeler ${spec.importer.name}`}>
                            <Phone size={20} strokeWidth={2} aria-hidden="true" />
                          </a>
                        )}
                      </div>
                      )}
                    </div>
                    {canQuote ? (
                      <button type="button" onClick={openQuote} className={S.CardQuote} aria-haspopup="dialog">
                        <FileText size={20} strokeWidth={2} aria-hidden="true" />
                        Demander un devis
                      </button>
                    ) : (
                      // Importer not subscribed: Comparer alone, the orange button with its word (owner).
                      <button type="button" onClick={handleCompare} className={S.CardQuote}>
                        <Scale size={20} strokeWidth={2} aria-hidden="true" />
                        Comparer
                      </button>
                    )}
                  </div>
                </div>
              </div>

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
              <div>
                <ImporterCard importer={spec.importer} />
              </div>
            </div>
          </div>
        </div>

        {/* Questions fréquentes, written from the sheet's own fields: same text as
            the crawler HTML (utils/techSpecSeo.ts › techSpecFaq). */}
        {faq.length > 0 && (
          <section aria-labelledby="questions-frequentes" className={`${S.ContentBlock} mt-8 md:mt-12`}>
            <div className="px-6 md:px-8 py-4 border-b border-border">
              <h2 id="questions-frequentes" className="font-sans text-[15px] font-extrabold uppercase tracking-[0.06em] text-foreground">
                {TECH_SPEC_FAQ_HEADING}
              </h2>
            </div>
            <div className="px-6 md:px-8 py-2 divide-y divide-border">
              {faq.map((f) => (
                <div key={f.question} className="py-4">
                  <h3 className="font-sans text-[15px] md:text-base font-bold text-gray-900">{f.question}</h3>
                  <p className="mt-1 font-sans text-[14px] md:text-[15px] text-gray-600 leading-relaxed">{f.answer}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Summary, last on the page: same sentence as the crawler HTML (api/og-prerender.ts). */}
        <p className="font-sans text-[14px] md:text-[15px] text-gray-600 leading-relaxed mt-8 md:mt-12">
          {techSpecSummary({
            brand: spec.brand, model: spec.model, year: spec.year, categoryLabel: spec.categoryLabel,
            cc: spec.engine?.cc, power: spec.engine?.power, price: spec.priceNew, updatedAt: spec.updatedAt,
            importerName: spec.importer?.name, importerCity: spec.importer?.city,
          })}
        </p>
        {/* Under the summary: link to the 125 cm³ scooter prices page. */}
        {priceBlock.pricesLink && (
          <p className="mt-3 text-sm font-semibold">
            <Link to={priceBlock.pricesLink.href} className="text-primary-600 hover:text-primary-700 underline-offset-4 hover:underline">
              {priceBlock.pricesLink.label}
            </Link>
          </p>
        )}
      </article>

      {/* Floating action capsule (phones and tablets): dark frosted glass that
          floats 12 px above the content and the iPhone home indicator. Price,
          call the importer, compare. Price and call are 48 px; « Comparer » is a
          smaller 40 px pill (owner's choice) inside the 56 px capsule. */}
      <FloatingCapsule hideFrom="lg" role="region" aria-label="Prix et actions" className={S.FloatBar}>
        {/* Under 360 px, with the contact buttons, the four actions take the
            row; the price stays in the page above. */}
        <div className={`${S.FloatPrice} ${canQuote ? 'hidden min-[360px]:flex' : 'flex'}`} title={capsule.kind === 'text' ? capsule.main : undefined}>
          {capsule.kind === 'amount' ? (
            <>
              <span className="text-[1rem] min-[400px]:text-[1.125rem] font-bold text-white leading-tight tabular-nums whitespace-nowrap">{capsule.main}</span>
              <span className="text-[0.75rem] font-medium text-gray-300 leading-tight tracking-[0.01em] whitespace-nowrap truncate">{capsule.sub}</span>
            </>
          ) : capsule.kind === 'text' ? (
            <span className="text-[0.875rem] font-semibold text-white leading-[1.2] line-clamp-2 break-words">{capsule.main}</span>
          ) : (
            <span className="text-[0.9375rem] font-semibold text-gray-200 leading-tight truncate">{capsule.main}</span>
          )}
        </div>
        {callHref && (
          <a
            href={callHref}
            onClick={() => trackLead(spec.id, 'call', spec)}
            className={`${S.FloatRound} ${S.FloatGlass}`}
            aria-label={`Appeler ${spec.importer.name}`}
            title={`Appeler ${spec.importer.name}`}
          >
            <Phone size={20} strokeWidth={2.2} aria-hidden="true" />
          </a>
        )}
        {waHref && (
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackLead(spec.id, 'whatsapp', spec)}
            className={`${S.FloatRound} ${S.FloatWhatsapp}`}
            aria-label={`Écrire à ${spec.importer.name} sur WhatsApp`}
            title="WhatsApp"
          >
            <svg viewBox="0 0 24 24" width="21" height="21" fill="currentColor" aria-hidden="true"><path d={siWhatsapp.path} /></svg>
          </a>
        )}
        {canQuote && (
          <button
            type="button"
            onClick={openQuote}
            className={`${S.FloatQuotePill} ${S.FloatQuote}`}
            aria-label={`Demander un devis pour le ${modelName}`}
            aria-haspopup="dialog"
          >
            <FileText size={18} strokeWidth={2.2} aria-hidden="true" />
            <span aria-hidden="true">Devis</span>
          </button>
        )}
        {/* « Comparer »: a round balance next to the contact buttons; alone
            (importer not subscribed), the orange pill with its word (owner). */}
        {canQuote ? (
          <button type="button" className={`${S.FloatRound} ${S.FloatGlass}`} onClick={handleCompare} aria-label="Comparer ce modèle" title="Comparer">
            <Scale size={20} strokeWidth={2.2} aria-hidden="true" />
          </button>
        ) : (
          <button type="button" className={`${S.FloatQuotePill} ${S.FloatQuote} !h-12 !px-4 !gap-1.5 !text-[0.9375rem]`} onClick={handleCompare}>
            <Scale size={18} strokeWidth={2.2} aria-hidden="true" />
            Comparer
          </button>
        )}
      </FloatingCapsule>

      {canQuote && (
        <QuoteRequestSheet
          open={quoteOpen}
          onClose={() => setQuoteOpen(false)}
          specId={spec.id}
          brand={spec.brand}
          model={spec.model}
          cardImage={spec.image}
          importerName={spec.importer?.name}
          pageUrl={pageUrl}
          returnFocus={quoteButtonRef}
        />
      )}

      {spec && (
        <SocialShareModal
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          content={{
            kind: 'techspec',
            id: spec.id,
            title: `${spec.brand} ${spec.model} ${spec.year || ''}`.trim(),
            subtitle: [spec.engine?.cc, spec.engine?.power, spec.priceNew].filter(Boolean).join(' • '),
            image: shareImage,
          }}
        />
      )}
    </main>
  );
};

export default memo(TechSpecsDetails);
