/**
 * Tech Specs API + mapper between backend and frontend TechSpec type.
 */
import { apiClient } from './apiClient';
import { TechSpec } from '../types';
import { registerSpecSlug } from '../utils/publicIds';
import { PLACEHOLDER_LISTING } from '../utils/urlUtils';

// Default moto image shown when a fiche technique has no uploaded photo yet.
// Uses the bundled placeholder (always available) — the old remote
// spec-default.jpg URL 404s.
const FALLBACK_IMAGE = PLACEHOLDER_LISTING;

type TechSpecsVisibilityOptions = {
  availableInTunisia?: boolean;
  signal?: AbortSignal;
};

function normalizeOptions(options?: AbortSignal | TechSpecsVisibilityOptions): TechSpecsVisibilityOptions {
  if (!options) return {};
  if (typeof AbortSignal !== 'undefined' && options instanceof AbortSignal) return { signal: options };
  return options as TechSpecsVisibilityOptions;
}

function visibilityQuery(availableInTunisia?: boolean) {
  return availableInTunisia ? { available_in_tunisia: true } : undefined;
}

export interface BackendTechSpec {
  id: number;
  brand: string;
  model: string;
  year: number | string;
  category?: string;
  price_new?: number | string;
  image?: string;
  cover_image?: string;
  gallery?: string[];
  // engine
  engine_type?: string;
  engine_cc?: string | number;
  engine_power?: string;
  engine_torque?: string;
  fuel_system?: string;
  cooling?: string;
  transmission?: string;
  // chassis
  frame?: string;
  suspension_front?: string;
  travel_front?: string;
  suspension_rear?: string;
  travel_rear?: string;
  brakes_front?: string;
  brakes_rear?: string;
  tire_front?: string;
  tire_rear?: string;
  // electronics
  abs?: string;
  tcs?: string;
  riding_modes?: string;
  quickshifter?: string;
  // dimensions
  weight?: string | number;
  seat_height?: string | number;
  tank?: string | number;
  length?: string | number;
  wheelbase?: string | number;
  // misc
  consumption?: string;
  top_speed?: string;
  norm_logo?: string;
  importer_id?: string | null;
  importer?: any | null;
  // free-form (already-shaped objects)
  engine?: any;
  chassis?: any;
  electronics?: any;
  dimensions?: any;
}

const VALID_CATEGORIES = ['Roadster', 'Sportive', 'Trail', 'Scooter', 'Custom', 'Off-road'];

function normalizeCategory(c?: string): TechSpec['category'] {
  if (!c) return 'Roadster';
  const found = VALID_CATEGORIES.find((v) => v.toLowerCase() === c.toLowerCase());
  return (found || 'Roadster') as TechSpec['category'];
}

function fmtPrice(v?: number | string): string {
  if (v === null || v === undefined || v === '') return '—';
  const str = String(v).trim();
  if (!str) return '—';
  // If it's a pure number, format with thousand separators + DT.
  // Otherwise (e.g. "Sur demande", "À partir de 35 000 DT", "N/C"), display as-is.
  const isPureNumber = /^-?\d+(\.\d+)?$/.test(str);
  if (isPureNumber) {
    const n = parseFloat(str);
    if (isFinite(n)) return `${n.toLocaleString('fr-FR')} DT`;
  }
  return str;
}

function s(v: any): string {
  return v == null ? '' : String(v);
}

export function mapBackendTechSpec(b: BackendTechSpec): TechSpec {
  registerSpecSlug(b.id, (b as any).slug);
  // Always return fully-shaped sub-objects with string values, even when
  // the backend payload is partial. The UI calls `.split(' ')`, `.split(',')`
  // and other string methods on these fields without guarding — a single
  // missing key would crash the whole fiche-technique page.
  const e = b.engine || {};
  const engine = {
    type: s(e.type ?? b.engine_type),
    cc: s(e.cc ?? b.engine_cc),
    power: s(e.power ?? b.engine_power),
    torque: s(e.torque ?? b.engine_torque),
    fuelSystem: s(e.fuelSystem ?? b.fuel_system),
    cooling: s(e.cooling ?? b.cooling),
    transmission: s(e.transmission ?? b.transmission),
  };
  const c = b.chassis || {};
  const chassis = {
    frame: s(c.frame ?? b.frame),
    suspensionFront: s(c.suspensionFront ?? b.suspension_front),
    travelFront: s(c.travelFront ?? b.travel_front),
    suspensionRear: s(c.suspensionRear ?? b.suspension_rear),
    travelRear: s(c.travelRear ?? b.travel_rear),
    brakesFront: s(c.brakesFront ?? b.brakes_front),
    brakesRear: s(c.brakesRear ?? b.brakes_rear),
    tireFront: s(c.tireFront ?? b.tire_front),
    tireRear: s(c.tireRear ?? b.tire_rear),
  };
  const el = b.electronics || {};
  const electronics = {
    abs: s(el.abs ?? b.abs),
    tcs: s(el.tcs ?? b.tcs),
    ridingModes: s(el.ridingModes ?? b.riding_modes),
    quickshifter: s(el.quickshifter ?? b.quickshifter),
    lighting: s(el.lighting),
    usb: s(el.usb),
    dashboard: s(el.dashboard),
    connectivity: s(el.connectivity),
    cruiseControl: s(el.cruiseControl),
    keyless: s(el.keyless),
    other: s(el.other),
  };
  const m = (b as any).maintenance || {};
  const maintenance = {
    warranty: s(m.warranty),
    firstService: s(m.firstService),
    serviceInterval: s(m.serviceInterval),
  };
  const d = b.dimensions || {};
  const dimensions = {
    weight: s(d.weight ?? b.weight),
    seatHeight: s(d.seatHeight ?? b.seat_height),
    tank: s(d.tank ?? b.tank),
    length: s(d.length ?? b.length),
    wheelbase: s(d.wheelbase ?? b.wheelbase),
  };

  return {
    id: b.id,
    brand: b.brand,
    model: b.model,
    year: typeof b.year === 'string' ? parseInt(b.year, 10) : b.year,
    category: normalizeCategory(b.category),
    priceNew: fmtPrice(b.price_new),
    image: b.cover_image || b.image || FALLBACK_IMAGE,
    gallery: b.gallery,
    engine,
    chassis,
    electronics,
    maintenance,
    slug: (b as any).slug || undefined,
    dimensions,
    consumption: b.consumption,
    topSpeed: b.top_speed,
    normLogo: b.norm_logo,
    importer: b.importer || null,
    importerId: b.importer_id ?? (b.importer ? b.importer.id : null) ?? null,
  };
}

export const techSpecsApi = {
  async getBrands(options?: AbortSignal | TechSpecsVisibilityOptions): Promise<string[]> {
    const { signal, availableInTunisia } = normalizeOptions(options);
    const data = await apiClient.get<any>('/tech-specs/brands', {
      signal,
      query: visibilityQuery(availableInTunisia),
    });
    if (Array.isArray(data)) {
      // Backend returns rows shaped like `{ brand, models_count }`
      // (see techSpecsController.getBrands). Older payloads used `{ name }`
      // or a plain string array — accept all three to stay future-proof.
      return data
        .map((b) => (typeof b === 'string' ? b : b.brand || b.name))
        .filter(Boolean);
    }
    return data?.brands || [];
  },

  async getModels(brand: string, options?: AbortSignal | TechSpecsVisibilityOptions): Promise<TechSpec[]> {
    const { signal, availableInTunisia } = normalizeOptions(options);
    const data = await apiClient.get<BackendTechSpec[] | { models: BackendTechSpec[] }>(
      `/tech-specs/brands/${encodeURIComponent(brand)}`,
      { signal, query: visibilityQuery(availableInTunisia) },
    );
    const arr = Array.isArray(data) ? data : data.models || [];
    return arr.map(mapBackendTechSpec);
  },

  async getById(id: number | string, signal?: AbortSignal): Promise<TechSpec> {
    const safeId = encodeURIComponent(String(id));
    const data = await apiClient.get<BackendTechSpec>(`/tech-specs/${safeId}`, { signal });
    return mapBackendTechSpec(data);
  },

  /** Full public catalogue (used by the comparator picker). */
  async getAll(signal?: AbortSignal): Promise<TechSpec[]> {
    // Brand endpoints are exhaustive even on API versions that cap /popular.
    // Fail as a whole rather than silently publish an incomplete comparison catalog.
    const brands = await techSpecsApi.getBrands({ signal });
    const models: TechSpec[] = [];
    for (let offset = 0; offset < brands.length; offset += 4) {
      const batch = await Promise.all(brands.slice(offset, offset + 4).map(brand => techSpecsApi.getModels(brand, { signal })));
      models.push(...batch.flat());
    }
    return [...new Map(models.map(model => [String(model.id), model])).values()]
      .sort((a, b) => `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`, 'fr'));
  },

  async getPopular(signal?: AbortSignal): Promise<TechSpec[]> {
    const data = await apiClient.get<BackendTechSpec[] | { specs: BackendTechSpec[] }>(
      '/tech-specs/popular',
      { signal },
    );
    const arr = Array.isArray(data) ? data : data.specs || [];
    return arr.map(mapBackendTechSpec);
  },

  /**
   * Cross-field public search. Backend returns rows where the term matches
   * brand, model, category, year, cylindrée, puissance, top_speed, transmission,
   * frame, ABS/TCS labels, etc. — letting the user find a fiche by any of
   * its visible attributes, not only by brand or model name.
   */
  async searchAll(q: string, limit = 30, options?: AbortSignal | TechSpecsVisibilityOptions): Promise<TechSpec[]> {
    const { signal, availableInTunisia } = normalizeOptions(options);
    const term = q.trim();
    if (!term) return [];
    const data = await apiClient.get<BackendTechSpec[] | { specs: BackendTechSpec[] }>(
      '/tech-specs/search',
      { query: { q: term, limit, ...visibilityQuery(availableInTunisia) }, signal },
    );
    const arr = Array.isArray(data) ? data : data.specs || [];
    return arr.map(mapBackendTechSpec);
  },
  async getPopularPage(
    params: { limit?: number; cursor?: string | null } = {},
    signal?: AbortSignal,
  ): Promise<{ items: TechSpec[]; nextCursor: string | null }> {
    const query: Record<string, any> = {
      mode: 'cursor',
      limit: params.limit ?? 12,
    };
    if (params.cursor) query.cursor = params.cursor;
    const data = await apiClient.get<{ specs: BackendTechSpec[]; nextCursor: string | null }>(
      '/tech-specs/popular',
      { query, signal },
    );
    return {
      items: (data.specs || []).map(mapBackendTechSpec),
      nextCursor: data.nextCursor ?? null,
    };
  },

  async getCategories(signal?: AbortSignal): Promise<string[]> {
    const data = await apiClient.get<string[] | { categories: string[] }>('/tech-specs/categories', { signal });
    return Array.isArray(data) ? data : data.categories || [];
  },

  async compare(ids: Array<number | string>): Promise<TechSpec[]> {
    const data = await apiClient.post<BackendTechSpec[] | { specs: BackendTechSpec[] }>('/tech-specs/compare', { ids });
    const arr = Array.isArray(data) ? data : data.specs || [];
    return arr.map(mapBackendTechSpec);
  },

  async getLatest(limit = 3, signal?: AbortSignal): Promise<TechSpec[]> {
    const data = await apiClient.get<BackendTechSpec[] | { specs: BackendTechSpec[] }>(
      '/tech-specs/latest',
      { query: { limit }, signal },
    );
    const arr = Array.isArray(data) ? data : data.specs || [];
    return arr.map(mapBackendTechSpec);
  },

  /** Best-effort: bumps brand_visits + model_visits counters. */
  async trackVisit(id: number | string): Promise<void> {
    try {
      await apiClient.post(`/tech-specs/${encodeURIComponent(String(id))}/visit`, {});
    } catch {
      /* tracking is best-effort */
    }
  },
};

export default techSpecsApi;
