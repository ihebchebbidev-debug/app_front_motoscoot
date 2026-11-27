import React, { useEffect } from 'react';
import { Toaster, toast } from 'sonner';
import { toastBus } from '../../context/ToastContext';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

/**
 * Site notifications (Sonner), fed by useToast().addToast (context/ToastContext).
 * Loaded on the first notification by components/ui/ToastContainer.tsx.
 * Same look as before (success and warning one shade darker: white text on
 * them was under 4.5:1): one solid colour per kind, white text, icon on a light
 * tile, close cross. Sonner adds what the hand-built stack lacked: it pauses
 * while hovered or focused, swipes away on phones, animates out, stacks, and
 * announces politely to screen readers (it no longer interrupts with
 * role="alert" for « Profil mis à jour »).
 *
 * Bottom right on computers; on phones it sits 8 rem up, above the floating
 * capsule (spec sheet, /mon-compte) and the listing's call bar.
 */
const iconTile = (Icon: React.ElementType) => (
  <span className="p-2 bg-white/10 rounded-xl inline-flex">
    <Icon size={20} strokeWidth={2.5} aria-hidden="true" />
  </span>
);

const SonnerToaster: React.FC = () => {
  // Runs after <Toaster> (a child) has subscribed, so the queued
  // notifications are shown, not lost.
  useEffect(() => toastBus.register({
    show: ({ message, type, duration }) => {
      // duration 0 used to mean « stays until closed ».
      toast[type](message, { duration: duration > 0 ? duration : Infinity });
    },
    dismiss: (id) => { toast.dismiss(id); },
  }), []);

  return (
    <Toaster
      position="bottom-right"
      offset={{ bottom: 40, right: 40 }}
      mobileOffset={{ bottom: 'calc(8rem + env(safe-area-inset-bottom))', left: 12, right: 12 }}
      gap={12}
      closeButton
      containerAriaLabel="Notifications"
      icons={{
        success: iconTile(CheckCircle2),
        error: iconTile(AlertCircle),
        info: iconTile(Info),
        warning: iconTile(AlertTriangle),
        close: <X size={16} strokeWidth={3} aria-hidden="true" />,
      }}
      toastOptions={{
        unstyled: true,
        closeButtonAriaLabel: 'Fermer',
        classNames: {
          toast: 'w-full flex items-center gap-4 pl-4 pr-3 py-3.5 rounded-2xl border shadow-2xl text-white font-sans',
          icon: 'shrink-0 !w-auto !h-auto !m-0',
          content: 'flex-1 min-w-0',
          title: 'text-sm font-semibold leading-snug',
          closeButton: 'order-last shrink-0 -my-1 w-11 h-11 inline-flex items-center justify-center rounded-full hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white',
          success: 'bg-emerald-700 border-emerald-600',
          error: 'bg-red-600 border-red-500',
          info: 'bg-gray-900 border-gray-800',
          warning: 'bg-amber-700 border-amber-600',
        },
      }}
    />
  );
};

export default SonnerToaster;
