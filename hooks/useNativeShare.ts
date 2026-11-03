import { useCallback } from 'react';
import { useToast } from '../context/ToastContext';
import { monitoring } from '../utils/monitoring';
import { openShareSheet } from '../utils/deviceShare';

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

    // 2. Device share sheet; the clipboard only when there is no usable sheet
    //    (not when the user closed it, nor on a repeat tap while it opens).
    const result = await openShareSheet(finalData);
    if (result === 'shared') {
      monitoring.trackEvent('ContentShared', { method: 'native_api', url: sharableUrl });
    } else if (result === 'unavailable' || result === 'failed') {
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