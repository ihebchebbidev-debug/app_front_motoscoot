/**
 * Centralised hook for backend reference data.
 * One query per endpoint, cached for 30 minutes (data rarely changes).
 *
 * Components should consume this hook instead of importing from
 * `constants/reference` for any list that needs to be admin-managed.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  referenceApi,
  BrandRef,
  ModelRef,
  CityRef,
  NamedRef,
  EquipmentRef,
  ColorRef,
  VehicleCategoryRef,
} from '../services/miscApi';

const CACHE = { staleTime: 1000 * 60 * 30, gcTime: 1000 * 60 * 60 };

/* ---------------- Individual queries ---------------- */
/**
 * Brands list, optionally scoped by vehicle category (Moto/Scooter/Quad)
 * and/or accessory type (Casque, Gant, …). When `accessoryType` is set
 * the backend returns ONLY brands the admin has tagged with that type.
 */
export const useBrands = (category?: string, accessoryType?: string) =>
  useQuery<BrandRef[]>({
    queryKey: ['reference', 'brands', category || 'all', accessoryType || 'any'],
    queryFn: ({ signal }) => referenceApi.getBrands(category, signal, accessoryType),
    ...CACHE,
  });

export const useModels = (brand?: string, accessoryType?: string) =>
  useQuery<ModelRef[]>({
    queryKey: ['reference', 'models', brand || 'all', accessoryType || 'any'],
    queryFn: ({ signal }) => referenceApi.getModels(brand, signal, accessoryType),
    ...CACHE,
  });

export const useCities = (governorate?: string) =>
  useQuery<CityRef[]>({
    queryKey: ['reference', 'cities', governorate || 'all'],
    queryFn: ({ signal }) => referenceApi.getCities(governorate, signal),
    ...CACHE,
  });

export const useGovernorates = () =>
  useQuery<string[]>({
    queryKey: ['reference', 'governorates'],
    queryFn: ({ signal }) => referenceApi.getGovernorates(signal),
    ...CACHE,
  });

/**
 * Legacy hook returning just the category names (`string[]`). Existing
 * callers (TechSpecsTab, SearchBar autocomplete, …) rely on this shape so
 * we keep it intact and add `useVehicleCategoriesRich` below for new UIs
 * that also need image_url / icon_url / description.
 */
export const useVehicleCategories = () =>
  useQuery<string[]>({
    queryKey: ['reference', 'categories'],
    queryFn: async ({ signal }) => {
      const raw = await referenceApi.getCategories(signal);
      // Backend may return either `string[]` or `VehicleCategoryRef[]`.
      return (raw as Array<string | VehicleCategoryRef>).map((c) =>
        typeof c === 'string' ? c : c.name,
      );
    },
    ...CACHE,
  });

/**
 * Returns vehicle categories with their admin-managed visuals (image_url,
 * icon_url) and description. When the backend still serves the legacy
 * `string[]` shape, items are projected to `{ name }` only — UIs should
 * fall back to a default image in that case.
 */
export const useVehicleCategoriesRich = () =>
  useQuery<VehicleCategoryRef[]>({
    queryKey: ['reference', 'categories', 'rich'],
    queryFn: async ({ signal }) => {
      const raw = await referenceApi.getCategories(signal);
      return (raw as Array<string | VehicleCategoryRef>).map((c, i) =>
        typeof c === 'string'
          ? { name: c, position: i }
          : { ...c, position: c.position ?? i },
      );
    },
    ...CACHE,
  });

export const useAccessoryTypes = () =>
  useQuery<NamedRef[]>({
    queryKey: ['reference', 'accessory-types'],
    queryFn: ({ signal }) => referenceApi.getAccessoryTypes(signal),
    ...CACHE,
  });

export const useGarageSpecialties = () =>
  useQuery<NamedRef[]>({
    queryKey: ['reference', 'garage-specialties'],
    queryFn: ({ signal }) => referenceApi.getGarageSpecialties(signal),
    ...CACHE,
  });

export const useGarageServices = () =>
  useQuery<NamedRef[]>({
    queryKey: ['reference', 'garage-services'],
    queryFn: ({ signal }) => referenceApi.getGarageServices(signal),
    ...CACHE,
  });

export const useEquipment = (accessoryType?: string) =>
  useQuery<EquipmentRef[]>({
    queryKey: ['reference', 'equipment', accessoryType || 'bike'],
    queryFn: ({ signal }) => referenceApi.getEquipment(signal, accessoryType),
    ...CACHE,
  });

export const useColors = () =>
  useQuery<ColorRef[]>({
    queryKey: ['reference', 'colors'],
    queryFn: ({ signal }) => referenceApi.getColors(signal),
    ...CACHE,
  });

export const useConditions = () =>
  useQuery<string[]>({
    queryKey: ['reference', 'conditions'],
    queryFn: ({ signal }) => referenceApi.getConditions(signal),
    ...CACHE,
  });

/* ---------------- Convenience helpers ---------------- */

/** Returns the model names for a given brand (server-side filtered).
 *  `accessoryType` further narrows to models tagged with that type. */
export const useModelsByBrand = (brand?: string, accessoryType?: string) => {
  const { data: models = [], ...rest } = useModels(brand, accessoryType);
  const names = useMemo(() => models.map((m) => m.name), [models]);
  return { ...rest, data: models, names };
};

/** Returns city *names* (no governorate metadata). */
export const useCityNames = () => {
  const { data: cities = [], ...rest } = useCities();
  const names = useMemo(() => cities.map((c) => c.name), [cities]);
  return { ...rest, data: cities, names };
};
