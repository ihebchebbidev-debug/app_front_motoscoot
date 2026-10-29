
import React from 'react';
import { Skeleton } from '../ui/Skeleton';

export const ListingDetailsSkeleton: React.FC = () => {
  return (
    <div className="animate-fade-in w-full">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
        {/* Colonne Gauche : Galerie + Infos */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-6">
          {/* Gallery Skeleton */}
          <div className="space-y-4">
            <Skeleton className="aspect-[4/3] md:aspect-video rounded-2xl w-full" />
            <div className="flex gap-3 overflow-hidden">
               {[...Array(4)].map((_, i) => (
                 <Skeleton key={i} className="w-24 h-18 md:w-32 md:h-24 rounded-xl shrink-0" />
               ))}
            </div>
          </div>
          
          <div className="pt-2 md:pt-0 space-y-6">
            <div className="space-y-3">
              <Skeleton className="h-6 w-24 rounded-full" />
              <div className="flex flex-col md:flex-row justify-between gap-4">
                <Skeleton className="h-12 w-2/3 rounded-xl" />
                <Skeleton className="h-10 w-32 rounded-xl" />
              </div>
            </div>
            
            {/* Specs Grid Skeleton */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-2xl" />
              ))}
            </div>
          </div>

          {/* Blocks Skeleton */}
          <div className="space-y-4">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="bg-card rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                <div className="p-6 border-b border-gray-50">
                  <Skeleton className="h-4 w-32" />
                </div>
                <div className="p-8 space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-4 w-4/6" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Colonne Droite : Sidebar Skeleton */}
        <div className="lg:col-span-5 xl:col-span-4">
          <div className="bg-card rounded-2xl p-6 md:p-8 border border-gray-100 space-y-8 shadow-sm">
            <div className="space-y-3">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-10 w-48" />
            </div>
            
            <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-4">
              <Skeleton className="w-12 h-12 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <div className="flex gap-2">
                   <Skeleton className="h-3 w-16" />
                   <Skeleton className="h-3 w-20" />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Skeleton className="h-12 rounded-xl" />
                <Skeleton className="h-12 rounded-xl" />
              </div>
              <Skeleton className="h-14 rounded-xl w-full" />
            </div>

            <div className="pt-4 border-t border-gray-50">
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
