import React, { memo, useState, useMemo, useEffect, useRef } from 'react';
import { Layers, Gauge, Search, Info } from 'lucide-react';
import { UseFormRegister, FieldErrors, Control, useWatch, UseFormSetValue, UseFormClearErrors } from 'react-hook-form';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { ListingFormData } from '../../types/listing';
import { useConditions, useModelsByBrand, useAccessoryTypes } from '../../hooks/useReferenceData';

interface StepTechnicalProps {
  register: UseFormRegister<ListingFormData>;
  errors: FieldErrors<ListingFormData>;
  control: Control<ListingFormData>;
  setValue: UseFormSetValue<ListingFormData>;
  clearErrors: UseFormClearErrors<ListingFormData>;
  category: string;
  brands: string[];
}

const S = {
  HeaderSection: "text-center md:text-left mb-10",
  Title: "text-2xl md:text-3xl font-black text-gray-900 mb-2 tracking-tight",
  Subtitle: "text-gray-500 font-medium",
  GridFields: "grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-8",
  AutocompleteWrapper: "relative w-full",
  SuggestionList: "absolute top-[calc(100%+8px)] left-0 w-full bg-card border border-neutral-200 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.12)] z-[100] overflow-hidden py-2 animate-scale-in origin-top",
  SuggestionItem: "w-full text-left px-5 py-3 text-[13px] font-bold text-gray-700 hover:bg-primary-50 hover:text-primary-600 transition-colors flex items-center justify-between group",
  NoResult: "px-5 py-3.5 text-xs font-bold text-gray-400 italic",
  LabelBadge: "text-[9px] font-black text-gray-300 uppercase tracking-widest px-5 py-2 border-b border-gray-50 mb-1",
};

const displacementOptions = [
  "50", "80", "100", "110", "125", "150", "180", "200", "250", "300",
  "350", "400", "450", "500", "530", "560", "600", "650", "700", "750",
  "800", "850", "900", "1000", "1100", "1200", "1300", "1400", "1600", "1800"
];

const helmetTypes   = ["Jet", "Modulable", "Intégral"];
const visorTypes    = ["Fumé", "Claire", "Iridium"];
const sizes         = ["XS", "S", "M", "L", "XL", "XXL"];
const genders       = ["Homme", "Femme", "Enfant"];
const antiTheftTypes = ["Bloc disque", "Bloc guidon", "Chaîne", "U", "Alarme", "Traceur GPS"];
const intercomOptions = ["Bluetooth", "Mesh"];

export const StepTechnical = memo(({ register, errors, control, setValue, clearErrors, category, brands }: StepTechnicalProps) => {
  const brand            = useWatch({ control, name: 'brand' });
  const modelValue       = useWatch({ control, name: 'model' }) || '';
  const accessoryType    = useWatch({ control, name: 'accessoryType' });
  const visorTypeValues  = useWatch({ control, name: 'visorType' }) || [];
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
  const { data: conditionList = [] }       = useConditions();
  const { names: referenceModels = [] }    = useModelsByBrand(brand || undefined, accessoryTypeForModels);
  const { data: accessoryTypesData = [] }  = useAccessoryTypes();
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
    <div className="space-y-8 animate-fade-in-up">
      <div className={S.HeaderSection}>
        <h2 className={S.Title}>Données techniques</h2>
        <p className={S.Subtitle}>Renseignez les caractéristiques principales de votre annonce.</p>
      </div>
      <div className={S.GridFields}>

        {category === 'Accessoires' && (
          <Select
            label="TYPE D'ACCESSOIRE"
            {...register('accessoryType')}
            error={errors.accessoryType?.message}
          >
            <option value="">Sélectionner</option>
            {accessoryTypeNames.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
        )}

        {/* MARQUE */}
        <Select label="MARQUE" {...register('brand')} error={errors.brand?.message}>
          <option value="">Sélectionner</option>
          {brands.map((b) => <option key={b} value={b}>{b}</option>)}
        </Select>

        {/* MODÈLE avec autocomplete API */}
        <div className={S.AutocompleteWrapper} ref={containerRef}>
          <Input
            label="MODÈLE"
            placeholder="Ex: TMAX 560"
            leftIcon={<Layers size={18} className="text-primary-600" />}
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
                  <div className="flex items-center gap-3">
                    <Search size={14} className="text-gray-300" />
                    <span>{suggestion}</span>
                  </div>
                  <Info size={12} className="opacity-0 group-hover:opacity-40" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ÉTAT */}
        <Select label="ÉTAT" {...register('condition')} error={errors.condition?.message}>
          <option value="">Choisir l'état</option>
          {conditionList.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>

        {category === 'Accessoires' && accessoryType === 'Casque' && (
          <>
            <Select label="TYPE DE CASQUE" {...register('helmetType')} error={errors.helmetType?.message}>
              <option value="">Sélectionner</option>
              {helmetTypes.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>

            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-black text-gray-700 uppercase tracking-widest">
                TYPE DE VISIÈRE (MAX 2)
              </label>
              <div className="flex flex-wrap gap-3">
                {visorTypes.map((t) => (
                  <label key={t} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      value={t}
                      {...register('visorType')}
                      disabled={visorTypeValues?.length >= 2 && !visorTypeValues?.includes(t)}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 w-4 h-4"
                    />
                    <span className="text-sm font-medium text-gray-700">{t}</span>
                  </label>
                ))}
              </div>
              {errors.visorType?.message && (
                <p className="text-red-500 text-xs mt-1">{errors.visorType.message}</p>
              )}
            </div>
          </>
        )}

        {category === 'Accessoires' && (
          <>
            {['Gant', 'Veste', 'Pantalons'].includes(accessoryType || '') && (
              <Select label="TAILLE" {...register('size')} error={errors.size?.message}>
                <option value="">Sélectionner</option>
                {sizes.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            )}

            {['Veste', 'Pantalons', 'Chaussures'].includes(accessoryType || '') && (
              <Select label="GENRE" {...register('gender')} error={errors.gender?.message}>
                <option value="">Sélectionner</option>
                {genders.map((g) => <option key={g} value={g}>{g}</option>)}
              </Select>
            )}

            {accessoryType === 'Chaussures' && (
              <Input
                label="POINTURE"
                placeholder="Ex: 42"
                type="number"
                inputMode="numeric"
                {...register('shoeSize')}
                error={errors.shoeSize?.message}
              />
            )}

            {accessoryType === 'Antivol' && (
              <Select label="TYPE D'ANTIVOL" {...register('antiTheftType')} error={errors.antiTheftType?.message}>
                <option value="">Sélectionner</option>
                {antiTheftTypes.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            )}

            {accessoryType === 'Intercom' && (
              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-black text-gray-700 uppercase tracking-widest">
                  FONCTIONNALITÉS INTERCOM
                </label>
                <div className="flex flex-wrap gap-3">
                  {intercomOptions.map((t) => (
                    <label key={t} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        value={t}
                        {...register('intercomFeatures')}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 w-4 h-4"
                      />
                      <span className="text-sm font-medium text-gray-700">{t}</span>
                    </label>
                  ))}
                </div>
                {errors.intercomFeatures?.message && (
                  <p className="text-red-500 text-xs mt-1">{errors.intercomFeatures.message}</p>
                )}
              </div>
            )}
          </>
        )}

        {category !== 'Accessoires' && (
          <>
            <Select label="ANNÉE" {...register('year')} error={errors.year?.message}>
              <option value="">Sélectionner l'année</option>
              {years.map((year) => <option key={year} value={year}>{year}</option>)}
            </Select>

            <Input
              label="KILOMÉTRAGE"
              placeholder="Ex: 5000"
              type="number"
              inputMode="numeric"
              leftIcon={<Gauge size={18} className="text-primary-600" />}
              {...register('mileage')}
              error={errors.mileage?.message}
            />

            <Select label="CYLINDRÉE (CC)" {...register('cc')} error={errors.cc?.message}>
              <option value="">Sélectionner la cylindrée</option>
              {displacementOptions.map((cc) => (
                <option key={cc} value={cc}>{cc} cc</option>
              ))}
              <option value="Autre">Autre / Électrique</option>
            </Select>
          </>
        )}
      </div>
    </div>
  );
});
