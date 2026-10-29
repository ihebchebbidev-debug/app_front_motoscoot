import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  ChevronLeft, ChevronRight, CheckCircle2, MapPin, Calendar, Gauge, Zap, Camera, SearchCheck, Layers
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import DOMPurify from 'dompurify';
import { Button } from './ui/Button';
import { StepProgress } from './deposit/StepProgress';
import { getOptimizedImageUrl } from '../utils/urlUtils';
import { useToast } from '../context/ToastContext';
import { useUser } from '../context/UserContext';
import { ViewStateName, NavigationParams } from '../types';

// Hooks isolés
import { useMediaUpload } from '../hooks/useMediaUpload';
import { useAdDraft } from '../hooks/useAdDraft';
import { useBrands } from '../hooks/useReferenceData';
import { UploadedMedia, ListingFormData, listingSchema, MAX_IMAGES } from '../types/listing';

// Import des sous-composants d'étape
import { StepCategory } from './deposit/StepCategory';
import { StepTechnical } from './deposit/StepTechnical';
import { StepEquipment } from './deposit/StepEquipment';
import { StepMedia } from './deposit/StepMedia';
import { StepPublish } from './deposit/StepPublish';
import { StepLocation } from './deposit/StepLocation';

import { listingService } from '../services/listingService';
import { listingsApi, PriceEstimate } from '../services/listingsApi';
import { PriceEstimator } from './deposit/PriceEstimator';
import SEO from './common/SEO';

interface DepositAdProps {
  onNavigate?: (view: ViewStateName, params?: NavigationParams) => void;
}

const S = {
  Container: "max-w-[1280px] mx-auto px-4 md:px-6 py-6 md:py-24 pb-32 md:pb-8",
  MainCard: "bg-card rounded-2xl md:rounded-[2.5rem] border border-neutral-200 overflow-hidden shadow-none mb-0 md:mb-8",
  StepWrapper: "p-4 md:p-12 min-h-[400px] md:min-h-[500px] outline-none focus:ring-0",
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
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 gap-2">
            <Camera size={32} strokeWidth={1.5} />
            <span className="text-[12px] font-black uppercase tracking-widest">Aperçu Photo</span>
          </div>
        )}
        <div className="absolute top-3 left-3 bg-card/90 backdrop-blur-md px-2.5 py-1 rounded-lg text-[12px] font-black text-foreground border border-border/50 shadow-sm uppercase tracking-tighter">
          {category || 'Catégorie'}
        </div>
      </div>
      <div className="p-5 flex flex-col gap-1">
        <h3 className="text-[17px] font-extrabold text-gray-900 line-clamp-1 leading-snug tracking-tight mb-1">
          {brand && model ? `${brand} ${model}` : (brand || model || 'Marque & Modèle')}
        </h3>
        <p className="text-[16px] font-[900] text-primary-600 leading-none mb-4 tracking-tighter">
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
           <div className="flex items-center gap-1.5"><MapPin size={13} className="text-gray-400" /><span className="truncate">{city}</span></div>
           <div className="flex items-center gap-1.5"><SearchCheck size={13} className="text-gray-400" /><span className="truncate">{condition || 'État'}</span></div>
        </div>
        <div className="flex items-center gap-3 pt-4 border-t border-gray-100/80">
          <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-black text-[12px] shadow-sm shrink-0 uppercase">{previewInitials}</div>
          <div className="flex flex-col min-w-0">
             <span className="text-[12px] font-extrabold text-gray-700 truncate uppercase tracking-wider">{previewName}</span>
             <span className="text-[12px] font-medium text-gray-400 leading-tight">{previewRole}</span>
          </div>
        </div>
      </div>
    </div>
  );
});

const DepositAd: React.FC<DepositAdProps> = ({ onNavigate }) => {
  // Step is mirrored to the URL as `?step=N` so a refresh on step 4 stays on
  // step 4 (and the step is shareable / linkable). The form data itself is
  // already restored from localStorage by `useAdDraft` below — together they
  // give a fully resumable wizard whether the user refreshes, copies the URL,
  // or comes back later. We seed initial state from the URL so the very first
  // render mounts the correct step.
  const [searchParams, setSearchParams] = useSearchParams();
  const initialStepFromUrl = (() => {
    const raw = parseInt(searchParams.get('step') || '', 10);
    return Number.isFinite(raw) && raw >= 1 && raw <= 6 ? raw : 1;
  })();
  const [step, setStepState] = useState<number>(initialStepFromUrl);

  // Keep ?step=N in sync with internal step state. Use replace so the wizard
  // doesn't pollute browser history with one entry per step (back button
  // should leave the wizard, not walk through every previous step).
  const setStep = useCallback((next: number | ((prev: number) => number)) => {
    setStepState((prev) => {
      const resolved = typeof next === 'function' ? (next as (p: number) => number)(prev) : next;
      const params = new URLSearchParams(window.location.search);
      if (resolved <= 1) {
        params.delete('step');
      } else {
        params.set('step', String(resolved));
      }
      const qs = params.toString();
      // setSearchParams is the react-router-dom way; replace=true avoids
      // history bloat. Wrap in try/catch in case we're called outside a
      // router context (defensive — should never happen here).
      try {
        setSearchParams(qs ? params : new URLSearchParams(), { replace: true });
      } catch { /* noop */ }
      return resolved;
    });
  }, [setSearchParams]);

  // If the URL `?step=` changes from outside (back/forward, manual edit), pull
  // it into state. We compare to current step to avoid an infinite loop with
  // the setStep effect above.
  useEffect(() => {
    const raw = parseInt(searchParams.get('step') || '', 10);
    const fromUrl = Number.isFinite(raw) && raw >= 1 && raw <= 6 ? raw : 1;
    setStepState((prev) => (prev === fromUrl ? prev : fromUrl));
  }, [searchParams]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  // `publishSuccess` drives the post-publish transition: a fullcard success
  // overlay appears, the stepper is dimmed/locked, and after ~1.2s we reset
  // the form and navigate. This guarantees the user sees a clear confirmation
  // before the UI snaps back to step 1 (which would otherwise look like the
  // submit "did nothing").
  const [publishSuccess, setPublishSuccess] = useState(false);
  const [priceEstimate, setPriceEstimate] = useState<PriceEstimate | null>(null);
  const estimateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const estimateCtrlRef = useRef<AbortController | null>(null);
  const { addToast } = useToast();
  const stepWrapperRef = useRef<HTMLDivElement>(null);

  // Hook 1 : Gestion des médias
  const { 
    mediaList, 
    setMediaList, 
    handleImageChange, 
    handleRemoveImage, 
    handleRetryUpload 
  } = useMediaUpload();

  const { register, handleSubmit, setValue, watch, trigger, reset, clearErrors, control, formState: { errors } } = useForm<ListingFormData>({
    resolver: zodResolver(listingSchema),
    defaultValues: {
      category: undefined as any, brand: '', model: '', year: '', mileage: '', cc: '', condition: '', equipment: [], price: '', city: '', governorate: '', phone: '', description: '', images: [], accessoryType: '', helmetType: '', visorType: [],
      address: '', latitude: undefined as any, longitude: undefined as any,
    }
  });

  const allValues = watch();

  const {
    category, brand, model, price, city, year, mileage, cc, condition,
    equipment: selectedEquipment, images, accessoryType
  } = allValues;

  // Hook 2 : Brands filtered by category — and, when the user is depositing
  // an accessory (Casque, Gant, …), further narrowed to the brands the admin
  // has tagged with that accessory type via the Reference tab.
  const brandFilterCategory = category === 'Accessoires' ? undefined : (category || undefined);
  const { data: brandsForCategory = [] } = useBrands(brandFilterCategory, accessoryType || undefined);
  const brandNames = brandsForCategory.map((b) => b.name);

  // Hook 3 : Gestion du brouillon (localStorage)
  const { clearDraft } = useAdDraft(
    step, 
    setStep, 
    allValues, 
    mediaList, 
    setMediaList, 
    reset
  );

  // Gestion du focus lors du changement d'étape (Accessibilité)
  useEffect(() => {
    if (stepWrapperRef.current) {
      stepWrapperRef.current.focus();
      if (window.innerWidth < 768) {
        stepWrapperRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [step]);

  // Synchronisation de mediaList vers le champ 'images' de react-hook-form
  useEffect(() => {
    const successfulUrls = mediaList
      .filter(m => m.status === 'success')
      .map(m => m.url);
    setValue('images', successfulUrls);
  }, [mediaList, setValue]);

  // Reset brand/model quand la catégorie change
  useEffect(() => {
    const subscription = watch((value, { name }) => {
      if (name === 'category') {
        setValue('brand', '');
        setValue('model', '');
        setValue('accessoryType', '');
      }
      if (name === 'brand') {
        setValue('model', '');
      }
      if (name === 'accessoryType') {
        setValue('helmetType', '');
        setValue('visorType', []);
        setValue('size', '');
        setValue('gender', '');
        setValue('shoeSize', '');
        setValue('antiTheftType', '');
        setValue('intercomFeatures', []);
      }
    });
    return () => subscription.unsubscribe();
  }, [watch, setValue]);

  useEffect(() => {
    if (category === 'Accessoires' || !brand) {
      setPriceEstimate(null);
      return;
    }
    if (estimateTimerRef.current) clearTimeout(estimateTimerRef.current);
    if (estimateCtrlRef.current) estimateCtrlRef.current.abort();

    estimateTimerRef.current = setTimeout(async () => {
      const ctrl = new AbortController();
      estimateCtrlRef.current = ctrl;
      try {
        const result = await listingsApi.estimatePrice(
          {
            brand,
            model: model || undefined,
            year: year ? parseInt(year) : undefined,
            condition: condition || undefined,
          },
          ctrl.signal,
        );
        setPriceEstimate(result);
      } catch {
        setPriceEstimate(null);
      }
    }, 800);

    return () => {
      if (estimateTimerRef.current) clearTimeout(estimateTimerRef.current);
      if (estimateCtrlRef.current) estimateCtrlRef.current.abort();
    };
  }, [category, brand, model, year, condition]);

  // ---- Per-step required fields ----------------------------------------------
  // Single source of truth for which fields belong to which step. Used by both
  // the per-step "Suivant" button AND the final "Publier" button so we never
  // surface an error from a step the user hasn't filled out yet.
  const fieldLabels: Record<string, string> = {
    category: 'Catégorie',
    brand: 'Marque',
    model: 'Modèle',
    condition: 'État',
    year: 'Année',
    mileage: 'Kilométrage',
    cc: 'Cylindrée',
    accessoryType: "Type d'accessoire",
    helmetType: 'Type de casque',
    visorType: 'Type de visière',
    size: 'Taille',
    gender: 'Genre',
    shoeSize: 'Pointure',
    antiTheftType: "Type d'antivol",
    intercomFeatures: 'Options Intercom',
    images: 'Photos',
    price: 'Prix',
    city: 'Ville',
    governorate: 'Gouvernorat',
    phone: 'Téléphone',
    latitude: 'Position sur la carte',
    longitude: 'Position sur la carte',
    address: 'Adresse',
  };

  const stepLabels = (isAccessory: boolean): Record<number, string> => ({
    1: 'Catégorie',
    2: isAccessory ? 'Spécifications accessoire' : 'Spécifications techniques',
    3: isAccessory ? 'Photos' : 'Équipements',
    4: isAccessory ? 'Publication' : 'Photos',
    5: isAccessory ? 'Localisation' : 'Publication',
    6: 'Localisation',
  });

  /**
   * Returns the list of required fields for a given step + whether the user
   * is depositing an accessory. Mirrors the logic that used to live inline
   * in `handleNext`. Returning an empty array means "no required fields"
   * (e.g. step 3 for non-accessories: optional equipment).
   */
  const getStepFields = (targetStep: number, isAccessory: boolean): string[] => {
    if (targetStep === 1) return ['category'];

    if (targetStep === 2) {
      if (isAccessory) {
        const f: string[] = ['brand', 'model', 'condition', 'accessoryType'];
        if (allValues.accessoryType === 'Casque') f.push('helmetType', 'visorType');
        if (['Gant', 'Veste', 'Pantalons'].includes(allValues.accessoryType || '')) f.push('size');
        if (['Veste', 'Pantalons', 'Chaussures'].includes(allValues.accessoryType || '')) f.push('gender');
        if (allValues.accessoryType === 'Chaussures') f.push('shoeSize');
        if (allValues.accessoryType === 'Antivol') f.push('antiTheftType');
        if (allValues.accessoryType === 'Intercom') f.push('intercomFeatures');
        return f;
      }
      return ['brand', 'model', 'condition', 'year', 'mileage', 'cc'];
    }

    // Step 3 — equipment for non-accessories is optional, photos for accessories
    if (targetStep === 3) return isAccessory ? ['images'] : [];

    // Step 4 — photos for non-accessories, publish for accessories
    if (targetStep === 4) return isAccessory ? ['price', 'governorate', 'city', 'phone', 'description'] : ['images'];

    // Step 5 — location for accessories (optional), publish for non-accessories
    if (targetStep === 5) return isAccessory ? [] : ['price', 'governorate', 'city', 'phone', 'description'];

    // Step 6 — location for non-accessories (optional, address only)
    if (targetStep === 6) return [];

    return [];
  };

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
          const rect = target.getBoundingClientRect();
          const isMobile = window.innerWidth < 768;
          const offset = isMobile ? 120 : 80;
          const top = window.scrollY + rect.top - offset;
          window.scrollTo({ top: Math.max(top, 0), behavior: 'smooth' });
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
    const isPhotosStep =
      (step === 3 && isAccessory) || (step === 4 && !isAccessory);
    if (isPhotosStep && valid) {
      const isUploading = mediaList.some((m) => m.status === 'uploading');
      if (isUploading) {
        addToast('Veuillez attendre la fin du téléchargement des photos.', 'warning');
        return;
      }
    }

    if (valid) {
      setStep((prev) => prev + 1);
      return;
    }

    const labels = (missing.length > 0 ? missing : fields).map((f) => fieldLabels[f] || f);
    addToast(
      labels.length > 0
        ? `Champs requis manquants : ${labels.join(', ')}`
        : 'Veuillez remplir tous les champs obligatoires avant de continuer.',
      'error',
      6000,
    );
    scrollToFirstError();
  };

  const handleBack = () => setStep(prev => prev - 1);

  const handleCategorySelect = useCallback(async (id: string) => {
    setValue('category', id as any);
    // On déclenche la validation de la catégorie et on passe à la suite si OK
    const isValid = await trigger('category');
    if (isValid) {
      setStep(2);
    }
  }, [setValue, trigger]);

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
      // Utilisation du service centralisé au lieu d'une simulation locale
      await listingService.publishListing(data);

      // CAS SUCCÈS — affiche l'overlay de confirmation puis renvoie l'utilisateur
      // sur la landing page. On ne ré-initialise PAS le formulaire ici : le
      // composant est démonté par la navigation, donc remettre setStep(1) /
      // reset() avant `onNavigate` faisait apparaître brièvement l'étape 1 à
      // l'écran avant le changement de route. On se contente de nettoyer le
      // brouillon persistant pour éviter qu'il ne réapparaisse au prochain
      // dépôt.
      setIsSubmitting(false);
      setPublishSuccess(true);
      addToast("Annonce publiée avec succès !", "success");
      clearDraft();

      window.setTimeout(() => {
        onNavigate?.('home');
      }, 1200);
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
    const isAccessory = allValues.category === 'Accessoires';
    const lastStep = isAccessory ? 5 : 6;
    const labels = stepLabels(isAccessory);

    for (let s = 1; s <= lastStep; s++) {
      const { valid, missing, fields } = await validateStep(s, isAccessory);
      if (!valid) {
        const offending = (missing.length > 0 ? missing : fields)
          .map((f) => fieldLabels[f] || f);
        addToast(
          `Étape ${s} (${labels[s]}) — champs manquants : ${offending.join(', ')}`,
          'error',
          6500,
        );
        if (s !== step) setStep(s);
        // Wait a tick so the new step is mounted before scrolling.
        setTimeout(scrollToFirstError, 50);
        return;
      }
    }

    // All steps valid — block on still-uploading photos as a final safety net.
    if (mediaList.some((m) => m.status === 'uploading')) {
      addToast('Veuillez attendre la fin du téléchargement des photos.', 'warning');
      return;
    }

    // Hand off to RHF so we get the sanitized/transformed payload.
    handleSubmit(onSubmit)();
  };

  return (
    <div className="bg-neutral-50 min-h-screen">
      <SEO title="Déposer une annonce" description="Publiez gratuitement votre annonce moto ou scooter sur MotoScoot.tn." noIndex url="/deposer-une-annonce" />
      <div className={S.Container}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-8 space-y-6">
            <div className={`${S.MainCard} relative`}>
              <StepProgress
                step={step}
                totalSteps={category === 'Accessoires' ? 5 : 6}
                disabled={publishSuccess}
              />
              <form
                onSubmit={(e) => { e.preventDefault(); handlePublish(); }}
                className={`transition-opacity duration-300 ${publishSuccess ? 'opacity-30 pointer-events-none' : ''}`}
                aria-busy={publishSuccess || undefined}
              >
                <div
                  className={S.StepWrapper}
                  ref={stepWrapperRef}
                  tabIndex={-1}
                  aria-live="polite"
                  role="region"
                  aria-label={`Dépôt d'annonce - Étape ${step} sur ${category === 'Accessoires' ? 5 : 6}`}
                >
                  {step === 1 && (
                    <StepCategory 
                      category={category} 
                      onSelect={handleCategorySelect} 
                      hasError={!!errors.category} 
                    />
                  )}
                  {step === 2 && (
                    <StepTechnical 
                      register={register} 
                      errors={errors} 
                      control={control}
                      setValue={setValue}
                      clearErrors={clearErrors}
                      category={category} 
                      brands={brandNames}
                    />
                  )}
                  {step === 3 && category !== 'Accessoires' && (
                    <StepEquipment 
                      selectedEquipment={selectedEquipment} 
                      onToggle={toggleEquipment} 
                    />
                  )}
                  {((step === 3 && category === 'Accessoires') || (step === 4 && category !== 'Accessoires')) && (
                    <StepMedia 
                      mediaList={mediaList} 
                      onImageChange={handleImageChange} 
                      onRemoveImage={handleRemoveImage} 
                      onRetryUpload={handleRetryUpload}
                      errors={errors} 
                    />
                  )}
                  {((step === 4 && category === 'Accessoires') || (step === 5 && category !== 'Accessoires')) && (
                    <StepPublish 
                      register={register} 
                      errors={errors} 
                      control={control}
                      setValue={setValue}
                    />
                  )}
                  {((step === 5 && category === 'Accessoires') || (step === 6 && category !== 'Accessoires')) && (
                    <StepLocation
                      register={register}
                      errors={errors}
                      control={control}
                      setValue={setValue}
                    />
                  )}
                </div>
                <div className={S.ActionNav}>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    onClick={handleBack} 
                    disabled={step === 1} 
                    leftIcon={<ChevronLeft size={20}/>}
                    className="flex-1 md:flex-initial md:bg-card md:border md:border-neutral-200 md:hover:bg-neutral-50 font-bold"
                  >
                    Retour
                  </Button>
                  {step < (category === 'Accessoires' ? 5 : 6) ? (
                    <Button 
                      type="button" 
                      variant="primary" 
                      onClick={handleNext} 
                      rightIcon={<ChevronRight size={20}/>}
                      className="flex-[2] md:flex-initial shadow-primary/20"
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
                      className="flex-[2] md:flex-initial shadow-primary/20"
                    >
                      Publier
                    </Button>
                  )}
                </div>
              </form>

              {/* Post-publish transition overlay — sits on top of the dimmed
                  form/stepper until we reset and navigate. role="status" so
                  screen readers announce the success state. */}
              {publishSuccess && (
                <div
                  className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-card/85 backdrop-blur-sm rounded-2xl md:rounded-[2.5rem] animate-fade-in"
                  role="status"
                  aria-live="assertive"
                >
                  <div className="w-16 h-16 rounded-full bg-success-50 flex items-center justify-center shadow-sm">
                    <CheckCircle2 size={36} className="text-success-600" strokeWidth={2.5} />
                  </div>
                  <div className="text-center px-6">
                    <p className="text-[18px] font-extrabold text-gray-900 tracking-tight">
                      Annonce publiée !
                    </p>
                    <p className="text-[13px] font-semibold text-gray-500 mt-1">
                      Redirection en cours…
                    </p>
                  </div>
                </div>
              )}
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
  );
};

export default DepositAd;
