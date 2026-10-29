import React from 'react';

interface SkeletonProps {
  className?: string;
  /** Optional inline style for arbitrary sizing (kept minimal). */
  style?: React.CSSProperties;
}

/**
 * Skeleton — Atomic loading placeholder.
 * Uses semantic `bg-muted` token so it adapts to light/dark theme.
 * Default radius is `rounded-lg`; override via className when needed.
 */
export const Skeleton: React.FC<SkeletonProps> = ({ className = '', style }) => {
  return (
    <div
      className={`bg-muted animate-pulse rounded-lg ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
};

interface SkeletonCardProps {
  /** 'grid' (default): vertical card.  'list': horizontal card.  'compact': minimal (used in popular sections, garage tiles). */
  variant?: 'grid' | 'list' | 'compact';
  /** Aspect ratio of the image area (Tailwind class). Default '4/3'. */
  imageAspect?: string;
  className?: string;
}

/**
 * SkeletonCard — Composite placeholder shaped like a listing/garage card:
 * image area + title bar + meta row + footer row.
 * Use this instead of hand-rolling per-page card skeletons.
 *
 * @example
 *   {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
 */
export const SkeletonCard: React.FC<SkeletonCardProps> = ({
  variant = 'grid',
  imageAspect = 'aspect-[4/3]',
  className = '',
}) => {
  if (variant === 'compact') {
    // Simple card used in carousels (PopularGarages, PopularModels): image + 2 lines.
    return (
      <div
        className={`bg-card rounded-2xl border border-border overflow-hidden flex flex-col shadow-sm ${className}`}
        aria-hidden="true"
      >
        <Skeleton className={`w-full ${imageAspect} rounded-none`} />
        <div className="p-4 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
    );
  }

  if (variant === 'list') {
    return (
      <div
        className={`bg-card rounded-2xl border border-border overflow-hidden flex flex-col md:flex-row shadow-sm ${className}`}
        aria-hidden="true"
      >
        <Skeleton className={`w-full md:w-72 ${imageAspect} rounded-none shrink-0`} />
        <div className="flex-1 p-5 flex flex-col gap-3">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/3" />
          <div className="flex gap-3 mt-auto pt-3 border-t border-border">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      </div>
    );
  }

  // grid (default)
  return (
    <div
      className={`bg-card rounded-2xl border border-border overflow-hidden flex flex-col shadow-sm h-full ${className}`}
      aria-hidden="true"
    >
      <Skeleton className={`w-full ${imageAspect} rounded-none`} />
      <div className="p-5 flex-1 flex flex-col gap-3">
        {/* Title */}
        <Skeleton className="h-5 w-3/4" />
        {/* Subtitle / price */}
        <Skeleton className="h-4 w-1/3" />
        {/* Meta row */}
        <div className="flex gap-3 mt-2">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-12" />
        </div>
        {/* Footer row */}
        <div className="flex items-center justify-between gap-3 mt-auto pt-4 border-t border-border">
          <div className="flex items-center gap-2">
            <Skeleton className="w-8 h-8 rounded-full" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-8 w-16 rounded-lg" />
        </div>
      </div>
    </div>
  );
};

interface SkeletonTextProps {
  /** Tailwind width class for the bar (e.g. 'w-32'). Default 'w-24'. */
  width?: string;
  /** Tailwind height class. Default 'h-3' to match small body text. */
  height?: string;
  className?: string;
}

/**
 * SkeletonText — A single text-line placeholder.
 * Use for inline strings (labels, dates, counters) where the surrounding
 * row must keep its height to avoid layout shifts.
 */
export const SkeletonText: React.FC<SkeletonTextProps> = ({
  width = 'w-24',
  height = 'h-3',
  className = '',
}) => (
  <Skeleton className={`${height} ${width} rounded-md ${className}`} />
);

/**
 * MemberSinceSkeleton — Standardised placeholder for the "Membre depuis …"
 * label across the app (seller card, dashboard header, profile sheets).
 * Always 12px tall × 8rem wide so every consumer gets identical spacing
 * and the row keeps a constant height while user data loads.
 */
export const MemberSinceSkeleton: React.FC<{ className?: string }> = ({
  className = '',
}) => <SkeletonText width="w-32" height="h-3" className={className} />;

export default Skeleton;

