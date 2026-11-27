import React from 'react';

/**
 * Floating capsule (phones and tablets): dark frosted glass that floats 12 px
 * above the content and the iPhone home indicator, with a soft fade behind it
 * so the page never shows through the edge. One shape for the whole site:
 * - the spec sheet's price and actions bar (TechSpecsDetails),
 * - the account tabs (Dashboard, /mon-compte).
 *
 * 64 px tall, 6 px inset, fully rounded, at most 448 px wide.
 * Material, depth, entrance and accessibility (reduced motion, reduced
 * transparency, more contrast): .ms-capsule in src/styles/globals.css.
 */

/** Width from which the capsule hides (the page shows its own desktop UI). */
type HideFrom = 'md' | 'lg';

// Literal class names so Tailwind generates both.
const HIDE: Record<HideFrom, string> = { md: 'md:hidden', lg: 'lg:hidden' };

const BAR = 'ms-capsule fixed z-50 left-3 right-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] mx-auto max-w-md h-16 p-1.5 flex items-center rounded-full';
const EDGE = 'ms-capsule-edge fixed inset-x-0 bottom-0 z-40 h-[calc(6rem+env(safe-area-inset-bottom))] pointer-events-none';

interface FloatingCapsuleProps {
  hideFrom: HideFrom;
  /** `nav` for tabs, `div` (with role="region") for an action bar. */
  as?: 'nav' | 'div';
  'aria-label': string;
  role?: string;
  /** Arrangement of the content (justify, gap). */
  className?: string;
  children: React.ReactNode;
}

export const FloatingCapsule: React.FC<FloatingCapsuleProps> = ({
  hideFrom, as: Tag = 'div', role, className = '', children, ...rest
}) => (
  <>
    <div className={`${EDGE} ${HIDE[hideFrom]}`} aria-hidden="true" />
    <Tag className={`${BAR} ${HIDE[hideFrom]} ${className}`} role={role} aria-label={rest['aria-label']}>
      {children}
    </Tag>
  </>
);

/** Text and ring colour that sit on the capsule (focus ring offset). */
export const CAPSULE_FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#1B1F27]';
