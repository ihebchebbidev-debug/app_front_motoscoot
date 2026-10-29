import React, { useState, useRef, useEffect, useMemo, memo, useDeferredValue, useCallback } from 'react';
import { 
  Layers, 
  ArrowRight,
  ChevronRight,
  Tag,
  ChevronDown,
  Search,
  Zap,
  Filter
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useTechSpecsBrands, useTechSpecsSearch } from '../hooks/useTechSpecs';
import { getOptimizedImageUrl, slugify } from '../utils/urlUtils';
import { useBrands } from '../hooks/useReferenceData';
import { Section } from './ui/Section';
import { Reveal } from './ui/Reveal';
import { Badge } from './ui/Badge';
import { TechSpecsHero } from './tech-specs/TechSpecsHero';
import { BrandCardSkeleton } from './tech-specs/TechSpecsSkeletons';
import { TechSpecsErrorRetry } from './tech-specs/TechSpecsErrorRetry';
import { FilterBar, FilterOption } from './ui/FilterBar';
import { BasePageProps } from '../types';
import SEO from './common/SEO';
import { trackBrandVisit } from '../utils/trackingUtils';
import { apiClient } from '../services/apiClient';
import { importersApi } from '../services/importersApi';
import { Importer } from '../types';
import { getHighlightTerms, highlightText } from '../utils/techSpecsSearch';

const S = {
  Wrapper: "min-h-screen bg-[#F8F9F9] md:bg-muted font-sans",
  Hero: "relative w-full flex flex-col font-sans overflow-hidden h-[calc(var(--vh,1vh)*48)] md:h-[45vh] justify-center items-start text-left",
  BgContainer: "absolute inset-0 overflow-hidden z-0",
  Overlay: "absolute inset-0 bg-gradient-to-b from-primary-700 to-primary-600 opacity-95 mix-blend-multiply",
  BgImage: "absolute inset-0 w-full h-full object-cover",
  ContentWrapper: "relative z-10 flex flex-col w-full max-w-[1440px] mx-auto px-6 md:px-16 lg:px-32 h-full",
  TextSection: "w-full flex-1 flex flex-col justify-center items-start space-y-4 md:space-y-8 h-full",
  TitleGroup: "w-full flex flex-col items-start text-left gap-2 md:gap-4",
  BadgeHero: "inline-flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm mb-1 animate-fade-in-up text-[11px] md:text-[12.25px] font-bold uppercase tracking-[0px] leading-tight md:leading-[17px] text-white",
  MainTitle: "drop-shadow-md max-w-4xl text-[2.25rem] leading-[1.1] md:text-[47px] font-[900] tracking-[0px] md:leading-[49px] text-white",
  Subtitle: "max-w-none text-[15px] md:text-[20px] font-medium tracking-[0px] leading-snug md:leading-[27px] text-white",
  
  // Unified Grid & Cards
  Grid: "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6",
  Card: "group relative flex flex-col items-center justify-center w-full max-w-[211px] h-[155px] mx-auto bg-transparent cursor-pointer gap-3",
  LogoWrapper: "flex items-center justify-center w-[115px] h-[115px] transition-transform duration-300 group-hover:scale-105 shrink-0",
  LogoImage: "max-w-full max-h-full object-contain",
  BrandName: "text-[13px] font-black text-slate-900 uppercase tracking-wider group-hover:text-orange-600 transition-colors text-center w-full truncate px-2",
  
  // Filter Styles
  FilterGroup: "flex-1 flex items-center gap-2 px-4 py-3.5 md:py-4 rounded-xl md:rounded-2xl bg-slate-50 hover:bg-slate-100 transition-colors group relative border-none appearance-none cursor-pointer font-bold text-slate-900 text-sm md:text-base outline-none",
};

const DEFAULT_POPULAR_BRANDS = ["Peugeot Motorcycles", "Piaggio", "SYM", "Voge", "Kymco", "CFMoto"];

const COUNTRIES: Record<string, string[]> = {
  "Inde": [],
  "Chine": ["Voge", "SYM", "Kymco", "QJMotor", "Zontes", "Teyin", "CForce", "Novago", "Lifan", "Sanya", "Haojin", "CFMoto", "Letbe", "Yadea", "PISTA HR+", "Ghost", "Blaster", "Dayun Motorcycle", "Senke", "Ki-Motors"],
  "Japon": ["Suzuki", "Yamaha", "Honda", "Kawasaki"],
  "Allemagne": ["BMW"],
  "Italie": ["Piaggio", "Aprilia"],
  "France": ["Peugeot Motorcycles"]
};

const BrandCard = memo(({ brand, onClick, logoMap }: { brand: string; onClick: (brand: string) => void; logoMap: Record<string, string> }) => (
  <button onClick={() => onClick(brand)} className={S.Card} aria-label={`Voir les modèles ${brand}`}>
    <div className={S.LogoWrapper}>
      {logoMap[brand] ? (
        <img src={logoMap[brand]} alt={brand} className={S.LogoImage} referrerPolicy="no-referrer" loading="lazy" decoding="async" />
      ) : (
        <Layers size={32} className="text-slate-300" />
      )}
    </div>
    <span className={S.BrandName}>{brand}</span>
  </button>
));

const TechSpecsBrands: React.FC<BasePageProps> = ({ onNavigate, availableInTunisia = false }) => {
  const [brandSearch, setBrandSearch] = useState("");
  const deferredBrandSearch = useDeferredValue(brandSearch);
  const [isLoading, setIsLoading] = useState(true);
  const [activeImporter, setActiveImporter] = useState('Tout');
  const [activeCountry, setActiveCountry] = useState('Tout');

  const {
    data: backendBrands = [],
    isLoading: brandsLoading,
    isError: brandsError,
    isFetching: brandsFetching,
    refetch: refetchBrands,
  } = useTechSpecsBrands({ availableInTunisia });
  const { data: brandsWithLogos = [] } = useBrands();

  // Importers are fully managed by admin. Each importer carries a list of
  // brands derived server-side from tech_specs.importer_id assignments,
  // so the filter stays in sync with reality without manual mapping.
  const { data: importers = [] } = useQuery<Importer[]>({
    queryKey: ['importers', 'with-brands'],
    queryFn: ({ signal }) => importersApi.list({ withBrands: true, activeOnly: true }, signal),
    staleTime: 1000 * 60 * 5,
  });

  const importersMap = useMemo<Record<string, string[]>>(() => {
    const m: Record<string, string[]> = {};
    for (const imp of importers) {
      if (imp?.name) m[imp.name] = imp.brands || [];
    }
    return m;
  }, [importers]);

  // Community-wide popular brands — fully dynamic, served by the backend.
  // Cached by react-query so subsequent navigations render instantly without
  // a reshuffle. No localStorage involved.
  const { data: popularBrandsData, isLoading: popularLoading } = useQuery<string[]>({
    queryKey: ['brands', 'popular'],
    queryFn: async ({ signal }) => {
      const data = await apiClient.get<{ brands?: string[] }>('/brands/popular', { signal });
      return data?.brands ?? [];
    },
    staleTime: 1000 * 60 * 10,
    retry: 1,
  });
  // Cross-field model search — surfaces matching specs (Yamaha MT-07, 689cc,
  // 73 ch, "Sport"...) when the user types ≥2 chars, even if the brand
  // grid filtered them out.
  const { data: matchingSpecs = [], isFetching: searchingSpecs } =
    useTechSpecsSearch(deferredBrandSearch, { availableInTunisia });

  const logoMap = useMemo(
    () => Object.fromEntries(brandsWithLogos.map(b => [b.name, b.logo_url || ''])),
    [brandsWithLogos]
  );

  // Drive the local skeleton flag off the actual query state — including
  // initial fetches that happen after a retry — so users always see the
  // skeleton grid (not a flash of empty state) while data is loading.
  useEffect(() => {
    setIsLoading(brandsLoading);
  }, [brandsLoading]);

  const sortedBrands = useMemo(() => {
    const allBrands = new Set<string>(backendBrands);
    // Normalize and remove duplicates (e.g., "SYM" vs "Sym")
    const normalizedBrands = Array.from(allBrands)
      .filter(b => b !== "Autre")
      .reduce((acc: string[], curr) => {
        if (!acc.some(b => b.toLowerCase() === curr.toLowerCase())) {
          acc.push(curr);
        }
        return acc;
      }, [])
      .sort((a, b) => a.localeCompare(b));

    return normalizedBrands;
  }, [backendBrands]);

  // Use a primitive key so the effect only fires when the actual brand SET
  // changes (not on every render where useTechSpecsBrands returns a new
  // array reference). Prior implementation caused an infinite render loop
  // → 50+ /api/brands/popular calls per second.
  // Derive the final popular list once both queries have resolved. Filter
  // server-returned brands against the known catalogue, then top up with
  // defaults if the backend returned fewer than 6. Memoized so the array
  // reference is stable across re-renders → no Reveal animation replay.
  const popularBrands = useMemo<string[]>(() => {
    const limit = 6;
    const known = new Set(sortedBrands);
    const fromApi = (popularBrandsData ?? []).filter(b => known.has(b));
    const result: string[] = [];
    const seen = new Set<string>();
    for (const b of fromApi) {
      if (seen.has(b)) continue;
      seen.add(b);
      result.push(b);
      if (result.length >= limit) break;
    }
    if (result.length < limit) {
      for (const b of DEFAULT_POPULAR_BRANDS) {
        if (seen.has(b)) continue;
        if (!known.has(b)) continue;
        seen.add(b);
        result.push(b);
        if (result.length >= limit) break;
      }
    }
    return result;
  }, [popularBrandsData, sortedBrands]);

  const popularReady = !popularLoading && !brandsLoading;

  const filteredBrands = useMemo(() => {
    let filtered = sortedBrands;
    
    if (deferredBrandSearch) {
      const searchLower = deferredBrandSearch.toLowerCase();
      filtered = filtered.filter(b => b.toLowerCase().includes(searchLower));
    }

    if (activeImporter !== 'Tout') {
      const allowedBrands = importersMap[activeImporter] || [];
      filtered = filtered.filter(b => allowedBrands.some(allowed => b.toLowerCase() === allowed.toLowerCase()));
    }

    if (activeCountry !== 'Tout') {
      const allowedBrands = COUNTRIES[activeCountry] || [];
      filtered = filtered.filter(b => allowedBrands.some(allowed => b.toLowerCase() === allowed.toLowerCase()));
    }

    return filtered;
  }, [sortedBrands, deferredBrandSearch, activeImporter, activeCountry, importersMap]);


  const extraFilters: FilterOption[] = useMemo(() => [
    {
      id: 'importer',
      label: 'Importateur',
      options: ['Tout', ...Object.keys(importersMap)],
      value: activeImporter,
      onChange: setActiveImporter
    },
    {
      id: 'country',
      label: 'Pays',
      options: ['Tout', ...Object.keys(COUNTRIES)],
      value: activeCountry,
      onChange: setActiveCountry
    }
  ], [activeImporter, activeCountry, importersMap]);

  const handleBrandClick = useCallback((brand: string) => {
    trackBrandVisit(brand);
    onNavigate?.('tech-specs-models', { brand, available_in_tunisia: availableInTunisia || undefined });
  }, [onNavigate, availableInTunisia]);

  // Open a spec directly from the cross-search results card.
  const handleSpecClick = useCallback((spec: any) => {
    const slug = `${spec.brand}-${spec.model}-${spec.year}`;
    onNavigate?.('tech-specs-details', { id: spec.id, specId: spec.id, slug });
  }, [onNavigate]);

  const highlightTerms = useMemo(
    () => getHighlightTerms(deferredBrandSearch),
    [deferredBrandSearch],
  );

  const breadcrumbSchema = useMemo(() => ({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Accueil",
        "item": "https://moto-scoot.tn"
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "Fiches Techniques",
        "item": "https://www.moto-scoot.tn/fiches-techniques"
      }
    ]
  }), []);

  return (
    <main className={S.Wrapper}>
      <SEO 
        title="Fiches Techniques Moto & Scooter en Tunisie | Catalogue Complet" 
        description="Consultez les fiches techniques, caractéristiques, performances et prix du neuf pour toutes les marques de motos et scooters en Tunisie (Peugeot, Piaggio, Voge...)."
        url="/fiches-techniques"
        schema={breadcrumbSchema}
      />
      
      <TechSpecsHero 
        title="Fiches Techniques"
        subtitle="Caractéristiques officielles, performances et prix du neuf de plus de 250 modèles."
        onNavigateHome={() => onNavigate?.('home')}
        breadcrumbCurrent="Fiches Techniques"
        onBack={() => onNavigate?.('home')}
      />

      {/* Mobile/desktop unified filter bar — matches Annonces & Blogs (sort
          pill + dark Filtres button on mobile; search input on desktop). */}
      <div className="md:pt-0">
        <FilterBar
          categories={[]}
          activeCategory=""
          onCategoryChange={() => {}}
          searchQuery={brandSearch}
          onSearchChange={setBrandSearch}
          showSort={false}
          searchPlaceholder="Rechercher une marque, modèle, CC…"
          searchWidth="w-full md:w-[400px] lg:w-[500px]"
        />
      </div>

      {/* CROSS-FIELD MODEL MATCHES — when the user types a query, surface
          matching models (any brand, any spec field) so they don't have to
          drill through brand → models manually. Hidden when no query. */}
      {deferredBrandSearch.trim().length >= 2 && (
        <Section variant="none" className="bg-[#F8F9F9] md:bg-card pt-10 md:pt-14 pb-0">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg md:text-xl font-[900] text-slate-900 uppercase tracking-tighter">
              Modèles correspondants
            </h2>
            <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">
              {searchingSpecs ? '…' : `${matchingSpecs.length} fiche${matchingSpecs.length > 1 ? 's' : ''}`}
            </span>
          </div>
          {matchingSpecs.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
              {matchingSpecs.slice(0, 12).map((spec, idx) => (
                <Reveal key={spec.id} animation="fade-in-up" delay={(idx % 8) * 30}>
                  <button
                    type="button"
                    onClick={() => handleSpecClick(spec)}
                    className="group flex items-center gap-3 w-full text-left bg-card border border-slate-100 hover:border-primary-200 hover:shadow-sm rounded-xl p-3 transition-all"
                    aria-label={`Voir la fiche ${spec.brand} ${spec.model}`}
                  >
                    <img
                      src={getOptimizedImageUrl(spec.image, 120, 90, 80, undefined, `${spec.brand} ${spec.model}`)}
                      alt={`${spec.brand} ${spec.model}`}
                      className="w-16 h-16 rounded-lg object-cover bg-slate-50 shrink-0"
                      loading="lazy"
                      decoding="async"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-black text-slate-900 truncate group-hover:text-primary-600 transition-colors">
                        {highlightText(`${spec.brand} ${spec.model}`, highlightTerms)}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {highlightText(spec.year, highlightTerms)} · {highlightText(spec.engine?.cc || '—', highlightTerms)} · {highlightText(spec.engine?.power || '—', highlightTerms)}
                      </p>
                      {spec.category && (
                        <Badge variant="primary" className="mt-1 text-[9px] px-1.5 py-0">
                          {highlightText(spec.category, highlightTerms)}
                        </Badge>
                      )}
                    </div>
                    <ChevronRight size={16} className="text-slate-300 group-hover:text-primary-500 shrink-0" />
                  </button>
                </Reveal>
              ))}
            </div>
          ) : !searchingSpecs ? (
            <p className="text-sm text-slate-400 italic">Aucun modèle ne correspond à « {deferredBrandSearch} ».</p>
          ) : null}
          {matchingSpecs.length > 12 && (
            <p className="text-xs text-slate-500 mt-3 text-center">
              Affichage des 12 premiers résultats — affinez votre recherche pour voir le reste.
            </p>
          )}
        </Section>
      )}

      <Section variant="none" className="bg-[#F8F9F9] md:bg-card pt-4 md:pt-24 pb-20 md:pb-32">
        {/* Error + retry surface — shown only when the brands query failed
            and we have no cached data to fall back on. */}
        {brandsError && backendBrands.length === 0 && (
          <div className="mb-12">
            <TechSpecsErrorRetry
              title="Marques indisponibles"
              description="Le catalogue des marques n'a pas pu être chargé. Vérifiez votre connexion et réessayez."
              onRetry={() => refetchBrands()}
              isRetrying={brandsFetching}
            />
          </div>
        )}

        {/* POPULAR BRANDS - Only show when no search/filter */}
        {!brandSearch && (
            <div className="mb-24">
              <div className="flex items-center justify-between mb-10">
                <h2 className="text-2xl font-[900] text-slate-900 uppercase tracking-tighter">
                  {availableInTunisia ? 'Marques Populaires Tunisie' : 'Marques Populaires'}
                </h2>
                <div className="h-px flex-1 bg-slate-100 mx-8 hidden md:block"></div>
              </div>
              <div className={`${S.Grid} mb-12 md:mb-16`}>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, idx) => <BrandCardSkeleton key={idx} />)
                ) : !popularReady ? (
                  Array.from({ length: 6 }).map((_, idx) => <BrandCardSkeleton key={`pop-${idx}`} />)
                ) : (
                  popularBrands.map((brand, idx) => (
                    <Reveal key={brand} animation="fade-in-up" delay={idx * 40}>
                      <BrandCard
                        brand={brand}
                        onClick={handleBrandClick}
                        logoMap={logoMap}
                      />
                    </Reveal>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ALL BRANDS GRID */}
          <div className="flex items-center justify-between mb-10">
            <h2 className="text-2xl font-[900] text-slate-900 uppercase tracking-tighter">
              {brandSearch ? `Résultats pour "${brandSearch}"` : availableInTunisia ? "Toutes les marques Tunisie" : "Toutes les marques"}
            </h2>
            <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">{filteredBrands.length} Marques</span>
          </div>

          {isLoading ? (
            <div className={S.Grid}>
              {Array.from({ length: 18 }).map((_, idx) => <BrandCardSkeleton key={idx} />)}
            </div>
          ) : filteredBrands.length > 0 ? (
            <div className={S.Grid}>
              {filteredBrands.map((brand, idx) => (
                <Reveal key={brand} animation="fade-in-up" delay={idx % 10 * 20}>
                  <BrandCard
                    brand={brand}
                    onClick={handleBrandClick}
                    logoMap={logoMap}
                  />
                </Reveal>
              ))}
            </div>
          ) : (
            <div className="py-32 text-center bg-card rounded-[40px] border border-dashed border-slate-200">
              <Search size={48} className="mx-auto text-slate-200 mb-6" />
              <h3 className="text-xl font-black text-slate-400 uppercase">Aucune marque trouvée</h3>
              <p className="text-slate-400 text-sm mt-2">Essayez une autre recherche ou lettre.</p>
            </div>
          )}
      </Section>
    </main>
  );
};

export default memo(TechSpecsBrands);
