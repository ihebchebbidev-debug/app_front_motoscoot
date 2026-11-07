import React, { useState, useMemo, useRef, useEffect, memo, useDeferredValue } from 'react';
import {
  Layers,
  ArrowRight,
  Zap,
  Gauge,
  ChevronDown,
  Search,
  Filter,
  Activity
} from 'lucide-react';
import { useTechSpecsByBrand } from '../hooks/useTechSpecs';
import { useBrands } from '../hooks/useReferenceData';
import { Section } from './ui/Section';
import { EmptyState } from './ui/EmptyState';
import { Badge } from './ui/Badge';
import { TechSpecsHero } from './tech-specs/TechSpecsHero';
import { TechSpecModelCard as ModelCard } from './tech-specs/TechSpecModelCard';
import { ModelCardSkeleton } from './tech-specs/TechSpecsSkeletons';
import { TechSpecsErrorRetry } from './tech-specs/TechSpecsErrorRetry';
import { FilterBar, FilterOption } from './ui/FilterBar';
import { BasePageProps } from '../types';
import SEO from './common/SEO';
import { getOptimizedImageUrl, getUrlFromState, slugify } from '../utils/urlUtils';
import { matchesTechSpec, getHighlightTerms, highlightText } from '../utils/techSpecsSearch';
import { sortTechSpecs, TECH_SPEC_SORTS, type TechSpecSort } from '../utils/techSpecSort';
import { ALL, facetOptions, matchesFacets, activeFacetCount, MIN_MODELS_FOR_FILTERS } from '../utils/techSpecFacets';

const S = {
  // White from 768 px like the cards section: the filter bar sticks out 18 px
  // under the orange header, and a grey page background showed there as a band.
  Wrapper: "min-h-screen bg-[#F8F9F9] md:bg-card font-sans",
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
  
  // Grid
  // Phones: one line per model (see TechSpecModelCard rowOnPhone).
  // 3 columns until 1280 px: at 4 the cards were 141-177 px wide and the
  // specs (« Cylindrée », « 124,7 cc ») were cut.
  Grid: "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-5",
};

const TechSpecsModels: React.FC<BasePageProps> = ({ brand: brandSlug = '', onNavigate, availableInTunisia = false }) => {
  const [modelSearch, setModelSearch] = useState("");
  const deferredModelSearch = useDeferredValue(modelSearch);

  const [activeType, setActiveType] = useState('Tout');
  const [activeYear, setActiveYear] = useState('Tout');
  const [activeCC, setActiveCC] = useState('Tout');
  const [sort, setSort] = useState<TechSpecSort>('recent');

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [brandSlug]);

  const { data: allBrands = [] } = useBrands();

  // 1. Trouver le nom officiel de la marque
  const brandName = useMemo(() => {
    const found = allBrands.find(b => slugify(b.name) === slugify(brandSlug));
    return found?.name || brandSlug;
  }, [allBrands, brandSlug]);

  // 2. Modèles depuis le backend uniquement
  const {
    data: backendModels = [],
    isLoading: modelsLoading,
    isError: modelsError,
    isFetching: modelsFetching,
    refetch: refetchModels,
  } = useTechSpecsByBrand(brandName, { availableInTunisia });
  const brandModels = backendModels;
  // The query is the single source of truth for the loading state — no
  // artificial timer. This fixes the flash of skeletons that appeared
  // even when models were already cached (e.g. browser back navigation).
  const isLoading = modelsLoading;

  // Filters built from this brand's models, each option with its count
  // (other filters kept): no choice leads to « Aucun modèle » by surprise.
  const facetState = useMemo(() => ({ type: activeType, year: activeYear, cc: activeCC }), [activeType, activeYear, activeCC]);
  const typeOptions = useMemo(() => facetOptions(brandModels, facetState, 'type'), [brandModels, facetState]);
  const yearOptions = useMemo(() => facetOptions(brandModels, facetState, 'year'), [brandModels, facetState]);
  const ccOptions = useMemo(() => facetOptions(brandModels, facetState, 'cc'), [brandModels, facetState]);
  const toCounts = (opts: { value: string; count: number }[]) => Object.fromEntries(opts.map((o) => [o.value, o.count]));

  const filteredModels = useMemo(
    () => brandModels.filter((m) =>
      // Cross-field search: model name, cylindrée, puissance, catégorie, ABS…
      (!deferredModelSearch || matchesTechSpec(m, deferredModelSearch)) && matchesFacets(m, facetState)),
    [brandModels, deferredModelSearch, facetState],
  );

  const activeCount = activeFacetCount(facetState) + (modelSearch ? 1 : 0);
  const resetFilters = () => { setActiveType(ALL); setActiveYear(ALL); setActiveCC(ALL); setModelSearch(''); };
  // A brand with a handful of models: show them, no filter or sort chrome.
  const showFilters = brandModels.length >= MIN_MODELS_FOR_FILTERS;

  // Price first: the buyer's first criterion. Models without a readable value
  // (« En arrivage », missing cylinder…) go last.
  const sortedModels = useMemo(() => sortTechSpecs(filteredModels, sort), [filteredModels, sort]);

  const highlightTerms = useMemo(
    () => getHighlightTerms(deferredModelSearch),
    [deferredModelSearch],
  );

  const brandLogo = useMemo(
    () => allBrands.find(b => b.name === brandName)?.logo_url || '',
    [allBrands, brandName]
  );

  // A filter with a single choice (SYM: « Scooter » only) is left out.
  const extraFilters: FilterOption[] = ([
    {
      id: 'year',
      label: 'Année',
      options: [ALL, ...yearOptions.map((o) => o.value)],
      counts: toCounts(yearOptions),
      value: activeYear,
      onChange: setActiveYear
    },
    {
      id: 'cc',
      label: 'Cylindrée',
      options: [ALL, ...ccOptions.map((o) => o.value)],
      counts: toCounts(ccOptions),
      value: activeCC,
      onChange: setActiveCC
    }
  ] as FilterOption[]).filter((f) => f.options.length > 2 || f.value !== ALL);
  const showTypes = typeOptions.length > 1 || activeType !== ALL;

  const breadcrumbSchema = useMemo(() => ({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Accueil",
        "item": "https://www.moto-scoot.tn/"
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "Fiches Techniques",
        "item": "https://www.moto-scoot.tn/fiches-techniques"
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": brandName,
        "item": `https://www.moto-scoot.tn/fiches-techniques/${slugify(brandName)}`
      }
    ]
  }), [brandName]);

  return (
    <main className={S.Wrapper}>
      <SEO 
        title={`${brandName} : fiches techniques et prix en Tunisie`}
        description={`Fiches techniques des modèles ${brandName} vendus en Tunisie : prix du neuf en DT, cylindrée, puissance, couple, poids et consommation.`}
        url={`/fiches-techniques/${slugify(brandName)}`}
        schema={breadcrumbSchema}
      />
      
      <TechSpecsHero 
        title={`Fiches techniques ${brandName}`}
        titleOnMobile
        subtitle={`Retrouvez la fiche technique de toute la gamme ${brandName}.`}
        onBack={() => onNavigate?.('tech-specs-brands', { available_in_tunisia: availableInTunisia || undefined })}
        breadcrumbParents={[{ label: 'Fiches techniques', href: '/fiches-techniques', onClick: () => onNavigate?.('tech-specs-brands', { available_in_tunisia: availableInTunisia || undefined }) }]}
        onNavigateHome={() => onNavigate?.('home')}
        breadcrumbCurrent={brandName}
      />

      {showFilters && (
      <div className="md:pt-0">
        <FilterBar
          categories={showTypes ? [ALL, ...typeOptions.map((o) => o.value)] : []}
          categoryCounts={toCounts(typeOptions)}
          activeCategory={activeType}
          onCategoryChange={setActiveType}
          searchQuery={modelSearch}
          onSearchChange={setModelSearch}
          showSort={false}
          searchPlaceholder="Rechercher un modèle…"
          phoneSearch
          extraFilters={extraFilters}
          categoriesVariant={showTypes ? 'dropdown' : 'list'}
          categoryLabel="Type de moto"
          searchWidth="w-full md:w-[400px] lg:w-[500px]"
          sortOptions={TECH_SPEC_SORTS}
          sortValue={sort}
          onSortValueChange={(v) => setSort(v as TechSpecSort)}
          activeFilterCount={activeCount}
          onReset={resetFilters}
          applyLabel={`Voir ${filteredModels.length} modèle${filteredModels.length > 1 ? 's' : ''}`}
        />
      </div>
      )}

      <Section variant="none" className="bg-[#F8F9F9] md:bg-card pb-32 pt-4 md:pt-20">
        {modelsError && brandModels.length === 0 ? (
          <TechSpecsErrorRetry
            title="Modèles indisponibles"
            description={`Impossible de charger la gamme ${brandName}. Vérifiez votre connexion et réessayez.`}
            onRetry={() => refetchModels()}
            isRetrying={modelsFetching}
          />
        ) : isLoading ? (
          <div className={S.Grid}>
            {Array.from({ length: 6 }).map((_, idx) => <ModelCardSkeleton key={idx} />)}
          </div>
        ) : filteredModels.length > 0 ? (
          <>
          {/* Count (+ reset). The sort lives in the filter bar: a button on
              phones, a menu in the bar from 768 px. */}
          <div className="flex items-center justify-between gap-4 mb-4 md:mb-6">
            <p className="flex items-center gap-3 text-[14px] font-medium text-gray-600 tabular-nums" aria-live="polite">
              {filteredModels.length === brandModels.length
                ? `${brandModels.length} modèle${brandModels.length > 1 ? 's' : ''}`
                : `${filteredModels.length} modèle${filteredModels.length > 1 ? 's' : ''} sur ${brandModels.length}`}
              {activeCount > 0 && (
                <button type="button" onClick={resetFilters} className="font-semibold text-primary-700 underline underline-offset-2 hover:text-primary-800">
                  Réinitialiser
                </button>
              )}
            </p>
          </div>
          {/* No entrance animation: the models are there when the finger
              arrives (they used to slide in over 700 ms, reduced motion too). */}
          <div className={S.Grid}>
              {sortedModels.map((spec) => (
                <ModelCard
                  key={spec.id}
                  spec={spec}
                  highlightTerms={highlightTerms}
                  rowOnPhone
                />
              ))}
            </div>
          </>
          ) : (
            <EmptyState
              variant="card"
              icon={Layers}
              title="Aucun modèle trouvé"
              description="Aucun modèle ne correspond à vos filtres pour cette marque. Essayez de modifier votre recherche."
              action={activeCount > 0 ? { label: 'Réinitialiser les filtres', onClick: resetFilters } : undefined}
            />
          )}
      </Section>
    </main>
  );
};

export default memo(TechSpecsModels);
