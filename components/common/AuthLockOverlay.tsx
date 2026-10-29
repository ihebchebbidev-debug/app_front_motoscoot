import React from 'react';
import { Lock, LogIn, Sparkles } from 'lucide-react';

interface AuthLockOverlayProps {
  /**
   * What is being protected — used in the title.
   * e.g. "le numéro de téléphone", "la localisation"
   */
  what: string;
  /** Optional supporting line under the title. */
  description?: string;
  /** Called when the user clicks the primary CTA. */
  onLogin: () => void;
  /**
   * Visual flavor:
   *  - "card"    : a full standalone card (used in sidebars / contact blocks)
   *  - "inline"  : compact pill-style button (used inside small action rows)
   *  - "blur"    : absolute overlay that blurs whatever it is laid over
   */
  variant?: 'card' | 'inline' | 'blur';
  className?: string;
}

/**
 * AuthLockOverlay — invites unauthenticated users to log in / sign up
 * before unlocking gated content (phone numbers, maps, contact buttons…).
 *
 * Designed to look premium: gradient border, soft glow, primary CTA + hint.
 */
const AuthLockOverlay: React.FC<AuthLockOverlayProps> = ({
  what,
  description,
  onLogin,
  variant = 'card',
  className = '',
}) => {
  if (variant === 'inline') {
    return (
      <button
        type="button"
        onClick={onLogin}
        className={`group inline-flex items-center justify-center gap-2 w-full h-14 rounded-[10px] bg-gradient-to-r from-primary-600 to-primary-700 text-white font-extrabold text-[12px] tracking-[0px] uppercase shadow-[0_8px_20px_-6px_rgba(255,107,0,0.5)] hover:shadow-[0_10px_25px_-6px_rgba(255,107,0,0.6)] active:scale-[0.98] transition-all duration-200 ${className}`}
        aria-label={`Se connecter pour voir ${what}`}
      >
        <Lock size={16} className="group-hover:rotate-12 transition-transform" />
        Se connecter pour voir
      </button>
    );
  }

  if (variant === 'blur') {
    return (
      <div className={`absolute inset-0 z-20 flex items-center justify-center backdrop-blur-md bg-card/60 rounded-[inherit] ${className}`}>
        <div className="text-center px-4 max-w-[280px]">
          <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-primary-600 to-primary-700 flex items-center justify-center shadow-lg">
            <Lock size={20} className="text-white" />
          </div>
          <p className="text-[14px] font-black text-gray-900 mb-3 leading-tight">
            Connectez-vous pour voir {what}
          </p>
          <button
            type="button"
            onClick={onLogin}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary-600 hover:bg-primary-700 text-white text-[12px] font-extrabold uppercase tracking-wider shadow-md hover:shadow-lg transition-all"
          >
            <LogIn size={14} />
            Se connecter
          </button>
        </div>
      </div>
    );
  }

  // variant === 'card'
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-primary-100 bg-gradient-to-br from-primary-50/80 via-card to-card p-5 ${className}`}
    >
      {/* Subtle decorative glow */}
      <div className="pointer-events-none absolute -top-10 -right-10 w-32 h-32 bg-primary-200/40 rounded-full blur-3xl" />
      <div className="pointer-events-none absolute -bottom-12 -left-8 w-28 h-28 bg-primary-100/50 rounded-full blur-3xl" />

      <div className="relative flex items-start gap-4">
        <div className="shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-600 to-primary-700 flex items-center justify-center shadow-md">
          <Lock size={20} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-[15px] font-black text-gray-900 leading-tight mb-1">
            Connectez-vous pour voir {what}
          </h4>
          {description && (
            <p className="text-[12px] font-medium text-gray-500 leading-snug mb-3">
              {description}
            </p>
          )}
          <button
            type="button"
            onClick={onLogin}
            className="group inline-flex items-center gap-2 h-11 px-5 rounded-[10px] bg-primary-600 hover:bg-primary-700 text-white text-[12px] font-extrabold uppercase tracking-wider shadow-[0_6px_16px_-4px_rgba(255,107,0,0.5)] hover:shadow-[0_8px_20px_-4px_rgba(255,107,0,0.6)] active:scale-[0.98] transition-all duration-200"
          >
            <LogIn size={14} />
            Se connecter / S'inscrire
          </button>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-gray-400">
            <Sparkles size={11} className="text-primary-500" />
            <span>Gratuit en 30 secondes</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthLockOverlay;
