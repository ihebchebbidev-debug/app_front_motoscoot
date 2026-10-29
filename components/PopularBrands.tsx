import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { brandsApi, PopularBrand } from '../services/miscApi';
import { Button } from './ui/Button';

interface PopularBrandsProps {
  onNavigate?: (view: any, params?: any) => void;
}

const usePopularBrands = (limit = 12) =>
  useQuery<PopularBrand[]>({
    queryKey: ['brands', 'popular', 'detailed', limit],
    queryFn: ({ signal }) => brandsApi.getPopularDetailed(limit, signal),
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
  });

const BrandTile: React.FC<{ brand: PopularBrand; onClick?: () => void }> = ({ brand, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    title={brand.name}
    aria-label={brand.name}
    className="group shrink-0 flex flex-col items-center justify-center gap-2 mx-3 sm:mx-4 md:mx-6 w-[110px] sm:w-[130px] md:w-[150px] h-[110px] sm:h-[130px] md:h-[140px] rounded-2xl bg-white border border-gray-200 hover:border-primary-400 hover:shadow-lg transition-all duration-200"
  >
    <div className="flex-1 w-full flex items-center justify-center px-3">
      {brand.logo_url ? (
        <img
          src={brand.logo_url}
          alt={`Logo ${brand.name}`}
          loading="lazy"
          className="max-h-10 sm:max-h-12 md:max-h-14 max-w-full object-contain grayscale group-hover:grayscale-0 transition-all duration-200"
        />
      ) : (
        <span className="text-xl font-extrabold text-gray-400 group-hover:text-primary-600">
          {brand.name.charAt(0)}
        </span>
      )}
    </div>
    <span className="pb-2 px-2 text-[12px] sm:text-[13px] font-semibold text-gray-700 group-hover:text-primary-600 truncate max-w-full">
      {brand.name}
    </span>
  </button>
);

const SkeletonTile: React.FC = () => (
  <div className="shrink-0 mx-3 sm:mx-4 md:mx-6 w-[110px] sm:w-[130px] md:w-[150px] h-[110px] sm:h-[130px] md:h-[140px] rounded-2xl bg-gray-100 animate-pulse" />
);

const PopularBrands: React.FC<PopularBrandsProps> = ({ onNavigate }) => {
  const { data: brands = [], isLoading } = usePopularBrands(6);

  if (!isLoading && brands.length === 0) return null;

  const visible = brands.slice(0, 6);

  return (
    <section className="py-16 md:py-20 bg-gray-50 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 md:px-20 lg:px-32">
        <div className="flex flex-col md:flex-row justify-between items-end mb-10 gap-4">
          <div>
            <h2 className="text-[36px] font-extrabold text-gray-900 tracking-normal">
              Marques populaires
            </h2>
            <p className="text-gray-500 mt-2 text-[17px] font-normal tracking-normal">
              Les marques de motos et scooters neufs les plus recherchées en Tunisie.
            </p>
          </div>
          <Button
            variant="ghost"
            onClick={() => onNavigate?.('tech-specs-brands')}
            className="hidden md:flex text-primary-600 hover:bg-primary-50"
            rightIcon={<ArrowRight className="w-5 h-5 ml-1" />}
          >
            Voir tout
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 sm:gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="w-full max-w-[211px] h-[155px] mx-auto bg-transparent animate-pulse rounded-xl"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 sm:gap-6">
            {visible.map((b) => (
              <button
                key={b.id ?? b.name}
                type="button"
                onClick={() => onNavigate?.('tech-specs-models', { brand: b.name })}
                title={b.name}
                aria-label={b.name}
                className="group relative flex flex-col items-center justify-center w-full max-w-[211px] h-[155px] mx-auto bg-transparent cursor-pointer gap-3"
              >
                <div className="flex items-center justify-center w-[115px] h-[115px] transition-transform duration-300 group-hover:scale-105 shrink-0">
                  {b.logo_url ? (
                    <img
                      src={b.logo_url}
                      alt={`Logo ${b.name}`}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      decoding="async"
                      className="max-w-full max-h-full object-contain"
                    />
                  ) : (
                    <span className="text-3xl font-extrabold text-slate-300">
                      {b.name.charAt(0)}
                    </span>
                  )}
                </div>
                <span className="text-[13px] font-black text-slate-900 uppercase tracking-wider group-hover:text-orange-600 transition-colors text-center w-full truncate px-2">
                  {b.name}
                </span>
              </button>
            ))}
          </div>
        )}

        {!isLoading && brands.length > 0 && (
          <div className="mt-10 flex justify-center md:hidden">
            <button
              type="button"
              onClick={() => onNavigate?.('tech-specs-brands')}
              className="inline-flex items-center gap-2 h-12 px-7 rounded-full border-2 border-primary-600 text-primary-600 hover:bg-primary-50 text-[13px] font-extrabold uppercase tracking-wider transition-all duration-200"
            >
              Voir tout
              <ArrowRight size={16} strokeWidth={3} />
            </button>
          </div>
        )}
      </div>
    </section>
  );
};

export default PopularBrands;
