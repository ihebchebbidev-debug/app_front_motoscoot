import React, { forwardRef, useMemo } from 'react';
import { CatalogPicker, type CatalogWords } from './CatalogPicker';

/**
 * « Modèle » of the listing form: the catalogue picker (CatalogPicker) with
 * what is the model's own — it waits for the brand, lists that brand's
 * models, and is a plain text field when the brand has none in the catalogue.
 */

interface ModelPickerProps {
  label: string;
  value: string;
  onChange: (model: string) => void;
  onBlur?: () => void;
  /** The chosen brand (empty: the field waits for it). */
  brand?: string;
  /** Catalogue models of the brand. */
  models: string[];
  /** The catalogue is still loading. */
  loading?: boolean;
  /** « Ex : TMAX 560 », by category (utils/depositOptions.ts). */
  example: string;
  error?: string;
}

/** A model name typed by hand: single spaces, trimmed, 100 characters (listings.model). */
export const cleanModelName = (v: string): string => v.replace(/\s+/g, ' ').trim().slice(0, 100);

export const ModelPicker = forwardRef<HTMLElement, ModelPickerProps>(({ label, value, onChange, onBlur, brand, models, loading, example, error }, ref) => {
  const names = useMemo(() => Array.from(new Set(models.map((m) => m.replace(/\s+/g, ' ').trim()).filter(Boolean))), [models]);
  const words = useMemo<CatalogWords>(() => ({
    placeholder: example,
    search: 'Rechercher un modèle…',
    missing: 'Mon modèle n’est pas dans la liste',
    use: (typed) => `Utiliser « ${typed} » comme modèle`,
    backToList: `Choisir dans les modèles ${brand ?? ''}`.trim(),
    noMatch: (typed) => `Aucun modèle « ${typed} » dans la liste.`,
    empty: null,
    more: (n) => `${n} autres modèles : tapez quelques lettres pour les trouver.`,
    typedPlaceholder: example,
  }), [brand, example]);

  return (
    <CatalogPicker
      ref={ref}
      label={label}
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      error={error}
      names={names}
      words={words}
      sheetTitle={brand ? `Modèles ${brand}` : label}
      clean={cleanModelName}
      maxLength={100}
      loading={loading}
      // No brand yet: the field waits for it, nothing is downloaded.
      waiting={brand ? undefined : 'Choisissez d’abord la marque'}
      // A brand with no model in the catalogue: the text field straight away.
      freeTextOnly={!!brand && !loading && names.length === 0}
    />
  );
});

ModelPicker.displayName = 'ModelPicker';
