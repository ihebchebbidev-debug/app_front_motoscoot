import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * Choice list of the home search bar.
 *
 * Phones: an iPhone-style sheet. It rises from the bottom edge and goes back
 * down there; a grabber and the title row can be dragged down to close it,
 * 1:1 with the finger (dragging up resists), and a flick closes it even when
 * short. Released early, it springs back.
 * From 768 px, with an anchor: a menu attached under the field it came
 * from (above it when there is more room there), no scrim, the page stays
 * usable; it opens from the field and closes on Escape or a click outside.
 * Reduced motion: a short fade, no movement.
 * Phones: the page behind does not scroll, iPhone included (body fixed).
 */

const EXIT_MS = 220;
const CLOSE_RATIO = 0.25; // of the sheet height
const CLOSE_VELOCITY = 0.5; // px per ms, downwards

/** Past the top the sheet follows less and less (rubber band). */
export const rubberband = (overshoot: number, dimension: number, c = 0.55) =>
  (overshoot * dimension * c) / (dimension + c * Math.abs(overshoot));

/** Whether a released drag closes the sheet (distance or flick). */
export const shouldCloseSheet = (dy: number, height: number, velocity: number) =>
  dy > height * CLOSE_RATIO || velocity > CLOSE_VELOCITY;

const MENU_GAP = 6; // px between the field and its menu
const MENU_EDGE = 16; // px kept clear of the window edges
const MENU_MIN_W = 240;
const MENU_MAX_H = 360;

export interface MenuPlacement { side: 'bottom' | 'top'; top?: number; bottom?: number; left: number; width: number; maxHeight: number }

/** Where the menu goes for a field box (viewport coordinates). */
export function placeMenu(
  field: { top: number; bottom: number; left: number; width: number },
  viewport: { width: number; height: number },
): MenuPlacement {
  const below = viewport.height - field.bottom - MENU_GAP - MENU_EDGE;
  const above = field.top - MENU_GAP - MENU_EDGE;
  // Below by default; above only when below is cramped and above has more room.
  const side = below < 240 && above > below ? 'top' : 'bottom';
  const width = Math.min(Math.max(field.width, MENU_MIN_W), viewport.width - 2 * MENU_EDGE);
  const left = Math.max(MENU_EDGE, Math.min(field.left, viewport.width - MENU_EDGE - width));
  const maxHeight = Math.max(120, Math.min(MENU_MAX_H, side === 'bottom' ? below : above));
  return side === 'bottom'
    ? { side, top: field.bottom + MENU_GAP, left, width, maxHeight }
    : { side, bottom: viewport.height - field.top + MENU_GAP, left, width, maxHeight };
}

const isPhone = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;
const finePointer = () => typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches;

/** Body scroll lock that also holds on iPhone Safari (overflow alone does not). */
function lockScroll(): () => void {
  const { body } = document;
  const y = window.scrollY;
  const prev = { position: body.style.position, top: body.style.top, width: body.style.width, overflow: body.style.overflow };
  body.style.position = 'fixed';
  body.style.top = `-${y}px`;
  body.style.width = '100%';
  body.style.overflow = 'hidden';
  return () => {
    body.style.position = prev.position;
    body.style.top = prev.top;
    body.style.width = prev.width;
    body.style.overflow = prev.overflow;
    window.scrollTo(0, y);
  };
}

interface ChoiceSheetProps {
  open: boolean;
  label: string;
  onClose: () => void;
  /** Optional search field (brand, model). */
  search?: { value: string; placeholder: string; onChange: (v: string) => void; /** Enter in the field (e.g. pick the first match). */ onEnter?: () => void };
  /** The field box: from 768 px the list opens as a menu under it. */
  anchor?: React.RefObject<HTMLElement | null>;
  /** false: the body holds a form (filters), not a list of options. */
  listbox?: boolean;
  /** Next to the close button (e.g. « Réinitialiser »). */
  headerAction?: React.ReactNode;
  /** Pinned under the scrolling body (e.g. « Voir 9 modèles »). */
  footer?: React.ReactNode;
  /** Phones: a fixed 85 % height, so the sheet does not shrink while the
   *  search filters and the results stay under the field, above the keyboard. */
  tall?: boolean;
  /** Where focus goes back on close (a tap does not focus a button on iPhone,
   *  so the opener cannot always be read from document.activeElement). */
  returnFocus?: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
}

export const ChoiceSheet: React.FC<ChoiceSheetProps> = ({ open, label, onClose, search, anchor, listbox = true, headerAction, footer, children, tall = false, returnFocus }) => {
  // Stay mounted while the exit animation plays.
  const [mounted, setMounted] = useState(open);
  const [state, setState] = useState<'open' | 'closed'>(open ? 'open' : 'closed');
  const panelRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startY: number; dy: number; samples: { y: number; t: number }[]; id: number } | null>(null);
  const draggedShut = useRef(false);
  // Phone sheet or anchored menu; follows the window crossing 768 px.
  const [phone, setPhone] = useState(isPhone);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const on = () => setPhone(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  const menu = !!anchor && !phone;
  const [place, setPlace] = useState<MenuPlacement | null>(null);

  useEffect(() => {
    if (open) {
      draggedShut.current = false;
      setMounted(true);
      setState('open');
      return;
    }
    if (!mounted) return;
    setState('closed');
    const t = window.setTimeout(() => setMounted(false), draggedShut.current ? 0 : EXIT_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Latest onClose without re-running the lock: the parent passes a new
  // function on every render, and unlocking/relocking lost the page position.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!mounted) return;
    // A menu leaves the page usable; only the phone sheet holds it still.
    const unlock = menu ? () => {} : lockScroll();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      onCloseRef.current();
      // Back to the field the menu came from.
      if (menu) anchor?.current?.querySelector<HTMLElement>('button')?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); unlock(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, menu]);

  // Sheet (modal): focus goes in (the ticked option, else the panel), Tab
  // stays inside, and focus returns to the control that opened it.
  // The anchored menu keeps its own behaviour (Escape → its field).
  useEffect(() => {
    if (!mounted || menu) return;
    const opener = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const frame = requestAnimationFrame(() => {
      if (!panel || panel.contains(document.activeElement)) return; // e.g. an autofocused search field
      const target = panel.querySelector<HTMLElement>('[aria-selected="true"]') ?? panel;
      target.focus({ preventScroll: true });
    });
    const onTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !panel) return;
      const items = Array.from(
        panel.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'),
      ).filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panel || !panel.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !panel.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onTab);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onTab);
      const back = returnFocus?.current ?? (opener !== document.body ? opener : null);
      if (back && document.contains(back)) back.focus({ preventScroll: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, menu]);

  // Menu: measured before paint, and kept on its field while the page
  // scrolls or the window changes size.
  useLayoutEffect(() => {
    if (!mounted || !menu) return;
    let frame = 0;
    const measure = () => {
      const el = anchor?.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setPlace(placeMenu(r, { width: document.documentElement.clientWidth, height: window.innerHeight }));
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    measure();
    window.addEventListener('scroll', schedule, { capture: true, passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule, { capture: true });
      window.removeEventListener('resize', schedule);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, menu]);

  // Sheet follows the finger; the scrim lightens with it (as on iOS).
  const setY = (y: number, transition = '') => {
    const el = panelRef.current;
    if (!el) return;
    el.style.transition = transition;
    el.style.transform = y ? `translateY(${y}px)` : '';
    const scrim = scrimRef.current;
    if (scrim) {
      scrim.style.transition = transition.replace('transform', 'opacity');
      scrim.style.opacity = y > 0 ? String(Math.max(0, 1 - y / el.offsetHeight)) : '';
    }
  };

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (!isPhone() || (e.target as Element).closest('button, input')) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { startY: e.clientY, dy: 0, samples: [{ y: e.clientY, t: e.timeStamp }], id: e.pointerId };
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const raw = e.clientY - d.startY;
    const height = panelRef.current?.offsetHeight || 1;
    d.dy = raw >= 0 ? raw : -rubberband(-raw, height);
    d.samples.push({ y: e.clientY, t: e.timeStamp });
    if (d.samples.length > 5) d.samples.shift();
    setY(d.dy);
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    // Speed over the last 100 ms only: how the finger left, not how it started.
    const last = d.samples[d.samples.length - 1];
    const first = d.samples.find((s) => last.t - s.t <= 100) ?? last;
    const velocity = last.t > first.t ? (last.y - first.y) / (last.t - first.t) : 0;
    const height = panelRef.current?.offsetHeight || 1;
    if (d.dy > 0 && shouldCloseSheet(d.dy, height, velocity)) {
      // Finish the throw from where the finger left it, then close.
      draggedShut.current = true;
      setY(height + 24, `transform ${EXIT_MS}ms cubic-bezier(0.32, 0.72, 0, 1)`);
      window.setTimeout(() => onCloseRef.current(), EXIT_MS);
    } else {
      setY(0, 'transform 260ms cubic-bezier(0.32, 0.72, 0, 1)');
    }
  }, []);

  if (!mounted) return null;

  if (menu) {
    if (!place) return null;
    return createPortal(
      <div
        data-searchbar-sheet=""
        data-state={state}
        data-side={place.side}
        role="dialog"
        aria-label={label}
        className="ms-menu fixed z-[1000] bg-card rounded-xl shadow-xl ring-1 ring-black/[0.08] flex flex-col overflow-hidden"
        style={{ top: place.top, bottom: place.bottom, left: place.left, width: place.width, maxHeight: place.maxHeight }}
      >
        {search && (
          <div className="p-2 border-b border-gray-100">
            <input
              type="text"
              aria-label={search.placeholder}
              placeholder={search.placeholder}
              value={search.value}
              // Mouse: type at once. Touch tablets: no keyboard over the list.
              autoFocus={finePointer()}
              autoComplete="off"
              // Brand and model names: no capital, no autocorrect (« ktm » must not become « kit »).
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint={search.onEnter ? 'go' : undefined}
              onChange={(e) => search.onChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && search.onEnter) { e.preventDefault(); search.onEnter(); } }}
              className="w-full h-10 px-3 rounded-lg border border-gray-300 text-[16px] md:text-[14.5px] text-gray-900 placeholder:text-gray-500 outline-none focus:border-primary-600 focus:ring-1 focus:ring-primary-600"
            />
          </div>
        )}
        <div role="listbox" aria-label={label} className="flex-1 min-h-0 overflow-y-auto overscroll-contain py-1.5">
          {children}
        </div>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div
      ref={scrimRef}
      data-searchbar-sheet=""
      data-state={state}
      className="ms-scrim fixed inset-0 z-[1000] flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        data-state={draggedShut.current ? 'dragged' : state}
        // dvh: the visible height with the browser bars (85vh overflowed under the
        // URL bar). Bottom padding keeps the last row clear of the home indicator.
        className={`ms-sheet outline-none bg-card w-full md:max-w-md md:rounded-2xl rounded-t-2xl max-h-[85dvh] ${tall ? 'h-[85dvh] md:h-auto' : ''} pb-[env(safe-area-inset-bottom,0px)] flex flex-col shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Grabber + title: the part a finger drags down to close (phones). */}
        <div
          className="touch-none md:touch-auto select-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="md:hidden flex justify-center pt-2.5 pb-1" aria-hidden="true">
            <span className="h-1.5 w-10 rounded-full bg-gray-300" />
          </div>
          <div className="flex items-center justify-between px-5 pt-2 pb-4 md:pt-4 border-b border-gray-100">
            <h3 className="text-base font-bold text-gray-900">{label}</h3>
            <div className="flex items-center gap-1 -my-2.5 -mr-2.5">
              {headerAction}
              <button
                type="button"
                onClick={onClose}
                aria-label="Fermer"
                className="w-11 h-11 flex items-center justify-center rounded-full text-gray-500 hover:text-gray-900 hover:bg-gray-100 active:bg-gray-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>
        </div>
        {search && (
          <div className="px-5 pt-3 pb-2 border-b border-gray-100">
            <input
              type="text"
              aria-label={search.placeholder}
              placeholder={search.placeholder}
              value={search.value}
              // Phones: no keyboard over half the list until the field is touched.
              autoFocus={finePointer()}
              autoComplete="off"
              // Brand and model names: no capital, no autocorrect (« ktm » must not become « kit »).
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint={search.onEnter ? 'go' : undefined}
              onChange={(e) => search.onChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && search.onEnter) { e.preventDefault(); search.onEnter(); } }}
              className="w-full h-11 px-3 rounded-lg border border-gray-300 text-[16px] text-gray-900 placeholder:text-gray-500 outline-none focus:border-primary-600 focus:ring-1 focus:ring-primary-600"
            />
          </div>
        )}
        <div role={listbox ? 'listbox' : undefined} aria-label={listbox ? label : undefined} className="flex-1 overflow-y-auto overscroll-contain py-2">
          {children}
        </div>
        {footer}
      </div>
    </div>,
    document.body,
  );
};

export default ChoiceSheet;
