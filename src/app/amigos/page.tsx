"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { Variants } from "framer-motion";
import Image from "next/image";
import {
  Loader2,
  MessageCircle,
  Search,
  Send,
  UserPlus,
  UserMinus,
  Check,
  X,
  XIcon,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Header } from "@/components/navigation";
import { Modal } from "@/components/modal";
import { ChatThread, ConversationContextMenu, convActions } from "@/components/chat";
import { dmToChatMessage } from "@/types";
import { useAuthRedirect } from "@/lib/auth-context";
import { streakIconSource } from "@/lib/energy-assets";
import { api } from "@/lib/api-client";
import type {
  FriendSummary,
  FriendRequest,
  UserSearchResult,
  DirectMessage,
} from "@/types";

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function UserAvatar({
  user,
  size = 40,
}: {
  user: { displayName: string; photoUrl?: string };
  size?: number;
}) {
  if (user.photoUrl) {
    return (
      <img
        src={user.photoUrl}
        alt={user.displayName}
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full text-xs font-bold text-black"
      style={{
        width: size,
        height: size,
        background: "linear-gradient(135deg, #71d4ff, #b69cff)",
      }}
    >
      {user.displayName.charAt(0).toUpperCase()}
    </div>
  );
}

function relativeTime(iso?: string): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

/* ------------------------------------------------------------------ */
/*  Animations                                                        */
/* ------------------------------------------------------------------ */

const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
};
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
};

/* ------------------------------------------------------------------ */
/*  Main Page                                                         */
/* ------------------------------------------------------------------ */

export default function AmigosPage() {
  const { user, loading: authLoading } = useAuthRedirect({ ifGuest: "/" });
  const reduced = useReducedMotion();

  const [friends, setFriends] = useState<FriendSummary[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* Conversation list context menu */
  const [listMenu, setListMenu] = useState<{ x: number; y: number; friend: FriendSummary } | null>(null);

  /* Search */
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* DM Chat */
  const [activeChat, setActiveChat] = useState<FriendSummary | null>(null);

  /* ---------------------------------------------------------------- */
  /*  Data fetching                                                   */
  /* ---------------------------------------------------------------- */

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [f, r] = await Promise.all([api.getFriends(), api.getFriendRequests()]);
      setFriends(f.friends);
      setRequests(r.requests);
    } catch {
      setError("Nao foi possivel carregar os dados sociais.");
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    loadData().then(() => { if (cancelled) return; });
    return () => { cancelled = true; };
  }, [authLoading, user?.uid, loadData]);

  /* Search debounce */
  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const { results } = await api.searchUsers(q);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  }, []);

  /* Send friend request */
  const handleSendRequest = useCallback(async (userId: string) => {
    setSearchResults((prev) =>
      prev.map((r) => (r.id === userId ? { ...r, relation: "pending_outgoing" as const } : r)),
    );
    try {
      await api.sendFriendRequest(userId);
    } catch {
      setSearchResults((prev) =>
        prev.map((r) => (r.id === userId ? { ...r, relation: "none" as const } : r)),
      );
    }
  }, []);

  /* Accept / Decline / Cancel */
  const handleAccept = useCallback(async (id: number) => {
    setRequests((prev) => prev.filter((r) => r.id !== id));
    try {
      await api.acceptFriendRequest(id);
      loadData();
    } catch {
      loadData();
    }
  }, [loadData]);

  const handleDecline = useCallback(async (id: number) => {
    setRequests((prev) => prev.filter((r) => r.id !== id));
    try {
      await api.declineFriendRequest(id);
    } catch {
      loadData();
    }
  }, [loadData]);

  /* ---------------------------------------------------------------- */
  /*  Partition requests                                               */
  /* ---------------------------------------------------------------- */
  const incoming = useMemo(
    () => requests.filter((r) => r.direction === "incoming"),
    [requests],
  );
  const outgoing = useMemo(
    () => requests.filter((r) => r.direction === "outgoing"),
    [requests],
  );
  const hasRequests = incoming.length > 0 || outgoing.length > 0;

  /* ---------------------------------------------------------------- */
  /*  Loading / error states                                           */
  /* ---------------------------------------------------------------- */

  if (authLoading || !user) {
    return (
      <div className="min-h-screen theme-bg flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-[var(--accent)]" />
      </div>
    );
  }

  if (loadingData) {
    return (
      <AppShell>
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 size={28} className="animate-spin text-[var(--accent)]" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="relative min-h-screen px-5 py-7 sm:px-8 lg:px-12 lg:py-10">
        <Header eyebrow="Social" title="Amigos" />

        {error && (
          <div className="glass-card mb-8 border-[var(--red)]/20 bg-[var(--red-bg)] p-4 text-sm text-[var(--red)]">
            {error}
          </div>
        )}

        {/* -------------------------------------------------------------- */}
        {/*  Search                                                        */}
        {/* -------------------------------------------------------------- */}
        <motion.section
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="mb-8"
        >
          <div className="glass-card flex items-center gap-3 px-4 py-3">
            <Search size={18} className="shrink-0 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Buscar usuarios..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full bg-transparent text-sm text-[var(--text)] placeholder:text-[var(--text-faint)] outline-none"
            />
            {searching && <Loader2 size={16} className="shrink-0 animate-spin text-[var(--accent)]" />}
          </div>

          <AnimatePresence>
            {searchResults.length > 0 && (
              <motion.div
                variants={stagger}
                initial="hidden"
                animate="visible"
                exit="hidden"
                className="mt-3 space-y-2"
              >
                {searchResults.map((r) => (
                  <motion.div
                    key={r.id}
                    variants={fadeUp}
                    className="glass-card flex items-center gap-3 px-4 py-3"
                  >
                    <UserAvatar user={r} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[var(--text)]">
                        {r.displayName}
                      </p>
                      {r.username && (
                        <p className="truncate text-xs text-[var(--text-muted)]">
                          @{r.username}
                        </p>
                      )}
                    </div>
                    {r.relation === "none" && (
                      <button
                        onClick={() => handleSendRequest(r.id)}
                        className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-xs"
                      >
                        <UserPlus size={13} />
                        Adicionar
                      </button>
                    )}
                    {r.relation === "pending_outgoing" && (
                      <span className="flex items-center gap-1.5 rounded-lg bg-[var(--orange-bg)] px-3 py-1.5 text-xs text-[var(--orange)]">
                        Pendente
                      </span>
                    )}
                    {r.relation === "pending_incoming" && (
                      <span className="flex items-center gap-1.5 rounded-lg bg-[var(--orange-bg)] px-3 py-1.5 text-xs text-[var(--orange)]">
                        Pendente
                      </span>
                    )}
                    {r.relation === "friends" && (
                      <span className="flex items-center gap-1.5 rounded-lg bg-[var(--green-bg)] px-3 py-1.5 text-xs text-[var(--green)]">
                        <Check size={12} />
                        Amigos
                      </span>
                    )}
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>

        {/* -------------------------------------------------------------- */}
        {/*  Friend requests                                               */}
        {/* -------------------------------------------------------------- */}
        {hasRequests && (
          <motion.section
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="mb-8"
          >
            <h2 className="mb-3 font-display text-base text-[var(--text-secondary)]">
              Pedidos de amizade
            </h2>

            <div className="space-y-2">
              {/* Incoming */}
              {incoming.map((req) => (
                <motion.div
                  key={req.id}
                  variants={fadeUp}
                  className="glass-card flex items-center gap-3 px-4 py-3"
                >
                  <UserAvatar user={req.user} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--text)]">
                      {req.user.displayName}
                    </p>
                    <p className="text-[10px] text-[var(--text-faint)]">
                      {relativeTime(req.createdAt)} atras
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleAccept(req.id)}
                      className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-xs"
                    >
                      <Check size={13} />
                      Aceitar
                    </button>
                    <button
                      onClick={() => handleDecline(req.id)}
                      className="flex items-center gap-1.5 rounded-lg bg-[var(--red-bg)] px-3 py-1.5 text-xs text-[var(--red)] transition hover:brightness-110"
                    >
                      <X size={13} />
                      Recusar
                    </button>
                  </div>
                </motion.div>
              ))}

              {/* Outgoing */}
              {outgoing.map((req) => (
                <motion.div
                  key={req.id}
                  variants={fadeUp}
                  className="glass-card flex items-center gap-3 px-4 py-3"
                >
                  <UserAvatar user={req.user} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--text)]">
                      {req.user.displayName}
                    </p>
                    <p className="text-[10px] text-[var(--text-faint)]">
                      Enviado {relativeTime(req.createdAt)} atras
                    </p>
                  </div>
                  <button
                    onClick={() => handleDecline(req.id)}
                    className="flex items-center gap-1.5 rounded-lg bg-[var(--orange-bg)] px-3 py-1.5 text-xs text-[var(--orange)] transition hover:brightness-110"
                  >
                    <UserMinus size={13} />
                    Cancelar
                  </button>
                </motion.div>
              ))}
            </div>
          </motion.section>
        )}

        {/* -------------------------------------------------------------- */}
        {/*  Friends list                                                  */}
        {/* -------------------------------------------------------------- */}
        <motion.section variants={fadeUp} initial="hidden" animate="visible">
          <h2 className="mb-3 font-display text-base text-[var(--text-secondary)]">
            Seus amigos
          </h2>

          {friends.length === 0 ? (
            <div className="glass-card p-8 text-center text-sm text-[var(--text-muted)]">
              Nenhum amigo ainda
            </div>
          ) : (
            <motion.div
              variants={stagger}
              initial="hidden"
              animate="visible"
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
            >
              {friends.map((f) => (
                <motion.button
                  key={f.id}
                  variants={fadeUp}
                  whileHover={reduced ? undefined : { y: -2, transition: { duration: 0.15 } }}
                  whileTap={reduced ? undefined : { scale: 0.98 }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setListMenu({ x: e.clientX, y: e.clientY, friend: f });
                  }}
                  onClick={() => {
                    setActiveChat(f);
                    if (f.unreadCount > 0) {
                      setFriends((prev) =>
                        prev.map((x) => (x.id === f.id ? { ...x, unreadCount: 0 } : x)),
                      );
                    }
                  }}
                  className="glass-card group relative flex items-center gap-3 px-4 py-3 text-left transition hover:border-[var(--accent)]/30"
                >
                  <UserAvatar user={f} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--text)] group-hover:text-[var(--accent)]">
                      {f.displayName}
                    </p>
                    {f.username && (
                      <p className="truncate text-xs text-[var(--text-muted)]">
                        @{f.username}
                      </p>
                    )}
                    <div className="mt-1 flex items-center gap-3 text-[10px] text-[var(--text-faint)]">
                      <span className="flex items-center gap-1 text-[var(--orange)]">
                        <Image src={streakIconSource(f.currentStreak)} alt="streak" width={11} height={11} style={{ objectFit: "contain" }} unoptimized />
                        {f.currentStreak}
                      </span>
                      {f.lastActiveAt && <span>{relativeTime(f.lastActiveAt)} atras</span>}
                    </div>
                  </div>

                  {f.unreadCount > 0 && (
                    <span className="absolute right-3 top-3 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[var(--accent)] px-1.5 text-[10px] font-bold text-black">
                      {f.unreadCount > 99 ? "99+" : f.unreadCount}
                    </span>
                  )}

                  <MessageCircle
                    size={16}
                    className="shrink-0 text-[var(--text-faint)] transition group-hover:text-[var(--accent)]"
                  />
                </motion.button>
              ))}
            </motion.div>
          )}
        </motion.section>

        {/* -------------------------------------------------------------- */}
        {/*  DM Chat Panel                                                 */}
        {/* -------------------------------------------------------------- */}
        {activeChat && (
          <ChatPanel
            friend={activeChat}
            currentUserId={user.uid}
            reduced={!!reduced}
            onClose={() => setActiveChat(null)}
            onRead={() => {
              setFriends((prev) =>
                prev.map((x) =>
                  x.id === activeChat.id ? { ...x, unreadCount: 0 } : x,
                ),
              );
            }}
          />
        )}

        {/* Conversation list context menu */}
        {listMenu && (
          <ConversationContextMenu
            x={listMenu.x}
            y={listMenu.y}
            onClose={() => setListMenu(null)}
            actions={[
              convActions.markAsRead(() => {
                if (listMenu.friend.unreadCount > 0) {
                  api.markDmRead(listMenu.friend.id).catch(() => {});
                  setFriends((prev) =>
                    prev.map((x) =>
                      x.id === listMenu.friend.id ? { ...x, unreadCount: 0 } : x,
                    ),
                  );
                }
              }),
              convActions.unfriend(() => {
                const friendshipId = listMenu.friend.friendshipId;
                if (friendshipId) {
                  // DELETE /api/friends/:id removes the friendship
                  api.declineFriendRequest(friendshipId).catch(() => {});
                  setFriends((prev) => prev.filter((x) => x.id !== listMenu.friend.id));
                }
              }),
            ]}
          />
        )}
      </main>
    </AppShell>
  );
}

/* ------------------------------------------------------------------ */
/*  Chat Panel                                                        */
/* ------------------------------------------------------------------ */

function ChatPanel({
  friend,
  currentUserId,
  reduced,
  onClose,
  onRead,
}: {
  friend: FriendSummary;
  currentUserId: string;
  reduced: boolean;
  onClose: () => void;
  onRead: () => void;
}) {
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [replyingTo, setReplyingTo] = useState<DirectMessage | null>(null);
  const lastIdRef = useRef<number | undefined>(undefined);

  /* Mark read on open */
  useEffect(() => {
    let cancelled = false;
    api.markDmRead(friend.id).then(() => {
      if (!cancelled) onRead();
    });
    return () => { cancelled = true; };
  }, [friend.id, onRead]);

  /* Load messages */
  useEffect(() => {
    let cancelled = false;
    api.getMessages(friend.id).then(({ messages: msgs }) => {
      if (cancelled) return;
      setMessages(msgs);
      lastIdRef.current = msgs.length > 0 ? msgs[msgs.length - 1].id : undefined;
    });
    return () => { cancelled = true; };
  }, [friend.id]);

  /* Poll */
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const { messages: msgs } = await api.getMessages(friend.id, lastIdRef.current);
        if (msgs.length > 0) {
          setMessages((prev) => {
            const existing = new Set(prev.map((m) => m.id));
            const fresh = msgs.filter((m) => !existing.has(m.id));
            return fresh.length > 0 ? [...prev, ...fresh] : prev;
          });
          lastIdRef.current = msgs[msgs.length - 1].id;
        }
      } catch { /* silent */ }
    }, 5000);
    return () => clearInterval(interval);
  }, [friend.id]);

  async function handleSend(body: string) {
    const { message } = await api.sendMessage(friend.id, body);
    setMessages((prev) => [...prev, message]);
    lastIdRef.current = message.id;
  }

  async function handleReply(body: string, replyToId: number) {
    const { message } = await api.sendMessage(friend.id, body, { replyToId });
    // The server returns the reply with joined reply info
    setMessages((prev) => [...prev, message]);
    lastIdRef.current = message.id;
    setReplyingTo(null);
  }

  async function handleEditMessage(messageId: number, newBody: string) {
    const { message } = await api.editDmMessage(messageId, newBody);
    setMessages((prev) => prev.map((m) => (m.id === messageId ? message : m)));
  }

  async function handleDeleteMessage(messageId: number) {
    await api.deleteDmMessage(messageId);
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  }

  /* Convert to unified type */
  const chatMessages = useMemo(
    () => messages.map((m) => dmToChatMessage(m, currentUserId)),
    [messages, currentUserId],
  );

  return (
    <Modal onClose={onClose} variant="side-right">
      <div className="flex h-full w-full flex-col border-l border-[var(--border-subtle)] bg-[var(--bg)]/95 backdrop-blur-xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-[var(--border-subtle)] px-4 py-3">
          <UserAvatar user={friend} size={36} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[var(--text)]">
              {friend.displayName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--text-muted)] transition hover:bg-[var(--accent-bg)] hover:text-[var(--accent)]"
          >
            <XIcon size={18} />
          </button>
        </div>

        {/* Shared ChatThread */}
        <ChatThread
          messages={chatMessages}
          currentUserId={currentUserId}
          reduced={reduced}
          onSend={handleSend}
          onReply={handleReply}
          onEdit={handleEditMessage}
          onDelete={handleDeleteMessage}
          onReplyMessage={(m) => {
            const dm = messages.find((x) => x.id === m.id);
            if (dm) setReplyingTo(dm);
          }}
          replyingTo={replyingTo ? dmToChatMessage(replyingTo, currentUserId) : null}
          onCancelReply={() => setReplyingTo(null)}
        />
      </div>
    </Modal>
  );
}
