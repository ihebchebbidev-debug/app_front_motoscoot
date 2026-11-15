import { useEffect } from 'react';
import { apiClient } from '../services/apiClient';
import { browserViewEnv, scheduleContentView } from '../utils/contentView';

/**
 * Counts one view of an actualité ('articles') or a conseil ('tips') once
 * the reader has had it on screen for a few seconds. Fire-and-forget: a
 * failure is silent and never affects the page.
 */
export function useContentView(kind: 'articles' | 'tips', slugOrId: string | undefined | null) {
  useEffect(() => {
    if (!slugOrId || typeof document === 'undefined') return;
    // Automated browsers (Lighthouse, prerender, tests) are not readers.
    if (typeof navigator !== 'undefined' && (navigator as any).webdriver) return;
    return scheduleContentView(
      `${kind}:${slugOrId}`,
      () => {
        apiClient.post(`/${kind}/${encodeURIComponent(slugOrId)}/view`).catch(() => {});
      },
      browserViewEnv(),
    );
  }, [kind, slugOrId]);
}
