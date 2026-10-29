/**
 * Uploads API — wraps the backend `/api/uploads` endpoints.
 *
 * The backend (BackendNodeJs/src/controllers/uploadController.js) accepts
 * multipart/form-data, compresses images with sharp, and returns persistent
 * URLs served from `/uploads/...`.
 */
import { apiClient, tokenStorage, API_BASE_URL } from './apiClient';

export interface UploadedImage {
  filename: string;
  url: string;
  thumbnail_url: string;
  /** Backend also returns these — kept for callers that want them explicitly. */
  absolute_url?: string;
  absolute_thumbnail_url?: string;
}

export interface MultipleUploadResponse {
  images: UploadedImage[];
  urls: string[];
  thumbnails: string[];
}

/**
 * Origin (scheme + host) of the backend API, derived once from API_BASE_URL.
 * Used to turn the backend's relative "/uploads/..." URLs into absolute ones
 * BEFORE we hand them to the rest of the app. This way every consumer
 * (form persistence, <img src>, avatar, shop logo) gets a working URL even
 * if it doesn't go through getOptimizedImageUrl.
 */
const API_ORIGIN: string = (() => {
  try {
    const u = new URL(API_BASE_URL, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    return `${u.protocol}//${u.host}`;
  } catch {
    return '';
  }
})();

function absolutize(url?: string): string {
  if (!url) return '';
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  if (url.startsWith('/')) return `${API_ORIGIN}${url}`;
  return url;
}

function normalizeImage(img: UploadedImage): UploadedImage {
  return {
    ...img,
    url: absolutize(img.absolute_url || img.url),
    thumbnail_url: absolutize(img.absolute_thumbnail_url || img.thumbnail_url),
  };
}

export const uploadsApi = {
  /**
   * Upload a single image file.
   * Returns the persistent URL + thumbnail URL.
   */
  async single(file: File, signal?: AbortSignal): Promise<UploadedImage> {
    const fd = new FormData();
    fd.append('file', file);
    const raw = await apiClient.post<UploadedImage>('/uploads/single', fd, { signal });
    return normalizeImage(raw);
  },

  /**
   * Upload multiple image files in one request (max 10 server-side).
   */
  async multiple(files: File[], signal?: AbortSignal): Promise<MultipleUploadResponse> {
    const fd = new FormData();
    files.forEach((f) => fd.append('files', f));
    const raw = await apiClient.post<MultipleUploadResponse>('/uploads/multiple', fd, { signal });
    const images = (raw.images || []).map(normalizeImage);
    return {
      images,
      urls: images.map((i) => i.url),
      thumbnails: images.map((i) => i.thumbnail_url),
    };
  },

  /**
   * Lower-level helper that uses XHR so we can report upload progress
   * (fetch does not yet expose upload progress events in browsers).
   */
  singleWithProgress(
    file: File,
    onProgress?: (pct: number) => void,
    signal?: AbortSignal,
  ): Promise<UploadedImage> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const url = `${API_BASE_URL}/uploads/single`;
      xhr.open('POST', url, true);

      const token = tokenStorage.get();
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(normalizeImage(JSON.parse(xhr.responseText) as UploadedImage));
          } catch {
            reject(new Error('Invalid response from upload server'));
          }
        } else {
          let msg = `Upload failed (${xhr.status})`;
          try {
            const data = JSON.parse(xhr.responseText);
            msg = data?.error || data?.message || msg;
          } catch {}
          reject(Object.assign(new Error(msg), { status: xhr.status }));
        }
      };

      xhr.onerror = () => reject(new Error('Network error during upload'));
      xhr.onabort = () => reject(Object.assign(new Error('Upload aborted'), { name: 'AbortError' }));

      if (signal) {
        if (signal.aborted) {
          xhr.abort();
          return;
        }
        signal.addEventListener('abort', () => xhr.abort(), { once: true });
      }

      const fd = new FormData();
      fd.append('file', file);
      xhr.send(fd);
    });
  },
};

export default uploadsApi;
