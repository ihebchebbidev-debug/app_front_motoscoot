import { useCallback } from 'react';
import { useToast } from '../context/ToastContext';
import { monitoring } from '../utils/monitoring';

interface ShareData {
  title: string;
  text: string;
  url: string;
}

export const useNativeShare = () => {
  const { addToast } = useToast();

  const share = useCallback(async (data: ShareData) => {
    // 1. URL Validation & Normalization
    let sharableUrl = data.url || window.location.href;
    const fallbackBase = "https://moto-scoot.tn";

    try {
      const urlObj = new URL(sharableUrl);
      // navigator.share strictly requires http: or https: protocols.
      // Many sandbox environments use blob: or about: which trigger 'Invalid URL' errors.
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        sharableUrl = `${fallbackBase}${window.location.pathname}${window.location.search}`;
      }
    } catch (e) {
      // If URL is relative or totally invalid, use fallback with current path
      sharableUrl = `${fallbackBase}${window.location.pathname}${window.location.search}`;
    }

    const finalData = {
      title: data.title,
      text: data.text,
      url: sharableUrl,
    };

    // 2. Execution with Feature Detection
    if (navigator.share) {
      try {
        // Use canShare check if supported by browser for extra safety
        if (typeof navigator.canShare === 'function' && !navigator.canShare(finalData)) {
          throw new Error('Unsharable data');
        }

        await navigator.share(finalData);
        monitoring.trackEvent('ContentShared', { method: 'native_api', url: sharableUrl });
      } catch (err) {
        // AbortError is triggered when user cancels, we should ignore it.
        if ((err as Error).name !== 'AbortError') {
          console.error('Share failed, falling back to clipboard:', err);
          copyToClipboard(sharableUrl);
        }
      }
    } else {
      copyToClipboard(sharableUrl);
    }
  }, [addToast]);

  const copyToClipboard = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      addToast("Lien copié dans le presse-papier !", "info", 2000);
      monitoring.trackEvent('ContentShared', { method: 'clipboard', url });
    } catch (err) {
      console.error('Clipboard failed:', err);
      addToast("Impossible de copier le lien.", "error");
    }
  };

  return share;
};