import React, { useState, useEffect } from 'react';
import { Lock, ArrowRight, Eye, EyeOff } from 'lucide-react';

const SITE_PASSWORD = 'Motoscoot2026';
const STORAGE_KEY = 'site_gate_unlocked_v1';

interface SiteGateProps {
  children: React.ReactNode;
}

const SiteGate: React.FC<SiteGateProps> = ({ children }) => {
  const [unlocked, setUnlocked] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [value, setValue] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (unlocked) {
      try { sessionStorage.setItem(STORAGE_KEY, '1'); } catch {}
    }
  }, [unlocked]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value === SITE_PASSWORD) {
      setError(false);
      setUnlocked(true);
    } else {
      setError(true);
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  };

  if (unlocked) return <>{children}</>;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-hidden bg-gradient-to-br from-[#0a0a0f] via-[#1a0f2e] to-[#0a0a0f]">
      {/* Animated background orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-primary-600/30 blur-[120px] animate-pulse" />
        <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full bg-primary-500/20 blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full bg-primary-700/20 blur-[100px]" />
      </div>

      {/* Subtle grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div
        className={`relative w-full max-w-md transition-transform ${shake ? 'animate-[shake_0.5s_ease-in-out]' : ''}`}
        style={{ animation: shake ? 'shake 0.4s' : undefined }}
      >
        <style>{`
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            20% { transform: translateX(-8px); }
            40% { transform: translateX(8px); }
            60% { transform: translateX(-6px); }
            80% { transform: translateX(6px); }
          }
        `}</style>

        {/* Card */}
        <div className="relative rounded-3xl bg-white/[0.04] backdrop-blur-2xl border border-white/10 p-8 md:p-10 shadow-[0_20px_80px_-20px_rgba(0,0,0,0.8)]">
          {/* Glow border */}
          <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br from-primary-500/20 via-transparent to-primary-700/20 opacity-50" />

          <div className="relative">
            {/* Icon */}
            <div className="mx-auto mb-6 w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-[0_10px_30px_-5px_rgba(255,107,0,0.6)]">
              <Lock className="w-7 h-7 text-white" />
            </div>

            {/* Title */}
            <h1 className="text-center text-white font-extrabold text-[26px] md:text-[30px] tracking-tight leading-tight mb-2">
              Accès restreint
            </h1>
            <p className="text-center text-white/60 text-[14px] font-medium mb-8 leading-relaxed">
              Ce site est en phase privée.<br />
              Entrez le mot de passe pour continuer.
            </p>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <input
                  type={show ? 'text' : 'password'}
                  value={value}
                  onChange={(e) => { setValue(e.target.value); setError(false); }}
                  placeholder="Mot de passe"
                  autoFocus
                  className={`w-full h-14 pl-5 pr-14 rounded-2xl bg-white/[0.06] border text-white placeholder:text-white/30 font-semibold outline-none transition-all duration-200 focus:bg-white/[0.08] focus:ring-4 ${
                    error
                      ? 'border-red-400/60 focus:border-red-400 focus:ring-red-500/20'
                      : 'border-white/10 focus:border-primary-500/60 focus:ring-primary-500/20'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition-colors"
                  aria-label={show ? 'Masquer' : 'Afficher'}
                >
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {error && (
                <p className="text-red-400 text-[13px] font-semibold text-center -mt-1">
                  Mot de passe incorrect
                </p>
              )}

              <button
                type="submit"
                className="group w-full h-14 rounded-2xl bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white font-extrabold text-[14px] uppercase tracking-wider shadow-[0_10px_30px_-8px_rgba(255,107,0,0.6)] hover:shadow-[0_15px_40px_-8px_rgba(255,107,0,0.8)] active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2"
              >
                Déverrouiller
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </form>

            {/* Footer */}
            <p className="text-center text-white/30 text-[11px] font-medium mt-8 uppercase tracking-[2px]">
              Motoscoot · Préversion privée
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SiteGate;
