import React, { memo, useEffect, useRef } from 'react';
import { BadgeEuro, FileText, Phone, MessageCircle } from 'lucide-react';
import { UseFormRegister, FieldErrors, Control, useWatch, UseFormSetValue } from 'react-hook-form';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { ListingFormData } from '../../types/listing';
import { useToast } from '../../context/ToastContext';
import { useGovernorates, useCities } from '../../hooks/useReferenceData';
import { useUser } from '../../context/UserContext';
import { cleanPhoneInput } from '../../utils/phoneUtils';

interface StepPublishProps {
  register: UseFormRegister<ListingFormData>;
  errors: FieldErrors<ListingFormData>;
  control: Control<ListingFormData>;
  setValue: UseFormSetValue<ListingFormData>;
}

const S = {
  HeaderSection: "text-center md:text-left mb-10",
  Title: "text-2xl md:text-3xl font-black text-gray-900 mb-2 tracking-tight",
  Subtitle: "text-gray-500 font-medium",
  GridFields: "grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6",
  LabelWrapper: "flex justify-between items-center mb-2",
  Label: "text-[12px] font-black text-gray-400 uppercase tracking-widest ml-1",
  TemplateButton: "flex items-center gap-1.5 text-[12px] font-black text-primary-600 uppercase tracking-tight hover:text-primary-700 transition-colors"
};

export const StepPublish = memo(({ register, errors, control, setValue }: StepPublishProps) => {
  const { addToast } = useToast();
  const { user } = useUser();
  const formData            = useWatch({ control });
  const selectedGovernorate = useWatch({ control, name: 'governorate' }) as string | undefined;
  const currentPhone        = useWatch({ control, name: 'phone' }) as string | undefined;

  // --- API reference data ---
  const { data: governorates = [] }   = useGovernorates();
  const { data: citiesData   = [] }   = useCities(selectedGovernorate || undefined);
  const cityNames = citiesData.map((c) => c.name);

  // Reset city whenever the governorate changes (skip initial render)
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    setValue('city', '', { shouldValidate: false });
  }, [selectedGovernorate, setValue]);

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
L'article est en très bon état général.
Prix légèrement négociable.
Curieux s'abstenir.`;
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
Le véhicule est en très bon état général. Entretien à jour.
Prix légèrement négociable devant le véhicule.
Curieux s'abstenir.`;
    }

    setValue('description', template, { shouldDirty: true, shouldValidate: true });
    addToast("Modèle d'annonce appliqué !", 'info');
  };

  return (
    <div className="space-y-8 animate-fade-in-up">
      <div className={S.HeaderSection}>
        <h2 className={S.Title}>Publication de l'annonce</h2>
        <p className={S.Subtitle}>Fixez votre prix et décrivez votre véhicule pour finaliser le dépôt.</p>
      </div>
      <div className="space-y-6">
        <div className={S.GridFields}>
          <Input
            label="PRIX (DT)"
            placeholder="Ex: 48500"
            type="number"
            {...register('price')}
            error={errors.price?.message}
            leftIcon={<BadgeEuro size={18} />}
          />

          {/* GOUVERNORAT first, then VILLE filtered by it */}
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
          <Select
            label="VILLE"
            {...register('city')}
            error={errors.city?.message}
            disabled={!selectedGovernorate}
          >
            <option value="">
              {selectedGovernorate ? '— Sélectionner une ville —' : '— Choisir un gouvernorat d\'abord —'}
            </option>
            {cityNames.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>

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
            <label className={S.Label}>DESCRIPTION <span className="text-red-500">*</span></label>
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
            className="w-full px-5 py-4 rounded-2xl bg-gray-50 border border-gray-200 outline-none focus:bg-card focus:border-primary-600 transition-all font-medium text-sm leading-relaxed"
            placeholder="Détaillez l'entretien, les options, les éventuels défauts... (Cliquez sur 'Utiliser un modèle' pour gagner du temps !)"
            {...register('description')}
          />
          {errors.description && <p className="text-red-500 text-[12px] font-bold">{errors.description.message}</p>}
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
    <div className="rounded-2xl border border-gray-200 bg-gray-50/60 p-4 md:p-5">
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
