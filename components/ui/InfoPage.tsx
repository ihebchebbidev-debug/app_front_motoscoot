import React from 'react';
import { Check, ChevronDown } from 'lucide-react';

/**
 * Shared pieces of the information pages (Conditions générales, Sécurité):
 * the orange hero, the "En bref" key-points box and the sommaire (sticky
 * list on large screens, folded menu on phones). One component each, so the
 * pages stay identical.
 *
 * Motion: none on the hero (the title is the page's main content and shows
 * at once); the folded sommaire opens with the site's menu curve
 * (.ms-toc in globals.css); the sticky sommaire marks the section being read.
 */

export const InfoHero: React.FC<{ title: string; subtitle: string }> = ({ title, subtitle }) => (
  <div className="relative w-full h-[35vh] md:h-[30vh] lg:h-[45vh] flex flex-col md:items-center md:justify-center px-6 font-sans overflow-hidden bg-primary-50">
    <div className="absolute inset-0 overflow-hidden z-0">
      <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('https://www.moto-scoot.tn/hero-assets/-hero-background.webp')" }} />
      <div className="absolute inset-0 bg-gradient-to-b from-primary-700 to-primary-600 opacity-95 mix-blend-multiply" />
    </div>
    <div className="relative z-10 flex flex-col justify-center items-center w-full max-w-[1280px] mx-auto h-full pt-20">
      <div className="text-center px-4 md:mt-32">
        <h1 className="text-3xl md:text-6xl font-extrabold text-white mb-4 drop-shadow-sm tracking-tight leading-tight text-balance">
          {title}
        </h1>
        <p className="text-white/90 text-lg md:text-xl font-medium max-w-2xl mx-auto">{subtitle}</p>
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

export type TocItem = { id: string; title: string };

// Called after the folded sommaire has closed, so the layout no longer moves.
const scrollToSection = (id: string) => {
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  history.replaceState(history.state, '', `#${id}`);
  el.focus({ preventScroll: true });
};

/** Id of the last heading that has reached the top of the window (under the fixed header). */
const useActiveSection = (ids: readonly string[]) => {
  const [active, setActive] = React.useState<string | undefined>();
  const key = ids.join(' ');
  React.useEffect(() => {
    if (!key) return;
    const list = key.split(' ');
    let frame = 0;
    const update = () => {
      frame = 0;
      let current: string | undefined;
      for (const id of list) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= 140) current = id;
      }
      setActive(current);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [key]);
  return active;
};

/** `tracked`: highlight the section being read (the sticky sommaire on large screens). */
export const TocList: React.FC<{ items: readonly TocItem[]; onPick?: () => void; tracked?: boolean }> = ({ items, onPick, tracked }) => {
  const active = useActiveSection(tracked ? items.map((s) => s.id) : []);
  return (
    <ol className="space-y-0.5">
      {items.map((s) => {
        const isActive = s.id === active;
        return (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              aria-current={isActive ? 'location' : undefined}
              onClick={(e) => {
                if (!document.getElementById(s.id)) return;
                e.preventDefault();
                onPick?.();
                requestAnimationFrame(() => scrollToSection(s.id));
              }}
              className={`block rounded-lg px-3 py-2 text-[0.9375rem] leading-snug transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                isActive
                  ? 'bg-primary-50 font-semibold text-primary-800'
                  : 'text-gray-700 [@media(hover:hover)]:hover:bg-gray-100 [@media(hover:hover)]:hover:text-gray-900'
              }`}
            >
              {s.title}
            </a>
          </li>
        );
      })}
    </ol>
  );
};

/** Sommaire folded above the text on phones and tablets; closes on pick. */
export const FoldedToc: React.FC<{ items: readonly TocItem[] }> = ({ items }) => {
  const ref = React.useRef<HTMLDetailsElement>(null);
  return (
    <details ref={ref} className="ms-toc group mt-5 rounded-2xl border border-gray-200 lg:hidden">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-5 py-3 font-bold text-gray-900 [&::-webkit-details-marker]:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
        Sommaire
        <ChevronDown size={20} className="text-gray-500 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
      </summary>
      <nav aria-label="Sommaire (mobile)" className="px-2 pb-3">
        <TocList items={items} onPick={() => ref.current?.removeAttribute('open')} />
      </nav>
    </details>
  );
};
