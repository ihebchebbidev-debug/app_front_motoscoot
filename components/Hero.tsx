
import React from 'react';
import { SearchBar } from './search/SearchBar';
import { CategoryNav } from './search/CategoryNav';
import { useListingsCount } from '../hooks/useListings';
import { useHeroImages } from '../hooks/useHeroImages';
import { useHeroTexts } from '../hooks/useHeroTexts';

// --- STYLES (Pattern "S") ---
const S = {
  // Mobile: Utilisation de --vh pour éviter les sauts de hauteur liés à la barre d'adresse
  // Tablette: 50vh | Desktop: 80vh
  Wrapper: "relative w-full flex flex-col font-sans bg-primary-50 overflow-hidden h-[calc(var(--vh,1vh)*100)] md:h-[50vh] lg:h-[80vh]",
  BgContainer: "absolute inset-0 overflow-hidden z-0",
  Overlay: "absolute inset-0 bg-gradient-to-b from-primary-700 to-primary-600 opacity-95 mix-blend-multiply",
  BgImage: "absolute inset-0 w-full h-full object-cover",
  
  // ContentWrapper : h-full pour permettre la distribution verticale
  // Padding latéral constant pour l'alignement gauche
  ContentWrapper: "relative z-10 flex flex-col w-full max-w-7xl mx-auto px-6 md:px-16 lg:px-24 h-full",
  
  // TextSection : Utilisation de flex-1 sur le conteneur du texte pour le centrer verticalement
  // pt-24 : Dégagement pour le header fixe sur mobile
  // pb-8 : Marge de sécurité sous la barre de recherche
  TextSection: "w-full flex-1 flex flex-col items-start pt-24 pb-8 md:pb-0 md:pt-0 md:justify-center md:space-y-10",
  
  // TitleGroup : Bloc regroupé avec espacement vertical minimal
  TitleGroup: "w-full flex flex-col items-start text-left gap-1.5 md:gap-4 flex-shrink-0",
  
  // Badge : Taille fixée à 10px pour mobile, 12px desktop
  Badge: "inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm text-white text-[10px] md:text-[12px] font-bold uppercase tracking-wide mb-1 md:mt-10 lg:mt-14 animate-fade-in-up",
  
  // H1: Taille ajustée pour mobile à 32px (2rem), titre sur deux lignes
  // Desktop/Tablette : font-800 (extrabold) et 40px
  MainTitle: "font-extrabold text-[2rem] md:text-[40px] tracking-tight leading-[1.05] drop-shadow-sm text-white",
  
  // Subtitle: Taille ajustée à 14px sur mobile (text-[14px])
  // Desktop/Tablette : font-500 (medium), 16px
  // Légère réduction de l'espacement avec la barre de recherche : md:mb-6
  Subtitle: "text-[14px] md:text-[16px] font-medium opacity-90 text-white/90 max-w-[280px] sm:max-w-sm md:max-w-none leading-snug md:mb-6",
  
  // SearchBarContainer : Espacement significatif pour isoler la zone d'action
  // mt-6 : Spacing mobile réduit pour éviter le débordement
  SearchBarContainer: "w-full mt-6 mb-2 md:mt-0 md:mb-0 flex-shrink-0"
};

interface HeroProps {
  onSearch?: (filters: any) => void;
  onNavigate?: (view: any, params?: any) => void;
}

const Hero: React.FC<HeroProps> = ({ onSearch, onNavigate }) => {
  const { data: liveCount } = useListingsCount();
  const { desktopUrl, mobileUrl, backgroundColor } = useHeroImages();
  const { title, subtitle, badgeSuffix, isLoaded: heroTextsLoaded } = useHeroTexts();
  // Split the title on the first \n so admins can force a mobile line break.
  // Falls back to a single line if no \n is present.
  const titleLines = title.split('\n');
  
  const handleCategoryClick = (categoryLabel: string) => {
    if (!onSearch) return;
    // Accessory sub-categories (singular, matching backend accessory_types
    // and CategoryNav labels). Anything in this set is filtered as
    // type=Accessoires + a free-text search on the sub-type so we hit
    // both the listing title and the `attributes.accessoryType` field.
    const ACCESSORY_SUBS = ["Casque", "Gant", "Veste", "Chaussures", "Pantalons", "Antivol", "Bagagerie", "Intercom", "GPS"];
    const isAccessorySub = ACCESSORY_SUBS.includes(categoryLabel);
    const isAccessoriesRoot = categoryLabel === "Accessoires";

    onSearch({
      type: isAccessorySub || isAccessoriesRoot ? "Accessoires" : categoryLabel,
      search: isAccessorySub ? categoryLabel : "",
      brand: "",
      model: "",
      location: "",
    });
  };

  return (
    <div className={S.Wrapper} style={{ backgroundColor }}>
      <div className={S.BgContainer}>
        {/* One <picture>: phones download only the mobile image (PageSpeed). */}
        <picture>
          <source media="(min-width: 768px)" srcSet={desktopUrl} />
          <img
            src={mobileUrl}
            className={S.BgImage}
            alt=""
            // @ts-ignore
            fetchPriority="high"
            loading="eager"
          />
        </picture>
        <div className="absolute inset-0 opacity-95 mix-blend-multiply" style={{ background: `linear-gradient(to bottom, ${backgroundColor}, ${backgroundColor})` }} />
      </div>

      <div className={S.ContentWrapper}>
        <div className={S.TextSection}>
          <div className="flex-1 md:flex-none flex flex-col justify-center w-full">
            <div className={S.TitleGroup}>
              {liveCount && liveCount > 0 ? (
                <div className={S.Badge}>
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success-500 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success-500"></span>
                  </span>
                  {`${liveCount.toLocaleString('fr-FR')} ${badgeSuffix}`}
                </div>
              ) : null}

              <h1 className={S.MainTitle}>
                {titleLines.length > 1 ? (
                  <>
                    {titleLines[0]} <br className="md:hidden" />
                    {titleLines.slice(1).join(' ')}
                  </>
                ) : (
                  title
                )}
              </h1>

              <p className={S.Subtitle}>
                {subtitle}
              </p>
            </div>
          </div>

          <div className={S.SearchBarContainer}>
            <SearchBar onSearch={onSearch} onNeufClick={() => onNavigate?.('tech-specs-brands', { available_in_tunisia: true })} />
          </div>

          {/* Version Desktop/Tablette : Icônes directement sous la barre de recherche */}
          {/* Augmentation de l'espace vertical : md:mt-44 (au lieu de md:mt-32) */}
          <div className="hidden md:block w-full mt-8 md:mt-44">
            <CategoryNav onCategoryClick={handleCategoryClick} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Hero;
