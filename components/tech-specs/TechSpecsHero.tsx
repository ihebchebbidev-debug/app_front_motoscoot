import React, { memo } from 'react';
import { ArrowLeft, Layers, Home, ChevronRight } from 'lucide-react';
import { Reveal } from '../ui/Reveal';
import { Badge } from '../ui/Badge';
import { useHeroImages } from '../../hooks/useHeroImages';

interface TechSpecsHeroProps {
  title: string;
  subtitle?: string;
  badgeText?: string;
  badgeIcon?: React.ReactNode;
  onBack?: () => void;
  backText?: string;
  onNavigateHome?: () => void;
  breadcrumbCurrent?: string;
}

// Clean, image-free header used across Tech Specs, News and Tips listing
// pages. Previously this rendered a full-bleed photo + primary-color overlay;
// we removed it for a calmer, content-first UX (lower visual noise, better
// readability of the breadcrumb + title).
const S = {
  // Mobile keeps the clean white header (content-first, low visual noise).
  // Desktop/tablet mirrors the landing-page Hero: admin-configured background
  // image + primary-color overlay, with white text on top.
  Hero: "relative w-full flex flex-col font-sans bg-[#F8F9F9] md:bg-primary-50 md:border-b-0 pt-[96px] pb-1 md:pt-28 md:pb-16 items-start text-left overflow-hidden",
  BgContainer: "hidden md:block absolute inset-0 overflow-hidden z-0",
  BgImage: "absolute inset-0 w-full h-full object-cover",
  ContentWrapper: "relative z-10 flex flex-col w-full max-w-[1440px] mx-auto px-6 md:px-16 lg:px-32",
  TitleGroup: "w-full flex flex-col items-start text-left gap-2 md:gap-4",
  MainTitle: "max-w-4xl text-[2rem] leading-[1.1] md:text-[42px] font-[900] tracking-tight md:leading-[1.1] text-foreground md:text-white md:drop-shadow-sm",
  Subtitle: "max-w-3xl text-[15px] md:text-[18px] font-medium leading-snug md:leading-[1.45] text-gray-500 md:text-white/90",
};

export const TechSpecsHero = memo(({
  title,
  subtitle,
  badgeText,
  badgeIcon,
  onBack,
  onNavigateHome,
  breadcrumbCurrent,
}: TechSpecsHeroProps) => {
  const { desktopUrl, backgroundColor } = useHeroImages();
  return (
    <section className={S.Hero} style={{ ['--hero-bg' as any]: backgroundColor }}>
      <div className={S.BgContainer}>
        <img
          src={desktopUrl}
          className={S.BgImage}
          alt=""
          // @ts-ignore
          fetchPriority="high"
          loading="eager"
        />
        <div
          className="absolute inset-0 opacity-95 mix-blend-multiply"
          style={{ background: `linear-gradient(to bottom, ${backgroundColor}, ${backgroundColor})` }}
        />
      </div>
      <div className={S.ContentWrapper}>
        <div className={S.TitleGroup}>
          {onNavigateHome && (
            <Reveal animation="fade-in-up">
              <header className="flex items-center justify-between mb-2 md:mb-3 w-full">
                <div className="flex items-center gap-3 md:gap-4">
                  {onBack && (
                    <button
                      onClick={onBack}
                      className="p-2.5 md:p-2 bg-card md:bg-white/10 border border-gray-100 md:border-white/20 md:backdrop-blur-sm rounded-2xl md:rounded-xl text-gray-700 md:text-white hover:bg-gray-50 md:hover:bg-white/20 hover:border-gray-200 md:hover:border-white/30 shadow-sm transition-all active:scale-95"
                      aria-label="Retour"
                    >
                      <ArrowLeft size={18} className="md:w-5 md:h-5" />
                    </button>
                  )}
                  <nav className="flex items-center gap-2 text-[12px] md:text-[13px] font-medium text-gray-400 md:text-white/70">
                    <span
                      className="flex items-center gap-1.5 hover:text-primary-600 md:hover:text-white cursor-pointer transition-colors"
                      onClick={onNavigateHome}
                    >
                      <Home size={14} className="md:w-3.5 md:h-3.5" /> Accueil
                    </span>
                    <ChevronRight size={12} className="md:w-3.5 md:h-3.5 text-gray-300 md:text-white/50" />
                    <span className="text-foreground md:text-white font-extrabold truncate max-w-[160px] md:max-w-none">
                      {breadcrumbCurrent || 'Fiches Techniques'}
                    </span>
                  </nav>
                </div>
              </header>
            </Reveal>
          )}
          {badgeText && (
            <Reveal animation="fade-in-up">
              <Badge
                variant="primary"
                className="hidden md:inline-flex bg-white/10 border border-white/20 backdrop-blur-sm text-white mb-1 text-[11px] md:text-[12px] font-bold uppercase tracking-[0px] leading-tight py-1.5 px-3 rounded-full items-center gap-2"
              >
                {badgeIcon || <Layers size={14} className="text-white" strokeWidth={2.5} />}
                {badgeText}
              </Badge>
            </Reveal>
          )}
          <Reveal animation="fade-in-up" delay={100}>
            <h1 className={`hidden md:block ${S.MainTitle}`}>{title}</h1>
          </Reveal>
          {subtitle && (
            <Reveal animation="fade-in-up" delay={200}>
              <p className={`hidden md:block ${S.Subtitle}`}>{subtitle}</p>
            </Reveal>
          )}
        </div>
      </div>
    </section>
  );
});
