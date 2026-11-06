import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * Choice list of the home search bar.
 *
 * Phones: an iPhone-style sheet. It rises from the bottom edge and goes back
 * down there; a grabber and the title row can be dragged down to close it,
 * 1:1 with the finger (dragging up resists), and a flick closes it even when
 * short. Released early, it springs back.
 * Larger screens: the centred window, unchanged.
 * Reduced motion: a short fade, no movement.
 * The page behind does not scroll, iPhone included (body fixed in place).
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
  search?: { value: string; placeholder: string; onChange: (v: string) => void };
  children: React.ReactNode;
}

export const ChoiceSheet: React.FC<ChoiceSheetProps> = ({ open, label, onClose, search, children }) => {
  // Stay mounted while the exit animation plays.
  const [mounted, setMounted] = useState(open);
  const [state, setState] = useState<'open' | 'closed'>(open ? 'open' : 'closed');
  const panelRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startY: number; dy: number; samples: { y: number; t: number }[]; id: number } | null>(null);
  const draggedShut = useRef(false);

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
    const unlock = lockScroll();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current(); };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); unlock(); };
  }, [mounted]);

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
        data-state={draggedShut.current ? 'dragged' : state}
        className="ms-sheet bg-card w-full md:max-w-md md:rounded-2xl rounded-t-2xl max-h-[85vh] flex flex-col shadow-2xl"
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
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer"
              className="p-1.5 rounded-full text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>
        {search && (
          <div className="px-5 pt-3 pb-2 border-b border-gray-100">
            <input
              type="text"
              placeholder={search.placeholder}
              value={search.value}
              // Phones: no keyboard over half the list until the field is touched.
              autoFocus={finePointer()}
              autoComplete="off"
              onChange={(e) => search.onChange(e.target.value)}
              className="w-full h-11 px-3 rounded-lg border border-gray-300 text-[16px] text-gray-900 placeholder:text-gray-500 outline-none focus:border-primary-600 focus:ring-1 focus:ring-primary-600"
            />
          </div>
        )}
        <div role="listbox" className="flex-1 overflow-y-auto overscroll-contain py-2">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default ChoiceSheet;
