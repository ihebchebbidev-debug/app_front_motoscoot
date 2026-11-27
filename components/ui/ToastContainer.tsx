import React, { lazy, Suspense, useEffect, useState } from 'react';
import { toastBus } from '../../context/ToastContext';

// Sonner (≈10 KB gzip) is downloaded on the first notification, not on every
// page load: most visits never show one.
const SonnerToaster = lazy(() => import('./SonnerToaster'));

export const ToastContainer: React.FC = () => {
  const [needed, setNeeded] = useState(() => toastBus.hasPending);

  useEffect(() => {
    if (toastBus.hasPending) setNeeded(true);
    return toastBus.onRequest(() => setNeeded(true));
  }, []);

  if (!needed) return null;
  return (
    <Suspense fallback={null}>
      <SonnerToaster />
    </Suspense>
  );
};
