/**
 * Tips API + mapper.
 */
import { apiClient } from './apiClient';
import { Tip } from '../types';
import { resolveEditorial } from '../utils/publicContent';

const FALLBACK_IMAGE = 'https://www.moto-scoot.tn/content-fallbacks/tip-default.jpg';

export interface BackendTip {
  // UUID strings in the new backend; kept loose for legacy numeric ids.
  id: number | string;
  slug?: string;
  title: string;
  category?: string;
  cover_image?: string;
  image?: string;
  published_at?: string;
  created_at?: string;
  read_time?: string | number;
  reading_time?: string | number;
  author?: string | { full_name?: string; name?: string };
  author_name?: string;
  excerpt?: string;
  summary?: string;
  content?: string;
  body?: string;
  difficulty?: string;
  tools?: string[];
}

const VALID_CATEGORIES = ['Entretien', 'Sécurité', 'Équipement', 'Conduite', 'Législation'];
const VALID_DIFFICULTY = ['Débutant', 'Intermédiaire', 'Expert'];

function normalizeCategory(c?: string): Tip['category'] {
  if (!c) return 'Entretien';
  const found = VALID_CATEGORIES.find((v) => v.toLowerCase() === c.toLowerCase());
  return (found || 'Entretien') as Tip['category'];
}

function normalizeDifficulty(d?: string): Tip['difficulty'] {
  if (!d) return 'Débutant';
  const found = VALID_DIFFICULTY.find((v) => v.toLowerCase() === d.toLowerCase());
  return (found || 'Débutant') as Tip['difficulty'];
}

function formatDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function mapBackendTip(t: BackendTip): Tip {
  const author =
    t.author_name ||
    (typeof t.author === 'string' ? t.author : t.author?.full_name || t.author?.name) ||
    'MotoScoot';
  const rt = t.read_time ?? t.reading_time;
  return {
    id: t.id,
    title: t.title,
    category: normalizeCategory(t.category),
    summary: t.excerpt || t.summary || '',
    content: t.content || t.body,
    tools: t.tools,
    image: t.cover_image || t.image || FALLBACK_IMAGE,
    date: formatDate(t.published_at || t.created_at),
    author,
    readTime: rt ? `${String(rt).replace(/\s*min\s*$/i, '')} min` : '5 min',
    difficulty: normalizeDifficulty(t.difficulty),
  };
}

export const tipsApi = {
  async list(params?: { category?: string; search?: string; page?: number; limit?: number }, signal?: AbortSignal): Promise<Tip[]> {
    const data = await apiClient.get<BackendTip[] | { tips: BackendTip[] }>(
      '/tips',
      { query: params as any, signal },
    );
    const arr = Array.isArray(data) ? data : data.tips || [];
    return arr.map(mapBackendTip);
  },

  async getById(id: number | string, signal?: AbortSignal): Promise<Tip> {
    const data = await resolveEditorial<BackendTip>(id,
      key => apiClient.get<BackendTip>(`/tips/${encodeURIComponent(key)}`, { signal }),
      async page => {
        const list = await apiClient.get<BackendTip[] | { tips: BackendTip[]; pagination?: { totalPages?: number } }>('/tips', { query: { page, limit: 100 }, signal });
        return { rows: Array.isArray(list) ? list : list.tips || [], totalPages: Array.isArray(list) ? undefined : list.pagination?.totalPages };
      });
    return mapBackendTip(data);
  },

  async getRelated(id: number | string, signal?: AbortSignal): Promise<Tip[]> {
    const data = await apiClient.get<BackendTip[] | { tips: BackendTip[] }>(
      `/tips/${id}/related`,
      { signal },
    );
    const arr = Array.isArray(data) ? data : data.tips || [];
    return arr.map(mapBackendTip);
  },

  async getCategories(signal?: AbortSignal): Promise<string[]> {
    const data = await apiClient.get<string[] | { categories: string[] }>('/tips/categories', { signal });
    return Array.isArray(data) ? data : data.categories || [];
  },
};

export default tipsApi;
