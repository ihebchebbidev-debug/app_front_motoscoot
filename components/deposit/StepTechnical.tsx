import React, { memo, useMemo } from 'react';
import { UseFormRegister, FieldErrors, Control, Controller, useWatch, UseFormSetValue, UseFormClearErrors } from 'react-hook-form';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { ChoiceChips } from '../ui/ChoiceChips';
import { ListingFormData } from '../../types/listing';
import { useConditions, useModelsByBrand, useAccessoryTypes, useVehicleCategoriesRich } from '../../hooks/useReferenceData';
import { DEPOSIT_CATEGORIES } from '../../utils/depositSteps';
import type { BrandRef } from '../../services/miscApi';
import { BrandPicker } from './BrandPicker';
import { ModelPicker } from './ModelPicker';
import { CONDITION_HINTS, DEFAULT_CONDITIONS, categoryTileImage, modelExample, optionsWithValue } from '../../utils/depositOptions';
import { API_ORIGIN } from '../../services/apiClient';
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
  // No brand yet: no request (the whole catalogue is not worth downloading).
  const { names: referenceModels = [], isLoading: modelsLoading } = useModelsByBrand(brand || undefined, accessoryTypeForModels, !!brand);
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
  // Category → its photo (the admin's image, else its icon).
  const categoryImages = useMemo(() => {
    const m = new Map<string, string | null | undefined>();
    for (const c of backendCategories || []) {
      const name = CATEGORY_ALIASES[c.name] || c.name;
      if (!m.has(name)) m.set(name, c.image_url || c.icon_url);
    }
    return m;
  }, [backendCategories]);
  const accessoryTypeNames = useMemo(() => accessoryTypesData.map((t) => t.name), [accessoryTypesData]);


  return (
    <div className="space-y-8">
      <div className={S.HeaderSection}>
        <h2 className={S.Title}>Données techniques</h2>
        <p className={S.Subtitle}>Renseignez les caractéristiques principales de votre annonce.</p>
      </div>
      <div className={S.GridFields}>

        {/* CATÉGORIE: the first choice; the other fields depend on it. Four photos (the admin's category images). */}
        <Controller
          control={control}
          name="category"
          render={({ field }) => (
            <ChoiceChips
              variant="tiles"
              className="md:col-span-2"
              label="Catégorie"
              name={field.name}
              ref={field.ref}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              options={categoryOptions.map((value) => ({ value, image: categoryTileImage(categoryImages.get(value), API_ORIGIN) }))}
              error={errors.category?.message}
            />
          )}
        />

        {category && (<>
        {category === 'Accessoires' && (
          // Controlled: a restored draft shows its value even when the list arrives after it.
          <Controller
            control={control}
            name="accessoryType"
            render={({ field }) => (
              <ChoiceChips
                className="md:col-span-2"
                label="Type d'accessoire"
                name={field.name}
                ref={field.ref}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                options={optionsWithValue(accessoryTypeNames, field.value).map((value) => ({ value }))}
                error={errors.accessoryType?.message}
              />
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

        {/* MODÈLE: the brand's models in the same sheet as the brand (ModelPicker). */}
        <Controller
          control={control}
          name="model"
          render={({ field }) => (
            <ModelPicker
              ref={field.ref}
              label="Modèle"
              value={field.value || ''}
              onChange={(v) => { field.onChange(v); if (v) clearErrors('model'); }}
              onBlur={field.onBlur}
              brand={brand || ''}
              models={referenceModels}
              loading={!!brand && modelsLoading}
              example={modelExample(category, accessoryType)}
              error={errors.model?.message}
            />
          )}
        />

        {category === 'Accessoires' && accessoryType === 'Casque' && (
          <>
            <Controller
              control={control}
              name="helmetType"
              render={({ field }) => (
                <ChoiceChips label="Type de casque" name={field.name} ref={field.ref} value={field.value} onChange={field.onChange} onBlur={field.onBlur}
                  options={helmetTypes.map((value) => ({ value }))} error={errors.helmetType?.message} />
              )}
            />

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
              <Controller
                control={control}
                name="size"
                render={({ field }) => (
                  <ChoiceChips label="Taille" name={field.name} ref={field.ref} value={field.value} onChange={field.onChange} onBlur={field.onBlur}
                    options={sizes.map((value) => ({ value }))} error={errors.size?.message} />
                )}
              />
            )}

            {['Veste', 'Pantalons', 'Chaussures'].includes(accessoryType || '') && (
              <Controller
                control={control}
                name="gender"
                render={({ field }) => (
                  <ChoiceChips label="Genre" name={field.name} ref={field.ref} value={field.value} onChange={field.onChange} onBlur={field.onBlur}
                    options={genders.map((value) => ({ value }))} error={errors.gender?.message} />
                )}
              />
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
              <Controller
                control={control}
                name="antiTheftType"
                render={({ field }) => (
                  <ChoiceChips className="md:col-span-2" label="Type d'antivol" name={field.name} ref={field.ref} value={field.value} onChange={field.onChange} onBlur={field.onBlur}
                    options={antiTheftTypes.map((value) => ({ value }))} error={errors.antiTheftType?.message} />
                )}
              />
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

        {/* ÉTAT: last, once the item is described; each choice says what it means. */}
        <Controller
          control={control}
          name="condition"
          render={({ field }) => (
            <ChoiceChips
              variant="cards"
              className="md:col-span-2"
              label="État"
              name={field.name}
              ref={field.ref}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              options={optionsWithValue(conditionList, field.value).map((value) => ({ value, hint: CONDITION_HINTS[value] }))}
              error={errors.condition?.message}
            />
          )}
        />
        </>)}
      </div>
    </div>
  );
});
