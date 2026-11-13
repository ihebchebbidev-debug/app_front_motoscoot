import React from 'react';

/**
 * Pieces shared by the deposit's catalogue pickers (« Marque », « Modèle »),
 * so both lists look and behave the same.
 */

// Controls, not content: pressed at once (no double-tap wait), no text
// selection or iOS callout on a long press.
export const TAP = 'touch-manipulation select-none [-webkit-touch-callout:none]';
export const ROW = `${TAP} w-full min-h-[44px] flex items-center gap-3 text-left px-4 py-2 text-[15px] font-medium transition-colors active:bg-gray-100`;
export const ROW_ON = 'bg-primary-50 text-primary-700 font-semibold';
export const ROW_OFF = 'text-gray-900 hover:bg-gray-50';
/** The link under a typed-by-hand field that goes back to the list. */
export const BACK_TO_LIST = 'ml-1 min-h-[44px] text-[14px] font-semibold text-primary-700 underline underline-offset-4 decoration-primary-300 hover:decoration-primary-700';

/** The typed letters in bold when they appear as written in the name. */
export const Highlight: React.FC<{ name: string; query: string }> = ({ name, query }) => {
  const q = query.trim();
  const i = q ? name.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (i < 0) return <>{name}</>;
  return <>{name.slice(0, i)}<strong className="font-extrabold">{name.slice(i, i + q.length)}</strong>{name.slice(i + q.length)}</>;
};

/** Close a menu on a click outside its field and the sheet (the sheet has its own scrim). */
export function useCloseOutside(open: boolean, wrapRef: React.RefObject<HTMLElement | null>, close: () => void) {
  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: Event) => {
      const t = e.target as Element;
      if (t.closest?.('[data-searchbar-sheet]') || wrapRef.current?.contains(t)) return;
      close();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown, { passive: true });
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
}
