/**
 * The deposit session: the life of one listing being written.
 *
 *   restore  — on arrival, the saved draft comes back (cleaned, on top of the empty form)
 *   save     — every change is kept, unless the session is closed
 *   startNew — « Réinitialiser » / « Déposer une autre annonce »: empty form, no photo, no draft
 *   published — the listing is sent: the draft is gone and nothing is saved any more
 *
 * No React here: the session talks to the browser storage and to the form
 * through two small ports, so its rules are tested with fakes
 * (utils/depositSession.test.ts) and wired to react-hook-form and
 * localStorage by hooks/useDepositSession.ts.
 *
 * Two rules learnt the hard way:
 * - react-hook-form makes the values given to reset(values) its new defaults:
 *   the restore passes keepDefaultValues, and startNew passes the empty form
 *   (a bare reset() brought a restored draft back, 2026-11-13);
 * - after a publish, saving stays off until a new deposit starts (the success
 *   screen's re-renders saved the published listing again, 2026-11-12).
 */
import { draftOverEmpty, emptyDepositValues } from './depositValues';
import { keepDepositFields } from './depositRules';

/** The browser storage, or an in-memory fake in tests. */
export interface DraftStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** The form, as the session needs it (react-hook-form's reset). */
export interface SessionForm {
  reset(values: Record<string, unknown>, options?: { keepDefaultValues?: boolean }): void;
}

export interface DraftMedia {
  id: string;
  url: string;
  status: string;
  file?: unknown;
  [key: string]: unknown;
}

export interface SessionPorts {
  storage: DraftStorage;
  /** One draft per account on a device (« anon » before login). */
  key: string;
  form: SessionForm;
  setStep(step: number): void;
  setMedia(media: DraftMedia[]): void;
  /** Empties the photos and frees their local previews. */
  clearMedia(): void;
}

const LEGACY_KEY = 'motoscoot_deposit_draft';

export const draftKey = (userId?: string | number | null): string => `${LEGACY_KEY}__${userId ?? 'anon'}`;

/** Photos worth keeping in a draft: uploaded ones (a blob: preview or a File cannot survive a reload). */
export const restorableMedia = (media: unknown): DraftMedia[] =>
  (Array.isArray(media) ? media : []).filter(
    (m: any) => m?.url && !String(m.url).startsWith('blob:') && m.status === 'success',
  );

/** Photos as saved: no File, and an upload in flight saved as failed (never a stuck spinner). */
export const savableMedia = (media: DraftMedia[]): DraftMedia[] =>
  media.map(({ file: _file, ...m }) => ({ ...m, status: m.status === 'uploading' ? 'error' : m.status }));

const safe = <T>(fn: () => T, fallback: T): T => {
  try { return fn(); } catch { return fallback; }
};

export function createDepositSession(ports: SessionPorts) {
  const { storage, key, form } = ports;
  let closed = false;

  return {
    /**
     * Brings the saved draft back. A step asked by the URL (> 1) wins over the
     * draft's. Returns the draft's step, or null when there is no draft.
     */
    restore(urlStep: number): number | null {
      // One-time move of the old unscoped draft to this account's key.
      safe(() => {
        if (key !== LEGACY_KEY && !storage.getItem(key)) {
          const legacy = storage.getItem(LEGACY_KEY);
          if (legacy) storage.setItem(key, legacy);
          storage.removeItem(LEGACY_KEY);
        }
      }, undefined);

      const raw = safe(() => storage.getItem(key), null);
      if (!raw) return null;
      const saved = safe(() => JSON.parse(raw), null);
      if (!saved || typeof saved !== 'object') return null;

      const draftStep = Number(saved.step) || 1;
      if (urlStep <= 1) ports.setStep(draftStep);
      // On top of the empty form, without the fields of another kind of
      // listing, and keeping the empty form as the defaults.
      form.reset(keepDepositFields(draftOverEmpty(saved.values)), { keepDefaultValues: true });
      ports.setMedia(restorableMedia(saved.mediaList));
      return draftStep;
    },

    /** Keeps the listing as it is now (nothing once published, until a new deposit). */
    save(step: number, values: Record<string, unknown>, media: DraftMedia[]): void {
      if (closed) return;
      // Quota exceeded or storage blocked: the form keeps working in memory.
      safe(() => storage.setItem(key, JSON.stringify({ step, values, mediaList: savableMedia(media) })), undefined);
    },

    /** A blank deposit: empty form, no photo, step 1, no draft; saving runs again. */
    startNew(): void {
      safe(() => storage.removeItem(key), undefined);
      form.reset(emptyDepositValues());
      ports.clearMedia();
      ports.setStep(1);
      closed = false;
    },

    /** The listing is sent: its draft is removed and nothing is saved until startNew. */
    published(): void {
      closed = true;
      safe(() => storage.removeItem(key), undefined);
    },

    get saving(): boolean {
      return !closed;
    },
  };
}

export type DepositSession = ReturnType<typeof createDepositSession>;
