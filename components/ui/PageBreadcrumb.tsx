import React from 'react';
import { ArrowLeft, ChevronRight } from 'lucide-react';

/**
 * The one page breadcrumb of the site (it used to be copied by hand in 22
 * pages, in three looks: 30 or 44 px back button, 11 or 12 px text, four
 * different heights).
 *
 * Same on every screen (owner's choice): a back button « ← » to the parent
 * page, then the trail « Accueil › … › page ».
 * - Phones: 44 px button, links 44 px tall to the finger; a trail of more
 *   than two steps keeps its first and last parents (the middle folds into
 *   « … » under 640 px); the current page ends with « … » instead of
 *   leaving the screen.
 * - Pages place it 24 px under the header and 12 px above the title.
 *
 * Every step is a real link (keyboard, Google) that the SPA intercepts.
 */
export interface Crumb {
  label: string;
  /** Real URL of the step (crawlable, opens in a new tab with Cmd/Ctrl). */
  href?: string;
  onClick?: () => void;
}

interface PageBreadcrumbProps {
  /** Steps above the current page, « Accueil » first. */
  parents: Crumb[];
  /** Name of the current page (last step, not a link). */
  current: string;
  /** Where « ← » goes: the parent page. Defaults to the last parent. */
  back?: Crumb;
  /** From 768 px, on the orange image header of the « Fiches techniques »
   *  family: light text. Phones always use the plain look. */
  tone?: 'default' | 'hero';
  className?: string;
}

/** Plain click: navigate inside the app. Cmd/Ctrl/Shift/middle click: let the browser open the link. */
const follow = (crumb: Crumb) => (e: React.MouseEvent<HTMLAnchorElement>) => {
  if (!crumb.onClick) return;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
  e.preventDefault();
  crumb.onClick();
};

export const PageBreadcrumb: React.FC<PageBreadcrumbProps> = ({ parents, current, back, tone = 'default', className = '' }) => {
  const parent = back ?? parents[parents.length - 1];
  const hero = tone === 'hero';

  // The orange image header exists from 768 px only: phones keep the light look.
  const btn = hero
    ? 'bg-card border-gray-200 text-gray-700 md:bg-white/10 md:border-white/25 md:text-white md:hover:bg-white/20 md:backdrop-blur-sm focus-visible:outline-gray-900 md:focus-visible:outline-white'
    : 'bg-card border-gray-200 text-gray-700 hover:text-primary-700 hover:border-gray-300 focus-visible:outline-gray-900';
  const link = hero
    ? 'hover:text-primary-700 md:hover:text-white focus-visible:outline-gray-900 md:focus-visible:outline-white'
    : 'hover:text-primary-700 focus-visible:outline-gray-900';
  const last = parents.length - 1;

  return (
    <div className={`flex items-center gap-3 md:gap-4 min-w-0 ${className}`}>
      {parent && (
        <a
          href={parent.href}
          onClick={follow(parent)}
          aria-label={`Retour à ${parent.label}`}
          className={`shrink-0 flex items-center justify-center w-11 h-11 md:w-10 md:h-10 rounded-xl border shadow-sm transition-colors active:scale-95 active:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${btn}`}
        >
          <ArrowLeft size={20} aria-hidden="true" />
        </a>
      )}
      <nav aria-label="Fil d'Ariane" className="min-w-0">
        <ol className={`flex items-center gap-1.5 md:gap-2 min-w-0 text-[13px] leading-5 font-medium text-gray-600 ${hero ? 'md:text-white/85' : ''}`}>
          {parents.map((crumb, i) => {
            // Phones: a trail of more than two steps keeps the first and the
            // last parent; the ones between fold into « … » (full from 640 px).
            const middle = i > 0 && i < last;
            return (
              <React.Fragment key={crumb.label}>
                {middle && i === 1 && (
                  <>
                    <li aria-hidden="true" className="sm:hidden shrink-0">…</li>
                    <li aria-hidden="true" className="sm:hidden shrink-0">
                      <ChevronRight size={14} className={`text-gray-400 ${hero ? 'md:text-white/60' : ''}`} />
                    </li>
                  </>
                )}
                <li className={`shrink-0 ${middle ? 'hidden sm:block' : ''}`}>
                  <a
                    href={crumb.href}
                    onClick={follow(crumb)}
                    // 44 px tall to the finger (inline padding: no layout change).
                    className={`py-3 rounded transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${link}`}
                  >
                    {crumb.label}
                  </a>
                </li>
                <li aria-hidden="true" className={`shrink-0 ${middle ? 'hidden sm:block' : ''}`}>
                  <ChevronRight size={14} className={`text-gray-400 ${hero ? 'md:text-white/60' : ''}`} />
                </li>
              </React.Fragment>
            );
          })}
          <li aria-current="page" className={`min-w-0 truncate font-semibold text-gray-900 ${hero ? 'md:text-white' : ''}`}>
            {current}
          </li>
        </ol>
      </nav>
    </div>
  );
};

export default PageBreadcrumb;
