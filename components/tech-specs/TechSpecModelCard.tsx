import React, { memo } from 'react';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '../ui/Badge';
import { getOptimizedImageUrl, getUrlFromState } from '../../utils/urlUtils';
import { highlightText } from '../../utils/techSpecsSearch';
import { ccLabel, powerLabel, torqueLabel, priceLabel } from '../../utils/techSpecDisplay';

// Model card of the brand page (/fiches-techniques/<marque>), also used by the
// price guides (/prix/…) and the « Modèles similaires » row, so a model looks
// the same everywhere.
// Sizes in rem: the text follows the phone's text-size setting (it stayed at
// 9-14 px while the spacing doubled). Price and year in dark orange (5:1;
// the lighter orange was 3.7:1). The press shows within 100 ms.
const S = {
  ModelCard: "group bg-card rounded-[14px] border border-gray-100 overflow-hidden cursor-pointer flex flex-col h-full shadow-sm transition-[transform,box-shadow,border-color] duration-100 ease-out active:scale-[0.97] [@media(hover:hover)]:hover:shadow-[0_4px_12px_rgba(0,0,0,0.05)] [@media(hover:hover)]:hover:border-primary-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gray-900",
  ImageArea: "relative w-full aspect-[4/3] bg-card overflow-hidden isolate transform translate-z-0 rounded-t-[14px]",
  ContentArea: "flex flex-1 flex-col p-4 md:p-3.5 lg:p-5 font-sans",
  ModelName: "text-base md:text-[0.875rem] lg:text-[1.0625rem] font-semibold text-gray-900 line-clamp-1 leading-snug mb-1",
  PriceValue: "text-base md:text-[0.875rem] lg:text-base font-bold text-primary-700 leading-tight tabular-nums",
  // A state (« En arrivage », « Épuisé ») is not a price: neutral, quiet.
  Status: "self-start inline-flex items-center min-h-6 px-2 rounded-md bg-gray-100 text-gray-700 text-[0.8125rem] md:text-[0.75rem] lg:text-[0.8125rem] font-medium leading-tight",
  SpecsGrid: "grid grid-cols-3 gap-1 md:gap-1.5 lg:gap-2 mt-4 mb-5 border-t border-gray-100 pt-4",
  SpecItem: "flex flex-col gap-0.5 min-w-0",
  SpecLabel: "text-xs md:text-[0.625rem] lg:text-xs font-medium text-gray-600",
  SpecValue: "text-sm md:text-[0.6875rem] lg:text-sm font-semibold text-gray-900 truncate tabular-nums",
  DetailsButton: "mt-auto w-full min-h-11 bg-primary-700 text-white text-[0.875rem] md:text-[0.75rem] lg:text-[0.875rem] font-semibold rounded-xl flex items-center justify-center gap-2 [@media(hover:hover)]:group-hover:bg-primary-800 transition-colors duration-100 shadow-sm",
  YearBadge: "border-none shadow-sm px-2 py-0.5 md:px-2.5 md:py-1 !text-[0.6875rem] !font-semibold !tracking-normal !text-primary-700",
};

export const TechSpecModelCard = memo(({ spec, highlightTerms = [] }: { spec: any; highlightTerms?: string[] }) => {
  const hl = (v: string | number | null | undefined) => highlightText(v, highlightTerms);
  const price = priceLabel(spec.priceNew);
  const cc = ccLabel(spec.engine?.cc);
  const power = powerLabel(spec.engine?.power);
  const torque = torqueLabel(spec.engine?.torque);
  return (
    <Link
      to={getUrlFromState('tech-specs-details', { id: spec.id, specSlug: spec.slug, slug: `${spec.brand}-${spec.model}-${spec.year}` })}
      className={S.ModelCard}
    >
      <div className={S.ImageArea}>
        <img
          src={getOptimizedImageUrl(spec.image, 600, 400, 80, undefined, `${spec.brand} ${spec.model} ${spec.year}`)}
          className="w-full h-full object-cover"
          alt={spec.model}
          loading="lazy"
          decoding="async"
        />
        {/* Same veil as the comparator cards (home/ModelCard): white or
            transparent photo backgrounds read as a light grey (#F2F2F2). */}
        <div className="absolute inset-0 bg-black/5 pointer-events-none" aria-hidden="true" />
        <div className="absolute top-2 left-2 md:top-4 md:left-4">
          <Badge variant="primary" className={S.YearBadge}>
            {hl(spec.year)}
          </Badge>
        </div>
      </div>

      <div className={S.ContentArea}>
        <h3 className={S.ModelName}>{hl(`${spec.brand} ${spec.model}`)}</h3>
        {price.kind === 'price'
          ? <p className={S.PriceValue}>{hl(price.text)}</p>
          : <p className={S.Status}>{hl(price.text)}</p>}


        <div className={S.SpecsGrid}>
          <div className={S.SpecItem}>
            <span className={S.SpecLabel}>Cylindrée</span>
            <span className={S.SpecValue}>{hl(cc)}</span>
          </div>
          <div className={S.SpecItem}>
            <span className={S.SpecLabel}>Puissance</span>
            <span className={S.SpecValue}>{hl(power)}</span>
          </div>
          <div className={S.SpecItem}>
            <span className={S.SpecLabel}>Couple</span>
            <span className={S.SpecValue}>{hl(torque)}</span>
          </div>
        </div>

        <div className={S.DetailsButton}>
          Fiche technique <ArrowRight size={16} aria-hidden="true" />
        </div>
      </div>
    </Link>
  );
});
