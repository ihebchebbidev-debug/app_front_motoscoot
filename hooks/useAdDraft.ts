import { useEffect, useRef } from 'react';
import { useToast } from '../context/ToastContext';
import { useUser } from '../context/UserContext';

const STORAGE_PREFIX = 'motoscoot_deposit_draft';
const LEGACY_KEY = 'motoscoot_deposit_draft';

/**
 * Builds a per-user storage key so two different accounts (or anonymous + then
 * logged in) on the same device can't see each other's draft. Anonymous users
 * still get their own key so a draft they started before logging in survives.
 */
const getStorageKey = (userId?: string | number | null) =>
  `${STORAGE_PREFIX}__${userId ?? 'anon'}`;

export const useAdDraft = (
  step: number,
  setStep: (s: number) => void,
  allValues: any,
  mediaList: any[],
  setMediaList: (m: any[]) => void,
  resetForm: (values: any) => void
) => {
  const { addToast } = useToast();
  const { user } = useUser();
  const isFirstRender = useRef(true);
  const storageKey = getStorageKey(user?.id);

  // Charger le brouillon au montage (et quand l'utilisateur change)
  useEffect(() => {
    // One-time migration: if a legacy unscoped draft exists and the new
    // per-user key is empty, move it over so we don't lose in-flight drafts.
    try {
      if (
        storageKey !== LEGACY_KEY &&
        !localStorage.getItem(storageKey) &&
        localStorage.getItem(LEGACY_KEY)
      ) {
        const legacy = localStorage.getItem(LEGACY_KEY);
        if (legacy) localStorage.setItem(storageKey, legacy);
        localStorage.removeItem(LEGACY_KEY);
      }
    } catch {}

    const savedDraft = localStorage.getItem(storageKey);
    if (savedDraft) {
      try {
        const { step: savedStep, values: savedValues, mediaList: savedMedia } = JSON.parse(savedDraft);
        // The caller (DepositAd) already seeded `step` from the URL `?step=`
        // search param. If the URL explicitly asked for a step (i.e. step > 1)
        // we keep it — the URL is a more explicit user intent than the draft.
        // Otherwise fall back to whatever step the draft was saved at so a
        // returning user resumes where they left off.
        if (step <= 1) {
          setStep(savedStep || 1);
        }
        resetForm(savedValues);

        // Drop any blob: previews (no longer valid after refresh) AND any
        // entries that were stuck in upload-or-error: without the original
        // File reference (it can't be serialized) we can't retry them, so
        // showing a permanent red "retry" card would be a dead-end UX.
        const cleanMedia = (savedMedia || []).filter((m: any) => {
          if (!m?.url || m.url.startsWith('blob:')) return false;
          if (m.status !== 'success') return false;
          return true;
        });
        setMediaList(cleanMedia);

        if (savedStep > 1) {
          addToast("Brouillon restauré. Continuez là où vous en étiez !", "info");
        }
      } catch (e) {
        console.error("Erreur de restauration du brouillon", e);
      }
    }
    isFirstRender.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Suppress the next N autosave passes after a clearDraft(). Without this,
  // the reset() + setStep(1) that follow a successful publish would each
  // re-trigger this effect and write a fresh empty draft to localStorage —
  // re-creating the very key we just removed and risking a stale step:5
  // snapshot if the autosave fires before the reset has settled.
  const suppressSavesRef = useRef(0);

  // Sauvegarde automatique du brouillon à chaque changement
  useEffect(() => {
    if (isFirstRender.current) return;
    if (suppressSavesRef.current > 0) {
      suppressSavesRef.current -= 1;
      return;
    }

    const draft = {
      step,
      values: allValues,
      // Strip the non-serializable File reference and downgrade in-flight
      // uploads so a refresh never resurrects a stuck "uploading" state.
      mediaList: mediaList.map(({ file, ...m }: any) => ({
        ...m,
        status: m.status === 'uploading' ? 'error' : m.status,
      })),
    };
    try {
      localStorage.setItem(storageKey, JSON.stringify(draft));
    } catch {
      // quota exceeded — silently ignore, the form keeps working in memory
    }
  }, [allValues, step, mediaList, storageKey]);

  const clearDraft = () => {
    try {
      localStorage.removeItem(storageKey);
    } catch {}
    // Skip the autosave passes triggered by the reset() / setStep(1) /
    // setMediaList([]) calls that the caller fires right after clearDraft.
    // 3 covers the three independent state writes; extras are harmless.
    suppressSavesRef.current = 3;
  };

  return { clearDraft };
};
