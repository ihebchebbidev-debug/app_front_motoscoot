import React from 'react';
import { Skeleton, SkeletonCard } from '../ui/Skeleton';
import { Section } from '../ui/Section';

/**
 * BrandCardSkeleton — Very specific compact tile (square logo + tiny label).
 * No SkeletonCard variant matches this shape, so it stays custom.
 */
export const BrandCardSkeleton = () => (
  <div
    className="flex flex-col items-center justify-center w-full max-w-[211px] h-[155px] mx-auto bg-transparent gap-3"
    aria-hidden="true"
  >
    <Skeleton className="w-[115px] h-[115px] rounded-2xl shrink-0" />
    <Skeleton className="h-3 w-16" />
  </div>
);

/**
 * ModelCardSkeleton — Matches the model card layout exactly via the
 * generic SkeletonCard primitive (grid variant, 4/3 image).
 */
export const ModelCardSkeleton = () => (
  <SkeletonCard variant="grid" imageAspect="aspect-[4/3]" />
);

/**
 * TechSpecsDetailsSkeleton — Full-page detail skeleton with hero image,
 * title block, stat strip, and 3 spec sections. Page-level layout — does
 * not map to a single card primitive, so we keep it bespoke (built on
 * top of <Skeleton /> atoms for theme consistency).
 */
export const TechSpecsDetailsSkeleton = () => (
  <div aria-hidden="true">
    <Section className="pt-24 md:pt-28 pb-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between mb-6">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>

        <Skeleton className="w-full aspect-[4/3] md:aspect-[16/9] rounded-[2rem] mb-8" />

        <div className="mb-8">
          <div className="flex justify-between mb-4">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-6 w-20" />
          </div>
          <Skeleton className="h-8 w-2/3 mb-4" />
          <Skeleton className="h-4 w-1/2 mb-6" />

          <div className="grid grid-cols-4 gap-4 bg-card rounded-2xl border border-border p-4 mb-10">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <Skeleton className="h-6 w-6 rounded-full" />
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-card rounded-3xl border border-border p-6">
              <div className="flex items-center gap-4 mb-6">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <Skeleton className="h-6 w-1/3" />
              </div>
              <div className="space-y-4">
                {[1, 2, 3, 4].map((j) => (
                  <div key={j} className="flex justify-between border-b border-border pb-4 last:border-0">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-4 w-1/4" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  </div>
);
