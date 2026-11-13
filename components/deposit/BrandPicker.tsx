import React, { forwardRef, useEffect, useMemo, useState } from 'react';
import { useListingFacets } from '../../hooks/useListings';
import type { BrandRef } from '../../services/miscApi';
import { TAP } from './pickerParts';
import { CatalogPicker, type CatalogWords } from './CatalogPicker';
import { cleanBrandName, popularBrands, tidyBrands } from '../../utils/brandPicker';

/**
 * « Marque » of the listing form: the catalogue picker (CatalogPicker) with
 * what is the brand's own — the logos, and the brands most sold in the
 * category as tiles above the A → Z list.
 */

interface BrandPickerProps {
  label: string;
  value: string;
  onChange: (brand: string) => void;
  onBlur?: () => void;
  brands: BrandRef[];
  /** Listing category (Moto, Scooter…): ranks the popular brands. */
  category?: string;
  error?: string;
}

const WORDS: CatalogWords = {
  placeholder: 'Choisir une marque',
  search: 'Rechercher une marque…',
  missing: 'Ma marque n’est pas dans la liste',
  use: (typed) => `Utiliser « ${typed} » comme marque`,
  backToList: 'Choisir dans la liste des marques',
  noMatch: (typed) => `Aucune marque « ${typed} » dans la liste.`,
  empty: 'Aucune marque pour cette catégorie.',
  more: (n) => `${n} autres marques : tapez quelques lettres pour les trouver.`,
  typedPlaceholder: 'Nom de la marque',
};

const Logo: React.FC<{ brand?: BrandRef; size: number }> = ({ brand, size }) => {
  // A logo file that is gone (404) falls back to the initial, never a broken image.
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [brand?.logo_url]);
  if (brand?.logo_url && !failed) {
    return (
      <img
        src={brand.logo_url}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        draggable={false}
        onError={() => setFailed(true)}
        className="object-contain shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="shrink-0 rounded-md bg-gray-100 text-gray-500 font-bold flex items-center justify-center"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.45) }}
    >
      {Array.from((brand?.name || '?').trim())[0]?.toUpperCase() || '?'}
    </span>
  );
};

export const BrandPicker = forwardRef<HTMLElement, BrandPickerProps>(({ label, value, onChange, onBlur, brands, category, error }, ref) => {
  const catalogue = useMemo(() => tidyBrands(brands), [brands]);
  const names = useMemo(() => catalogue.map((b) => b.name), [catalogue]);
  const byName = useMemo(() => new Map(catalogue.map((b) => [b.name, b])), [catalogue]);

  // Live listings per brand in the category: the popular tiles.
  const { data: facets } = useListingFacets(category ? { type: category } : undefined);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of facets?.brand || []) if (b?.key) m.set(b.key.toLowerCase(), b.count);
    return m;
  }, [facets]);
  const popular = useMemo(() => popularBrands(names, counts), [names, counts]);

  return (
    <CatalogPicker
      ref={ref}
      label={label}
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      error={error}
      names={names}
      words={WORDS}
      clean={cleanBrandName}
      maxLength={40}
      autoCapitalize="words"
      leading={(name, place) => <Logo brand={byName.get(name) ?? { id: 0, name }} size={place === 'field' ? 24 : 28} />}
      listTitle={popular.length > 0 ? 'Toutes les marques' : undefined}
      header={popular.length > 0 ? (pick, chosen) => (
        <div className="px-3 pt-1 pb-3">
          <p className="px-1 pb-2 text-[12px] font-bold uppercase tracking-[0.08em] text-gray-500">Les plus vendues</p>
          <div className="grid grid-cols-4 max-[359px]:grid-cols-3 gap-2">
            {popular.map((name) => (
              <button
                key={name}
                type="button"
                role="option"
                aria-selected={chosen === name}
                onClick={() => pick(name)}
                className={`${TAP} min-h-[72px] flex flex-col items-center justify-center gap-1.5 px-1 py-2 rounded-xl border transition-[transform,border-color,background-color] duration-100 ease-out active:scale-[0.97] motion-reduce:active:scale-100 ${
                  chosen === name ? 'border-primary-600 bg-primary-50' : 'border-gray-200 hover:border-gray-400 active:bg-gray-50'
                }`}
              >
                <Logo brand={byName.get(name)} size={36} />
                <span title={name} className="max-w-full truncate text-[12px] font-semibold text-gray-800">{name}</span>
              </button>
            ))}
          </div>
        </div>
      ) : undefined}
    />
  );
});

BrandPicker.displayName = 'BrandPicker';
