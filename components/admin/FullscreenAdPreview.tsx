import React, { useState } from 'react';
import { X, Smartphone, Monitor } from 'lucide-react';

export interface FullscreenAdPreviewData {
  title?: string;
  description?: string | null;
  mediaUrl?: string | null;
  ctaText?: string | null;
  linkUrl?: string | null;
}

/**
 * Admin-only preview of the public <FullscreenAd /> overlay.
 *
 * Renders the exact same markup/classes used in production, but inside a
 * device-sized frame (mobile 390×780 / desktop 1280×800) so the admin can
 * confirm both layouts before publishing. No analytics, no session caps,
 * no body-scroll lock — purely visual.
 *
 * Keep the inner card markup IN SYNC with components/FullscreenAd.tsx.
 */
export const FullscreenAdPreview: React.FC<{
  ad: FullscreenAdPreviewData;
  onClose: () => void;
}> = ({ ad, onClose }) => {
  const [device, setDevice] = useState<'mobile' | 'desktop'>('mobile');

  const frame =
    device === 'mobile'
      ? { w: 390, h: 780 }
      : { w: 1280, h: 800 };

  return (
    <div
      className="fixed inset-0 z-[10001] flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Toolbar */}
      <div className="mb-4 flex items-center gap-2 bg-card rounded-xl px-3 py-2 shadow-lg">
        <span className="text-xs font-bold text-gray-700 mr-2">Aperçu Fullscreen</span>
        <button
          onClick={() => setDevice('mobile')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
            device === 'mobile' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <Smartphone size={14} /> Mobile
        </button>
        <button
          onClick={() => setDevice('desktop')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
            device === 'desktop' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <Monitor size={14} /> Desktop
        </button>
        <button
          onClick={onClose}
          className="ml-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-red-50 text-red-600 hover:bg-red-100"
        >
          <X size={14} /> Fermer
        </button>
      </div>

      {/* Device frame — scales down if the admin viewport is smaller. */}
      <div
        className="relative bg-black rounded-3xl shadow-2xl overflow-hidden border-4 border-gray-800 max-w-[95vw] max-h-[80vh]"
        style={{
          width: frame.w,
          height: frame.h,
          // Tailwind responsive fallback so 1280px frame stays readable on
          // small admin screens.
          aspectRatio: `${frame.w} / ${frame.h}`,
        }}
      >
        {/*
          Force Tailwind responsive breakpoints inside this scoped frame by
          rendering the SAME card markup as <FullscreenAd />, but with a
          surrounding container that mimics the device width. Tailwind sm:/md:
          breakpoints follow the actual viewport, NOT the frame, so we apply
          explicit "mobile" vs "desktop" sizing classes manually below.
        */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-md p-2">
          {device === 'mobile' ? (
            <MobileCard ad={ad} />
          ) : (
            <DesktopCard ad={ad} />
          )}
        </div>
      </div>

      <p className="mt-3 text-xs text-white/70">
        Aperçu visuel uniquement — ce contenu ne sera pas tracké comme une vue.
      </p>
    </div>
  );
};

const SponsorBadge = () => (
  <div className="absolute top-3 left-3 z-20 bg-card/90 backdrop-blur-sm px-3 py-1 rounded-full text-[11px] font-bold text-gray-800 shadow">
    Sponsorisé
  </div>
);

const CloseStub = () => (
  <button
    type="button"
    className="absolute top-3 right-3 z-20 p-3 bg-black/50 text-white rounded-full shadow-lg cursor-default"
    aria-label="Fermer"
  >
    <X className="w-6 h-6" />
  </button>
);

const Body: React.FC<{ ad: FullscreenAdPreviewData; large?: boolean }> = ({ ad, large }) => (
  <div className={`p-5 text-center flex-1 flex flex-col justify-center overflow-y-auto ${large ? 'p-8' : ''}`}>
    <h3 className={`font-bold text-gray-900 mb-3 ${large ? 'text-4xl' : 'text-2xl'}`}>
      {ad.title || 'Titre de la campagne'}
    </h3>
    {ad.description && (
      <p className={`text-gray-600 mb-6 max-w-2xl mx-auto ${large ? 'text-lg' : 'text-sm'}`}>
        {ad.description}
      </p>
    )}
    <button
      type="button"
      className={`mx-auto bg-orange-500 text-white font-bold rounded-lg shadow-md ${
        large ? 'px-12 py-4 text-lg' : 'w-full py-3 text-base'
      }`}
    >
      {ad.ctaText || 'Découvrir'}
    </button>
    <div className="mt-5 flex flex-col items-center gap-3">
      <button type="button" className="text-sm text-gray-500 underline cursor-default">
        Non merci, je continue ma visite
      </button>
      <label className="flex items-center gap-2">
        <input type="checkbox" disabled className="w-4 h-4 rounded border-gray-300" />
        <span className="text-xs text-gray-400">Ne plus afficher dans cette session</span>
      </label>
    </div>
  </div>
);

const MobileCard: React.FC<{ ad: FullscreenAdPreviewData }> = ({ ad }) => (
  <div className="relative bg-card rounded-2xl shadow-2xl overflow-hidden w-full h-full flex flex-col">
    <CloseStub />
    <SponsorBadge />
    {ad.mediaUrl && (
      <div className="w-full bg-gray-100 flex-shrink-0" style={{ height: '55%' }}>
        <img src={ad.mediaUrl} alt={ad.title || ''} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
      </div>
    )}
    <Body ad={ad} />
  </div>
);

const DesktopCard: React.FC<{ ad: FullscreenAdPreviewData }> = ({ ad }) => (
  <div className="relative bg-card rounded-2xl shadow-2xl overflow-hidden w-full max-w-5xl max-h-[88%] flex flex-col mx-auto">
    <CloseStub />
    <SponsorBadge />
    {ad.mediaUrl && (
      <div className="w-full bg-gray-100 flex-shrink-0" style={{ height: 384 }}>
        <img src={ad.mediaUrl} alt={ad.title || ''} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
      </div>
    )}
    <Body ad={ad} large />
  </div>
);
