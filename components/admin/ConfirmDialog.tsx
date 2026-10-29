import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export type ConfirmVariant = 'danger' | 'warning' | 'info';

export interface ConfirmOptions {
  title: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
}

interface ConfirmDialogProps extends ConfirmOptions {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

const VARIANT_STYLES: Record<ConfirmVariant, { iconBg: string; iconColor: string; confirmBtn: string }> = {
  danger:  { iconBg: 'bg-red-50',    iconColor: 'text-red-600',    confirmBtn: 'bg-red-600 hover:bg-red-700' },
  warning: { iconBg: 'bg-amber-50',  iconColor: 'text-amber-600',  confirmBtn: 'bg-amber-600 hover:bg-amber-700' },
  info:    { iconBg: 'bg-blue-50',   iconColor: 'text-blue-600',   confirmBtn: 'bg-blue-600 hover:bg-blue-700' },
};

/**
 * Accessible, design-system-aligned confirmation dialog.
 *
 * Replaces every native `window.confirm()` in the admin tabs so the prompts
 * match the rest of the UI (rounded card, lucide icon, primary/danger button)
 * and so they stop being browser-blocked or styled differently across OSes.
 *
 * Closes on: Escape, backdrop click, Cancel, or Confirm. Buttons are disabled
 * while `loading` is true to prevent double-submission of the underlying
 * mutation.
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  variant = 'danger',
  onConfirm,
  onCancel,
  loading,
}) => {
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  // Focus the confirm button on open + close on Escape.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => confirmBtnRef.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, loading, onCancel]);

  if (!open) return null;
  const styles = VARIANT_STYLES[variant];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      // z-[10010] → must sit above the EditListingModal (z-[10000]) which
      // opens this dialog for "discard unsaved changes" prompts. Anything
      // less and the confirm dialog disappears behind the edit modal.
      className="fixed inset-0 z-[10010] flex items-center justify-center p-4 bg-black/50 animate-fade-in"
      onClick={() => !loading && onCancel()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-card rounded-2xl shadow-xl border border-gray-200 overflow-hidden"
      >
        <div className="p-5 border-b border-gray-100 flex items-start gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${styles.iconBg} ${styles.iconColor}`}>
            <AlertTriangle size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 id="confirm-dialog-title" className="text-base font-black text-gray-900">
              {title}
            </h3>
            {message && (
              <p className="text-sm text-gray-600 mt-1 break-words">{message}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => !loading && onCancel()}
            className="p-1 -m-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Fermer"
            disabled={loading}
          >
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-bold text-gray-700 hover:bg-card disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-sm font-bold disabled:opacity-60 ${styles.confirmBtn}`}
          >
            {loading ? '…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Promise-based confirmation hook — drop-in replacement for `window.confirm()`.
 *
 * Usage:
 *   const { confirm, dialog } = useConfirm();
 *   const ok = await confirm({ title: 'Supprimer ?', variant: 'danger' });
 *   if (!ok) return;
 *   // ...mutation
 *   {dialog}  // render once at the bottom of the component
 */
export function useConfirm() {
  const [state, setState] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    setState(opts);
    return new Promise<boolean>((resolve) => { resolverRef.current = resolve; });
  }, []);

  const handle = (ok: boolean) => {
    resolverRef.current?.(ok);
    resolverRef.current = null;
    setState(null);
  };

  const dialog = state ? (
    <ConfirmDialog
      open
      {...state}
      onConfirm={() => handle(true)}
      onCancel={() => handle(false)}
    />
  ) : null;

  return { confirm, dialog };
}

export default ConfirmDialog;
