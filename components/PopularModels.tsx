import React from 'react';
import { Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { usePopularModelsRow } from '../hooks/useTechSpecs';
import { useIntersectionObserver } from '../hooks/useIntersectionObserver';
import { ModelCarousel } from './tech-specs/ModelCarousel';
import { ModelCardSkeleton } from './tech-specs/TechSpecsSkeletons';
import { getUrlFromState } from '../utils/urlUtils';
import { POPULAR_MODELS_HEADING, POPULAR_MODELS_SUBTITLE } from '../utils/popularModels';

interface PopularModelsProps {
  onNavigate?: (view: any, params?: any) => void;
}

const S = {
  // Same as the other home sections (Marques populaires, Annonces récentes).
  Heading: 'text-[36px] font-extrabold text-gray-900 tracking-normal',
  Subtitle: 'text-gray-500 mt-2 text-[17px] font-normal tracking-normal',
};

/**
 * Home page « Modèles populaires » (owner, 2026-11-19): 12 fiches, one per
 * brand, most visited brands first (utils/popularModels.ts), with the model
 * card of the brand pages in the slider of « Modèles similaires ». It used to
 * show 3 cards, all SYM. The fiches are the pages that rank on Google; the
 * home HTML links the same 12 (src/seo/snapshotLinks.ts).
 * The list (every sheet, ~30 KB) loads when the row nears the screen: it is
 * below the fold, the first paint does not pay for it.
 */
const PopularModels: React.FC<PopularModelsProps> = () => {
  const { elementRef, isVisible } = useIntersectionObserver({ threshold: 0, rootMargin: '600px' });
  const { data: models = [], isLoading, isError } = usePopularModelsRow(isVisible);
  const waiting = !isVisible || isLoading;

  if (!waiting && (isError || models.length === 0)) return null;

  return (
    <section ref={elementRef as React.RefObject<HTMLElement>} className="py-16 md:py-20 bg-card overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 md:px-20 lg:px-32">
        {waiting ? (
          <div aria-hidden="true">
            <h2 className={S.Heading}>{POPULAR_MODELS_HEADING}</h2>
            <p className={S.Subtitle}>{POPULAR_MODELS_SUBTITLE}</p>
            <div className="mt-4 flex gap-4 overflow-hidden">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="shrink-0 w-[78%] sm:w-[260px] md:w-[270px]"><ModelCardSkeleton /></div>
              ))}
            </div>
          </div>
        ) : (
          <ModelCarousel
            id="modeles-populaires"
            heading={POPULAR_MODELS_HEADING}
            subtitle={POPULAR_MODELS_SUBTITLE}
            models={models}
            headingClassName={S.Heading}
            subtitleClassName={S.Subtitle}
            className=""
          />
        )}

        <div className="mt-12 flex flex-col items-center gap-3">
          <Link
            to={getUrlFromState('tech-specs-brands')}
            className="group inline-flex items-center gap-2 h-12 px-7 rounded-full bg-primary-600 hover:bg-primary-700 text-white text-[13px] font-extrabold uppercase tracking-wider shadow-[0_8px_20px_-6px_rgba(255,107,0,0.5)] hover:shadow-[0_10px_25px_-6px_rgba(255,107,0,0.6)] active:scale-[0.98] transition-all duration-200"
          >
            <Plus size={16} strokeWidth={3} className="group-hover:rotate-90 transition-transform duration-300" />
            Voir plus de modèles
          </Link>
        </div>
      </div>
    </section>
  );
};

export default PopularModels;
