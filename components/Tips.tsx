import React, { useState, useMemo } from 'react';
import { Clock, Search, ArrowRight, Calendar, Lightbulb } from 'lucide-react';
import { useTips } from '../hooks/useTips';
import { Badge } from './ui/Badge';
import { Section } from './ui/Section';
import { Reveal } from './ui/Reveal';
import { FilterBar } from './ui/FilterBar';
import { BasePageProps } from '../types';
import { TechSpecsHero } from './tech-specs/TechSpecsHero';
import { TechSpecsErrorRetry } from './tech-specs/TechSpecsErrorRetry';
import SEO from './common/SEO';

const S = {
  Wrapper: "min-h-screen bg-[#F8F9F9] md:bg-muted font-sans",
  Hero: "relative w-full flex flex-col font-sans overflow-hidden h-[calc(var(--vh,1vh)*48)] md:h-[45vh] justify-center items-start text-left",
  BgContainer: "absolute inset-0 overflow-hidden z-0",
  Overlay: "absolute inset-0 bg-gradient-to-b from-primary-700 to-primary-600 opacity-95 mix-blend-multiply",
  BgImage: "absolute inset-0 w-full h-full object-cover",
  ContentWrapper: "relative z-10 flex flex-col w-full max-w-7xl mx-auto px-6 md:px-20 lg:px-32 h-full",
  TextSection: "w-full flex-1 flex flex-col justify-center items-start space-y-4 md:space-y-8 h-full",
  TitleGroup: "w-full flex flex-col items-start text-left gap-2 md:gap-4",
  BadgeHero: "inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm mb-1 animate-fade-in-up text-[12.25px] font-bold uppercase tracking-[0px] leading-[17px] text-white",
  MainTitle: "drop-shadow-md max-w-4xl text-[47px] font-[900] tracking-[0px] leading-[49px] text-white",
  Subtitle: "max-w-none text-[20px] font-medium tracking-[0px] leading-[27px] text-white",
  Grid: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-10",
  TipCard: "group cursor-pointer flex flex-col h-full bg-card p-3.5 rounded-2xl shadow-sm hover:shadow-md hover:border-primary-100 border border-gray-100 transition-all duration-500",
  ImageWrapper: "relative aspect-[16/10] overflow-hidden rounded-t-[14px] -mt-3.5 -mx-3.5 bg-card mb-6 p-0",
};

const Tips: React.FC<BasePageProps> = ({ onNavigate }) => {
  const [activeCategory, setActiveCategory] = useState('Tout');
  const [searchQuery, setSearchQuery] = useState('');
  const { data: tips = [], isLoading, isError, isFetching, refetch } = useTips();

  // Categories derive from real data; "Tout" always first.
  const categories = useMemo(() => {
    const set = new Set<string>();
    tips.forEach((t: any) => t.category && set.add(t.category));
    return ['Tout', ...Array.from(set)];
  }, [tips]);

  const filteredTips = useMemo(() => {
    return tips.filter(t => {
      const matchesCat = activeCategory === 'Tout' || t.category === activeCategory;
      const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCat && matchesSearch;
    });
  }, [activeCategory, searchQuery, tips]);

  const getDiffVariant = (diff: string): any => {
    if (diff === 'Débutant') return 'success';
    if (diff === 'Expert') return 'error';
    return 'warning';
  };

  // Dynamic SEO derived from admin tip content.
  const seo = useMemo(() => {
    const count = tips.length;
    // Fallback metadata while admin tips are still loading — replaced as soon
    // as data arrives (useMemo re-runs on tips/activeCategory change).
    if (isLoading && count === 0) {
      return {
        title: 'Conseils Moto & Entretien — Chargement des guides… | moto-scoot.tn',
        description: "Chargement des derniers conseils d'entretien, sécurité et pilotage moto en Tunisie. Guides pratiques mis à jour par notre équipe.",
        keywords: [
          'conseils moto',
          'entretien moto Tunisie',
          'sécurité deux-roues',
          'guide pilotage moto',
        ],
        heroImage: undefined as string | undefined,
        schemas: [{
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: 'Conseils Moto & Entretien',
          description: 'Guides pratiques pour motards en Tunisie.',
          url: 'https://www.moto-scoot.tn/conseils',
          inLanguage: 'fr-TN',
        }],
      };
    }
    const categoryList = Array.from(
      new Set(tips.map((t: any) => t.category).filter(Boolean))
    ) as string[];
    const latest = [...tips].sort((a: any, b: any) => {
      const da = new Date(a?.publishedAt || a?.date || 0).getTime();
      const db = new Date(b?.publishedAt || b?.date || 0).getTime();
      return db - da;
    });
    const heroImage = latest[0]?.image;

    const filterContext =
      activeCategory !== 'Tout'
        ? `${activeCategory} — `
        : '';
    const title = count > 0
      ? `${filterContext}Conseils Moto & Entretien (${count} guides) en Tunisie`
      : 'Conseils Moto & Entretien — Guides Pratiques en Tunisie';

    const description = count > 0
      ? `Découvrez ${count} conseils${activeCategory !== 'Tout' ? ` sur ${activeCategory}` : ''} : ${categoryList.slice(0, 4).join(', ')}. Guides d'entretien, sécurité et pilotage pour motards en Tunisie.`
      : "Guides d'entretien, sécurité, pilotage et achat-vente pour motards en Tunisie.";

    const keywords = [
      'conseils moto',
      'entretien moto Tunisie',
      'sécurité deux-roues',
      'guide pilotage moto',
      ...categoryList.slice(0, 6).map((c) => `conseils ${c.toLowerCase()}`),
    ];

    const itemListSchema = count > 0 ? {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'Conseils Moto & Entretien',
      numberOfItems: count,
      itemListElement: latest.slice(0, 20).map((t: any, i: number) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `https://www.moto-scoot.tn/conseils/${t.id}`,
        name: t.title,
      })),
    } : null;

    const collectionSchema = {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Conseils Moto & Entretien',
      description,
      url: 'https://www.moto-scoot.tn/conseils',
      inLanguage: 'fr-TN',
    };

    const schemas = itemListSchema ? [collectionSchema, itemListSchema] : [collectionSchema];
    return { title, description, keywords, heroImage, schemas };
  }, [tips, activeCategory, isLoading]);

  return (
    <div className={S.Wrapper}>
      <SEO
        title={seo.title}
        description={seo.description}
        image={seo.heroImage}
        url="/conseils"
        keywords={seo.keywords}
        schema={seo.schemas}
        breadcrumbs={[
          { name: 'Accueil', url: '/' },
          { name: 'Conseils', url: '/conseils' },
        ]}
      />
      <TechSpecsHero 
        title="Entretien & Conseil"
        subtitle="Astuces d'entretien, guides de sécurité et conseils de pilotage pour prolonger la vie de votre deux-roues."
        onNavigateHome={() => onNavigate?.('home')}
        onBack={() => onNavigate?.('home')}
        breadcrumbCurrent="Entretien & Conseil"
      />

      <div className="md:pt-0">
        <FilterBar
          categories={categories}
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          showSort={false}
          searchPlaceholder="Chercher un conseil..."
        />
      </div>

      <div className="md:hidden flex flex-col w-full">
        <div className="px-6 pb-20 w-full mt-4">
          {isLoading ? (
            <div className="space-y-4 mt-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 mb-6 animate-pulse">
                  <div className="w-24 h-24 rounded-[18px] bg-gray-200 shrink-0" />
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="h-2 w-20 bg-gray-200 rounded" />
                    <div className="h-3 w-full bg-gray-200 rounded" />
                    <div className="h-3 w-2/3 bg-gray-200 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="mt-6"><TechSpecsErrorRetry onRetry={() => refetch()} isRetrying={isFetching} /></div>
          ) : filteredTips.length > 0 ? (
            <div className="space-y-4 mt-4">
              {filteredTips.map((tip, idx) => (
                <Reveal key={tip.id} animation="fade-in-up" delay={idx * 50}>
                  <div className="flex items-center gap-4 mb-6 group active:scale-[0.98] transition-transform" onClick={() => onNavigate?.('tip-details', { id: tip.id, title: tip.title })}>
                    <img src={tip.image} className="w-24 h-24 rounded-[18px] object-cover bg-gray-100 shrink-0 shadow-sm" alt="" loading="lazy" decoding="async" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <button 
                          onClick={(e) => { e.stopPropagation(); setActiveCategory(tip.category); }}
                          className="text-[9px] font-[900] text-primary-600 uppercase tracking-widest"
                        >
                          {tip.category}
                        </button>
                        <span className="text-[9px] font-black text-gray-300 uppercase">{tip.date}</span>
                      </div>
                      <h4 className="text-[14px] font-[800] text-gray-900 leading-[1.3] mb-2 line-clamp-2 tracking-tight">{tip.title}</h4>
                      <div className="flex items-center gap-2 text-[9px] font-bold text-gray-400">
                        <Clock size={11} className="text-gray-300" />
                        <span>{tip.readTime}</span>
                      </div>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          ) : (
            <div className="py-20 text-center">
              <p className="text-gray-400 font-bold">Aucun conseil trouvé.</p>
              <button onClick={() => { setActiveCategory('Tout'); setSearchQuery(''); }} className="mt-4 text-primary-600 font-black text-xs uppercase underline">Afficher tout</button>
            </div>
          )}
        </div>
      </div>

      <div className="hidden md:block">
        <Section variant="none" className="bg-[#F8F9F9] md:bg-gray-50 pb-24 pt-16">
          {isLoading ? (
            <div className={S.Grid}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex flex-col h-full bg-card p-3.5 rounded-2xl border border-gray-100 animate-pulse">
                  <div className="aspect-[16/10] -mt-3.5 -mx-3.5 mb-6 rounded-t-[14px] bg-gray-200" />
                  <div className="px-3 space-y-3">
                    <div className="h-3 w-32 bg-gray-200 rounded" />
                    <div className="h-5 w-full bg-gray-200 rounded" />
                    <div className="h-5 w-3/4 bg-gray-200 rounded" />
                    <div className="h-3 w-full bg-gray-200 rounded" />
                    <div className="h-3 w-5/6 bg-gray-200 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : isError ? (
            <TechSpecsErrorRetry onRetry={() => refetch()} isRetrying={isFetching} />
          ) : (
          <div className={S.Grid}>
            {filteredTips.map((tip, idx) => (
              <Reveal key={tip.id} animation="fade-in-up" delay={idx * 100}>
                <article onClick={() => onNavigate?.('tip-details', { id: tip.id, title: tip.title })} className={S.TipCard}>
                  <div className={S.ImageWrapper}>
                    <img src={tip.image} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt={tip.title} loading="lazy" decoding="async" />
                    <div className="absolute top-4 left-4 flex gap-2">
                       <Badge variant="default" size="xs" className="bg-card/95 text-gray-900 border-none shadow-sm">{tip.category}</Badge>
                       <Badge variant={getDiffVariant(tip.difficulty)} size="xs" className="border-none shadow-sm">{tip.difficulty}</Badge>
                    </div>
                  </div>
                  <div className="px-3">
                    <div className="flex items-center gap-4 text-[12px] font-black text-gray-400 uppercase mb-4">
                      <div className="flex items-center gap-1.5"><Calendar size={12} className="text-primary-600" /> {tip.date}</div>
                      <div className="flex items-center gap-1.5"><Clock size={12} /> {tip.readTime}</div>
                    </div>
                    <h3 className="text-xl font-[900] text-foreground leading-[1.2] mb-4 group-hover:text-primary-600 transition-colors line-clamp-2 tracking-tight">{tip.title}</h3>
                    <p className="text-gray-500 text-sm font-medium line-clamp-3 leading-relaxed mb-8">{tip.summary}</p>
                    <div className="flex items-center gap-3 text-[12px] font-black uppercase text-foreground group-hover:text-primary-600 transition-colors">
                      Lire le guide <ArrowRight size={14} className="text-primary-600" />
                    </div>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
          )}
          {!isLoading && !isError && filteredTips.length === 0 && (
            <div className="py-32 text-center">
              <h3 className="text-2xl font-black text-gray-300 italic">Aucun conseil trouvé.</h3>
              <button onClick={() => { setActiveCategory('Tout'); setSearchQuery(''); }} className="mt-4 text-primary-600 font-black uppercase underline">Réinitialiser</button>
            </div>
          )}
        </Section>
      </div>
    </div>
  );
};

export default Tips;