import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { TechSpecModelCard } from './TechSpecModelCard';
import type { TechSpec } from '../../types';

/**
 * A row of the catalogue's model cards (TechSpecModelCard, as on the brand
 * pages) in a horizontal slider: swipe with scroll snap on phones, previous /
 * next buttons from md up, each card a real link reachable with Tab.
 * Used by « Modèles similaires » (fiche page) and « Modèles populaires »
 * (home page), so both rows look and behave the same.
 */
const DEFAULT_HEADING = 'font-sans text-[15px] font-extrabold uppercase tracking-[0.06em] text-foreground border-b-2 border-primary-600 pb-2';

export const ModelCarousel: React.FC<{
  id: string;
  heading: string;
  models: TechSpec[];
  /** One line under the heading (what the row is). */
  subtitle?: string;
  headingClassName?: string;
  subtitleClassName?: string;
  className?: string;
}> = ({ id, heading, models, subtitle, headingClassName = DEFAULT_HEADING, subtitleClassName = 'mt-1 text-sm text-gray-600', className = 'mt-8' }) => {
  const track = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });
  const updateEdges = useCallback(() => {
    const el = track.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  }, []);
  useEffect(() => {
    updateEdges();
    window.addEventListener('resize', updateEdges);
    return () => window.removeEventListener('resize', updateEdges);
  }, [models, updateEdges]);
  const slide = (dir: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: reduce ? 'auto' : 'smooth' });
  };
  if (!models.length) return null;
  const arrow = 'grid h-10 w-10 place-items-center rounded-full bg-card border border-gray-200 text-foreground transition-colors hover:border-primary-600 hover:text-primary-600 disabled:opacity-40 disabled:pointer-events-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600';
  return (
    <section aria-labelledby={id} className={className}>
      <div className="flex items-end justify-between gap-4 mb-4">
        <div className="min-w-0">
          <h2 id={id} className={headingClassName}>
            {heading}
          </h2>
          {subtitle && <p className={subtitleClassName}>{subtitle}</p>}
        </div>
        <div className="hidden md:flex gap-2 shrink-0">
          <button type="button" className={arrow} onClick={() => slide(-1)} disabled={edges.start} aria-label="Modèles précédents"><ChevronLeft size={18} /></button>
          <button type="button" className={arrow} onClick={() => slide(1)} disabled={edges.end} aria-label="Modèles suivants"><ChevronRight size={18} /></button>
        </div>
      </div>
      <div
        ref={track}
        onScroll={updateEdges}
        role="list"
        aria-label={heading}
        className="flex gap-4 overflow-x-auto no-scrollbar snap-x snap-mandatory scroll-smooth motion-reduce:scroll-auto -mx-4 px-4 md:mx-0 md:px-0 pb-2"
      >
        {models.map((m) => (
          <div key={String(m.id)} role="listitem" className="shrink-0 w-[78%] sm:w-[260px] md:w-[270px] snap-start">
            <TechSpecModelCard spec={m} />
          </div>
        ))}
      </div>
    </section>
  );
};
