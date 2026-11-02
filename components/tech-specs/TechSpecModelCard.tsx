import React, { memo } from 'react';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '../ui/Badge';
import { getOptimizedImageUrl, getUrlFromState } from '../../utils/urlUtils';
import { highlightText } from '../../utils/techSpecsSearch';

// Model card of the brand page (/fiches-techniques/<marque>), also used by the
// price guides (/prix/…) so a model looks the same everywhere.
const S = {
  ModelCard: "group bg-card rounded-[14px] border border-gray-100 overflow-hidden transition-all duration-300 cursor-pointer flex flex-col h-full shadow-sm hover:shadow-[0_4px_12px_rgba(0,0,0,0.05)] hover:border-primary-100 active:scale-[0.98]",
  ImageArea: "relative w-full aspect-[4/3] bg-card overflow-hidden isolate transform translate-z-0 rounded-t-[14px]",
  ContentArea: "flex flex-1 flex-col p-4 md:p-3.5 lg:p-5 pt-4 font-sans",
  ModelName: "text-[15px] md:text-[14px] lg:text-[17px] font-extrabold text-gray-900 line-clamp-1 leading-snug tracking-tight mb-1",
  PriceValue: "text-[14px] md:text-[13px] lg:text-[16px] font-[900] text-primary-600 leading-none mb-4 tracking-tighter",
  SpecsGrid: "grid grid-cols-3 gap-1 md:gap-1.5 lg:gap-2 mb-6 border-t border-gray-50 pt-4",
  SpecItem: "flex flex-col gap-0.5",
  SpecLabel: "text-[9px] md:text-[8px] lg:text-[10px] font-bold text-gray-400 uppercase tracking-wider",
  SpecValue: "text-[11px] md:text-[10px] lg:text-[13px] font-black text-gray-700 truncate",
  DetailsButton: "mt-auto w-full py-2.5 bg-primary-600 text-white text-[11px] md:text-[10px] lg:text-[13px] font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-primary-700 transition-all duration-300 shadow-md shadow-primary-600/20 active:scale-[0.98]"
};

export const TechSpecModelCard = memo(({ spec, highlightTerms = [] }: { spec: any; highlightTerms?: string[] }) => (
  <Link
    to={getUrlFromState('tech-specs-details', { id: spec.id, specSlug: spec.slug, slug: `${spec.brand}-${spec.model}-${spec.year}` })}
    className={S.ModelCard}
  >
    <div className={S.ImageArea}>
      <img 
        src={getOptimizedImageUrl(spec.image, 600, 400, 80, undefined, `${spec.brand} ${spec.model} ${spec.year}`)} 
        className="w-full h-full object-cover transition-transform duration-700" 
        alt={spec.model} 
        loading="lazy"
        decoding="async"
      />
      <div className="absolute top-2 left-2 md:top-4 md:left-4">
        <Badge variant="primary" className="border-none shadow-sm px-2 py-0.5 md:px-3 md:py-1 text-[9px] md:text-[10px]">
          {highlightText(spec.year, highlightTerms)}
        </Badge>
      </div>
    </div>
    
    <div className={S.ContentArea}>
      <h3 className={S.ModelName}>{highlightText(`${spec.brand} ${spec.model}`, highlightTerms)}</h3>
      <p className={S.PriceValue}>{highlightText(spec.priceNew, highlightTerms)}</p>

      <div className={S.SpecsGrid}>
        <div className={S.SpecItem}>
          <span className={S.SpecLabel}>Cylindrée</span>
          <span className={S.SpecValue}>{highlightText(spec.engine.cc, highlightTerms)}</span>
        </div>
        <div className={S.SpecItem}>
          <span className={S.SpecLabel}>Puissance</span>
          <span className={S.SpecValue}>{highlightText(spec.engine.power, highlightTerms)}</span>
        </div>
        <div className={S.SpecItem}>
          <span className={S.SpecLabel}>Couple</span>
          <span className={S.SpecValue}>{highlightText(spec.engine.torque, highlightTerms)}</span>
        </div>
      </div>

      <div className={S.DetailsButton}>
        Fiche technique <ArrowRight size={16} />
      </div>
    </div>
  </Link>
));
