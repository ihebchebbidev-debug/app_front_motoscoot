import React, { memo, useMemo } from 'react';
import categoryMoto from '../../src/assets/category-moto.jpg';
import categoryScooter from '../../src/assets/category-scooter.jpg';
import categoryQuad from '../../src/assets/category-quad.jpg';
import categoryAccessoires from '../../src/assets/category-accessoires.jpg';
import categoryVelo from '../../src/assets/category-velo.jpg';
import categoryJetski from '../../src/assets/category-jetski.jpg';
import categoryPieces from '../../src/assets/category-pieces.jpg';
import { useVehicleCategoriesRich } from '../../hooks/useReferenceData';

interface StepCategoryProps {
  category: string;
  onSelect: (id: string) => void;
  hasError: boolean;
}

const S = {
  HeaderSection: "text-center md:text-left mb-10",
  Title: "text-2xl md:text-3xl font-black text-gray-900 mb-2 tracking-tight",
  Subtitle: "text-gray-500 font-medium",

  // ✅ FIXED HERE: 2 columns on mobile
  GridCategory: "grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4",

  CategoryCard: (active: boolean, hasError: boolean) =>
    `group p-4 md:p-5 rounded-2xl md:rounded-3xl border-2 transition-all text-center flex flex-col items-center justify-start gap-3 md:gap-4 active:scale-[0.98] ${
      active
        ? 'border-primary-500 bg-primary-50/60 shadow-sm'
        : hasError
        ? 'border-red-200 bg-red-50'
        : 'border-neutral-100 bg-card hover:border-primary-200 hover:shadow-sm'
    }`,

  ImageBox: (active: boolean) =>
    `relative w-full aspect-square rounded-xl md:rounded-2xl overflow-hidden bg-white flex items-center justify-center transition-all ${
      active ? 'ring-1 ring-primary-200' : 'ring-1 ring-neutral-100 group-hover:ring-primary-200'
    }`,
};

const FALLBACK_IMAGES: Record<string, string> = {
  Moto: categoryMoto,
  Scooter: categoryScooter,
  Quad: categoryQuad,
  Accessoires: categoryAccessoires,
  Vélo: categoryVelo,
  Velo: categoryVelo,
  'Jet Ski': categoryJetski,
  'Jet ski': categoryJetski,
  Jetski: categoryJetski,
  'Pièces': categoryPieces,
  'Pièces détachées': categoryPieces,
  Pieces: categoryPieces,
};

const FALLBACK_DESC: Record<string, string> = {
  Moto: 'Sportive, Trail...',
  Scooter: 'Urbain, Maxi...',
  Quad: 'Loisirs, Sport...',
  Accessoires: 'Équipements...',
};

const DEFAULT_IMG = categoryMoto;

export const StepCategory = memo(({ category, onSelect, hasError }: StepCategoryProps) => {
  const { data: backendCategories } = useVehicleCategoriesRich();

  const categories = useMemo(() => {
    const FALLBACK = [
      { id: 'Moto', label: 'Moto', image: categoryMoto, desc: 'Sportive, Trail...' },
      { id: 'Scooter', label: 'Scooter', image: categoryScooter, desc: 'Urbain, Maxi...' },
      { id: 'Quad', label: 'Quad', image: categoryQuad, desc: 'Loisirs, Sport...' },
      { id: 'Accessoires', label: 'Accessoires', image: categoryAccessoires, desc: 'Équipements...' },
    ];

    if (!backendCategories || backendCategories.length === 0) return FALLBACK;

    const NAME_ALIASES: Record<string, string> = {
      Accesoires: 'Accessoires',
      Accessoire: 'Accessoires',
      Velo: 'Vélo',
      'Jet ski': 'Jet Ski',
      Jetski: 'Jet Ski',
      Pieces: 'Pièces',
    };

    return backendCategories.map((c) => {
      const canonical = NAME_ALIASES[c.name] || c.name;

      const remoteImage =
        c.image_url && /^https?:\/\//i.test(c.image_url) ? c.image_url : null;

      return {
        id: canonical,
        label: canonical,
        image:
          remoteImage ||
          FALLBACK_IMAGES[canonical] ||
          FALLBACK_IMAGES[c.name] ||
          DEFAULT_IMG,
        desc: c.description || FALLBACK_DESC[canonical] || FALLBACK_DESC[c.name] || '',
      };
    });
  }, [backendCategories]);

  return (
    <div className="space-y-8 animate-fade-in-up">
      <div className={S.HeaderSection}>
        <h2 className={S.Title}>Choisir une catégorie</h2>
        <p className={S.Subtitle}>
          Sélectionnez le type de bien à mettre en vente.
        </p>
      </div>

      <div className={S.GridCategory}>
        {categories.map((item) => {
          const active = category === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className={S.CategoryCard(active, hasError)}
            >
              <div className={S.ImageBox(active)}>
                <img
                  src={item.image}
                  alt={item.label}
                  loading="lazy"
                  width={512}
                  height={512}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </div>

              <span className="block font-black text-base md:text-lg text-gray-900 leading-tight">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
});