import { useEffect, useMemo, useRef, useState } from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
  type InfiniteData,
} from '@tanstack/react-query';
import {
  conversationsApi,
  getSocket,
  ensureSocketLib,
  disconnectSocket,
  type Conversation,
  type Message,
  type ID,
} from '../services/conversationsApi';
import { useUser } from '../context/UserContext';

/** Compare two IDs that may be string (UUID) or number, defensively. */
const sameId = (a: ID | null | undefined, b: ID | null | undefined): boolean =>
  a != null && b != null && String(a) === String(b);

/** Page size for the cursor-based "load older" pagination on /messages. */
const MESSAGES_PAGE_SIZE = 50;

const QK = {
  list: ['conversations', 'list'] as const,
  unread: ['conversations', 'unread'] as const,
  messages: (id: ID) => ['conversations', 'messages', String(id)] as const,
};

/** Shape stored under a messages query key (react-query InfiniteData). */
type MessagesCache = InfiniteData<Message[], string | undefined>;

/** Append a message to the most recent (= last) page of the cache. */
function appendToCache(prev: MessagesCache | undefined, msg: Message): MessagesCache {
  if (!prev || prev.pages.length === 0) {
    return { pages: [[msg]], pageParams: [undefined] };
  }
  // Newest page is pages[0] (the initial fetch). Older pages get appended
  // when fetchNextPage runs. New incoming messages always belong to the
  // newest page so we push onto pages[0].
  // Dedupe across EVERY page, not just pages[0]. A re-emitted socket event
  // (reconnect, multi-tab, server retry) can target a message id that already
  // landed in an older page after pagination, and we'd otherwise duplicate it.
  for (const page of prev.pages) {
    if (Array.isArray(page) && page.some((m) => sameId(m.id, msg.id))) return prev;
  }
  const pages = prev.pages.slice();
  pages[0] = [...pages[0], msg];
  return { ...prev, pages };
}

/** List of conversations for the current user. */
export function useConversations() {
  const { isAuthenticated } = useUser();
  return useQuery({
    queryKey: QK.list,
    queryFn: ({ signal }) => conversationsApi.list(signal),
    enabled: isAuthenticated,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

/** Global unread count (used in header / dashboard badge). */
export function useUnreadConversationsCount(opts: { socketConnected?: boolean } = {}) {
  const { isAuthenticated } = useUser();
  // Disable the 60s poll while the websocket is live — the realtime hook
  // already invalidates this query on every incoming message (see the
  // onMessageNew handler in useConversationsRealtime). Without this guard
  // we were doing one redundant HTTP round-trip per minute per logged-in
  // user. When the socket is down (transient disconnect, mobile background),
  // fall back to the poll so the badge still self-heals.
  const { socketConnected = false } = opts;
  return useQuery({
    queryKey: QK.unread,
    queryFn: ({ signal }) => conversationsApi.unreadCount(signal).then((r) => r.unread_count),
    enabled: isAuthenticated,
    staleTime: 15_000,
    refetchInterval: socketConnected ? false : 60_000,
  });
}

/**
 * Messages of a single conversation, with cursor-based "load older" pagination.
 *
 * Backend returns each page in chronological ASC order. Pages are stored as
 * react-query infinite-query pages: pages[0] = most recent page, pages[N] =
 * oldest page (appended by fetchNextPage). The exposed `messages` flattens
 * them back into a single ASC timeline so the chat UI can render top-to-bottom.
 *
 * Use `loadOlder()` to prepend the previous chunk; `hasMore` toggles to false
 * once a page comes back short (we've hit the start of the conversation).
 */
export function useMessages(conversationId: ID | null) {
  const query = useInfiniteQuery<
    Message[],
    Error,
    MessagesCache,
    ReturnType<typeof QK.messages>,
    string | undefined
  >({
    queryKey: QK.messages(conversationId ?? '__none__'),
    enabled: !!conversationId,
    staleTime: 5_000,
    initialPageParam: undefined,
    queryFn: ({ pageParam, signal }) =>
      conversationsApi.getMessages(
        conversationId as ID,
        { limit: MESSAGES_PAGE_SIZE, before: pageParam },
        signal,
      ),
    /**
     * "Next page" semantically means "older messages". Cursor = created_at
     * of the very first (oldest) message currently in cache. When a returned
     * page has fewer than PAGE_SIZE rows, we've reached the start.
     */
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage || lastPage.length === 0) return undefined;
      if (lastPage.length < MESSAGES_PAGE_SIZE) return undefined;
      // Find the globally-oldest message we currently hold (across all pages)
      // — pages are ASC within themselves, but `lastPage` is the page we just
      // fetched (which is the oldest window). So lastPage[0] is the oldest.
      return lastPage[0]?.created_at;
    },
  });

  // Flatten pages into a single ASC array for the UI. Older pages were
  // appended later by fetchNextPage, so reverse the page list before
  // concatenating.
  const messages = useMemo<Message[]>(() => {
    const pages = query.data?.pages ?? [];
    if (pages.length === 0) return [];
    const out: Message[] = [];
    // Defensive: spread crashes hard if a page is not an iterable (can happen
    // if the backend transiently returns a non-array on a soft 200 error,
    // or if the cache was hand-mutated). Skip non-arrays silently.
    for (let i = pages.length - 1; i >= 0; i--) {
      const page = pages[i];
      if (Array.isArray(page)) out.push(...page);
    }
    return out;
  }, [query.data]);

  return {
    messages,
    /** Convenience alias so existing code reading `data` keeps working. */
    data: messages,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    loadOlder: () => query.fetchNextPage(),
    hasMore: query.hasNextPage ?? false,
    isLoadingMore: query.isFetchingNextPage,
    refetch: query.refetch,
  };
}

/** Send a message; optimistically appends to cache. */
export function useSendMessage(conversationId: ID | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { content?: string; image_url?: string; offer_amount?: number }) =>
      conversationsApi.sendMessage(conversationId as ID, {
        ...payload,
        type: payload.image_url ? 'image' : payload.offer_amount ? 'offer' : 'text',
      }),
    onSuccess: (msg) => {
      if (!conversationId) return;
      qc.setQueryData<MessagesCache>(QK.messages(conversationId), (prev) =>
        appendToCache(prev, msg),
      );
      qc.invalidateQueries({ queryKey: QK.list });
    },
  });
}

/** Open or create a conversation around a listing, then return its id. */
export function useStartConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { listing_id: ID; seller_id: ID; message?: string }) =>
      conversationsApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.list });
      qc.invalidateQueries({ queryKey: QK.unread });
    },
  });
}

/** Mark a conversation as read on the server + locally. */
export function useMarkConversationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: ID) => conversationsApi.markRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.list });
      qc.invalidateQueries({ queryKey: QK.unread });
    },
  });
}

/**
 * Subscribe to realtime events. Joins the global user room automatically and
 * an optional per-conversation room. Updates react-query caches in place.
 */
export function useConversationsRealtime(activeConversationId?: ID | null) {
  const { isAuthenticated, user } = useUser();
  const qc = useQueryClient();
  const [connected, setConnected] = useState(false);
  // Map of userId → timeout handle. Presence in the map = "this user is typing
  // in the active conversation right now". Auto-clears after 4s of silence as
  // a safety net in case we miss the typing:stop event (network blip, tab
  // closed, etc.) so the indicator never gets stuck on.
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const typingTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const joinedRef = useRef<ID | null>(null);
  const [libReady, setLibReady] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    let alive = true;
    ensureSocketLib().then(() => { if (alive) setLibReady(true); }).catch(() => {});
    return () => { alive = false; };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !libReady) return;
    const socket = getSocket();
    if (!socket) return;

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onMessageNew = (payload: { conversation_id: ID; message: Message }) => {
      const cid = payload.conversation_id;
      qc.setQueryData<MessagesCache>(QK.messages(cid), (prev) =>
        appendToCache(prev, payload.message),
      );
      qc.invalidateQueries({ queryKey: QK.list });
      // Only bump unread if the message isn't from us and the conv isn't open
      if (
        user?.id != null &&
        !sameId(payload.message.sender_id, user.id) &&
        !sameId(cid, activeConversationId)
      ) {
        qc.invalidateQueries({ queryKey: QK.unread });
      }
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('message:new', onMessageNew);
    // Peer marked our messages as read — refresh the list AND flip is_read=true
    // on all our outgoing messages in the cached pages so the double-check
    // appears live without waiting for a refetch.
    const onConversationRead = (payload: { conversation_id: ID; reader_id: ID }) => {
      qc.invalidateQueries({ queryKey: QK.list });
      qc.setQueryData<MessagesCache>(QK.messages(payload.conversation_id), (prev) => {
        if (!prev) return prev;
        let changed = false;
        const pages = prev.pages.map((page) => {
          let pageChanged = false;
          const next = page.map((m) => {
            // Only flip messages NOT sent by the reader (= messages WE sent to them).
            if (!m.is_read && !sameId(m.sender_id, payload.reader_id)) {
              pageChanged = true;
              return { ...m, is_read: true };
            }
            return m;
          });
          if (pageChanged) changed = true;
          return pageChanged ? next : page;
        });
        return changed ? { ...prev, pages } : prev;
      });
    };
    socket.on('conversation:read', onConversationRead);

    // Typing events — backend re-broadcasts to the conversation room only,
    // so we must already be joined (handled by the effect below).
    const clearTyping = (uid: string) => {
      const t = typingTimersRef.current.get(uid);
      if (t) clearTimeout(t);
      typingTimersRef.current.delete(uid);
      setTypingUsers((prev) => {
        if (!prev.has(uid)) return prev;
        const next = new Set(prev);
        next.delete(uid);
        return next;
      });
    };
    const onTypingStart = (payload: { userId: ID; conversationId: ID }) => {
      if (!sameId(payload.conversationId, activeConversationId)) return;
      if (sameId(payload.userId, user?.id)) return;
      const uid = String(payload.userId);
      setTypingUsers((prev) => (prev.has(uid) ? prev : new Set(prev).add(uid)));
      const existing = typingTimersRef.current.get(uid);
      if (existing) clearTimeout(existing);
      typingTimersRef.current.set(uid, setTimeout(() => clearTyping(uid), 4000));
    };
    const onTypingStop = (payload: { userId: ID; conversationId: ID }) => {
      if (!sameId(payload.conversationId, activeConversationId)) return;
      clearTyping(String(payload.userId));
    };
    socket.on('typing:start', onTypingStart);
    socket.on('typing:stop', onTypingStop);
    if (socket.connected) setConnected(true);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('message:new', onMessageNew);
      socket.off('conversation:read', onConversationRead);
      socket.off('typing:start', onTypingStart);
      socket.off('typing:stop', onTypingStop);
      typingTimersRef.current.forEach((t) => clearTimeout(t));
      typingTimersRef.current.clear();
    };
  }, [isAuthenticated, libReady, qc, user?.id, activeConversationId]);

  // Reset typing users when switching conversations
  useEffect(() => {
    setTypingUsers(new Set());
    typingTimersRef.current.forEach((t) => clearTimeout(t));
    typingTimersRef.current.clear();
  }, [activeConversationId]);

  // Join / leave per-conversation rooms
  useEffect(() => {
    if (!isAuthenticated || !libReady || !activeConversationId) return;
    const socket = getSocket();
    if (!socket) return;
    socket.emit('conversation:join', activeConversationId);
    joinedRef.current = activeConversationId;
    return () => {
      socket.emit('conversation:leave', activeConversationId);
      joinedRef.current = null;
    };
  }, [isAuthenticated, libReady, activeConversationId]);

  // Disconnect on logout
  useEffect(() => {
    if (!isAuthenticated) disconnectSocket();
  }, [isAuthenticated]);

  return { connected, typingUsers };
}

/**
 * Emit typing:start / typing:stop for the active conversation as the user
 * types. Throttles start emissions to once per 2s and auto-stops 3s after the
 * last keystroke. Call `notify()` on every input change.
 */
export function useTypingEmitter(activeConversationId?: ID | null) {
  const lastStartRef = useRef(0);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  const stop = () => {
    if (!activeConversationId || !isTypingRef.current) return;
    const socket = getSocket();
    socket?.emit('typing:stop', activeConversationId);
    isTypingRef.current = false;
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
  };

  const notify = () => {
    if (!activeConversationId) return;
    const socket = getSocket();
    if (!socket) return;
    const now = Date.now();
    if (!isTypingRef.current || now - lastStartRef.current > 2000) {
      socket.emit('typing:start', activeConversationId);
      isTypingRef.current = true;
      lastStartRef.current = now;
    }
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    stopTimerRef.current = setTimeout(stop, 3000);
  };

  // Stop on unmount or conversation switch
  useEffect(() => {
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversationId]);

  return { notify, stop };
}

export type { Conversation, Message };
