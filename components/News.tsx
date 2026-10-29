import React, { useState, useMemo, useEffect } from 'react';
import { 
  Clock, 
  ArrowRight, 
  Calendar 
} from 'lucide-react';
import { useArticles } from '../hooks/useArticles';
import { Badge } from './ui/Badge';
import { Section } from './ui/Section';
import { Reveal } from './ui/Reveal';
import { FilterBar } from './ui/FilterBar';
import { BasePageProps } from '../types';
import { TechSpecsHero } from './tech-specs/TechSpecsHero';
import SEO from './common/SEO';

const S = {
  Wrapper: "min-h-screen bg-[#F8F9F9] md:bg-muted font-sans",
  
  // Style Hero : Hauteur calibrée (48dvh/45vh), Alignement à GAUCHE
  Hero: "relative w-full flex flex-col font-sans overflow-hidden h-[calc(var(--vh,1vh)*48)] md:h-[45vh] justify-center items-start text-left",
  
  // Fond identique à Hero.tsx
  BgContainer: "absolute inset-0 overflow-hidden z-0",
  Overlay: "absolute inset-0 bg-gradient-to-b from-primary-700 to-primary-600 opacity-95 mix-blend-multiply",
  BgImage: "absolute inset-0 w-full h-full object-cover",
  
  // Alignement du conteneur mis à jour pour correspondre aux paddings de Section.tsx (md:px-20 lg:px-32)
  ContentWrapper: "relative z-10 flex flex-col w-full max-w-7xl mx-auto px-6 md:px-20 lg:px-32 h-full",
  
  TextSection: "w-full flex-1 flex flex-col justify-center items-start space-y-4 md:space-y-8 h-full",
  
  TitleGroup: "w-full flex flex-col items-start text-left gap-2 md:gap-4",
  
  BadgeHero: "inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm mb-1 animate-fade-in-up text-[12.25px] font-bold uppercase tracking-[0px] leading-[17px] text-white",
  
  MainTitle: "drop-shadow-md max-w-4xl text-[47px] font-[900] tracking-[0px] leading-[49px] text-white",
  
  Subtitle: "max-w-none text-[20px] font-medium tracking-[0px] leading-[27px] text-white",

  // Grille et cartes
  DesktopGrid: "hidden md:grid grid-cols-2 lg:grid-cols-3 gap-8 md:gap-10",
  ArticleCard: "group cursor-pointer flex flex-col h-full bg-card p-3.5 rounded-2xl shadow-sm hover:shadow-md hover:border-primary-100 border border-gray-100 transition-all duration-500",
  ImageWrapper: "relative aspect-[16/10] overflow-hidden rounded-t-[14px] -mt-3.5 -mx-3.5 bg-card mb-6 p-0",
  ArticleTitle: "text-base md:text-lg font-[900] text-foreground leading-[1.2] tracking-tight mb-4 group-hover:text-primary-600 transition-colors line-clamp-2",
  ArticleSummary: "text-gray-500 text-sm font-medium line-clamp-3 leading-relaxed mb-8",
  
  MobileControlContainer: "md:hidden px-6 mb-8 -mt-6 relative z-40",
  SortButton: "flex items-center justify-center gap-2 h-11 bg-gray-900 text-white rounded-xl shadow-md active:scale-95 transition-all w-full font-bold text-sm",
  RecCard: "flex items-center gap-4 mb-6 group active:scale-[0.98] transition-transform",
  RecImage: "w-24 h-24 rounded-[18px] object-cover bg-gray-100 shrink-0 shadow-sm",
  RecContent: "flex-1 min-w-0"
};

const News: React.FC<BasePageProps> = ({ onNavigate, onGoHome, onSearch }) => {
  const [activeCategory, setActiveCategory] = useState('Tout');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'oldest'>('recent');
  const { data: articles = [], isLoading } = useArticles();

  // Categories derive from real article data.
  const categories = useMemo(() => {
    const set = new Set<string>();
    articles.forEach((a: any) => a.category && set.add(a.category));
    return ['Tout', ...Array.from(set)];
  }, [articles]);

  const parseDate = (dateStr: string) => {
    // Mapper formats with toLocaleDateString('fr-FR', { month: 'short' }) which
    // returns lowercase, dotted abbreviations like "24 avr. 2026". Match
    // case-insensitively so sort actually works (otherwise every article gets
    // month=0 and "tri par récent" silently degrades to title order).
    const months: Record<string, number> = {
      jan: 0, fév: 1, fev: 1, mar: 2, avr: 3, mai: 4, juin: 5,
      juil: 6, août: 7, aou: 7, sept: 8, sep: 8, oct: 9, nov: 10, déc: 11, dec: 11,
    };
    const parts = dateStr.replace(/\./g, '').split(/\s+/).filter(Boolean);
    if (parts.length < 3) return 0;
    const day = parseInt(parts[0]);
    const key = parts[1].toLowerCase().substring(0, 4);
    const month = months[key] ?? months[key.substring(0, 3)] ?? 0;
    const year = parseInt(parts[2]);
    return new Date(year, month, day).getTime();
  };

  const filteredAndSortedArticles = useMemo(() => {
    let result = articles.filter(a => {
      const matchesCategory = activeCategory === 'Tout' || a.category === activeCategory;
      const matchesSearch = a.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            a.summary.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });

    result.sort((a, b) => {
      const timeA = parseDate(a.date);
      const timeB = parseDate(b.date);
      return sortBy === 'recent' ? timeB - timeA : timeA - timeB;
    });

    return result;
  }, [activeCategory, sortBy, searchQuery, articles]);

  const handleCategoryChange = (cat: string) => {
    if (categories.includes(cat)) {
      setActiveCategory(cat);
    } else {
      setActiveCategory('Tout');
    }
  };

  return (
    <div className={S.Wrapper}>
      <SEO
        title="Actualités Moto & Scooter en Tunisie — Essais, Guides, Nouveautés"
        description="Toute l'actualité moto en Tunisie : essais, comparatifs, guides d'achat, conseils de vente et nouveautés du marché. Mis à jour chaque semaine."
        url="/actualites"
        keywords={['actualités moto Tunisie', 'essai moto', 'guide achat moto', 'nouveautés moto']}
        breadcrumbs={[
          { name: 'Accueil', url: '/' },
          { name: 'Actualités', url: '/actualites' },
        ]}
      />
      <TechSpecsHero 
        title="Actualités & Essais"
        subtitle="Guides d’achat, conseils de vente, comparatifs et nouveautés du marché tunisien."
        onNavigateHome={() => onNavigate?.('home')}
        onBack={() => onNavigate?.('home')}
        breadcrumbCurrent="Actualités & Essais"
      />

      <div className="md:pt-0">
        <FilterBar
          categories={categories}
          activeCategory={activeCategory}
          onCategoryChange={handleCategoryChange}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          sortBy={sortBy}
          onSortChange={setSortBy}
          searchPlaceholder="Rechercher un article..."
        />
      </div>

      <div className="md:hidden flex flex-col w-full">
        <div className="px-6 pb-20 w-full mt-4">
          {isLoading ? (
            <div className="space-y-1 mt-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className={S.RecCard}>
                  <div className="w-24 h-24 rounded-[18px] bg-gray-100 animate-pulse shrink-0" />
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="h-2.5 bg-gray-100 animate-pulse rounded w-1/3" />
                    <div className="h-3.5 bg-gray-100 animate-pulse rounded w-full" />
                    <div className="h-3.5 bg-gray-100 animate-pulse rounded w-4/5" />
                    <div className="h-2 bg-gray-100 animate-pulse rounded w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredAndSortedArticles.length > 0 ? (
            <div className="space-y-1 mt-4">
              {filteredAndSortedArticles.map((article, idx) => (
                <Reveal key={article.id} animation="fade-in-up" delay={idx * 50}>
                  <div className={S.RecCard} onClick={() => onNavigate?.('article-details', { id: article.id, title: article.title })}>
                    <img src={article.image} className={S.RecImage} alt="" loading="lazy" decoding="async" />
                    <div className={S.RecContent}>
                      <div className="flex items-center justify-between mb-1.5">
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleCategoryChange(article.category); }}
                          className="text-[9px] font-[900] text-primary-600 uppercase tracking-widest"
                        >
                          {article.category}
                        </button>
                        <span className="text-[9px] font-black text-gray-300 uppercase">{article.date}</span>
                      </div>
                      <h4 className="text-[14px] font-[800] text-gray-900 leading-[1.3] mb-2 line-clamp-2 tracking-tight">{article.title}</h4>
                      <div className="flex items-center gap-2 text-[9px] font-bold text-gray-400">
                        <Clock size={11} className="text-gray-300" />
                        <span>{article.readTime} de lecture</span>
                      </div>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          ) : (
            <div className="py-20 text-center">
              <p className="text-gray-400 font-bold">Aucun article trouvé.</p>
              <button onClick={() => { setActiveCategory('Tout'); setSearchQuery(''); }} className="mt-4 text-primary-600 font-black text-xs uppercase underline">Afficher tout</button>
            </div>
          )}
        </div>
      </div>

      <div className="hidden md:block">
        <Section variant="none" className="bg-[#F8F9F9] md:bg-gray-50 pb-24 pt-16">
          {isLoading ? (
            <div className={S.DesktopGrid}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className={S.ArticleCard}>
                  <div className={S.ImageWrapper}>
                    <div className="w-full h-full bg-gray-100 animate-pulse" />
                  </div>
                  <div className="px-3 space-y-3">
                    <div className="h-3 bg-gray-100 animate-pulse rounded w-1/2" />
                    <div className="h-5 bg-gray-100 animate-pulse rounded w-full" />
                    <div className="h-5 bg-gray-100 animate-pulse rounded w-4/5" />
                    <div className="h-3 bg-gray-100 animate-pulse rounded w-full mt-4" />
                    <div className="h-3 bg-gray-100 animate-pulse rounded w-5/6" />
                    <div className="h-3 bg-gray-100 animate-pulse rounded w-1/3 mt-6" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className={S.DesktopGrid}>
                {filteredAndSortedArticles.map((article, idx) => (
                  <Reveal key={article.id} animation="fade-in-up" delay={idx * 100}>
                    <article onClick={() => onNavigate?.('article-details', { id: article.id, title: article.title })} className={S.ArticleCard}>
                      <div className={S.ImageWrapper}>
                        <img src={article.image} className="w-full h-full object-cover" alt={article.title} loading="lazy" decoding="async" />
                      </div>
                      <div className="px-3">
                        <div className="flex items-center gap-4 text-[12px] font-black text-gray-400 uppercase mb-4">
                          <div className="flex items-center gap-1.5"><Calendar size={12} className="text-primary-600" /> {article.date}</div>
                          <button 
                            onClick={(e) => { e.stopPropagation(); setActiveCategory(article.category); }}
                            className="transition-transform active:scale-95"
                          >
                            <Badge variant="primary" size="xs" className="bg-card/95 border-none shadow-sm hover:bg-primary-100">{article.category}</Badge>
                          </button>
                        </div>
                        <h3 className={S.ArticleTitle}>{article.title}</h3>
                        <p className={S.ArticleSummary}>{article.summary}</p>
                        <div className="flex items-center gap-3 text-[12px] font-black uppercase text-foreground group-hover:text-primary-600 transition-colors">Découvrir <ArrowRight size={14} className="text-primary-600" /></div>
                      </div>
                    </article>
                  </Reveal>
                ))}
              </div>
              {filteredAndSortedArticles.length === 0 && (
                <div className="py-32 text-center">
                  <h3 className="text-2xl font-black text-gray-300 italic">Aucun article trouvé.</h3>
                  <button onClick={() => { setActiveCategory('Tout'); setSearchQuery(''); }} className="mt-4 text-primary-600 font-black uppercase underline">Réinitialiser</button>
                </div>
              )}
            </>
          )}
        </Section>
      </div>
    </div>
  );
};

export default News;