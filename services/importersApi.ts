/**
 * Public + admin APIs for the importers (importateurs) catalog.
 * The public endpoints are read-only; admin CRUD goes through `adminApi`.
 */
import { apiClient } from './apiClient';
import { Importer } from '../types';

export const importersApi = {
  list(
    opts: { withBrands?: boolean; activeOnly?: boolean } = {},
    signal?: AbortSignal,
  ): Promise<Importer[]> {
    const query: Record<string, any> = {};
    if (opts.withBrands) query.with_brands = 'true';
    if (opts.activeOnly) query.active = 'true';
    return apiClient
      .get<{ importers: Importer[] }>('/importers', { query, signal })
      .then((d) => d.importers || []);
  },
  getById(id: string, signal?: AbortSignal): Promise<Importer> {
    return apiClient.get<Importer>(`/importers/${encodeURIComponent(id)}`, { signal });
  },
};

export default importersApi;