/**
 * The site header is `position: fixed` (72 px, 56 px once scrolled, plus the
 * 36 px admin bar for admins). Scrolling an element to the very top of the
 * viewport hides it under the header: use these helpers instead of
 * `scrollIntoView({ block: 'start' })`.
 */

/** Bottom edge of the fixed header in the viewport, in px (0 if none). */
export function fixedHeaderBottom(doc: Document = document): number {
  const header = doc.querySelector<HTMLElement>('header[role="banner"]');
  if (!header) return 0;
  const style = doc.defaultView?.getComputedStyle(header);
  if (style && style.position !== 'fixed' && style.position !== 'sticky') return 0;
  return Math.max(0, header.getBoundingClientRect().bottom);
}

/** Document scroll position that puts `elementTop` (viewport px) `gap` px below the header. */
export function scrollTargetBelowHeader(elementTop: number, scrollY: number, headerBottom: number, gap = 12): number {
  return Math.max(0, Math.round(scrollY + elementTop - headerBottom - gap));
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Scrolls so `el` starts just below the header, only when its top is hidden
 * under the header or above the viewport.
 */
export function revealBelowHeader(el: HTMLElement | null, gap = 12): void {
  if (!el) return;
  const headerBottom = fixedHeaderBottom();
  const top = el.getBoundingClientRect().top;
  if (top >= headerBottom) return;
  window.scrollTo({
    top: scrollTargetBelowHeader(top, window.scrollY, headerBottom, gap),
    behavior: prefersReducedMotion() ? 'auto' : 'smooth',
  });
}

/** Scrolls so `el` sits `gap` px below the header (always). */
export function scrollBelowHeader(el: HTMLElement | null, gap = 12): void {
  if (!el) return;
  window.scrollTo({
    top: scrollTargetBelowHeader(el.getBoundingClientRect().top, window.scrollY, fixedHeaderBottom(), gap),
    behavior: prefersReducedMotion() ? 'auto' : 'smooth',
  });
}
