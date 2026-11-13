import React, { memo, useState, useMemo, useEffect, useRef } from 'react';
import { Search, Info } from 'lucide-react';
import { UseFormRegister, FieldErrors, Control, Controller, useWatch, UseFormSetValue, UseFormClearErrors } from 'react-hook-form';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { ListingFormData } from '../../types/listing';
import { useConditions, useModelsByBrand, useAccessoryTypes, useVehicleCategoriesRich } from '../../hooks/useReferenceData';
import { DEPOSIT_CATEGORIES } from '../../utils/depositSteps';
import type { BrandRef } from '../../services/miscApi';
import { BrandPicker } from './BrandPicker';
import { DEFAULT_CONDITIONS, modelExample, optionsWithValue } from '../../utils/depositOptions';
import { FIELD_TYPE, useTypeTone } from '../ui/TypeScale';

// Backend category names that differ from the form's values.
const CATEGORY_ALIASES: Record<string, string> = { Accesoires: 'Accessoires', Accessoire: 'Accessoires' };

interface StepTechnicalProps {
  register: UseFormRegister<ListingFormData>;
  errors: FieldErrors<ListingFormData>;
  control: Control<ListingFormData>;
  setValue: UseFormSetValue<ListingFormData>;
  clearErrors: UseFormClearErrors<ListingFormData>;
  category: string;
  /** Brands of the category, with their logos. */
  brands: BrandRef[];
}

const S = {
  HeaderSection: "mb-10",
  Title: "text-[26px] md:text-3xl leading-[1.15] font-extrabold text-gray-900 mb-2 tracking-[-0.02em]",
  Subtitle: "text-base leading-relaxed text-gray-600",
  GridFields: "grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-8",
  AutocompleteWrapper: "relative w-full",
  SuggestionList: "absolute top-[calc(100%+8px)] left-0 w-full bg-card border border-neutral-200 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.12)] z-[100] overflow-hidden py-2 animate-scale-in origin-top",
  SuggestionItem: "w-full text-left px-5 py-3 text-[15px] font-medium text-gray-900 hover:bg-primary-50 hover:text-primary-600 transition-colors flex items-center justify-between group",
  NoResult: "px-5 py-3.5 text-[13px] text-gray-600",
  LabelBadge: "text-[11px] font-black text-gray-500 uppercase tracking-widest px-5 py-2 border-b border-gray-100 mb-1",
};

const displacementOptions = [
  "50", "80", "100", "110", "125", "150", "180", "200", "250", "300",
  "350", "400", "450", "500", "530", "560", "600", "650", "700", "750",
  "800", "850", "900", "1000", "1100", "1200", "1300", "1400", "1600", "1800"
];

const helmetTypes   = ["Jet", "Modulable", "Intégral"];
// Agreed with « visière » (féminin); stored as shown.
const visorTypes    = ["Fumée", "Claire", "Iridium"];
const sizes         = ["XS", "S", "M", "L", "XL", "XXL"];
const genders       = ["Homme", "Femme", "Enfant"];
const antiTheftTypes = ["Bloque-disque", "Bloque-guidon", "Chaîne", "Antivol en U", "Alarme", "Traceur GPS"];
const intercomOptions = ["Bluetooth", "Mesh"];

// Each choice is a 44 px target for a finger (the bare 16 px boxes were 20 px tall).
const CHECK_ROW = "min-h-[44px] inline-flex items-center gap-2.5 px-4 rounded-xl border border-gray-200 bg-gray-50 cursor-pointer select-none touch-manipulation has-[:checked]:border-primary-600 has-[:checked]:bg-primary-50 has-[:disabled]:opacity-50 has-[:disabled]:cursor-not-allowed";

export const StepTechnical = memo(({ register, errors, control, setValue, clearErrors, category, brands }: StepTechnicalProps) => {
  const brand            = useWatch({ control, name: 'brand' });
  const modelValue       = useWatch({ control, name: 'model' }) || '';
  const accessoryType    = useWatch({ control, name: 'accessoryType' });
  const visorTypeValues  = useWatch({ control, name: 'visorType' }) || [];
  const fieldType        = FIELD_TYPE[useTypeTone()];
  const intercomFeatures = useWatch({ control, name: 'intercomFeatures' }) || [];

  const currentYear = new Date().getFullYear();
  const years = useMemo(
    () => Array.from({ length: currentYear - 1995 + 1 }, (_, i) => String(currentYear - i)),
    [currentYear],
  );

  // --- API reference data ---
  // When the user is depositing an accessory, narrow the model autocomplete
  // to models the admin has tagged with that accessory type. For vehicle
  // categories the second arg stays undefined → no extra filtering.
  const accessoryTypeForModels = category === 'Accessoires' ? (accessoryType || undefined) : undefined;
  const { data: conditionData = [] }       = useConditions();
  const conditionList = conditionData.length > 0 ? conditionData : DEFAULT_CONDITIONS;
  const { names: referenceModels = [] }    = useModelsByBrand(brand || undefined, accessoryTypeForModels);
  const { data: accessoryTypesData = [] }  = useAccessoryTypes();
  const { data: backendCategories }        = useVehicleCategoriesRich();
  // The admin's category list, limited to what the listing form accepts.
  const categoryOptions = useMemo(() => {
    const allowed = new Set<string>(DEPOSIT_CATEGORIES);
    const names = (backendCategories || [])
      .map((c) => CATEGORY_ALIASES[c.name] || c.name)
      .filter((n) => allowed.has(n));
    return names.length > 0 ? Array.from(new Set(names)) : [...DEPOSIT_CATEGORIES];
  }, [backendCategories]);
  const accessoryTypeNames = useMemo(() => accessoryTypesData.map((t) => t.name), [accessoryTypesData]);

  const [showSuggestions, setShowSuggestions] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredSuggestions = useMemo(() => {
    const search = modelValue.toLowerCase().trim();
    if (search.length < 1) return [];
    return referenceModels
      .filter((m) => m.toLowerCase().includes(search) && m.toLowerCase() !== search)
      .slice(0, 8);
  }, [modelValue, referenceModels]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSuggestionSelect = (suggestion: string) => {
    setValue('model', suggestion, { shouldValidate: true, shouldDirty: true });
    clearErrors('model');
    setShowSuggestions(false);
  };

  return (
    <div className="space-y-8">
      <div className={S.HeaderSection}>
        <h2 className={S.Title}>Données techniques</h2>
        <p className={S.Subtitle}>Renseignez les caractéristiques principales de votre annonce.</p>
      </div>
      <div className={S.GridFields}>

        {/* CATÉGORIE: the other fields depend on it (brands, accessory fields). */}
        <Select label="Catégorie" {...register('category')} error={errors.category?.message}>
          <option value="">Choisir une catégorie</option>
          {categoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>

        {category && (<>
        {category === 'Accessoires' && (
          // Controlled: a restored draft shows its value even when the list arrives after it.
          <Controller
            control={control}
            name="accessoryType"
            render={({ field }) => (
              <Select
                label="Type d'accessoire"
                name={field.name}
                ref={field.ref}
                value={field.value ?? ''}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={errors.accessoryType?.message}
              >
                <option value="">Choisir un type</option>
                {optionsWithValue(accessoryTypeNames, field.value).map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            )}
          />
        )}

        {/* MARQUE: popular brands first, then A → Z, with a search (utils/brandPicker.ts). */}
        <Controller
          control={control}
          name="brand"
          render={({ field }) => (
            <BrandPicker
              ref={field.ref}
              label="Marque"
              value={field.value || ''}
              onChange={(v) => { field.onChange(v); if (v) clearErrors('brand'); }}
              onBlur={field.onBlur}
              brands={brands}
              category={category}
              error={errors.brand?.message}
            />
          )}
        />

        {/* MODÈLE avec autocomplete API */}
        <div className={S.AutocompleteWrapper} ref={containerRef}>
          <Input
            label="Modèle"
            placeholder={modelExample(category, accessoryType)}
            maxLength={100}
            {...register('model')}
            error={errors.model?.message}
            onFocus={() => setShowSuggestions(true)}
            autoComplete="off"
          />
          {showSuggestions && filteredSuggestions.length > 0 && (
            <div className={S.SuggestionList} role="listbox">
              <div className={S.LabelBadge}>
                {brand ? `Modèles ${brand}` : 'Modèles suggérés'}
              </div>
              {filteredSuggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); handleSuggestionSelect(suggestion); }}
                  className={S.SuggestionItem}
                  role="option"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <Search size={14} className="text-gray-300 shrink-0 mt-[3px]" />
                    <span>{suggestion}</span>
                  </div>
                  <Info size={12} className="opacity-0 group-hover:opacity-40" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ÉTAT */}
        <Controller
          control={control}
          name="condition"
          render={({ field }) => (
            <Select
              label="État"
              name={field.name}
              ref={field.ref}
              value={field.value ?? ''}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={errors.condition?.message}
            >
              <option value="">Choisir l'état</option>
              {optionsWithValue(conditionList, field.value).map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          )}
        />

        {category === 'Accessoires' && accessoryType === 'Casque' && (
          <>
            <Select label="Type de casque" {...register('helmetType')} error={errors.helmetType?.message}>
              <option value="">Choisir un type</option>
              {helmetTypes.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>

            {/* A group of choices: a fieldset named by its legend, in the labels' own style. */}
            <fieldset className="flex flex-col gap-2 min-w-0">
              <legend className={`${fieldType.label} ml-1 mb-2`}>Type de visière</legend>
              <p className="ml-1 -mt-1 text-[13px] text-gray-600">2 au maximum</p>
              <div className="flex flex-wrap gap-2">
                {visorTypes.map((t) => (
                  <label key={t} className={CHECK_ROW}>
                    <input
                      type="checkbox"
                      value={t}
                      {...register('visorType')}
                      disabled={visorTypeValues?.length >= 2 && !visorTypeValues?.includes(t)}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 w-5 h-5"
                    />
                    <span className="text-[15px] font-medium text-gray-900">{t}</span>
                  </label>
                ))}
              </div>
              {errors.visorType?.message && (
                <p className={`${fieldType.error} text-red-600 ml-1`}>{errors.visorType.message}</p>
              )}
            </fieldset>
          </>
        )}

        {category === 'Accessoires' && (
          <>
            {['Gant', 'Veste', 'Pantalons'].includes(accessoryType || '') && (
              <Select label="Taille" {...register('size')} error={errors.size?.message}>
                <option value="">Choisir une taille</option>
                {sizes.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            )}

            {['Veste', 'Pantalons', 'Chaussures'].includes(accessoryType || '') && (
              <Select label="Genre" {...register('gender')} error={errors.gender?.message}>
                <option value="">Choisir</option>
                {genders.map((g) => <option key={g} value={g}>{g}</option>)}
              </Select>
            )}

            {accessoryType === 'Chaussures' && (
              <Input
                label="Pointure"
                placeholder="Ex : 42"
                type="number"
                inputMode="numeric"
                {...register('shoeSize')}
                error={errors.shoeSize?.message}
              />
            )}

            {accessoryType === 'Antivol' && (
              <Select label="Type d'antivol" {...register('antiTheftType')} error={errors.antiTheftType?.message}>
                <option value="">Choisir un type</option>
                {antiTheftTypes.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            )}

            {accessoryType === 'Intercom' && (
              <fieldset className="flex flex-col gap-2 min-w-0">
                <legend className={`${fieldType.label} ml-1 mb-2`}>Options Intercom</legend>
                <div className="flex flex-wrap gap-2">
                  {intercomOptions.map((t) => (
                    <label key={t} className={CHECK_ROW}>
                      <input
                        type="checkbox"
                        value={t}
                        {...register('intercomFeatures')}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 w-5 h-5"
                      />
                      <span className="text-[15px] font-medium text-gray-900">{t}</span>
                    </label>
                  ))}
                </div>
                {errors.intercomFeatures?.message && (
                  <p className={`${fieldType.error} text-red-600 ml-1`}>{errors.intercomFeatures.message}</p>
                )}
              </fieldset>
            )}
          </>
        )}

        {category !== 'Accessoires' && (
          <>
            <Select label="Année" {...register('year')} error={errors.year?.message}>
              <option value="">Choisir l'année</option>
              {years.map((year) => <option key={year} value={year}>{year}</option>)}
            </Select>

            <Input
              label="Kilométrage"
              placeholder="Ex : 12000"
              type="number"
              inputMode="numeric"
              rightIcon={<span aria-hidden="true" className="text-[15px] font-medium text-gray-600">km</span>}
              min={0}
              max={999999}
              step={1}
              {...register('mileage')}
              error={errors.mileage?.message}
            />

            <Select label="Cylindrée" {...register('cc')} error={errors.cc?.message}>
              <option value="">Choisir la cylindrée</option>
              {displacementOptions.map((cc) => (
                <option key={cc} value={cc}>{cc} cc</option>
              ))}
              {/* Both are stored as no cylinder size (listings.cc is a number). */}
              <option value="Électrique">Électrique</option>
              <option value="Autre">Autre</option>
            </Select>
          </>
        )}
        </>)}
      </div>
    </div>
  );
});
