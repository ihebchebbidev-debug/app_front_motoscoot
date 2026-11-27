import React from 'react';

/**
 * Shared heading for the home sections (Marques populaires, Modèles
 * populaires, Annonces récentes, Avis…) so every section opens the same way.
 *
 * Scale: section titles sit below the hero H1 (36 px phone / 48 px desktop)
 * at 26 px phone / 36 px desktop, tight leading so a two-line title stays a
 * compact block instead of 108 px of air.
 */
export const SECTION_HEADING = 'text-[26px] md:text-[36px] font-extrabold text-gray-900 leading-[1.15] tracking-tight text-balance';
export const SECTION_SUBTITLE = 'text-gray-600 mt-2 text-[15px] md:text-[17px] leading-snug text-pretty';

/** Vertical rhythm of a home section: tighter on phones, roomy on desktop. */
export const SECTION_SPACING = 'py-10 md:py-20';

interface SectionHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Desktop-side action (e.g. « Tout voir »), aligned to the title's baseline. */
  action?: React.ReactNode;
  id?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({ title, subtitle, action, id }) => (
  <div className="flex flex-col md:flex-row justify-between md:items-end mb-6 md:mb-10 gap-4">
    <div className="min-w-0">
      <h2 id={id} className={SECTION_HEADING}>{title}</h2>
      {subtitle && <p className={SECTION_SUBTITLE}>{subtitle}</p>}
    </div>
    {action}
  </div>
);
