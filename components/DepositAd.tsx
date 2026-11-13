import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  ChevronLeft, ChevronRight, CheckCircle2, MapPin, Calendar, Gauge, Zap, Camera, SearchCheck, Layers, RotateCcw
} from 'lucide-react';
import { z } from 'zod';
import DOMPurify from 'dompurify';
import { Button } from './ui/Button';
import { TypeScaleProvider } from './ui/TypeScale';
import { StepProgress } from './deposit/StepProgress';
import { getOptimizedImageUrl } from '../utils/urlUtils';
import { useToast } from '../context/ToastContext';
import { useUser } from '../context/UserContext';
import { ViewStateName, NavigationParams } from '../types';

// Hooks isolés
import { useDepositSession } from '../hooks/useDepositSession';
import { useBrands } from '../hooks/useReferenceData';
import { UploadedMedia, ListingFormData, listingSchema, MAX_IMAGES } from '../types/listing';

// Import des sous-composants d'étape
import { StepTechnical } from './deposit/StepTechnical';
import { StepEquipment } from './deposit/StepEquipment';
import { StepMedia } from './deposit/StepMedia';
import { StepPublish } from './deposit/StepPublish';
import { StepRecap } from './deposit/StepRecap';
import { DepositSuccess, type PublishedListing } from './deposit/DepositSuccess';
import { primeSuccessSound } from '../utils/successSound';
import { revealBelowHeader, scrollBelowHeader } from '../utils/scrollBelowHeader';
import { depositSteps, depositStepAt, depositStepNumber, depositStepLabel, MAX_DEPOSIT_STEPS, type DepositStepId } from '../utils/depositSteps';
import { DEPOSIT_FIELD_LABELS, depositStepFields, photosStillUploading } from '../utils/depositRules';

import { listingService } from '../services/listingService';
import { PriceEstimator } from './deposit/PriceEstimator';
import SEO from './common/SEO';
import { DEPOSIT_TITLE, DEPOSIT_DESCRIPTION } from '../src/seo/privatePages';
import { analytics } from '../src/lib/posthog';

/** Step fields that show their own error message under the field. */
const FIELDS_WITH_INLINE_ERROR = new Set([
  'category', 'brand', 'model', 'condition', 'year', 'mileage', 'cc', 'accessoryType', 'helmetType', 'visorType',
  'size', 'gender', 'shoeSize', 'antiTheftType', 'intercomFeatures', 'images',
  'price', 'governorate', 'phone', 'description',
]);

interface DepositAdProps {
  onNavigate?: (view: ViewStateName, params?: NavigationParams) => void;
}

const S = {
  Container: "max-w-[1280px] mx-auto px-4 md:px-6 py-6 md:py-24 pb-32 md:pb-8",
  MainCard: "bg-card rounded-2xl md:rounded-[2.5rem] border border-neutral-200 overflow-hidden shadow-none mb-0 md:mb-8",
  StepWrapper: "px-4 pb-4 pt-6 md:px-12 md:pb-12 md:pt-8 xl:pt-10 min-h-[400px] md:min-h-[500px] outline-none focus:ring-0",
  ActionNav: "fixed bottom-0 left-0 right-0 z-[100] md:relative md:z-auto flex justify-between items-center gap-3 md:gap-4 px-4 md:px-10 py-4 md:py-8 bg-card/90 backdrop-blur-xl md:bg-neutral-50 border-t border-neutral-100 shadow-[0_-8px_30px_rgb(0,0,0,0.08)] md:shadow-none md:rounded-b-[2.5rem] pb-[max(1rem,env(safe-area-inset-bottom))] md:pb-8",
};

// Extraction de LivePreviewCard pour memoization
const LivePreviewCard = memo(({ data }: { data: any }) => {
  const { category, brand, model, price, city, year, mileage, cc, condition, images, accessoryType, helmetType, visorType } = data;
  const { user } = useUser();
  const previewInitials =
    ((user?.firstName?.charAt(0) || '') + (user?.lastName?.charAt(0) || '')).toUpperCase() ||
    (user?.email?.slice(0, 2).toUpperCase() || '??');
  const previewName =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() || 'Moi (Aperçu)';
  const previewRole = user?.memberType === 'Pro' ? 'Vendeur Professionnel' : 'Vendeur Particulier';
  return (
    <div className="bg-card rounded-[14px] border border-gray-100 overflow-hidden shadow-sm flex flex-col animate-fade-in transition-all duration-500">
      <div className="relative aspect-[4/3] bg-card overflow-hidden">
        {images && images.length > 0 ? (
          <img src={getOptimizedImageUrl(images[0], 400, 300)} className="w-full h-full object-cover" alt="Preview" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 gap-2">
            <Camera size={32} strokeWidth={1.5} aria-hidden="true" />
            <span className="text-[12px] font-black uppercase tracking-widest text-gray-500">Aperçu Photo</span>
          </div>
        )}
        <div className="absolute top-3 left-3 bg-card px-2.5 py-1 rounded-lg text-[12px] font-black text-gray-900 border border-gray-200 shadow-sm uppercase tracking-tighter">
          {category || 'Catégorie'}
        </div>
      </div>
      <div className="p-5 flex flex-col gap-1">
        <h3 className="text-[17px] font-extrabold text-gray-900 line-clamp-1 leading-snug tracking-tight mb-1">
          {brand && model ? `${brand} ${model}` : (brand || model || 'Marque & Modèle')}
        </h3>
        <p className="text-[16px] font-[900] text-primary-700 leading-none mb-4 tracking-tighter">
          {price ? `${parseInt(price).toLocaleString()} DT` : '0 DT'}
        </p>
        
        {category === 'Accessoires' ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] font-semibold text-gray-500 leading-none mb-3 tracking-tight">
            {accessoryType && <div className="flex items-center gap-1.5"><Layers size={13} className="text-gray-400" /><span>{accessoryType}</span></div>}
            {helmetType && <div className="flex items-center gap-1.5"><SearchCheck size={13} className="text-gray-400" /><span>{helmetType}</span></div>}
            {visorType && visorType.length > 0 && <div className="flex items-center gap-1.5"><Zap size={13} className="text-gray-400" /><span>{visorType.join(', ')}</span></div>}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] font-semibold text-gray-500 leading-none mb-3 tracking-tight">
            <div className="flex items-center gap-1.5"><Calendar size={13} className="text-gray-400" /><span>{year || '2024'}</span></div>
            <div className="flex items-center gap-1.5"><Gauge size={13} className="text-gray-400" /><span>{mileage ? `${parseInt(mileage).toLocaleString()} km` : '0 km'}</span></div>
            <div className="flex items-center gap-1.5"><Zap size={13} className="text-gray-400" /><span>{cc ? `${cc} cc` : '0 cc'}</span></div>
          </div>
        )}

        <div className="flex items-center flex-wrap gap-x-4 gap-y-2 mb-5 text-[12px] font-semibold text-gray-500 tracking-tight">
           <div className="flex items-center gap-1.5"><MapPin size={13} className="text-gray-400" /><span className="truncate">{city || data.governorate}</span></div>
           <div className="flex items-center gap-1.5"><SearchCheck size={13} className="text-gray-400" /><span className="truncate">{condition || 'État'}</span></div>
        </div>
        <div className="flex items-center gap-3 pt-4 border-t border-gray-100/80">
          <div className="w-8 h-8 rounded-full bg-primary-700 text-white flex items-center justify-center font-black text-[12px] shadow-sm shrink-0 uppercase">{previewInitials}</div>
          <div className="flex flex-col min-w-0">
             <span className="text-[12px] font-extrabold text-gray-700 truncate uppercase tracking-wider">{previewName}</span>
             <span className="text-[12px] font-medium text-gray-500 leading-tight">{previewRole}</span>
          </div>
        </div>
      </div>
    </div>
  );
});

/** Fields that open the phone keyboard (selects open a picker instead). */
const isTypingField = (el: Element | null): boolean =>
  !!el && (el.tagName === 'TEXTAREA' ||
    (el.tagName === 'INPUT' && !['checkbox', 'radio', 'file', 'button', 'submit'].includes((el as HTMLInputElement).type)));

const DepositAd: React.FC<DepositAdProps> = ({ onNavigate }) => {
  // Step is mirrored to the URL as `?step=N` so a refresh on step 4 stays on
  // step 4 (and the step is shareable / linkable). The form data itself is
  // already restored from localStorage by `useDepositSession` below — together they
  // give a fully resumable wizard whether the user refreshes, copies the URL,
  // or comes back later. We seed initial state from the URL so the very first
  // render mounts the correct step.
  const [searchParams, setSearchParams] = useSearchParams();
  const initialStepFromUrl = (() => {
    const raw = parseInt(searchParams.get('step') || '', 10);
    return Number.isFinite(raw) && raw >= 1 && raw <= MAX_DEPOSIT_STEPS ? raw : 1;
  })();
  const [step, setStepState] = useState<number>(initialStepFromUrl);

  const setStep = setStepState;

  // Keep ?step=N in sync with the step, after render (updating the router
  // from inside a state updater warned "Cannot update a component while
  // rendering"). Replace, so Back leaves the wizard instead of walking steps.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const current = params.get('step');
    const wanted = step <= 1 ? null : String(step);
    if (current === wanted) return;
    if (wanted) params.set('step', wanted); else params.delete('step');
    setSearchParams(params, { replace: true });
  }, [step, setSearchParams]);

  // If the URL `?step=` changes from outside (back/forward, manual edit), pull
  // it into state. We compare to current step to avoid an infinite loop with
  // the setStep effect above.
  useEffect(() => {
    const raw = parseInt(searchParams.get('step') || '', 10);
    const fromUrl = Number.isFinite(raw) && raw >= 1 && raw <= MAX_DEPOSIT_STEPS ? raw : 1;
    setStepState((prev) => (prev === fromUrl ? prev : fromUrl));
  }, [searchParams]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  // Once the listing is sent, the wizard gives way to the success screen
  // ("Voir mon annonce", "Partager", "Déposer une autre").
  const [published, setPublished] = useState<PublishedListing | null>(null);
  const { addToast } = useToast();
  const stepWrapperRef = useRef<HTMLDivElement>(null);
  const mainCardRef = useRef<HTMLDivElement>(null);
  const lastStep = useRef(initialStepFromUrl);
  const stepDirection = useRef<'forward' | 'back'>('forward');
  // Phones: the fixed Retour/Suivant bar would sit on the keyboard while a
  // text field is being typed in; hide it until the field loses focus.
  const [typing, setTyping] = useState(false);

  // The listing in progress: form, photos, market price and draft, with the
  // rules of a new deposit and of a published one (hooks/useDepositSession.ts).
  const {
    form, values: allValues, media, priceEstimate, run: depositRun, startNew, markPublished,
  } = useDepositSession({ step, setStep });
  const {
    mediaList,
    handleImageChange,
    handleRemoveImage,
    handleRetryUpload,
    handleReorder,
    handleSetMain,
    handleCropDone,
  } = media;

  const { register, handleSubmit, setValue, trigger, clearErrors, control, getFieldState, formState: { errors } } = form;

  // react-hook-form clears an error by mutating the same `errors` object, so
  // the memoised steps would keep showing a fixed field's message: give them
  // a new object whenever the form re-renders.
  const stepErrors = { ...errors };

  const {
    category, brand, model, price, city, year, mileage, cc, condition,
    equipment: selectedEquipment, images, accessoryType
  } = allValues;

  // Hook 2 : Brands filtered by category — and, when the user is depositing
  // an accessory (Casque, Gant, …), further narrowed to the brands the admin
  // has tagged with that accessory type via the Reference tab.
  const brandFilterCategory = category === 'Accessoires' ? undefined : (category || undefined);
  const { data: brandsForCategory = [] } = useBrands(brandFilterCategory, accessoryType || undefined);


  // New step: focus it for screen readers WITHOUT scrolling (focus() and
  // scrollIntoView({ block: 'start' }) put the step under the fixed header
  // on phones), then bring the card's top — progress bar included — just
  // below the header if it is hidden. Not on first load: the page is already
  // at the top.
  const firstStepRender = useRef(true);
  useEffect(() => {
    if (firstStepRender.current) { firstStepRender.current = false; return; }
    stepWrapperRef.current?.focus({ preventScroll: true });
    revealBelowHeader(mainCardRef.current);
  }, [step]);

  // There is no map step any more: the position saved on the seller's
  // profile keeps the listing in the "près de moi" search (the backend skips
  // listings without coordinates). Nothing is shown or asked.
  const { user } = useUser();
  useEffect(() => {
    if (!user || user.latitude == null || user.longitude == null) return;
    if (allValues.latitude == null || allValues.longitude == null) {
      setValue('latitude', user.latitude, { shouldDirty: false });
      setValue('longitude', user.longitude, { shouldDirty: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.latitude, user?.longitude]);





  // ---- Per-step required fields ----------------------------------------------
  // Which field is required on which step, and its name in the toasts:
  // utils/depositRules.ts (the zod schema reads the same rules). Used by both
  // the per-step « Suivant » and the final « Publier », so we never surface an
  // error from a step the user hasn't filled out yet.
  const fieldLabels = DEPOSIT_FIELD_LABELS;

  const stepLabels = (isAccessory: boolean): Record<number, string> =>
    Object.fromEntries(depositSteps(isAccessory).map((id, i) => [i + 1, depositStepLabel(id, isAccessory)]));

  const getStepFields = (targetStep: number, isAccessory: boolean): string[] =>
    depositStepFields(depositStepAt(targetStep, isAccessory), allValues);

  /**
   * Lightweight per-step validator that only inspects the fields belonging to
   * `targetStep`. Returns the list of missing field keys (empty = valid) and
   * whether RHF/Zod considers them valid. We intentionally do NOT fall back
   * to the full schema here, so a missing field on step 5 can never trigger
   * an error message about step 2.
   */
  const validateStep = async (
    targetStep: number,
    isAccessory: boolean,
  ): Promise<{ valid: boolean; missing: string[]; fields: string[] }> => {
    const fields = getStepFields(targetStep, isAccessory);
    if (fields.length === 0) return { valid: true, missing: [], fields };

    const valid = await trigger(fields as any);

    // Belt-and-braces: also inspect raw values so a race between RHF state and
    // the click handler doesn't yield "valid: false, missing: []" toasts.
    const missingFromErrors = fields.filter((f) => (errors as any)?.[f]);
    const missingFromValues = fields.filter((f) => {
      const v = (allValues as any)?.[f];
      if (Array.isArray(v)) return v.length === 0;
      return v === undefined || v === null || v === '';
    });
    const missing = Array.from(new Set([...missingFromErrors, ...missingFromValues]));

    return { valid: valid && missing.length === 0, missing, fields };
  };

  /** Smooth-scroll to the first invalid field within the step container. */
  const scrollToFirstError = () => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const root = stepWrapperRef.current || document;
        const firstError = (root as HTMLElement).querySelector?.(
          '[aria-invalid="true"], [data-invalid="true"], .border-red-500, .border-red-400, .border-destructive'
        ) as HTMLElement | null;
        const target = firstError || stepWrapperRef.current;
        if (target) {
          // Below the fixed header, with room for the field's label above it.
          scrollBelowHeader(target, 44);
          if (firstError && typeof firstError.focus === 'function') {
            try { firstError.focus({ preventScroll: true }); } catch { /* noop */ }
          }
        }
      });
    });
  };

  const handleNext = async () => {
    const isAccessory = allValues.category === 'Accessoires';
    const { valid, missing, fields } = await validateStep(step, isAccessory);

    // Block on still-uploading photos (only when on the photos step).
    const isPhotosStep = depositStepAt(step, isAccessory) === 'photos';
    if (isPhotosStep && valid) {
      if (photosStillUploading(mediaList)) {
        addToast('Veuillez attendre la fin du téléchargement des photos.', 'warning');
        return;
      }
    }

    if (valid) {
      setStep((prev) => prev + 1);
      return;
    }

    // Each field shows its own message under it: a toast repeating them only
    // covered the fields on phones. Keep one for what has no message on screen.
    const unseen = missing.length > 0 ? missing.filter((f) => !FIELDS_WITH_INLINE_ERROR.has(f)) : fields;
    if (unseen.length > 0) {
      addToast(`Champs requis manquants : ${unseen.map((f) => fieldLabels[f] || f).join(', ')}`, 'error', 6000);
    }
    scrollToFirstError();
  };

  const handleBack = () => setStep(prev => prev - 1);

  const handleViewPublished = () => {
    if (!published) return;
    onNavigate?.('listing-details', { id: published.id, title: published.title, listingNumber: published.listingNumber } as any);
  };

  /** Empty form, no photo, no market price, step 1, no draft (useDepositSession). */
  const startBlankDeposit = () => {
    startNew();
    setPublished(null);
    // Back to the top of the form (the step may already be 1: no step effect).
    revealBelowHeader(mainCardRef.current);
  };

  const handleDepositAnother = () => {
    startBlankDeposit();
  };

  /** « Réinitialiser »: start over, after a confirmation (everything typed is lost). */
  const handleResetDeposit = () => {
    if (!window.confirm('Effacer toutes les informations de cette annonce et recommencer ?')) return;
    startBlankDeposit();
    addToast('Formulaire réinitialisé.', 'info');
  };

  const handleEditStep = useCallback((id: DepositStepId) => {
    const n = depositStepNumber(id, allValues.category === 'Accessoires');
    if (n > 0) setStep(n);
  }, [allValues.category, setStep]);

  const toggleEquipment = useCallback((item: string) => {
    const current = selectedEquipment || [];
    if (current.includes(item)) {
      setValue('equipment', current.filter(i => i !== item));
    } else {
      setValue('equipment', [...current, item]);
    }
  }, [selectedEquipment, setValue]);

  const onSubmit = async (data: ListingFormData) => {
    setIsSubmitting(true);

    try {
      const created = await listingService.publishListing(data);

      analytics.capture('listing_published', {
        category: data.category,
        image_count: data.images.length,
        contact_method: data.contactMethod || 'phone',
        has_equipment: data.equipment.length > 0,
      });

      // The draft is done: removed, and nothing is saved until a new deposit.
      markPublished();
      setIsSubmitting(false);
      setPublished({
        id: created.id,
        listingNumber: created.listingNumber,
        title: created.title,
        image: created.image,
        subtitle: [data.year, data.price ? `${data.price} DT` : '', data.governorate].filter(Boolean).join(' • '),
      });
    } catch (error: any) {
      // CAS ÉCHEC
      setIsSubmitting(false);
      addToast(
        error.message || "Une erreur est survenue lors de la publication. Vos données restent sauvegardées localement.", 
        "error",
        6000
      );
    }
  };

  /**
   * Final "Publier" handler. Walks every step (1 → last) and validates only
   * the fields belonging to that step. As soon as a step is invalid we jump
   * the user back there with a focused toast — no more "Année requise" error
   * surfacing on the location step because Zod validates the whole schema.
   */
  const handlePublish = async () => {
    // Inside the click: lets the success screen play its sound later.
    primeSuccessSound();
    const isAccessory = allValues.category === 'Accessoires';
    const lastStep = depositSteps(isAccessory).length;
    const labels = stepLabels(isAccessory);

    for (let s = 1; s <= lastStep; s++) {
      const { valid, missing, fields } = await validateStep(s, isAccessory);
      if (!valid) {
        // On the current step the messages are already under the fields;
        // when we jump back to another step, say where and why.
        if (s !== step || missing.some((f) => !FIELDS_WITH_INLINE_ERROR.has(f))) {
          const offending = (missing.length > 0 ? missing : fields)
            .map((f) => fieldLabels[f] || f);
          addToast(
            `Étape ${s} (${labels[s]}) — champs manquants : ${offending.join(', ')}`,
            'error',
            6500,
          );
        }
        if (s !== step) setStep(s);
        // Wait a tick so the new step is mounted before scrolling.
        setTimeout(scrollToFirstError, 50);
        return;
      }
    }

    // All steps valid — block on still-uploading photos as a final safety net.
    if (photosStillUploading(mediaList)) {
      addToast('Veuillez attendre la fin du téléchargement des photos.', 'warning');
      return;
    }

    // Hand off to RHF so we get the sanitized/transformed payload.
    handleSubmit(onSubmit)();
  };

  // Direction of the last step change, fixed when the step changes so that
  // re-renders (typing) never swap the class and replay the entrance.
  if (lastStep.current !== step) {
    stepDirection.current = step < lastStep.current ? 'back' : 'forward';
    lastStep.current = step;
  }

  const totalSteps = depositSteps(category === 'Accessoires').length;
  const stepNames = depositSteps(category === 'Accessoires').map((id) => depositStepLabel(id, category === 'Accessoires'));
  const stepId = depositStepAt(step, category === 'Accessoires');

  return (
    // Calm type scale (sentence case, fewer weights) for the deposit only.
    <TypeScaleProvider tone="calm">
    <div className="bg-neutral-50 min-h-screen">
      <SEO title={DEPOSIT_TITLE} rawTitle description={DEPOSIT_DESCRIPTION} noIndex url="/deposer-une-annonce" />
      <div className={S.Container}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-8 space-y-6">
            <div ref={mainCardRef} className={`${S.MainCard} relative scroll-mt-24`}>
              {published ? (
                <DepositSuccess listing={published} onView={handleViewPublished} onDepositAnother={handleDepositAnother} />
              ) : (<>
              <StepProgress
                step={step}
                steps={stepNames}
                onStepClick={(n) => { if (n < step) setStep(n); }}
              />
              {/* Start over: clears the form, the photos and the saved draft. */}
              <div className="flex justify-end px-4 md:px-12 -mb-4 md:-mb-2">
                <button
                  type="button"
                  onClick={handleResetDeposit}
                  className="inline-flex items-center gap-1.5 min-h-11 px-2 -mr-2 rounded-lg text-[13px] font-semibold text-gray-600 transition-colors duration-100 hover:text-primary-700 active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
                >
                  <RotateCcw size={15} strokeWidth={2.25} aria-hidden="true" />
                  Réinitialiser
                </button>
              </div>
              <form
                onSubmit={(e) => { e.preventDefault(); handlePublish(); }}
                onFocus={(e) => setTyping(isTypingField(e.target))}
                onBlur={(e) => { if (!isTypingField(e.relatedTarget as Element | null)) setTyping(false); }}
              >
                <div
                  className={S.StepWrapper}
                  ref={stepWrapperRef}
                  tabIndex={-1}
                  aria-live="polite"
                  role="region"
                  aria-label={`Dépôt d'annonce - Étape ${step} sur ${totalSteps}`}
                >
                  {/* Keyed by step: each new step plays its entrance once. */}
                  <div key={`${depositRun}-${step}`} className={stepDirection.current === 'back' ? 'ms-step-back' : 'ms-step-forward'}>
                  {stepId === 'technical' && (
                    <StepTechnical 
                      register={register} 
                      errors={stepErrors} 
                      control={control}
                      setValue={setValue}
                      clearErrors={clearErrors}
                      category={category} 
                      brands={brandsForCategory}
                    />
                  )}
                  {stepId === 'equipment' && (
                    <StepEquipment 
                      selectedEquipment={selectedEquipment} 
                      onToggle={toggleEquipment} 
                    />
                  )}
                  {stepId === 'photos' && (
                    <StepMedia 
                      mediaList={mediaList} 
                      onImageChange={handleImageChange} 
                      onRemoveImage={handleRemoveImage} 
                      onRetryUpload={handleRetryUpload}
                      onReorder={handleReorder}
                      onSetMain={handleSetMain}
                      onCropDone={handleCropDone}
                      errors={stepErrors} 
                    />
                  )}
                  {stepId === 'details' && (
                    <StepPublish 
                      register={register} 
                      errors={stepErrors} 
                      control={control}
                      setValue={setValue}
                      priceEstimate={category === 'Accessoires' ? null : priceEstimate}
                    />
                  )}
                  {stepId === 'recap' && (
                    <StepRecap
                      values={allValues}
                      mediaList={mediaList}
                      isAccessory={category === 'Accessoires'}
                      onEdit={handleEditStep}
                    />
                  )}
                  </div>
                </div>
                <div className={`${S.ActionNav} transition-transform duration-200 ease-out ${typing ? 'max-md:translate-y-full max-md:pointer-events-none' : ''}`}>
                  {/* Step 1 has nowhere to go back to: no greyed-out button. */}
                  {step > 1 && (
                    <Button 
                      type="button" 
                      variant="ghost" 
                      onClick={handleBack} 
                      leftIcon={<ChevronLeft size={20}/>}
                      className="flex-1 md:flex-initial md:bg-card md:border md:border-neutral-200 md:hover:bg-neutral-50 font-bold"
                    >
                      Retour
                    </Button>
                  )}
                  {step < totalSteps ? (
                    <Button 
                      type="button" 
                      variant="primary" 
                      onClick={handleNext} 
                      rightIcon={<ChevronRight size={20}/>}
                      className="flex-[2] md:flex-initial md:ml-auto bg-primary-700 dark:text-gray-50 dark:hover:bg-primary-600 shadow-primary/20"
                    >
                      Suivant
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="primary"
                      onClick={handlePublish}
                      isLoading={isSubmitting}
                      rightIcon={<CheckCircle2 size={20}/>}
                      className="flex-[2] md:flex-initial md:ml-auto bg-primary-700 dark:text-gray-50 dark:hover:bg-primary-600 shadow-primary/20"
                    >
                      Publier
                    </Button>
                  )}
                </div>
              </form>

              </>)}
            </div>
          </div>
          <div className="hidden lg:block lg:col-span-4 sticky top-32 space-y-6">
             <div className="space-y-4">
                <LivePreviewCard data={allValues} />
                {category !== 'Accessoires' && brand && (
                  <PriceEstimator
                    estimation={priceEstimate?.avg ?? null}
                    hasEnoughData={!!priceEstimate && priceEstimate.n > 0 && priceEstimate.avg != null}
                  />
                )}
             </div>
          </div>
        </div>
      </div>
    </div>
    </TypeScaleProvider>
  );
};

export default DepositAd;
