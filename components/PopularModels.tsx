import React, { useMemo } from 'react';
import { ArrowRight, Plus } from 'lucide-react';
import { useAllTechSpecs } from '../hooks/useTechSpecs';
import { ModelCard } from './home/ModelCard';
import { Button } from './ui/Button';
import { SkeletonCard } from './ui/Skeleton';

interface PopularModelsProps {
  onNavigate?: (view: any, params?: any) => void;
}

const MAX_COUNT = 3;

const PopularModels: React.FC<PopularModelsProps> = ({ onNavigate }) => {
  const { data: specs = [], isLoading } = useAllTechSpecs();

  const items = useMemo(
    () =>
      specs.slice(0, MAX_COUNT).map((s: any) => ({
        id: s.id,
        name: `${s.brand ?? ''} ${s.model ?? ''}`.trim() || 'Fiche technique',
        brand: s.brand || '—',
        image: s.image,
        price: s.priceNew || (s.year ? `${s.year}` : 'Prix sur demande'),
      })),
    [specs],
  );

  if (!isLoading && items.length === 0) return null;

  return (
    <section className="py-16 md:py-20 bg-card overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 md:px-20 lg:px-32">
        <div className="flex flex-col md:flex-row justify-between items-end mb-10 gap-4">
          <div>
            <h2 className="text-[36px] font-extrabold text-gray-900 tracking-normal">
              Modèles populaires
            </h2>
            <p className="text-gray-500 mt-2 text-[17px] font-normal tracking-normal">
              Les modèles de motos et scooters neufs les plus recherchés en Tunisie.
            </p>
          </div>
          <Button
            variant="ghost"
            onClick={() => onNavigate?.('tech-specs-brands')}
            className="hidden md:flex text-primary-600 hover:bg-primary-50"
            rightIcon={<ArrowRight className="w-5 h-5 ml-1" />}
          >
            Tout voir
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 xl:gap-8">
          {isLoading
            ? Array.from({ length: MAX_COUNT }).map((_, i) => (
                <SkeletonCard key={i} variant="compact" imageAspect="aspect-[16/10]" />
              ))
            : items.map((item: any, idx: number) => (
                <div key={item.id} className="animate-fade-in-up" style={{ animationDelay: `${idx * 60}ms` }}>
                  <ModelCard
                    model={item as any}
                    onClick={() => {
                      const s: any = specs[idx];
                      const slug = `${s.brand}-${s.model}-${s.year}`;
                      onNavigate?.('tech-specs-details', { id: item.id, specId: item.id, slug });
                    }}
                  />
                </div>
              ))}
        </div>

        {!isLoading && items.length > 0 && (
          <div className="mt-12 flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate?.('tech-specs-brands')}
              className="group inline-flex items-center gap-2 h-12 px-7 rounded-full bg-primary-600 hover:bg-primary-700 text-white text-[13px] font-extrabold uppercase tracking-wider shadow-[0_8px_20px_-6px_rgba(255,107,0,0.5)] hover:shadow-[0_10px_25px_-6px_rgba(255,107,0,0.6)] active:scale-[0.98] transition-all duration-200"
            >
              <Plus size={16} strokeWidth={3} className="group-hover:rotate-90 transition-transform duration-300" />
              Voir plus de modèles
            </button>
          </div>
        )}
      </div>
    </section>
  );
};

export default PopularModels;
