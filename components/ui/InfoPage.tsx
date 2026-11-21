import React from 'react';
import { Check } from 'lucide-react';

/**
 * Shared pieces of the information pages (Conditions générales, Sécurité):
 * the orange hero and the "En bref" key-points box. One component each, so
 * the pages stay identical.
 */

export const InfoHero: React.FC<{ title: string; subtitle: string }> = ({ title, subtitle }) => (
  <div className="relative w-full h-[35vh] md:h-[30vh] lg:h-[45vh] flex flex-col md:items-center md:justify-center px-6 font-sans overflow-hidden bg-primary-50">
    <div className="absolute inset-0 overflow-hidden z-0">
      <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('https://www.moto-scoot.tn/hero-assets/-hero-background.webp')" }} />
      <div className="absolute inset-0 bg-gradient-to-b from-primary-700 to-primary-600 opacity-95 mix-blend-multiply" />
    </div>
    <div className="relative z-10 flex flex-col justify-center items-center w-full max-w-[1280px] mx-auto h-full pt-20">
      <div className="text-center px-4 md:mt-32">
        <h1 className="text-3xl md:text-6xl font-extrabold text-white mb-4 drop-shadow-sm tracking-tight leading-tight text-balance animate-fade-in-up">
          {title}
        </h1>
        <p className="text-white/90 text-lg md:text-xl font-medium max-w-2xl mx-auto animate-fade-in-up">{subtitle}</p>
      </div>
    </div>
  </div>
);

export const KeyPoints: React.FC<{ id: string; title: string; items: readonly string[]; note?: string }> = ({ id, title, items, note }) => (
  <section aria-labelledby={id} className="mt-5 rounded-2xl bg-primary-50 px-5 py-6 sm:px-7">
    <h2 id={id} className="text-lg font-extrabold text-gray-900">{title}</h2>
    <ul className="mt-4 space-y-3">
      {items.map((line) => (
        <li key={line} className="flex gap-3 text-[0.9375rem] leading-relaxed text-gray-800 sm:text-base">
          <Check size={18} strokeWidth={2.5} className="mt-[0.2rem] shrink-0 text-primary-700" aria-hidden="true" />
          <span>{line}</span>
        </li>
      ))}
    </ul>
    {note && <p className="mt-4 text-sm text-gray-700">{note}</p>}
  </section>
);
