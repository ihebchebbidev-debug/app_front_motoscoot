import React from 'react';
import { ArrowRight } from 'lucide-react';
import { useLatestTechSpecs } from '../hooks/useTechSpecs';
import { ModelCard } from './home/ModelCard';
import { Button } from './ui/Button';
import { SkeletonCard } from './ui/Skeleton';

interface LatestTechSpecsProps {
  onNavigate?: (view: any, params?: any) => void;
}

const LatestTechSpecs: React.FC<LatestTechSpecsProps> = ({ onNavigate }) => {
  const { data: specs = [], isLoading } = useLatestTechSpecs(3);

  if (!isLoading && specs.length === 0) return null;

  const items = specs.slice(0, 3).map((s) => ({
    id: s.id,
    name: `${s.brand} ${s.model}`.trim() || 'Fiche technique',
    brand: s.brand,
    image: s.cardImage || s.image,
    price: s.priceNew || `${s.year}`,
  }));

  return (
    <section className="py-16 md:py-20 bg-background overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 md:px-20 lg:px-32">
        <div className="flex flex-col md:flex-row justify-between items-end mb-10 gap-4">
          <div>
            <h2 className="text-[36px] font-extrabold text-gray-900 tracking-normal">
              Les nouveautés
            </h2>
            <p className="text-gray-500 mt-2 text-[17px] font-normal tracking-normal">
              Les nouveautés moto et scooter à découvrir dès maintenant en Tunisie.
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 xl:gap-8">
          {isLoading
            ? Array.from({ length: 3 }).map((_, i) => (
                <SkeletonCard key={i} variant="compact" imageAspect="aspect-[16/10]" />
              ))
            : items.map((item, idx) => (
                <div key={item.id} className="animate-fade-in-up" style={{ animationDelay: `${idx * 60}ms` }}>
                  <ModelCard
                    badgeLabel="Nouveauté"
                    model={item as any}
                    onClick={() => {
                      const slug = `${specs[idx].brand}-${specs[idx].model}-${specs[idx].year}`;
                      onNavigate?.('tech-specs-details', { id: item.id, specId: item.id, slug });
                    }}
                  />
                </div>
              ))}
        </div>

        {!isLoading && items.length > 0 && (
          <div className="mt-12 flex justify-center md:hidden">
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

export default LatestTechSpecs;
