import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MessageSquare, Send, ArrowLeft, Wifi, WifiOff, Check, CheckCheck } from 'lucide-react';
import {
  useConversations,
  useMessages,
  useSendMessage,
  useMarkConversationRead,
  useConversationsRealtime,
  useTypingEmitter,
  type Conversation,
} from '../../hooks/useConversations';
import type { ID } from '../../services/conversationsApi';
import { useUser } from '../../context/UserContext';
import { EmptyState } from '../ui/EmptyState';
import { Skeleton } from '../ui/Skeleton';

/** Compare IDs as strings to be UUID-safe. */
const sameId = (a: ID | null | undefined, b: ID | null | undefined): boolean =>
  a != null && b != null && String(a) === String(b);

function fmtTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

const MessagesTab: React.FC = () => {
  const { user } = useUser();
  const myId: ID | null = user?.id ?? null;

  const { data: convData, isLoading } = useConversations();
  // Defensive: if the API ever returns a non-array (envelope, error object,
  // null), `.find()` below would crash. Always coerce to an array here.
  const conversations: Conversation[] = Array.isArray(convData) ? convData : [];
  const [activeId, setActiveId] = useState<ID | null>(null);

  const active = useMemo(
    () => conversations.find((c) => sameId(c.id, activeId)) || null,
    [conversations, activeId],
  );

  const {
    messages,
    isLoading: loadingMsgs,
    loadOlder,
    hasMore,
    isLoadingMore,
  } = useMessages(activeId);
  const sendMutation = useSendMessage(activeId);
  const markRead = useMarkConversationRead();
  const { connected, typingUsers } = useConversationsRealtime(activeId);
  const { notify: notifyTyping, stop: stopTyping } = useTypingEmitter(activeId);

  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  // Tracks whether the user is "stuck to the bottom". When true, new messages
  // auto-scroll into view; when the user has scrolled up to read history, we
  // leave their position alone so the chat doesn't yank them around.
  const stickToBottomRef = useRef(true);
  // Snapshot scrollHeight before fetching an older page so we can restore the
  // visible position after the new (taller) DOM has rendered. Without this,
  // prepending older messages would jump the user to a random spot.
  const prevScrollHeightRef = useRef<number | null>(null);
  // Remember the count of messages we've seen so far so we can detect *new
  // messages at the bottom* vs. *older messages prepended at the top*.
  const prevMessageCountRef = useRef(0);
  // Remember which conversation the refs belong to — switching threads must
  // reset the sticky-bottom state.
  const lastConvIdRef = useRef<ID | null>(null);

  // Auto-select first conversation on desktop
  useEffect(() => {
    if (!activeId && conversations.length > 0 && window.innerWidth >= 768) {
      setActiveId(conversations[0].id);
    }
  }, [conversations, activeId]);

  // Mark as read whenever opened
  useEffect(() => {
    if (activeId) markRead.mutate(activeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  // When switching conversations, reset the sticky-bottom flag so the first
  // render of the new thread snaps to the latest message.
  useEffect(() => {
    if (!sameId(lastConvIdRef.current, activeId)) {
      stickToBottomRef.current = true;
      prevScrollHeightRef.current = null;
      prevMessageCountRef.current = 0;
      lastConvIdRef.current = activeId;
    }
  }, [activeId]);

  // After messages render, decide what to do with scroll position:
  //   1. Restoring after "load older" — keep the old top message in view by
  //      adjusting scrollTop by the height delta.
  //   2. New message at the bottom while sticky — snap to bottom.
  //   3. Otherwise leave the user where they are.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const prevCount = prevMessageCountRef.current;
    const delta = messages.length - prevCount;

    if (prevScrollHeightRef.current != null) {
      // We just prepended an older page. Restore the offset so the message
      // the user was looking at stays in the same on-screen position.
      el.scrollTop = el.scrollHeight - prevScrollHeightRef.current;
      prevScrollHeightRef.current = null;
    } else if (delta > 0 && stickToBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    } else if (prevCount === 0 && messages.length > 0) {
      // First render of this thread — always start at the bottom.
      el.scrollTop = el.scrollHeight;
    }
    prevMessageCountRef.current = messages.length;
  }, [messages.length]);

  /** Track sticky-bottom + trigger "load older" when scrolling near the top. */
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distanceFromBottom < 80;

    // 120px buffer from the top so a slow scroll naturally loads the next
    // page before the user runs out of content.
    if (el.scrollTop < 120 && hasMore && !isLoadingMore && !loadingMsgs) {
      prevScrollHeightRef.current = el.scrollHeight;
      void loadOlder();
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = draft.trim();
    if (!content || !activeId) return;
    setDraft('');
    stopTyping();
    // Sending a message implies the user wants to see it appear at the bottom.
    stickToBottomRef.current = true;
    try {
      await sendMutation.mutateAsync({ content });
    } catch {
      setDraft(content); // restore on failure
    }
  };

  const counterpart = (c: Conversation) => {
    const isBuyer = sameId(c.buyer_id, myId);
    return {
      name: isBuyer ? c.seller_name : c.buyer_name,
      avatar: isBuyer ? c.seller_avatar : c.buyer_avatar,
      unread: isBuyer ? c.buyer_unread : c.seller_unread,
    };
  };

  return (
    <div
      // Mobile: leave room for the dashboard's bottom tab bar (~80px) AND
      // the iOS safe-area inset, otherwise the message input bar disappears
      // behind the navbar. We use 100dvh (dynamic viewport) so collapsing
      // the mobile browser chrome doesn't snap the chat to a wrong height.
      // Desktop keeps the original calc minus header offset.
      className="bg-card rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col h-[calc(100dvh-260px)] md:h-[calc(100vh-200px)] min-h-[420px] md:min-h-[500px]"
    >
      {/* Header */}
      <div className="px-4 md:px-6 py-3 md:py-4 border-b border-gray-100 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg md:text-xl font-black text-gray-900 flex items-center gap-2">
            <MessageSquare size={20} className="text-primary-600" />
            Messages
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {conversations.length} conversation{conversations.length > 1 ? 's' : ''}
          </p>
        </div>
        <div
          className={`shrink-0 flex items-center gap-1.5 text-[10px] md:text-[11px] font-bold uppercase px-2 md:px-2.5 py-1 rounded-full ${
            connected ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-50 text-gray-400'
          }`}
          title={connected ? 'Temps réel actif' : 'Hors ligne'}
        >
          {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
          {connected ? 'En direct' : 'Hors ligne'}
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* List */}
        <aside
          className={`${
            activeId ? 'hidden md:flex' : 'flex'
          } w-full md:w-80 border-r border-gray-100 flex-col overflow-y-auto`}
        >
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex-1 flex items-center justify-center p-6">
              <EmptyState
                variant="inline"
                icon={MessageSquare}
                title="Aucun message"
                description="Vos discussions avec acheteurs et vendeurs apparaîtront ici."
              />
            </div>
          ) : (
            conversations.map((c) => {
              const cp = counterpart(c);
              const isActive = sameId(c.id, activeId);
              return (
                <button
                  key={String(c.id)}
                  onClick={() => setActiveId(c.id)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors flex gap-3 ${
                    isActive ? 'bg-orange-50/60' : ''
                  }`}
                >
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-orange-500 to-red-500 text-white flex items-center justify-center font-black shrink-0 overflow-hidden">
                    {cp.avatar ? (
                      <img src={cp.avatar} alt={cp.name || ''} className="w-full h-full object-cover" />
                    ) : (
                      (cp.name || '?').charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-sm text-gray-900 truncate">{cp.name || 'Utilisateur'}</span>
                      <span className="text-[10px] text-gray-400 shrink-0">{fmtTime(c.last_message_at)}</span>
                    </div>
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {c.listing_title ? <span className="text-gray-400">{c.listing_title} · </span> : null}
                      {c.last_message_content || '—'}
                    </p>
                  </div>
                  {cp.unread > 0 && (
                    <span className="ml-2 w-5 h-5 rounded-full bg-primary-600 text-white text-[10px] font-black flex items-center justify-center shrink-0">
                      {cp.unread}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </aside>

        {/* Conversation pane */}
        <section className={`${activeId ? 'flex' : 'hidden md:flex'} flex-1 flex-col min-w-0`}>
          {!active ? (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
              Sélectionnez une conversation
            </div>
          ) : (
            <>
              <div className="px-3 md:px-5 py-3 border-b border-gray-100 flex items-center gap-3">
                <button
                  onClick={() => setActiveId(null)}
                  className="md:hidden p-2 rounded-lg bg-gray-50 hover:bg-gray-100 active:scale-95 transition"
                  aria-label="Retour"
                >
                  <ArrowLeft size={18} />
                </button>
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-500 to-red-500 text-white flex items-center justify-center font-black shrink-0 overflow-hidden text-sm">
                  {counterpart(active).avatar ? (
                    <img src={counterpart(active).avatar!} alt="" className="w-full h-full object-cover" />
                  ) : (
                    (counterpart(active).name || '?').charAt(0).toUpperCase()
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-bold text-gray-900 truncate text-sm md:text-base">
                    {counterpart(active).name || 'Utilisateur'}
                  </h2>
                  {active.listing_title && (
                    <p className="text-[11px] md:text-xs text-gray-500 truncate">{active.listing_title}</p>
                  )}
                </div>
              </div>

              <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto p-3 md:p-5 space-y-3 bg-gray-50/40"
              >
                {/* "Loading older messages…" banner stays pinned at the top
                    while a previous page is being fetched. */}
                {isLoadingMore && (
                  <div className="flex justify-center py-2">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400 bg-card px-3 py-1 rounded-full border border-gray-100">
                      Chargement des messages plus anciens…
                    </span>
                  </div>
                )}
                {!hasMore && messages.length >= 50 && !isLoadingMore && (
                  <p className="text-center text-[10px] text-gray-300 py-1">
                    — Début de la conversation —
                  </p>
                )}
                {loadingMsgs ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} className="h-12 w-2/3 rounded-2xl" />
                    ))}
                  </div>
                ) : messages.length === 0 ? (
                  <p className="text-center text-xs text-gray-400 py-8">
                    Aucun message — soyez le premier à écrire.
                  </p>
                ) : (
                  messages.map((m) => {
                    const mine = sameId(m.sender_id, myId);
                    return (
                      <div key={String(m.id)} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[75%] px-4 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words shadow-sm ${
                            mine
                              ? 'bg-primary-600 text-white rounded-br-md'
                              : 'bg-card text-gray-900 border border-gray-100 rounded-bl-md'
                          }`}
                        >
                          {m.type === 'image' && m.image_url ? (
                            <img src={m.image_url} alt="" className="rounded-lg max-w-full mb-1" />
                          ) : null}
                          {m.type === 'offer' && m.offer_amount != null ? (
                            <span className="font-black">💰 Offre : {m.offer_amount.toLocaleString('fr-FR')} DT</span>
                          ) : null}
                          {m.content && <span>{m.content}</span>}
                          <div className={`text-[10px] mt-1 flex items-center gap-1 ${mine ? 'text-orange-100 justify-end' : 'text-gray-400'}`}>
                            <span>{fmtTime(m.created_at)}</span>
                            {mine && (
                              m.is_read ? (
                                <CheckCheck size={12} className="text-sky-300" aria-label="Lu" />
                              ) : (
                                <Check size={12} className="opacity-80" aria-label="Envoyé" />
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {typingUsers.size > 0 && (
                <div className="px-4 pb-1 flex items-center gap-2 text-xs text-gray-500">
                  <span className="flex gap-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" />
                  </span>
                  <span>{counterpart(active).name} est en train d'écrire…</span>
                </div>
              )}

              <form onSubmit={handleSend} className="p-3 border-t border-gray-100 bg-card flex items-center gap-2">
                <input
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    if (e.target.value) notifyTyping();
                    else stopTyping();
                  }}
                  onBlur={stopTyping}
                  placeholder="Votre message..."
                  className="flex-1 px-4 py-3 rounded-full bg-gray-50 border border-gray-100 text-sm focus:outline-none focus:border-primary-600 focus:bg-card transition"
                  disabled={sendMutation.isPending}
                />
                <button
                  type="submit"
                  disabled={!draft.trim() || sendMutation.isPending}
                  className="w-11 h-11 rounded-full bg-primary-600 text-white flex items-center justify-center disabled:opacity-50 hover:bg-primary-700 transition"
                  aria-label="Envoyer"
                >
                  <Send size={18} />
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
};

export default MessagesTab;
