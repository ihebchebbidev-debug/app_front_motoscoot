import { useEffect, useRef } from 'react';

/**
 * Sentinel-based infinite scroll trigger.
 *
 * Attach the returned `sentinelRef` to a tiny element rendered AFTER the last
 * item in your list. When that element scrolls into view (or near it, via the
 * rootMargin pre-fetch buffer), `onLoadMore` fires.
 *
 * The hook is reentrancy-safe: it ignores callbacks while `isLoading` is true
 * and stops observing entirely once `hasMore` is false.
 */
export function useInfiniteScroll<T extends HTMLElement = HTMLDivElement>(opts: {
  hasMore: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
  /** Pre-fetch buffer in CSS pixels. Default: load 600px before the sentinel. */
  rootMargin?: string;
  /** Disable the observer entirely (e.g. when filters are open). */
  disabled?: boolean;
}) {
  const sentinelRef = useRef<T | null>(null);
  const { hasMore, isLoading, onLoadMore, rootMargin = '600px', disabled } = opts;

  // Keep latest callback in a ref so the observer doesn't re-create on every render.
  const onLoadMoreRef = useRef(onLoadMore);
  useEffect(() => {
    onLoadMoreRef.current = onLoadMore;
  }, [onLoadMore]);

  useEffect(() => {
    if (disabled || !hasMore) return;
    const node = sentinelRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting && !isLoading) {
          onLoadMoreRef.current();
        }
      },
      { rootMargin, threshold: 0 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, isLoading, rootMargin, disabled]);

  return { sentinelRef };
}
