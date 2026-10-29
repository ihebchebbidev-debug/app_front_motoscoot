/**
 * Articles API + mapper.
 */
import { apiClient } from './apiClient';
import { Article } from '../types';
import { resolveEditorial } from '../utils/publicContent';

const FALLBACK_IMAGE = 'https://www.moto-scoot.tn/content-fallbacks/article-default.jpg';

export interface BackendArticle {
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
  tags?: string[];
  is_featured?: boolean;
}

const VALID_CATEGORIES = ['Nouveautés', 'Essais', 'Tech', 'Scooters', 'Électrique'];

function normalizeCategory(c?: string): Article['category'] {
  if (!c) return 'Nouveautés';
  const found = VALID_CATEGORIES.find((v) => v.toLowerCase() === c.toLowerCase());
  return (found || 'Nouveautés') as Article['category'];
}

function formatDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function mapBackendArticle(a: BackendArticle): Article {
  const author =
    a.author_name ||
    (typeof a.author === 'string' ? a.author : a.author?.full_name || a.author?.name) ||
    'MotoScoot';
  const rt = a.read_time ?? a.reading_time;
  return {
    id: a.id,
    title: a.title,
    category: normalizeCategory(a.category),
    image: a.cover_image || a.image || FALLBACK_IMAGE,
    date: formatDate(a.published_at || a.created_at),
    readTime: rt ? `${String(rt).replace(/\s*min\s*$/i, '')} min` : '5 min',
    author,
    summary: a.excerpt || a.summary || '',
    content: a.content || a.body,
    tags: a.tags,
    isFeatured: !!a.is_featured,
  };
}

export const articlesApi = {
  async list(params?: { category?: string; search?: string; page?: number; limit?: number }, signal?: AbortSignal): Promise<Article[]> {
    const data = await apiClient.get<BackendArticle[] | { articles: BackendArticle[] }>(
      '/articles',
      { query: params as any, signal },
    );
    const arr = Array.isArray(data) ? data : data.articles || [];
    return arr.map(mapBackendArticle);
  },

  async getById(id: number | string, signal?: AbortSignal): Promise<Article> {
    // Backend exposes /articles/:slug — id can be slug, UUID, or numeric id.
    const data = await resolveEditorial<BackendArticle>(id,
      key => apiClient.get<BackendArticle>(`/articles/${encodeURIComponent(key)}`, { signal }),
      async page => {
        const list = await apiClient.get<BackendArticle[] | { articles: BackendArticle[]; pagination?: { totalPages?: number } }>('/articles', { query: { page, limit: 100 }, signal });
        return { rows: Array.isArray(list) ? list : list.articles || [], totalPages: Array.isArray(list) ? undefined : list.pagination?.totalPages };
      });
    return mapBackendArticle(data);
  },

  async getRelated(id: number | string, signal?: AbortSignal): Promise<Article[]> {
    const data = await apiClient.get<BackendArticle[] | { articles: BackendArticle[] }>(
      `/articles/${id}/related`,
      { signal },
    );
    const arr = Array.isArray(data) ? data : data.articles || [];
    return arr.map(mapBackendArticle);
  },

  async getCategories(signal?: AbortSignal): Promise<string[]> {
    const data = await apiClient.get<string[] | { categories: string[] }>('/articles/categories', { signal });
    return Array.isArray(data) ? data : data.categories || [];
  },

  async getFeatured(signal?: AbortSignal): Promise<Article[]> {
    const data = await apiClient.get<BackendArticle[] | { articles: BackendArticle[] }>(
      '/articles/featured',
      { signal },
    );
    const arr = Array.isArray(data) ? data : data.articles || [];
    return arr.map(mapBackendArticle);
  },
};

export default articlesApi;
