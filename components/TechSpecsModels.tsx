import React, { useState, useMemo, useRef, useEffect, memo, useDeferredValue } from 'react';
import { 
  Layers, 
  ArrowRight, 
  Zap, 
  Gauge, 
  ChevronDown,
  ArrowLeft,
  Search,
  Filter,
  Activity
} from 'lucide-react';
import { useTechSpecsByBrand } from '../hooks/useTechSpecs';
import { useBrands } from '../hooks/useReferenceData';
import { Section } from './ui/Section';
import { EmptyState } from './ui/EmptyState';
import { Reveal } from './ui/Reveal';
import { Badge } from './ui/Badge';
import { TechSpecsHero } from './tech-specs/TechSpecsHero';
import { TechSpecModelCard as ModelCard } from './tech-specs/TechSpecModelCard';
import { ModelCardSkeleton } from './tech-specs/TechSpecsSkeletons';
import { TechSpecsErrorRetry } from './tech-specs/TechSpecsErrorRetry';
import { FilterBar, FilterOption } from './ui/FilterBar';
import { BasePageProps } from '../types';
import SEO from './common/SEO';
import { getOptimizedImageUrl, getUrlFromState, slugify } from '../utils/urlUtils';
import { Link } from 'react-router-dom';
import { matchesTechSpec, getHighlightTerms, highlightText } from '../utils/techSpecsSearch';

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
  
  // Grid
  Grid: "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 md:gap-5",
};

const TechSpecsModels: React.FC<BasePageProps> = ({ brand: brandSlug = '', onNavigate, availableInTunisia = false }) => {
  const [modelSearch, setModelSearch] = useState("");
  const deferredModelSearch = useDeferredValue(modelSearch);

  const [activeType, setActiveType] = useState('Tout');
  const [activeYear, setActiveYear] = useState('Tout');
  const [activeCC, setActiveCC] = useState('Tout');

  const techCategories = useMemo(() => [
    'Tout', 
    'Naked / Roadster', 
    'Sport', 
    'Adventure / Trail', 
    'Scooter', 
    'Maxi Scooter', 
    'Off-Road / Enduro'
  ], []);

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

  const availableYears = useMemo(() => {
    const years = Array.from(
      new Set(brandModels.map(m => (m.year != null ? String(m.year) : '')).filter(Boolean)),
    ).sort((a: string, b: string) => parseInt(b) - parseInt(a));
    return ['Tout', ...years];
  }, [brandModels]);

  const parseCC = (ccStr?: string) => {
    const match = (ccStr || '').match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  };

  const filteredModels = useMemo(() => {
    return brandModels.filter(m => {
      // Cross-field search: matches model name, cylindrée, puissance,
      // catégorie, transmission, ABS/TCS, modes de conduite, etc.
      const matchesSearch = !deferredModelSearch || matchesTechSpec(m, deferredModelSearch);
      
      // Type filter mapping
      let matchesType = true;
      if (activeType !== 'Tout') {
        const cc = parseCC(m.engine?.cc);
        const cat = m.category as string;
        if (activeType === 'Naked / Roadster') {
          matchesType = cat === 'Roadster';
        } else if (activeType === 'Sport') {
          matchesType = cat === 'Sport' || cat === 'Sportive';
        } else if (activeType === 'Adventure / Trail') {
          matchesType = cat === 'Trail' || cat === 'Adventure';
        } else if (activeType === 'Scooter') {
          matchesType = cat === 'Scooter' && cc < 400;
        } else if (activeType === 'Maxi Scooter') {
          matchesType = cat === 'Scooter' && cc >= 400;
        } else if (activeType === 'Off-Road / Enduro') {
          matchesType = cat === 'Off-road' || cat === 'Enduro';
        } else {
          matchesType = cat === activeType;
        }
      }

      // Year filter
      const matchesYear = activeYear === 'Tout' || String(m.year ?? '') === activeYear;

      // CC filter
      let matchesCC = true;
      if (activeCC !== 'Tout') {
        const cc = parseCC(m.engine?.cc);
        if (activeCC === '50-125') matchesCC = cc >= 50 && cc <= 125;
        else if (activeCC === '125-560') matchesCC = cc > 125 && cc <= 560;
        else if (activeCC === '560-1300') matchesCC = cc > 560 && cc <= 1300;
      }

      return matchesSearch && matchesType && matchesYear && matchesCC;
    });
  }, [brandModels, deferredModelSearch, activeType, activeYear, activeCC]);

  const highlightTerms = useMemo(
    () => getHighlightTerms(deferredModelSearch),
    [deferredModelSearch],
  );

  const brandLogo = useMemo(
    () => allBrands.find(b => b.name === brandName)?.logo_url || '',
    [allBrands, brandName]
  );

  const extraFilters: FilterOption[] = [
    {
      id: 'year',
      label: 'Année',
      options: availableYears,
      value: activeYear,
      onChange: setActiveYear
    },
    {
      id: 'cc',
      label: 'Cylindrée (CC)',
      options: ['Tout', '50-125', '125-560', '560-1300'],
      value: activeCC,
      onChange: setActiveCC
    }
  ];

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
        backText="Retour au catalogue"
        onNavigateHome={() => onNavigate?.('home')}
        breadcrumbCurrent={brandName}
      />

      <div className="md:pt-0">
        <FilterBar
          categories={techCategories}
          activeCategory={activeType}
          onCategoryChange={setActiveType}
          searchQuery={modelSearch}
          onSearchChange={setModelSearch}
          showSort={false}
          searchPlaceholder={`Rechercher ${brandName} (modèle, CC, puissance, catégorie…)`}
          extraFilters={extraFilters}
          categoriesVariant="dropdown"
          categoryLabel="Type de moto"
          searchWidth="w-full md:w-[400px] lg:w-[500px]"
        />
      </div>

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
          <div className={S.Grid}>
              {filteredModels.map((spec, idx) => (
                <Reveal key={spec.id} animation="fade-in-up" delay={idx % 6 * 50}>
                  <ModelCard 
                    spec={spec} 
                    highlightTerms={highlightTerms}
                  />
                </Reveal>
              ))}
            </div>
          ) : (
            <EmptyState
              variant="card"
              icon={Layers}
              title="Aucun modèle trouvé"
              description="Aucun modèle ne correspond à vos filtres pour cette marque. Essayez de modifier votre recherche."
            />
          )}
      </Section>
    </main>
  );
};

export default memo(TechSpecsModels);
