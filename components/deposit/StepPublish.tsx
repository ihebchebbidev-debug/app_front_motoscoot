import React, { memo, useEffect } from 'react';
import { BadgeEuro, FileText, Phone, MessageCircle } from 'lucide-react';
import { UseFormRegister, FieldErrors, Control, useWatch, UseFormSetValue } from 'react-hook-form';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { ListingFormData } from '../../types/listing';
import { useToast } from '../../context/ToastContext';
import { useGovernorates } from '../../hooks/useReferenceData';
import { useUser } from '../../context/UserContext';
import { cleanPhoneInput } from '../../utils/phoneUtils';
import type { PriceEstimate } from '../../services/listingsApi';

interface StepPublishProps {
  register: UseFormRegister<ListingFormData>;
  errors: FieldErrors<ListingFormData>;
  control: Control<ListingFormData>;
  setValue: UseFormSetValue<ListingFormData>;
  /** Market price for this brand / model / year (shown on phones; desktops have the side panel). */
  priceEstimate?: PriceEstimate | null;
}

const dt = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} DT`;

const S = {
  HeaderSection: "text-center md:text-left mb-10",
  Title: "text-2xl md:text-3xl font-black text-gray-900 mb-2 tracking-tight",
  Subtitle: "text-gray-500 font-medium",
  GridFields: "grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6",
  LabelWrapper: "flex justify-between items-center mb-2",
  Label: "text-[12px] font-black text-gray-500 uppercase tracking-widest ml-1",
  TemplateButton: "flex items-center gap-1.5 text-[12px] font-black text-primary-700 uppercase tracking-tight hover:text-primary-800 transition-colors"
};

export const StepPublish = memo(({ register, errors, control, setValue, priceEstimate }: StepPublishProps) => {
  const hasMarketPrice = !!priceEstimate && priceEstimate.n > 0 && priceEstimate.avg != null;
  const { addToast } = useToast();
  const { user } = useUser();
  const formData            = useWatch({ control });
  const currentPhone        = useWatch({ control, name: 'phone' }) as string | undefined;
  const descriptionLength   = ((useWatch({ control, name: 'description' }) as string | undefined) || '').trim().length;

  // --- API reference data ---
  // Only the governorate is asked (no city: one field less). Listings show
  // the governorate when there is no city (services/listingsApi.ts).
  const { data: governorates = [] }   = useGovernorates();

  // Prefill phone from the user's profile the first time we see one and the
  // form's phone is still empty. Subsequent edits stay sticky.
  useEffect(() => {
    if (!currentPhone && user?.phone) {
      setValue('phone', user.phone, { shouldValidate: false, shouldDirty: false });
    }
  }, [user?.phone, currentPhone, setValue]);

  const handleApplyTemplate = () => {
    const { brand, model, year, mileage, cc, condition, equipment, category, accessoryType } = formData;

    if (!brand || !model) {
      addToast("Veuillez renseigner la marque et le modèle à l'étape précédente.", 'warning');
      return;
    }

    let template = '';
    if (category === 'Accessoires') {
      template = `À VENDRE : ${accessoryType ? accessoryType + ' ' : ''}${brand} ${model}

État : ${condition}

Informations complémentaires :
L'article est en très bon état général.`;
    } else {
      template = `À VENDRE : ${brand} ${model} (${year})

Caractéristiques principales :
- Cylindrée : ${cc} cc
- Kilométrage : ${mileage} km
- État : ${condition}

Options & Équipements :
${equipment && equipment.length > 0
  ? equipment.map((e: string) => `- ${e}`).join('\n')
  : '- Équipement standard'}

Informations complémentaires :
Le véhicule est en très bon état général. Entretien à jour.`;
    }

    setValue('description', template, { shouldDirty: true, shouldValidate: true });
    addToast("Modèle d'annonce appliqué !", 'info');
  };

  return (
    <div className="space-y-8 animate-fade-in-up">
      <div className={S.HeaderSection}>
        <h2 className={S.Title}>Prix et description</h2>
        <p className={S.Subtitle}>Fixez votre prix et décrivez votre véhicule.</p>
      </div>
      <div className="space-y-6">
        <div className={S.GridFields}>
          <div>
            <Input
              label="PRIX (DT)"
              placeholder="Ex: 48500"
              type="number"
              {...register('price')}
              error={errors.price?.message}
              leftIcon={<BadgeEuro size={18} />}
              aria-describedby={hasMarketPrice ? 'price-market' : undefined}
            />
            {/* Phones have no side panel: give the market price where the price is typed. */}
            {hasMarketPrice && (
              <p id="price-market" className="lg:hidden mt-2 ml-1 text-[13px] leading-snug text-gray-600">
                Prix du marché : <strong className="font-bold text-gray-900">{dt(priceEstimate!.avg!)}</strong> en moyenne
                {priceEstimate!.min != null && priceEstimate!.max != null && priceEstimate!.min !== priceEstimate!.max && (
                  <> (de {dt(priceEstimate!.min)} à {dt(priceEstimate!.max)})</>
                )}
                , d'après {priceEstimate!.n} annonce{priceEstimate!.n > 1 ? 's' : ''} similaire{priceEstimate!.n > 1 ? 's' : ''}.
              </p>
            )}
          </div>

          <Select
            label="GOUVERNORAT"
            {...register('governorate')}
            error={(errors as any).governorate?.message}
          >
            <option value="">— Sélectionner —</option>
            {governorates.map((g) => <option key={g} value={g}>{g}</option>)}
          </Select>
        </div>

        <div className={S.GridFields}>
          <Input
            label="TÉLÉPHONE"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="22 123 456"
            {...register('phone', {
              setValueAs: (v: string) => cleanPhoneInput(v ?? ''),
            })}
            error={(errors as any).phone?.message}
            leftIcon={<Phone size={18} />}
          />
        </div>

        {/* Per-listing contact preference. Saved to listings.contact_method
            (migration 023). When 'callback', the seller's number stays hidden
            and buyers must request a callback or message in-app. */}
        <ContactMethodToggle control={control} setValue={setValue} />

        <div className="space-y-2">
          <div className={S.LabelWrapper}>
            <label className={S.Label}>DESCRIPTION <span className="text-red-600 dark:text-red-400">*</span></label>
            <button
              type="button"
              onClick={handleApplyTemplate}
              className={S.TemplateButton}
            >
              <FileText size={12} className="text-primary-600" />
              Utiliser un modèle
            </button>
          </div>
          <textarea
            rows={10}
            className={`w-full px-5 py-4 rounded-2xl bg-gray-50 border outline-none focus:bg-card focus:border-primary-600 transition-all font-medium text-sm leading-relaxed placeholder:text-gray-500 ${errors.description ? 'border-red-500' : 'border-gray-200'}`}
            placeholder="Détaillez l'entretien, les options, les éventuels défauts... (Cliquez sur 'Utiliser un modèle' pour gagner du temps !)"
            aria-invalid={!!errors.description}
            aria-describedby="description-count"
            {...register('description')}
          />
          {/* The 20-character minimum is shown before it becomes an error. */}
          <div className="flex items-start justify-between gap-3">
            {errors.description ? <p className="text-red-600 text-[12px] font-bold">{errors.description.message}</p> : <span />}
            <p id="description-count" className="text-xs font-medium text-gray-600 tabular-nums shrink-0">
              {descriptionLength < 20 ? `${descriptionLength} / 20 caractères minimum` : `${descriptionLength} caractères`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
});

/* -------------------------------------------------------------------------- */
/* Contact method toggle                                                       */
/* -------------------------------------------------------------------------- */

interface ToggleProps {
  control: Control<ListingFormData>;
  setValue: UseFormSetValue<ListingFormData>;
}

const ContactMethodToggle: React.FC<ToggleProps> = ({ control, setValue }) => {
  const value = (useWatch({ control, name: 'contactMethod' }) as 'phone' | 'callback' | undefined) ?? 'phone';
  const isCallback = value === 'callback';

  const setMethod = (next: 'phone' | 'callback') => {
    setValue('contactMethod', next, { shouldDirty: true, shouldValidate: false });
  };

  return (
    <div className="border-t border-gray-100 pt-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {isCallback ? (
              <MessageCircle size={16} className="text-primary-600" />
            ) : (
              <Phone size={16} className="text-primary-600" />
            )}
            <span className="text-[12px] font-black text-gray-900 uppercase tracking-widest">
              Mode de contact
            </span>
          </div>
          <p className="mt-1 text-[13px] text-gray-600 leading-snug">
            {isCallback
              ? "Votre numéro reste privé. Les acheteurs vous contactent par message ou demande de rappel."
              : "Votre numéro est affiché sur l'annonce. Les acheteurs peuvent vous appeler directement."}
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={isCallback}
          aria-label="Garder mon numéro privé"
          onClick={() => setMethod(isCallback ? 'phone' : 'callback')}
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
            isCallback ? 'bg-primary-600' : 'bg-gray-300'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-card shadow transition-transform duration-200 ${
              isCallback ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setMethod('phone')}
          className={`rounded-xl border px-3 py-2 text-[12px] font-bold transition-all ${
            !isCallback
              ? 'border-primary-600 bg-primary-50 text-primary-700'
              : 'border-gray-200 bg-card text-gray-500 hover:bg-gray-50'
          }`}
        >
          Afficher le numéro
        </button>
        <button
          type="button"
          onClick={() => setMethod('callback')}
          className={`rounded-xl border px-3 py-2 text-[12px] font-bold transition-all ${
            isCallback
              ? 'border-primary-600 bg-primary-50 text-primary-700'
              : 'border-gray-200 bg-card text-gray-500 hover:bg-gray-50'
          }`}
        >
          Garder privé (rappel)
        </button>
      </div>
    </div>
  );
};
