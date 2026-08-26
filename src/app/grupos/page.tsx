"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  Crown,
  Flame,
  Loader2,
  MessageCircle,
  Plus,
  Send,
  Timer,
  Users,
  X as XIcon,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Header } from "@/components/navigation";
import { useAuthRedirect } from "@/lib/auth-context";
import { api } from "@/lib/api-client";
import type {
  FriendSummary,
  GroupDetail,
  GroupMessage,
  GroupSummary,
} from "@/types";

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

const EMOJI_OPTIONS = ["⚡", "🔥", "✨", "💎", "🌙", "☀️", "🌊", "🌿", "🎯", "💜", "🌀", "⭐", "🚀", "🧠"];

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

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const } },
};
const slideLeft = {
  hidden: { x: "100%", opacity: 0 },
  visible: { x: 0, opacity: 1, transition: { type: "spring" as const, stiffness: 300, damping: 30 } },
  exit: { x: "100%", opacity: 0, transition: { duration: 0.2 } },
};

/* ------------------------------------------------------------------ */
/*  Main Page                                                         */
/* ------------------------------------------------------------------ */

export default function GruposPage() {
  const { user, loading: authLoading } = useAuthRedirect({ ifGuest: "/" });
  const reduced = useReducedMotion() ?? false;

  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* Create form */
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createEmoji, setCreateEmoji] = useState("⚡");
  const [inviteIds, setInviteIds] = useState<string[]>([]);
  const [friends, setFriends] = useState<FriendSummary[]>([]);
  const [creating, setCreating] = useState(false);

  /* Detail view */
  const [activeGroup, setActiveGroup] = useState<GroupDetail | null>(null);

  /* ---------------------------------------------------------------- */
  /*  Data fetching                                                   */
  /* ---------------------------------------------------------------- */

  const loadGroups = useCallback(async () => {
    try {
      setError(null);
      const { groups: g } = await api.getGroups();
      setGroups(g);
    } catch {
      setError("Não foi possível carregar os grupos.");
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    loadGroups().then(() => { if (cancelled) return; });
    return () => { cancelled = true; };
  }, [authLoading, user?.uid, loadGroups]);

  /* Load friends when create form opens */
  useEffect(() => {
    if (!showCreate || friends.length > 0) return;
    api.getFriends().then(({ friends: f }) => setFriends(f)).catch(() => {});
  }, [showCreate, friends.length]);

  /* ---------------------------------------------------------------- */
  /*  Create group                                                    */
  /* ---------------------------------------------------------------- */

  const handleCreate = useCallback(async () => {
    const name = createName.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      const { group } = await api.createGroup({ name, avatarEmoji: createEmoji, inviteIds });
      setGroups((prev) => [
        {
          id: group.id,
          name: group.name,
          avatarEmoji: group.avatarEmoji,
          avatarUrl: group.avatarUrl,
          memberCount: group.members.length,
          weeklyFocusMinutes: group.weeklyFocusMinutes,
          unreadCount: 0,
        },
        ...prev,
      ]);
      setActiveGroup(group);
      setShowCreate(false);
      setCreateName("");
      setCreateEmoji("⚡");
      setInviteIds([]);
    } catch {
      setError("Não foi possível criar o grupo.");
    } finally {
      setCreating(false);
    }
  }, [createName, createEmoji, inviteIds, creating]);

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
        <Header eyebrow="Comunidade" title="Grupos" />

        {error && (
          <div className="glass-card mb-8 border-[var(--red)]/20 bg-[var(--red-bg)] p-4 text-sm text-[var(--red)]">
            {error}
          </div>
        )}

        <AnimatePresence mode="wait">
          {activeGroup ? (
            <GroupDetailPanel
              key={`detail-${activeGroup.id}`}
              group={activeGroup}
              currentUserId={user.uid}
              reduced={reduced}
              onBack={() => setActiveGroup(null)}
              onRead={(groupId) => {
                setGroups((prev) =>
                  prev.map((g) => (g.id === groupId ? { ...g, unreadCount: 0 } : g)),
                );
              }}
            />
          ) : (
            <motion.div
              key="list"
              initial={reduced ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              {/* -------------------------------------------------------------- */}
              {/*  Top bar                                                       */}
              {/* -------------------------------------------------------------- */}
              <div className="mb-6 flex items-center justify-between">
                <h2 className="font-display text-lg text-[var(--text-secondary)]">
                  Seus grupos
                </h2>
                <button
                  onClick={() => setShowCreate((v) => !v)}
                  className="btn-primary flex items-center gap-2 px-4 py-2 text-sm"
                >
                  {showCreate ? <XIcon size={16} /> : <Plus size={16} />}
                  {showCreate ? "Cancelar" : "Criar grupo"}
                </button>
              </div>

              {/* -------------------------------------------------------------- */}
              {/*  Create group form                                             */}
              {/* -------------------------------------------------------------- */}
              <AnimatePresence>
                {showCreate && (
                  <motion.div
                    variants={fadeUp}
                    initial="hidden"
                    animate="visible"
                    exit="hidden"
                    className="glass-card mb-8 space-y-5 p-5"
                  >
                    {/* Name */}
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">
                        Nome do grupo
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: Time Foco Total"
                        value={createName}
                        onChange={(e) => setCreateName(e.target.value)}
                        className="glass-card w-full px-4 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--text-faint)] outline-none focus:border-[var(--accent)]/40"
                      />
                    </div>

                    {/* Emoji picker */}
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">
                        Emoji do grupo
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {EMOJI_OPTIONS.map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => setCreateEmoji(emoji)}
                            className={`flex h-10 w-10 items-center justify-center rounded-xl text-xl transition ${
                              createEmoji === emoji
                                ? "ring-2 ring-[var(--accent)] shadow-[0_0_12px_var(--glow-cyan)]"
                                : "glass-card hover:brightness-125"
                            }`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Friend invites */}
                    {friends.length > 0 && (
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">
                          Convidar amigos
                        </label>
                        <div className="max-h-48 space-y-1 overflow-y-auto">
                          {friends.map((f) => {
                            const selected = inviteIds.includes(f.id);
                            return (
                              <button
                                key={f.id}
                                onClick={() =>
                                  setInviteIds((prev) =>
                                    selected
                                      ? prev.filter((id) => id !== f.id)
                                      : [...prev, f.id],
                                  )
                                }
                                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition ${
                                  selected
                                    ? "bg-[var(--accent-bg)] border border-[var(--accent)]/30"
                                    : "glass-card hover:brightness-110"
                                }`}
                              >
                                <UserAvatar user={f} size={32} />
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm text-[var(--text)]">
                                    {f.displayName}
                                  </p>
                                </div>
                                <div
                                  className={`flex h-5 w-5 items-center justify-center rounded-md border transition ${
                                    selected
                                      ? "border-[var(--accent)] bg-[var(--accent)] text-black"
                                      : "border-[var(--border-subtle)]"
                                  }`}
                                >
                                  {selected && (
                                    <svg
                                      width="12"
                                      height="12"
                                      viewBox="0 0 12 12"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    >
                                      <polyline points="2 6 5 9 10 3" />
                                    </svg>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-3 pt-2">
                      <button
                        onClick={handleCreate}
                        disabled={!createName.trim() || creating}
                        className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm disabled:opacity-30"
                      >
                        {creating ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Plus size={14} />
                        )}
                        Criar
                      </button>
                      <button
                        onClick={() => setShowCreate(false)}
                        className="rounded-xl px-5 py-2.5 text-sm text-[var(--text-muted)] transition hover:text-[var(--text)]"
                      >
                        Cancelar
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* -------------------------------------------------------------- */}
              {/*  Groups grid                                                   */}
              {/* -------------------------------------------------------------- */}
              {groups.length === 0 ? (
                <div className="glass-card p-12 text-center">
                  <p className="mb-1 text-3xl">🎯</p>
                  <p className="text-sm text-[var(--text-muted)]">
                    Nenhum grupo ainda
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-faint)]">
                    Comece criando um grupo!
                  </p>
                </div>
              ) : (
                <motion.div
                  variants={stagger}
                  initial="hidden"
                  animate="visible"
                  className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
                >
                  {groups.map((g) => (
                    <motion.button
                      key={g.id}
                      variants={fadeUp}
                      whileHover={reduced ? undefined : { y: -2, transition: { duration: 0.15 } }}
                      whileTap={reduced ? undefined : { scale: 0.98 }}
                      onClick={() => {
                        api.getGroup(g.id).then(({ group }) => setActiveGroup(group));
                        if (g.unreadCount > 0) {
                          setGroups((prev) =>
                            prev.map((x) => (x.id === g.id ? { ...x, unreadCount: 0 } : x)),
                          );
                        }
                      }}
                      className="glass-card group relative flex flex-col items-center gap-3 px-4 py-6 text-center transition hover:border-[var(--accent)]/30"
                    >
                      <span className="text-4xl leading-none">{g.avatarEmoji}</span>
                      <p className="font-display text-sm font-medium text-[var(--text)] group-hover:text-[var(--accent)]">
                        {g.name}
                      </p>
                      <div className="flex items-center gap-4 text-[11px] text-[var(--text-muted)]">
                        <span className="flex items-center gap-1">
                          <Users size={12} />
                          {g.memberCount}
                        </span>
                        <span className="flex items-center gap-1 text-[var(--green)]">
                          <Timer size={12} />
                          {g.weeklyFocusMinutes}min
                        </span>
                      </div>

                      {g.unreadCount > 0 && (
                        <span className="absolute right-3 top-3 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[var(--accent)] px-1.5 text-[10px] font-bold text-black">
                          {g.unreadCount > 99 ? "99+" : g.unreadCount}
                        </span>
                      )}

                      <MessageCircle
                        size={16}
                        className="absolute bottom-3 right-3 text-[var(--text-faint)] transition group-hover:text-[var(--accent)]"
                      />
                    </motion.button>
                  ))}
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </AppShell>
  );
}

/* ------------------------------------------------------------------ */
/*  Group Detail Panel                                                */
/* ------------------------------------------------------------------ */

function GroupDetailPanel({
  group: initialGroup,
  currentUserId,
  reduced,
  onBack,
  onRead,
}: {
  group: GroupDetail;
  currentUserId: string;
  reduced: boolean;
  onBack: () => void;
  onRead: (groupId: number) => void;
}) {
  const [group] = useState(initialGroup);
  const [tab, setTab] = useState<"chat" | "members">("chat");

  /* Chat state */
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastIdRef = useRef<number | undefined>(undefined);

  /* Mark read on open */
  useEffect(() => {
    let cancelled = false;
    api.markGroupRead(group.id).then(() => {
      if (!cancelled) onRead(group.id);
    });
    return () => { cancelled = true; };
  }, [group.id, onRead]);

  /* Load messages */
  useEffect(() => {
    let cancelled = false;
    api.getGroupMessages(group.id).then(({ messages: msgs }) => {
      if (cancelled) return;
      setMessages(msgs);
      lastIdRef.current = msgs.length > 0 ? msgs[msgs.length - 1].id : undefined;
    });
    return () => { cancelled = true; };
  }, [group.id]);

  /* Poll for new messages */
  useEffect(() => {
    if (tab !== "chat") return;
    const interval = setInterval(async () => {
      try {
        const { messages: msgs } = await api.getGroupMessages(group.id, lastIdRef.current);
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
  }, [group.id, tab]);

  /* Auto-scroll */
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  /* Send message */
  async function handleSend() {
    const body = input.trim();
    if (!body || sending) return;
    setInput("");
    setSending(true);
    try {
      const { message } = await api.sendGroupMessage(group.id, body);
      setMessages((prev) => [...prev, message]);
      lastIdRef.current = message.id;
    } catch {
      setInput(body);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <motion.div
      variants={slideLeft}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="-mx-5 -my-7 flex min-h-[100dvh] flex-col sm:-mx-8 lg:-mx-12 lg:-my-10"
    >
      {/* -------------------------------------------------------------- */}
      {/*  Header                                                        */}
      {/* -------------------------------------------------------------- */}
      <div className="flex items-center gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg)]/80 px-5 py-3 backdrop-blur-lg sm:px-8 lg:px-12">
        <button
          onClick={onBack}
          className="rounded-lg p-1.5 text-[var(--text-muted)] transition hover:bg-[var(--accent-bg)] hover:text-[var(--accent)]"
        >
          <ArrowLeft size={20} />
        </button>

        <span className="text-2xl leading-none">{group.avatarEmoji}</span>

        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-sm font-medium text-[var(--text)]">
            {group.name}
          </p>
          <p className="text-[11px] text-[var(--text-faint)]">
            {group.members.length} membros · {group.weeklyFocusMinutes}min/semana
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex overflow-hidden rounded-xl border border-[var(--border-subtle)]">
          <button
            onClick={() => setTab("chat")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs transition ${
              tab === "chat"
                ? "bg-[var(--accent-bg)] text-[var(--accent)]"
                : "text-[var(--text-muted)] hover:text-[var(--text)]"
            }`}
          >
            <MessageCircle size={13} />
            Chat
          </button>
          <button
            onClick={() => setTab("members")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs transition ${
              tab === "members"
                ? "bg-[var(--accent-bg)] text-[var(--accent)]"
                : "text-[var(--text-muted)] hover:text-[var(--text)]"
            }`}
          >
            <Users size={13} />
            Membros
          </button>
        </div>
      </div>

      {/* -------------------------------------------------------------- */}
      {/*  Chat tab                                                      */}
      {/* -------------------------------------------------------------- */}
      {tab === "chat" && (
        <>
          <div
            ref={scrollRef}
            className="flex-1 space-y-3 overflow-y-auto px-5 py-4 sm:px-8 lg:px-12"
          >
            {messages.length === 0 && (
              <p className="pt-12 text-center text-xs text-[var(--text-faint)]">
                Nenhuma mensagem ainda
              </p>
            )}
            {messages.map((msg) => {
              const isMe = msg.senderId === currentUserId;
              return (
                <motion.div
                  key={msg.id}
                  initial={reduced ? false : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex gap-2.5 ${isMe ? "flex-row-reverse" : "flex-row"}`}
                >
                  {/* Sender avatar */}
                  <div className="mt-0.5 shrink-0">
                    <UserAvatar
                      user={{
                        displayName: msg.senderName,
                        photoUrl: msg.senderPhotoUrl,
                      }}
                      size={32}
                    />
                  </div>

                  {/* Bubble */}
                  <div className={`max-w-[75%] ${isMe ? "items-end" : "items-start"}`}>
                    {!isMe && (
                      <p className="mb-0.5 text-[10px] font-medium text-[var(--text-muted)]">
                        {msg.senderName}
                      </p>
                    )}
                    <div
                      className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                        isMe
                          ? "rounded-br-md bg-[var(--accent)] text-black"
                          : "glass-card rounded-bl-md text-[var(--text)]"
                      }`}
                    >
                      {msg.body}
                    </div>
                    <p
                      className={`mt-0.5 text-[9px] ${
                        isMe ? "text-right text-[var(--text-faint)]" : "text-[var(--text-faint)]"
                      }`}
                    >
                      {relativeTime(msg.createdAt)}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Input */}
          <div className="border-t border-[var(--border-subtle)] bg-[var(--bg)]/80 px-5 py-3 backdrop-blur-lg sm:px-8 lg:px-12">
            <div className="glass-card flex items-center gap-2 px-3 py-2">
              <input
                type="text"
                placeholder="Mensagem..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full bg-transparent text-sm text-[var(--text)] placeholder:text-[var(--text-faint)] outline-none"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || sending}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)] text-black transition hover:brightness-110 disabled:opacity-30"
              >
                {sending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Send size={14} />
                )}
              </button>
            </div>
          </div>
        </>
      )}

      {/* -------------------------------------------------------------- */}
      {/*  Members tab                                                   */}
      {/* -------------------------------------------------------------- */}
      {tab === "members" && (
        <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-8 lg:px-12">
          {/* Stats card */}
          <div className="glass-card mb-6 flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--green-bg)] text-[var(--green)]">
              <Timer size={22} />
            </div>
            <div>
              <p className="text-lg font-bold text-[var(--text)]">
                {group.weeklyFocusMinutes}
                <span className="ml-1 text-xs font-normal text-[var(--text-muted)]">min</span>
              </p>
              <p className="text-[11px] text-[var(--text-faint)]">foco total da semana</p>
            </div>
            <div className="ml-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent-bg)] text-[var(--accent)]">
              <Users size={22} />
            </div>
            <div>
              <p className="text-lg font-bold text-[var(--text)]">
                {group.members.length}
              </p>
              <p className="text-[11px] text-[var(--text-faint)]">membros</p>
            </div>
          </div>

          {/* Member list */}
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="visible"
            className="space-y-2"
          >
            {group.members
              .slice()
              .sort((a, b) => (a.role === "owner" ? -1 : b.role === "owner" ? 1 : 0))
              .map((m) => (
                <motion.div
                  key={m.id}
                  variants={fadeUp}
                  className="glass-card flex items-center gap-3 px-4 py-3"
                >
                  <UserAvatar
                    user={{ displayName: m.displayName, photoUrl: m.photoUrl }}
                    size={40}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-[var(--text)]">
                        {m.displayName}
                      </p>
                      {m.role === "owner" && (
                        <Crown size={13} className="shrink-0 text-[var(--orange)]" />
                      )}
                    </div>
                    {m.username && (
                      <p className="truncate text-xs text-[var(--text-muted)]">
                        @{m.username}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-[var(--orange)]">
                    <Flame size={12} fill="currentColor" />
                    {m.currentStreak}
                  </div>
                </motion.div>
              ))}
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
