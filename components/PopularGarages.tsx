import React from 'react';
import { ArrowRight } from 'lucide-react';
import { usePopularGarages } from '../hooks/useGarages';
import { GarageCard } from './home/GarageCard';
import { Button } from './ui/Button';
import { SkeletonCard } from './ui/Skeleton';

interface PopularGaragesProps {
  onNavigate?: (view: any, params?: any) => void;
}

const PopularGarages: React.FC<PopularGaragesProps> = ({ onNavigate }) => {
  const { data: garages = [], isLoading } = usePopularGarages();
  const popular = garages.slice(0, 3);

  if (!isLoading && popular.length === 0) return null;

  return (
    <section className="py-16 md:py-20 bg-gray-50 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 md:px-20 lg:px-32">
        <div className="flex flex-col md:flex-row justify-between items-end mb-10 gap-4">
          <div>
            <h2 className="text-[36px] font-extrabold text-gray-900 tracking-normal">
              Les garages les plus consultés
            </h2>
            <p className="text-gray-500 mt-2 text-[17px] font-normal tracking-normal">
              Confiez votre moto aux meilleurs experts de votre région.
            </p>
          </div>
          <Button
            variant="ghost"
            onClick={() => onNavigate?.('garages')}
            className="hidden md:flex text-primary-600 hover:bg-primary-50"
            rightIcon={<ArrowRight className="w-5 h-5 ml-1" />}
          >
            Tous les garages
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 xl:gap-8">
          {isLoading
            ? Array.from({ length: 3 }).map((_, i) => (
                <SkeletonCard key={i} variant="compact" imageAspect="aspect-[16/10]" />
              ))
            : popular.map((garage) => (
                <div key={garage.id} className="animate-fade-in-up">
                  <GarageCard garage={garage} onClick={() => onNavigate?.('garages')} />
                </div>
              ))}
        </div>
      </div>
    </section>
  );
};

export default PopularGarages;
