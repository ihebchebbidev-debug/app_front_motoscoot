import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from '../context/ToastContext';
import { useUser } from '../context/UserContext';
import { listingSchema, type ListingFormData } from '../types/listing';
import { emptyDepositValues } from '../utils/depositValues';
import { strayDepositFields, type DepositValues } from '../utils/depositRules';
import { createDepositSession, draftKey, type DraftStorage } from '../utils/depositSession';
import { useMediaUpload } from './useMediaUpload';
import { useMarketPrice } from './useMarketPrice';

/** localStorage, or nothing when the browser refuses it (private mode, blocked site data). */
const browserStorage: DraftStorage = {
  getItem: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  setItem: (k, v) => { try { localStorage.setItem(k, v); } catch { /* quota, blocked */ } },
  removeItem: (k) => { try { localStorage.removeItem(k); } catch { /* blocked */ } },
};

/**
 * Everything one listing in progress needs, wired together: the form (with
 * its field relationships), the photos, the market price and the draft
 * (utils/depositSession.ts). The page only shows steps and calls:
 *   startNew()       — « Réinitialiser », « Déposer une autre annonce »
 *   markPublished()  — the listing is sent
 * `run` changes on every fresh start: key the step with it so pickers and
 * fields drop their own state.
 */
export function useDepositSession({ step, setStep }: { step: number; setStep: (s: number) => void }) {
  const { addToast } = useToast();
  const { user } = useUser();
  const key = draftKey(user?.id);

  const media = useMediaUpload();
  const form = useForm<ListingFormData>({
    resolver: zodResolver(listingSchema),
    // The one empty form (utils/depositValues.ts): also what a new deposit goes back to.
    defaultValues: emptyDepositValues(),
  });
  const { watch, setValue, trigger, getFieldState, reset } = form;
  const values = watch();
  const market = useMarketPrice(values);

  const session = useMemo(
    () => createDepositSession({
      storage: browserStorage,
      key,
      form: { reset: reset as any },
      setStep,
      setMedia: media.setMediaList as any,
      clearMedia: media.clearMedia,
    }),
    // One session per account; the ports are stable functions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );

  // On arrival (and when the account changes): the saved draft comes back.
  const restored = useRef(false);
  useEffect(() => {
    restored.current = false;
    const draftStep = session.restore(step);
    if (draftStep && draftStep > 1) addToast('Brouillon restauré. Continuez là où vous en étiez !', 'info');
    restored.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // Every change is kept (the session ignores it once published).
  useEffect(() => {
    if (!restored.current) return;
    session.save(step, values as Record<string, unknown>, media.mediaList as any);
  }, [session, step, values, media.mediaList]);

  // The uploaded photos are the form's « images ».
  useEffect(() => {
    setValue('images', media.mediaList.filter((m) => m.status === 'success').map((m) => m.url));
  }, [media.mediaList, setValue]);

  // A field with an error is checked again as soon as it changes, so a fixed
  // field loses its message at once (react-hook-form only does it after a submit).
  useEffect(() => {
    const subscription = watch((_value, { name }) => {
      const field = name?.split('.')[0];
      if (field && getFieldState(field as any).error) void trigger(field as any);
    });
    return () => subscription.unsubscribe();
  }, [watch, trigger, getFieldState]);

  // What depends on what: a new category needs a new brand and model; a new
  // brand, a new model. And a field that no longer belongs to the listing is
  // emptied (utils/depositRules.ts): the year, km and cylinder size of a moto
  // turned into a helmet. A field that still belongs stays.
  useEffect(() => {
    const subscription = watch((value, { name }) => {
      if (name === 'category') {
        setValue('brand', '');
        setValue('model', '');
        setValue('accessoryType', '');
      }
      if (name === 'brand') setValue('model', '');
      if (name === 'category' || name === 'accessoryType') {
        for (const field of strayDepositFields(value as DepositValues)) {
          setValue(field as keyof ListingFormData, (Array.isArray((value as any)[field]) ? [] : '') as never);
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [watch, setValue]);

  const [run, setRun] = useState(0);

  /** A blank deposit: empty form, no photo, no market price, step 1, no draft. */
  const startNew = useCallback(() => {
    session.startNew();
    market.clear();
    setRun((n) => n + 1);
  }, [session, market]);

  /** The listing is sent: no draft any more, nothing saved until startNew. */
  const markPublished = useCallback(() => session.published(), [session]);

  return { form, values, media, priceEstimate: market.estimate, run, startNew, markPublished };
}
