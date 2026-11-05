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
  HeaderSection: "mb-10",
  Title: "text-[26px] md:text-3xl leading-[1.15] font-extrabold text-gray-900 mb-2 tracking-[-0.02em]",
  Subtitle: "text-base leading-relaxed text-gray-600",
  GridFields: "grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6",
  LabelWrapper: "flex justify-between items-center mb-2",
  Label: "text-[14px] leading-[1.3] font-semibold text-gray-900 ml-1",
  TemplateButton: "flex items-center gap-1.5 min-h-11 text-[14px] font-semibold text-primary-700 hover:text-primary-800 transition-colors"
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
    <div className="space-y-8">
      <div className={S.HeaderSection}>
        <h2 className={S.Title}>Prix et description</h2>
        <p className={S.Subtitle}>Fixez votre prix et décrivez votre véhicule.</p>
      </div>
      <div className="space-y-6">
        <div className={S.GridFields}>
          <div>
            <Input
              label="Prix (DT)"
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
            label="Gouvernorat"
            {...register('governorate')}
            error={(errors as any).governorate?.message}
          >
            <option value="">— Sélectionner —</option>
            {governorates.map((g) => <option key={g} value={g}>{g}</option>)}
          </Select>
        </div>

        <div className={S.GridFields}>
          <Input
            label="Téléphone"
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
            <label className={S.Label}>Description <span className="text-red-600 dark:text-red-400">*</span></label>
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
            {errors.description ? <p className="text-red-600 text-[13px] font-medium">{errors.description.message}</p> : <span />}
            <p id="description-count" className="text-[13px] text-gray-600 tabular-nums shrink-0">
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

const CONTACT_OPTIONS = [
  {
    value: 'phone' as const,
    Icon: Phone,
    title: 'Afficher mon numéro',
    text: "Votre numéro est affiché sur l'annonce. Les acheteurs peuvent vous appeler directement.",
  },
  {
    value: 'callback' as const,
    Icon: MessageCircle,
    title: 'Garder mon numéro privé',
    text: 'Les acheteurs vous contactent par message ou demande de rappel.',
  },
];

/**
 * One exclusive choice (native radio buttons): before, a switch and two
 * buttons changed the same setting.
 */
const ContactMethodToggle: React.FC<ToggleProps> = ({ control, setValue }) => {
  const value = (useWatch({ control, name: 'contactMethod' }) as 'phone' | 'callback' | undefined) ?? 'phone';

  return (
    <fieldset className="border-t border-gray-100 pt-6">
      <legend className="float-left w-full text-[14px] leading-[1.3] font-semibold text-gray-900 ml-1 mb-3">
        Mode de contact
      </legend>
      <div className="clear-left grid grid-cols-1 sm:grid-cols-2 gap-3">
        {CONTACT_OPTIONS.map(({ value: option, Icon, title, text }) => {
          const selected = value === option;
          return (
            <label
              key={option}
              className={`relative flex items-start gap-3 min-h-11 rounded-2xl border-2 p-4 cursor-pointer transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-gray-900 ${
                selected ? 'border-primary-600 bg-primary-50' : 'border-gray-200 bg-card hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                name="contactMethod"
                value={option}
                checked={selected}
                onChange={() => setValue('contactMethod', option, { shouldDirty: true, shouldValidate: false })}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                  selected ? 'border-primary-700' : 'border-gray-400'
                }`}
              >
                {selected && <span className="h-2.5 w-2.5 rounded-full bg-primary-700" />}
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-2 text-[16px] font-semibold text-gray-900">
                  <Icon size={16} className="text-primary-700 shrink-0" aria-hidden="true" />
                  {title}
                </span>
                <span className="mt-1 block text-[13px] leading-snug text-gray-600">{text}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
};
