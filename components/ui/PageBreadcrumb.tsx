import React from 'react';
import { ArrowLeft, ChevronRight } from 'lucide-react';

/**
 * The one page breadcrumb of the site (it used to be copied by hand in 22
 * pages, in three looks: 30 or 44 px back button, 11 or 12 px text, four
 * different heights).
 *
 * - Phones: a single « ← Parent » link, 44 px tall, right under the header.
 *   Its 44 px tap zone overflows 13 px above and below (negative margins):
 *   in the layout it is only as tall as what is seen (18 px), so the pages'
 *   spacing is the visible spacing — 24 px under the header, 12 px to the
 *   title, on every page.
 *   The arrow and « Accueil » no longer sit side by side doing the same thing;
 *   the system back gesture already covers the browsing history.
 * - From 768 px: back button + the full trail « Accueil › … › page ».
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

  return (
    <div className={className}>
      {/* Phones: one link to the parent page. */}
      {parent && (
        <a
          href={parent.href}
          onClick={follow(parent)}
          aria-label={`Retour à ${parent.label}`}
          className="md:hidden flex w-fit items-center gap-1.5 min-h-11 -my-[13px] -ml-2 pl-2 pr-3 rounded-xl text-[14px] font-semibold text-gray-700 active:bg-gray-100 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-gray-900"
        >
          <ArrowLeft size={18} aria-hidden="true" className="shrink-0" />
          <span className="truncate">{parent.label}</span>
        </a>
      )}

      {/* From 768 px: back button + full trail. */}
      <div className="hidden md:flex items-center gap-4 min-w-0">
        {parent && (
          <a
            href={parent.href}
            onClick={follow(parent)}
            aria-label={`Retour à ${parent.label}`}
            className={`shrink-0 flex items-center justify-center w-10 h-10 rounded-xl border shadow-sm transition-colors active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
              hero
                ? 'bg-white/10 border-white/25 text-white hover:bg-white/20 backdrop-blur-sm focus-visible:outline-white'
                : 'bg-card border-gray-200 text-gray-700 hover:text-primary-700 hover:border-gray-300 focus-visible:outline-gray-900'
            }`}
          >
            <ArrowLeft size={20} aria-hidden="true" />
          </a>
        )}
        <nav aria-label="Fil d'Ariane" className="min-w-0">
          <ol className={`flex items-center gap-2 min-w-0 text-[13px] leading-5 font-medium ${hero ? 'text-white/85' : 'text-gray-600'}`}>
            {parents.map((crumb) => (
              <React.Fragment key={crumb.label}>
                <li className="shrink-0">
                  <a
                    href={crumb.href}
                    onClick={follow(crumb)}
                    className={`rounded transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                      hero ? 'hover:text-white focus-visible:outline-white' : 'hover:text-primary-700 focus-visible:outline-gray-900'
                    }`}
                  >
                    {crumb.label}
                  </a>
                </li>
                <li aria-hidden="true" className="shrink-0">
                  <ChevronRight size={14} className={hero ? 'text-white/60' : 'text-gray-400'} />
                </li>
              </React.Fragment>
            ))}
            <li aria-current="page" className={`min-w-0 truncate font-semibold ${hero ? 'text-white' : 'text-gray-900'}`}>
              {current}
            </li>
          </ol>
        </nav>
      </div>
    </div>
  );
};

export default PageBreadcrumb;
