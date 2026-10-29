/**
 * useAvailableSearchOptions
 * -------------------------
 * Frontend-only filter that intersects the (admin-managed) reference catalog
 * with the actual listing facets returned by the backend so the hero search
 * bar only proposes brands / types / locations that have at least one live
 * listing. Models for a chosen brand are derived from a small targeted query
 * so users never get zero-result combinations.
 *
 * No business logic / persistence is touched — purely a presentation guard.
 */
import { useMemo } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useListingFacets } from './useListings';
import { listingsApi } from '../services/listingsApi';

/** Fetch distinct models that actually exist in active listings for a brand. */
const useAvailableModelsForBrand = (brand?: string, type?: string) =>
  useQuery<string[]>({
    queryKey: ['search-options', 'models-by-brand', brand || 'none', type || 'any'],
    enabled: !!brand,
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 5,
    queryFn: async ({ signal }) => {
      // Pull a wide slice (capped) and reduce to distinct model names.
      const { listings } = await listingsApi.list(
        { brand, type, page: 1, limit: 200, status: 'active' },
        signal,
      );
      const set = new Set<string>();
      for (const l of listings) {
        if (l.model && typeof l.model === 'string') set.add(l.model);
      }
      return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'));
    },
  });

export interface AvailableSearchOptions {
  /** Set of types (Moto/Scooter/…) that have ≥1 listing. */
  availableTypes: Set<string>;
  /** Map brand name → live count, lower-cased keys for case-insensitive lookups. */
  brandCounts: Map<string, number>;
  /** Set of governorate names that have ≥1 listing (used to gate cities). */
  availableGovernorates: Set<string>;
  /** Distinct models available for the currently chosen brand (empty if none). */
  availableModels: string[];
  /** Loading flags so callers can show skeletons / disable while fetching. */
  isLoadingFacets: boolean;
  isLoadingModels: boolean;
}

/**
 * @param brand currently selected brand (used to scope the model list)
 * @param type  currently selected vehicle type (re-queries facets so brand
 *              counts are accurate within that type)
 */
export function useAvailableSearchOptions(
  brand?: string,
  type?: string,
): AvailableSearchOptions {
  // Facets without a brand filter — gives accurate brand bucket counts.
  const { data: globalFacets, isLoading: isLoadingFacets } = useListingFacets(
    type ? { type } : undefined,
  );

  const { data: modelList = [], isLoading: isLoadingModels } =
    useAvailableModelsForBrand(brand, type);

  return useMemo(() => {
    const availableTypes = new Set<string>(
      (globalFacets?.type || []).map((b) => b.key).filter(Boolean),
    );
    const brandCounts = new Map<string, number>();
    for (const b of globalFacets?.brand || []) {
      if (b?.key) brandCounts.set(b.key.toLowerCase(), b.count);
    }
    // Lower-cased for case-insensitive matching against the cities catalog
    // (admin entries can be "Tunis" while facets may return "tunis").
    const availableGovernorates = new Set<string>(
      (globalFacets?.governorate || [])
        .map((b) => (b.key || '').toLowerCase())
        .filter(Boolean),
    );

    return {
      availableTypes,
      brandCounts,
      availableGovernorates,
      availableModels: modelList,
      isLoadingFacets,
      isLoadingModels,
    };
  }, [globalFacets, modelList, isLoadingFacets, isLoadingModels]);
}
