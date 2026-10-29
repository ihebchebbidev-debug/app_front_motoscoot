import { useState, useCallback, useEffect, useTransition, useRef, useMemo } from 'react';
import { SearchFilters } from '../types';
import type { ListingsListParams } from '../services/listingsApi';

export type SortOption = 'recent' | 'price_asc' | 'price_desc' | 'year_desc' | 'km_asc' | 'proximity';

export interface FilterState {
  search: string;
  seller: string;
  sellerId: string | number | '';
  type: string;
  brand: string;
  model: string;
  location: string;
  onlyPro: boolean;
  conditions: string[];
  minYear: number;
  maxYear: number;
  minKm: number;
  maxKm: number;
  minPrice: number;
  maxPrice: number;
  minCC: number;
  maxCC: number;
}

export interface UserCoords { lat: number; lng: number }

interface UseListingFiltersOptions {
  onFiltersChange?: (filters: FilterState) => void;
}

const DEFAULT_FILTERS: FilterState = {
  search: '', seller: '', sellerId: '', type: '', brand: '', model: '', location: '',
  onlyPro: false, conditions: [],
  minYear: 2000, maxYear: 2026, minKm: 0, maxKm: 300000,
  minPrice: 0, maxPrice: 200000, minCC: 50, maxCC: 1650,
};

const RANGE_BOUNDS = {
  minYear: 2000, maxYear: 2026,
  minKm: 0, maxKm: 300000,
  minPrice: 0, maxPrice: 200000,
  minCC: 50, maxCC: 1650,
};

const ALL_OPTION_VALUES = new Set([
  'Tous les types', 'Toutes les marques', 'Tous les modèles', 'Toutes les villes',
]);

export const RADIUS_OPTIONS = [10, 25, 50, 100] as const;
export type RadiusKm = typeof RADIUS_OPTIONS[number];

/**
 * Map a frontend FilterState (+ sort + optional geo origin + radius) to the
 * server-side query parameters expected by GET /api/listings.
 *
 * Only forwards values that meaningfully narrow the query — defaults like
 * `minPrice=0` or `Toutes les marques` are stripped so the cache key stays
 * stable and the backend doesn't waste cycles on no-op predicates.
 */
export function filtersToServerParams(
  filters: FilterState,
  sortBy: SortOption[],
  coords: UserCoords | null,
  page: number,
  limit: number,
  radiusKm: RadiusKm = 50,
): ListingsListParams {
  const params: ListingsListParams = { page, limit };
  const v = (s: string) => (s && !ALL_OPTION_VALUES.has(s) ? s : undefined);

  if (v(filters.type)) params.type = filters.type;
  if (v(filters.brand)) params.brand = filters.brand;
  if (v(filters.model)) params.model = filters.model;
  if (v(filters.location)) params.governorate = filters.location;
  if (filters.search) params.search = filters.search;
  if (filters.sellerId) params.user_id = filters.sellerId;
  if (filters.onlyPro) params.only_pro = true;
  if (filters.conditions.includes('Neuf')) params.condition = 'Neuf';
  if (filters.minPrice > RANGE_BOUNDS.minPrice) params.min_price = filters.minPrice;
  if (filters.maxPrice < RANGE_BOUNDS.maxPrice) params.max_price = filters.maxPrice;
  if (filters.minYear > RANGE_BOUNDS.minYear) params.min_year = filters.minYear;
  if (filters.maxYear < RANGE_BOUNDS.maxYear) params.max_year = filters.maxYear;
  if (filters.minKm > RANGE_BOUNDS.minKm) params.min_mileage = filters.minKm;
  if (filters.maxKm < RANGE_BOUNDS.maxKm) params.max_mileage = filters.maxKm;
  if (filters.minCC > RANGE_BOUNDS.minCC) params.min_cc = filters.minCC;
  if (filters.maxCC < RANGE_BOUNDS.maxCC) params.max_cc = filters.maxCC;

  // Sort — backend understands a single sort key. The client previously
  // supported multi-sort but in practice users pick one; we honor the first.
  const primary = sortBy[0] || 'recent';
  const sortMap: Record<SortOption, ListingsListParams['sort']> = {
    recent: 'newest',
    price_asc: 'price_asc',
    price_desc: 'price_desc',
    year_desc: 'year_desc',
    km_asc: 'mileage_asc',
    proximity: 'distance',
  };
  params.sort = sortMap[primary] || 'newest';

  // Geo origin: only attach if the user opted into proximity (or selected the
  // proximity sort). The radius narrows the result set to that bounding circle.
  if (coords && (sortBy.includes('proximity') || params.sort === 'distance')) {
    params.lat = coords.lat;
    params.lng = coords.lng;
    params.radius_km = radiusKm;
    if (params.sort !== 'distance') params.sort = 'distance';
  }
  return params;
}

/**
 * Pure controlled state hook for the search page. Holds filters/sort/geo and
 * debounces text input → committed filter state. No client-side filtering or
 * sorting — that's all done server-side via filtersToServerParams.
 */
export const useListingFilters = (
  initialFilters?: SearchFilters | null,
  options?: UseListingFiltersOptions,
) => {
  const [sortBy, setSortBy] = useState<SortOption[]>(['recent']);
  const [userLocation, setUserLocation] = useState<UserCoords | null>(null);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'success' | 'denied' | 'error'>('idle');
  const [radiusKm, setRadiusKmState] = useState<RadiusKm>(50);

  const [isPending, startTransition] = useTransition();
  const commitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (commitTimeoutRef.current) clearTimeout(commitTimeoutRef.current);
    };
  }, []);

  const [searchInputValue, setSearchInputValue] = useState(initialFilters?.search ?? '');

  const [filters, setFilters] = useState<FilterState>({
    ...DEFAULT_FILTERS,
    search: initialFilters?.search ?? '',
    seller: initialFilters?.seller ?? '',
    sellerId: initialFilters?.sellerId ?? '',
    type: initialFilters?.type ?? '',
    brand: initialFilters?.brand ?? '',
    model: initialFilters?.model ?? '',
    location: initialFilters?.location ?? '',
    onlyPro: initialFilters?.onlyPro ?? false,
    conditions: initialFilters?.conditions ?? [],
    minYear: initialFilters?.minYear ?? DEFAULT_FILTERS.minYear,
    maxYear: initialFilters?.maxYear ?? DEFAULT_FILTERS.maxYear,
    minKm: initialFilters?.minKm ?? DEFAULT_FILTERS.minKm,
    maxKm: initialFilters?.maxKm ?? DEFAULT_FILTERS.maxKm,
    minPrice: initialFilters?.minPrice ?? DEFAULT_FILTERS.minPrice,
    maxPrice: initialFilters?.maxPrice ?? DEFAULT_FILTERS.maxPrice,
    minCC: initialFilters?.minCC ?? DEFAULT_FILTERS.minCC,
    maxCC: initialFilters?.maxCC ?? DEFAULT_FILTERS.maxCC,
  });

  // Debounce search input → committed filter (avoids a refetch on every keystroke)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (filters.search !== searchInputValue) {
        startTransition(() => {
          setFilters(prev => ({ ...prev, search: searchInputValue }));
        });
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInputValue, filters.search]);

  // Push committed filter changes to the URL (debounced) so back/forward works.
  useEffect(() => {
    if (commitTimeoutRef.current) clearTimeout(commitTimeoutRef.current);
    commitTimeoutRef.current = setTimeout(() => {
      if (isMounted.current) options?.onFiltersChange?.(filters);
    }, 600);
    return () => {
      if (commitTimeoutRef.current) clearTimeout(commitTimeoutRef.current);
    };
  }, [filters, options]);

  const handleFilterChange = useCallback((key: keyof FilterState, value: any) => {
    if (key === 'search') {
      setSearchInputValue(value);
    } else {
      startTransition(() => {
        setFilters(prev => ({ ...prev, [key]: value }));
      });
    }
  }, []);

  const handleSortChange = useCallback((nextSort: SortOption[]) => {
    startTransition(() => setSortBy(nextSort));
  }, []);

  const setRadiusKm = useCallback((next: RadiusKm) => {
    startTransition(() => setRadiusKmState(next));
  }, []);

  const resetFilters = useCallback(() => {
    startTransition(() => {
      setSearchInputValue('');
      setFilters(DEFAULT_FILTERS);
      setLocationStatus('idle');
      setUserLocation(null);
      setSortBy(['recent']);
      setRadiusKmState(50);
    });
  }, []);

  const handleLocationDetect = useCallback(() => {
    if (locationStatus === 'success') {
      startTransition(() => {
        setLocationStatus('idle');
        setUserLocation(null);
        setSortBy(prev => prev.filter(s => s !== 'proximity'));
      });
      return;
    }
    if (!navigator.geolocation) { setLocationStatus('error'); return; }
    setLocationStatus('loading');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!isMounted.current) return;
        startTransition(() => {
          setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setLocationStatus('success');
          setSortBy(prev => ['proximity', ...prev.filter(s => s !== 'proximity')]);
        });
      },
      (err) => {
        if (!isMounted.current) return;
        setLocationStatus(err.code === 1 ? 'denied' : 'error');
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 },
    );
  }, [locationStatus]);

  useEffect(() => {
    if (initialFilters?.aroundMe && locationStatus === 'idle') {
      handleLocationDetect();
    }
  }, [initialFilters, locationStatus, handleLocationDetect]);

  // A stable signature of the active filters/sort (used by the page to know
  // when to reset back to page 1).
  const filtersSignature = useMemo(
    () => JSON.stringify({ filters, sortBy, hasGeo: !!userLocation, radiusKm }),
    [filters, sortBy, userLocation, radiusKm],
  );

  return {
    filters,
    searchInputValue,
    handleFilterChange,
    resetFilters,
    sortBy,
    setSortBy: handleSortChange,
    locationStatus,
    handleLocationDetect,
    userLocation,
    radiusKm,
    setRadiusKm,
    isFiltering: isPending,
    filtersSignature,
  };
};
