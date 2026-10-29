/**
 * Conversations / Messaging API
 * REST: /api/conversations/*
 * Realtime: Socket.IO at API_BASE_URL host (rooms: user:<id>, conversation:<id>)
 */
import { apiClient, API_BASE_URL, tokenStorage } from './apiClient';
import type { Socket } from 'socket.io-client';

/** Backend IDs are UUIDs (strings). Some callers still pass numbers — accept both. */
export type ID = string | number;

export interface Message {
  id: ID;
  conversation_id: ID;
  sender_id: ID;
  type: 'text' | 'image' | 'offer';
  content?: string | null;
  image_url?: string | null;
  offer_amount?: number | null;
  is_read: boolean;
  created_at: string;
  sender_name?: string;
  sender_avatar?: string;
}

export interface Conversation {
  id: ID;
  listing_id: ID | null;
  buyer_id: ID;
  seller_id: ID;
  buyer_unread: number;
  seller_unread: number;
  is_archived: boolean;
  last_message_at: string;
  created_at: string;
  // joined
  listing_title?: string;
  listing_images?: string[] | null;
  listing_price?: number | string;
  buyer_name?: string;
  buyer_avatar?: string;
  seller_name?: string;
  seller_avatar?: string;
  last_message_content?: string | null;
  last_message_type?: string | null;
  last_message_sender?: ID | null;
}

export const conversationsApi = {
  list: (signal?: AbortSignal) =>
    apiClient
      .get<Conversation[] | { conversations?: Conversation[] } | null>('/conversations', { signal })
      .then((r) => {
        // Backend SHOULD return Conversation[] but we defend against:
        //  - { conversations: [...] } envelope
        //  - null / undefined (parse failure)
        //  - { error: ... } leaking through on a 200
        if (Array.isArray(r)) return r as Conversation[];
        if (r && Array.isArray((r as any).conversations)) return (r as any).conversations as Conversation[];
        return [] as Conversation[];
      }),

  unreadCount: (signal?: AbortSignal) =>
    apiClient.get<{ unread_count: number }>('/conversations/unread', { signal }),

  create: (payload: { listing_id: ID; seller_id: ID; message?: string }) =>
    apiClient.post<{ conversation_id: ID }>('/conversations', payload),

  /**
   * Fetch a page of messages, oldest-first (chronological ASC).
   *
   * Backend supports cursor pagination via `?before=<ISO|messageId>` which
   * returns the page of messages strictly older than the cursor — used by
   * the infinite-scroll-up behaviour in the chat. Without `before`, returns
   * the most recent `limit` messages.
   */
  getMessages: (
    id: ID,
    params?: { limit?: number; before?: string },
    signal?: AbortSignal,
  ) =>
    apiClient
      .get<Message[] | { messages?: Message[] } | null>(`/conversations/${id}/messages`, {
        query: params as any,
        signal,
      })
      .then((r) => {
        // Same defensive coercion as list(): the infinite-query cache spreads
        // each page with `...pages[i]`, which crashes hard if a page is not an
        // array (e.g. backend returned an envelope or null on a soft error).
        if (Array.isArray(r)) return r as Message[];
        if (r && Array.isArray((r as any).messages)) return (r as any).messages as Message[];
        return [] as Message[];
      }),

  sendMessage: (
    id: ID,
    payload: { content?: string; type?: 'text' | 'image' | 'offer'; image_url?: string; offer_amount?: number },
  ) => apiClient.post<Message>(`/conversations/${id}/messages`, payload),

  markRead: (id: ID) => apiClient.patch(`/conversations/${id}/read`),
  archive: (id: ID) => apiClient.patch(`/conversations/${id}/archive`),
};

// ---------- Socket.IO singleton ----------
let socket: Socket | null = null;
// socket.io-client is loaded on demand (only for signed-in users) so anonymous
// visitors never download it — keeps it out of the first-load bundle.
let ioFn: typeof import('socket.io-client').io | null = null;
let ioPromise: Promise<void> | null = null;
export function ensureSocketLib(): Promise<void> {
  if (ioFn) return Promise.resolve();
  if (!ioPromise) ioPromise = import('socket.io-client').then((m) => { ioFn = m.io; });
  return ioPromise;
}

/** Strip `/api` suffix to reach the Socket.IO server root. */
function getSocketUrl(): string {
  return API_BASE_URL.replace(/\/api\/?$/, '');
}

export function getSocket(): Socket | null {
  const token = tokenStorage.get();
  if (!token) return null;
  if (socket && socket.connected) return socket;
  if (socket) {
    // Refresh auth in case the JWT was rotated since the socket was created.
    socket.auth = { token };
    socket.connect();
    return socket;
  }
  if (!ioFn) { void ensureSocketLib(); return null; }
  socket = ioFn(getSocketUrl(), {
    auth: { token },
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  // CRITICAL: refresh the token on every reconnect attempt. Otherwise the socket
  // keeps trying to connect with the JWT it was created with — even after the
  // user logged out & back in, or the token was rotated by /auth/refresh-token.
  socket.on('reconnect_attempt', () => {
    const fresh = tokenStorage.get();
    if (fresh && socket) socket.auth = { token: fresh };
  });

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
