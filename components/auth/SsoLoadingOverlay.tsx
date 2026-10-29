/**
 * SsoLoadingOverlay — full-screen branded loading state shown during the
 * Google OAuth round-trip (Clerk redirect → /sso-callback → backend JWT
 * exchange). Gives users immediate visual feedback so the few seconds
 * between leaving Google and being logged in don't feel like a dead app.
 */
import React from 'react';
import { Loader2 } from 'lucide-react';

interface Props {
  /** Optional sub-label, e.g. "Finalisation de votre connexion…" */
  label?: string;
  /** Optional muted hint shown below the main label */
  hint?: string;
}

const SsoLoadingOverlay: React.FC<Props> = ({
  label = 'Connexion en cours…',
  hint = 'Nous finalisons votre session, un instant.',
}) => {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-white/95 backdrop-blur-md"
    >
      <div className="flex flex-col items-center text-center px-6 max-w-sm animate-fade-in">
        {/* Google-style ring + brand orange spinner */}
        <div className="relative w-16 h-16 mb-6">
          <div className="absolute inset-0 rounded-full border-4 border-gray-100" />
          <Loader2 className="w-16 h-16 text-primary-600 animate-spin" strokeWidth={2.5} />
        </div>

        <h2 className="text-gray-900 text-xl font-extrabold tracking-tight mb-2">
          {label}
        </h2>
        <p className="text-gray-500 text-sm font-medium leading-relaxed">
          {hint}
        </p>

        {/* Indeterminate progress bar */}
        <div className="mt-8 w-56 h-1.5 rounded-full bg-gray-100 overflow-hidden">
          <div className="h-full w-1/3 bg-primary-600 rounded-full animate-[slide_1.2s_ease-in-out_infinite]" />
        </div>
      </div>

      <style>{`
        @keyframes slide {
          0%   { transform: translateX(-100%); }
          50%  { transform: translateX(150%); }
          100% { transform: translateX(350%); }
        }
      `}</style>
    </div>
  );
};

export default SsoLoadingOverlay;
