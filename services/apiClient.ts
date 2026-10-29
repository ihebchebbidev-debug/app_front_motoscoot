/**
 * Central API client for the MotoScoot backend.
 *
 * - Base URL is taken from VITE_API_BASE_URL (e.g. https://api.moto-scoot.tn/api).
 * - Falls back to "/api" in development (proxied by Vite).
 * - Automatically attaches the JWT stored in localStorage (key: "auth_token").
 * - Handles JSON parsing, query strings, AbortSignal, and error normalization.
 */

export interface ApiError extends Error {
  status: number;
  data?: any;
  code?: string;
  /** X-Request-Id returned by the backend (or generated client-side) for log correlation. */
  requestId?: string;
}

/**
 * Generate a short, URL-safe request id (16 hex chars).
 *
 * Prefer `crypto.randomUUID()` (122 bits of entropy) and slice 16 hex chars
 * (64 bits). For the fallback path we ALSO build the id from `crypto
 * .getRandomValues` when available so we keep CSPRNG-quality entropy on
 * older browsers without `randomUUID`. `Math.random` is the very last
 * resort (very weak, but never used in modern environments).
 */
function generateRequestId(): string {
  const c: any = typeof crypto !== 'undefined' ? crypto : null;
  if (c?.randomUUID) {
    return c.randomUUID().replace(/-/g, '').slice(0, 16);
  }
  if (c?.getRandomValues) {
    const bytes = new Uint8Array(8);
    c.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/**
 * Hardcoded production backend URL.
 * Override only for local development by setting VITE_API_BASE_URL
 * (e.g. "/api" with the Vite dev proxy, or "http://localhost:4000/api").
 */
export const PRODUCTION_API_URL = 'https://motoscoot.ihebchebbi.pro/api';

const RAW_BASE =
  (import.meta as any).env?.VITE_API_BASE_URL || PRODUCTION_API_URL;

// Strip trailing slash for consistent joining
export const API_BASE_URL = String(RAW_BASE).replace(/\/+$/, '');

const PUBLIC_SITE_ORIGIN = 'https://www.moto-scoot.tn';

/**
 * Origin (scheme + host) of the backend API, derived from API_BASE_URL.
 * Used to absolutize any "/uploads/..." string returned by the backend.
 */
export const API_ORIGIN: string = (() => {
  try {
    const u = new URL(API_BASE_URL, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    return `${u.protocol}//${u.host}`;
  } catch {
    return '';
  }
})();

/**
 * Walk a JSON-decoded value and rewrite every string that starts with
 * "/uploads/" into an absolute URL pointing at the API host. Mutates in
 * place — the data has just been parsed and is not shared yet.
 *
 * Why at the network layer? 30+ components do `<img src={obj.image}>` directly,
 * and avatars / shop logos / garage covers / article covers all came back as
 * relative "/uploads/..." which broke cross-origin rendering. Doing it once
 * here guarantees no relative upload URL ever reaches the UI.
 */
function absolutizeUploads(value: any, seen?: WeakSet<object>): any {
  if (!API_ORIGIN || value == null || typeof value !== 'object') return value;
  const guard = seen || new WeakSet<object>();
  if (guard.has(value)) return value;
  guard.add(value);
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const v = value[i];
      if (typeof v === 'string') {
        if (v.startsWith('/uploads/')) value[i] = `${API_ORIGIN}${v}`;
      } else if (v && typeof v === 'object') {
        absolutizeUploads(v, guard);
      }
    }
    return value;
  }

  for (const k in value) {
    if (!Object.prototype.hasOwnProperty.call(value, k)) continue;
    const v = (value as any)[k];
    if (typeof v === 'string') {
      if (v.startsWith('/uploads/')) (value as any)[k] = `${API_ORIGIN}${v}`;
    } else if (v && typeof v === 'object') {
      absolutizeUploads(v, guard);
    }
  }
  return value;
}

function rewritePublicAssetUrl(url: string): string {
  if (!url || typeof url !== 'string') return url;
  let out = url.replace(/^http:\/\//i, 'https://');

  if (out.startsWith('/uploads/')) {
    return `${PUBLIC_SITE_ORIGIN}${out}`;
  }

  out = out.replace(/^https:\/\/(www\.)?motoscoot\.ihebchebbi\.pro(?=\/|$)/i, PUBLIC_SITE_ORIGIN);

  out = out.replace(
    /^https:\/\/www\.magma-studio\.tn\/portfolio2\/moto\/Logo\/brand%20logo\/([^?#]+)$/i,
    `${PUBLIC_SITE_ORIGIN}/brand-logos/$1`,
  );
  out = out.replace(
    /^https:\/\/www\.magma-studio\.tn\/portfolio2\/moto\/Logo\/([^?#]+)$/i,
    `${PUBLIC_SITE_ORIGIN}/site-logo/$1`,
  );
  out = out.replace(
    /^https:\/\/(www\.)?magma-studio\.tn\/portfolio2\/([^?#]+)$/i,
    `${PUBLIC_SITE_ORIGIN}/hero-assets/$2`,
  );
  out = out.replace(
    /^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/thumb\/1\/12\/Suzuki_logo_2\.svg\/2560px-Suzuki_logo_2\.svg\.png$/i,
    `${PUBLIC_SITE_ORIGIN}/brand-logos/Suzuki.svg`,
  );

  return out;
}

function rewriteAssetUrlsDeep(value: any, seen?: WeakSet<object>): any {
  if (value == null) return value;
  if (typeof value === 'string') return rewritePublicAssetUrl(value);
  if (typeof value !== 'object') return value;
  const guard = seen || new WeakSet<object>();
  if (guard.has(value)) return value;
  guard.add(value);

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const v = value[i];
      value[i] = typeof v === 'string' ? rewritePublicAssetUrl(v) : rewriteAssetUrlsDeep(v, guard);
    }
    return value;
  }

  for (const k in value) {
    if (!Object.prototype.hasOwnProperty.call(value, k)) continue;
    const v = (value as any)[k];
    (value as any)[k] = typeof v === 'string' ? rewritePublicAssetUrl(v) : rewriteAssetUrlsDeep(v, guard);
  }
  return value;
}

const TOKEN_KEY = 'auth_token';
const AUTH_TOKEN_CHANGED_EVENT = 'motoscoot:auth-token-changed';

function notifyAuthTokenChanged() {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new Event(AUTH_TOKEN_CHANGED_EVENT));
  } catch {}
}

export const tokenStorage = {
  get(): string | null {
    if (typeof window === 'undefined') return null;
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token: string) {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(TOKEN_KEY, token);
      notifyAuthTokenChanged();
    } catch {}
  },
  clear() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(TOKEN_KEY);
      notifyAuthTokenChanged();
    } catch {}
  },
};

type QueryValue = string | number | boolean | null | undefined;
export type QueryParams = Record<string, QueryValue | QueryValue[]>;

function buildQuery(params?: QueryParams): string {
  if (!params) return '';
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (Array.isArray(value)) {
      value.forEach((v) => {
        if (v !== undefined && v !== null && v !== '') sp.append(key, String(v));
      });
    } else {
      sp.append(key, String(value));
    }
  });
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: any;
  query?: QueryParams;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** Skip Authorization header even if a token exists */
  noAuth?: boolean;
  /** Return raw Response instead of parsed JSON */
  raw?: boolean;
}

async function request<T = any>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, headers = {}, signal, noAuth, raw } = options;

  const url = `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}${buildQuery(query)}`;

  const finalHeaders: Record<string, string> = {
    Accept: 'application/json',
    ...headers,
  };

  // Always send a client-generated request id so the backend can echo it in its logs.
  const clientReqId = generateRequestId();
  if (!finalHeaders['X-Request-Id'] && !finalHeaders['x-request-id']) {
    finalHeaders['X-Request-Id'] = clientReqId;
  }

  let payload: BodyInit | undefined;
  if (body !== undefined && body !== null) {
    if (body instanceof FormData) {
      payload = body; // browser sets the multipart boundary
    } else {
      finalHeaders['Content-Type'] = finalHeaders['Content-Type'] || 'application/json';
      payload = JSON.stringify(body);
    }
  }

  if (!noAuth) {
    const token = tokenStorage.get();
    if (token) finalHeaders.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: finalHeaders,
      body: payload,
      signal,
    });
  } catch (err: any) {
    if (err?.name === 'AbortError') throw err;
    const networkError: ApiError = Object.assign(new Error('Connexion impossible. Vérifiez votre connexion internet et réessayez.'), {
      status: 0,
      code: 'NETWORK_ERROR',
      requestId: clientReqId,
    });
    throw networkError;
  }

  // Backend returns the canonical id (it may have generated its own if we omitted ours)
  const serverReqId = response.headers.get('x-request-id') || clientReqId;

  if (raw) return response as unknown as T;

  // 204 / empty body
  if (response.status === 204) return undefined as unknown as T;

  let data: any = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
      // Rewrite every "/uploads/..." string in the response into an absolute
      // URL so any UI consumer (including direct <img src>) gets a working URL.
      data = absolutizeUploads(data);
      data = rewriteAssetUrlsDeep(data);
    } catch {
      data = null;
    }
  } else {
    try {
      data = await response.text();
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    // Default FR fallback per HTTP status — used only when the backend did
    // not return a message (or returned an English `statusText` like
    // "Bad Gateway"). Backend-supplied messages are already in French and
    // win when present.
    const FR_STATUS: Record<number, string> = {
      400: 'Requête invalide. Vérifiez les informations saisies.',
      401: 'Vous devez être connecté pour effectuer cette action.',
      403: "Vous n'avez pas les droits nécessaires pour cette action.",
      404: 'Ressource introuvable.',
      408: 'Délai dépassé. Veuillez réessayer.',
      409: 'Conflit : cette ressource existe déjà.',
      413: 'Le fichier est trop volumineux.',
      422: 'Les données fournies sont invalides.',
      429: 'Trop de requêtes. Veuillez patienter quelques instants.',
      500: "Une erreur est survenue côté serveur. Réessayez dans un instant.",
      502: 'Service momentanément indisponible. Réessayez dans un instant.',
      503: 'Service indisponible. Réessayez dans quelques instants.',
      504: 'Délai dépassé côté serveur. Réessayez.',
    };
    const backendMessage = data && (data.error || data.message);
    const message =
      backendMessage ||
      FR_STATUS[response.status] ||
      `Erreur ${response.status}. Veuillez réessayer.`;
    const error: ApiError = Object.assign(new Error(message), {
      status: response.status,
      data,
      code: data?.code,
      requestId: serverReqId,
    });

    // Auto-clear stale token on 401, BUT only when the failing request actually
    // sent an Authorization header. A public endpoint that returns 401 (e.g.
    // misconfigured /api/listings/popular) should NOT log the user out.
    const sentAuth = !!finalHeaders.Authorization;
    if (response.status === 401 && !noAuth && sentAuth) {
      tokenStorage.clear();
    }

    // Surface backend correlation id in the console for easier debugging
    if (typeof console !== 'undefined') {
      // eslint-disable-next-line no-console
      console.warn(`[API ${response.status}] ${method} ${path} (req ${serverReqId})`, message);
    }
    throw error;
  }

  return data as T;
}

export const apiClient = {
  baseUrl: API_BASE_URL,
  request,
  get: <T = any>(path: string, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...opts, method: 'GET' }),
  post: <T = any>(path: string, body?: any, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...opts, method: 'POST', body }),
  put: <T = any>(path: string, body?: any, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...opts, method: 'PUT', body }),
  patch: <T = any>(path: string, body?: any, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...opts, method: 'PATCH', body }),
  // DELETE accepts an optional body, but many corporate proxies / CDNs strip
  // request bodies on DELETE. Callers that need to send a payload should use
  // `deleteWithPayload` below which encodes it as a query string instead.
  delete: <T = any>(path: string, opts?: Omit<RequestOptions, 'method'>) =>
    request<T>(path, { ...opts, method: 'DELETE' }),
};

/**
 * Send a DELETE whose payload is encoded into the URL query string.
 * Use this whenever a proxy might strip the request body (admin role removal,
 * etc.). The backend should accept the param either via body OR query.
 */
export function deleteWithPayload<T = any>(
  path: string,
  payload: Record<string, any>,
  opts?: Omit<RequestOptions, 'method' | 'body' | 'query'>,
) {
  return request<T>(path, { ...opts, method: 'DELETE', query: payload });
}

export default apiClient;
