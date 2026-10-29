import React from 'react';
import { Skeleton, SkeletonCard } from '../ui/Skeleton';

interface ListingCardSkeletonProps {
  viewMode?: 'grid' | 'list';
}

/**
 * ListingCardSkeleton — Built on top of the generic SkeletonCard primitive.
 *
 * The base shape (image + title + meta + footer) comes from <SkeletonCard />
 * to stay in sync with future design tweaks; we only overlay the
 * listing-specific phantom chrome (proximity badge + favorite button)
 * and, for the list variant, the right-side price/action sidebar.
 */
export const ListingCardSkeleton: React.FC<ListingCardSkeletonProps> = ({ viewMode = 'grid' }) => {
  if (viewMode === 'grid') {
    return (
      <div className="relative">
        <SkeletonCard variant="grid" imageAspect="aspect-[4/3]" />
        <div className="absolute left-0 top-0 w-20 h-8 bg-card/90 rounded-br-2xl border-b border-r border-border" aria-hidden="true" />
        <div className="absolute top-3 right-3 w-10 h-10 rounded-full bg-card/90 border border-border" aria-hidden="true" />
      </div>
    );
  }

  // List variant: horizontal card with optional desktop price/action sidebar.
  return (
    <div
      className="bg-card rounded-2xl border border-border overflow-hidden flex flex-col md:flex-row shadow-sm"
      aria-hidden="true"
    >
      {/* Image side */}
      <div className="relative w-full md:w-72 shrink-0">
        <Skeleton className="w-full aspect-[16/9] md:aspect-[4/3] rounded-none" />
        <div className="absolute left-0 top-0 w-20 h-8 bg-card/90 rounded-br-2xl border-b border-r border-border" />
        <div className="absolute top-3 right-3 w-10 h-10 rounded-full bg-card/90 border border-border" />
      </div>

      {/* Main content */}
      <div className="flex-1 p-5 flex flex-col gap-3 min-w-0">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/3" />
        <div className="flex gap-3">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-12" />
        </div>
        <div className="flex items-center justify-between gap-3 mt-auto pt-4 border-t border-border">
          <div className="flex items-center gap-2">
            <Skeleton className="w-8 h-8 rounded-full" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      </div>

      {/* Price / actions sidebar (desktop only) */}
      <div className="hidden md:flex flex-col justify-between items-end p-5 w-[210px] lg:w-[230px] border-l border-border shrink-0">
        <div className="text-right w-full space-y-2">
          <Skeleton className="h-2 w-16 ml-auto" />
          <Skeleton className="h-9 w-full ml-auto" />
        </div>
        <div className="w-full space-y-2">
          <Skeleton className="h-11 w-full rounded-xl" />
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
};
