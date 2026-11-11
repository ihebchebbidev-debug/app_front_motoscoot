/**
 * First paint of the prepared HTML (audit 2026-11-11, row 9: « délai de
 * rendu »). index.html paints [data-seo-fallback] at once as a layer over the
 * page: header bar, breadcrumb, title, intro and main photo, from the HTML.
 * Before this, visitors saw a white screen until the app and the API had
 * answered (6 to 8 s on a phone in PageSpeed).
 *
 * React clears #root when it mounts, so the layer is first moved next to
 * #root, then removed as soon as the page shows its own title (the real page
 * is complete underneath by then), on the first scroll or key press, or after
 * MAX_MS at most. The home page is left alone: it paints its own photo shell.
 */
export const MAX_MS = 6000;

/** The prepared layer that should stay on screen, or null (home, admin, spa.html). */
export function firstPaintLayer(root: ParentNode): HTMLElement | null {
  if (root.querySelector('[data-home-shell]')) return null;
  return root.querySelector<HTMLElement>(':scope > [data-seo-fallback]');
}

export function holdFirstPaint(root: HTMLElement, win: Window = window): void {
  const layer = firstPaintLayer(root);
  if (!layer || !root.parentNode) return;
  root.parentNode.insertBefore(layer, root);

  let done = false;
  const intents = ['wheel', 'touchmove', 'keydown'] as const;
  const release = () => {
    if (done) return;
    done = true;
    observer.disconnect();
    win.clearTimeout(timer);
    intents.forEach((t) => win.removeEventListener(t, release));
    layer.remove();
  };
  // Wait for the frame where React's title is painted, so nothing blinks white.
  const releaseAfterPaint = () => win.requestAnimationFrame(() => win.requestAnimationFrame(release));
  const observer = new MutationObserver(() => {
    if (root.querySelector('h1')) {
      observer.disconnect();
      releaseAfterPaint();
    }
  });
  observer.observe(root, { childList: true, subtree: true });
  const timer = win.setTimeout(release, MAX_MS);
  intents.forEach((t) => win.addEventListener(t, release, { passive: true }));
}
