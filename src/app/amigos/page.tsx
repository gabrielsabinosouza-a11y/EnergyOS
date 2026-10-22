"use client";

import "@/app/amigos-chat.css";

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { animate, motion, AnimatePresence, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import type { Variants } from "framer-motion";
import Image from "next/image";
import {
  Check,
  Activity,
  ArrowDownWideNarrow,
  ArrowRight,
  ArrowUpRight,
  Command,
  Crown,
  Flame,
  Heart,
  Loader2,
  MessageCircle,
  Radio,
  Search,
  SlidersHorizontal,
  Sparkles,
  UserMinus,
  UserPlus,
  UsersRound,
  Zap,
  X,
  XIcon,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Header } from "@/components/navigation";
import { Modal } from "@/components/modal";
import { ChatThread, ChatComposer, ConversationContextMenu, convActions } from "@/components/chat";
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
      <Image
        src={user.photoUrl}
        alt={user.displayName}
        width={size}
        height={size}
        unoptimized
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

function isRecentlyActive(friend: FriendSummary, minutes = 15, now = Date.now()) {
  if (!friend.lastActiveAt) return false;
  const elapsed = now - new Date(friend.lastActiveAt).getTime();
  return elapsed >= 0 && elapsed <= minutes * 60_000;
}

function AnimatedMetric({ value, reduced }: { value: number; reduced: boolean }) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => Math.round(latest).toLocaleString("pt-BR"));
  const [display, setDisplay] = useState("0");

  useEffect(() => {
    const unsubscribe = rounded.on("change", setDisplay);
    if (reduced) {
      count.set(value);
      return unsubscribe;
    }
    const controls = animate(count, value, { duration: 1.1, ease: [0.22, 1, 0.36, 1] });
    return () => { unsubscribe(); controls.stop(); };
  }, [count, reduced, rounded, value]);

  return <motion.span>{display}</motion.span>;
}

function FriendCard({
  friend,
  favorite,
  reduced,
  onChat,
  onToggleFavorite,
  onContextMenu,
}: {
  friend: FriendSummary;
  favorite: boolean;
  reduced: boolean;
  onChat: () => void;
  onToggleFavorite: () => void;
  onContextMenu: (event: ReactMouseEvent) => void;
}) {
  const active = isRecentlyActive(friend);
  return (
    <motion.article
      layout
      whileHover={reduced ? undefined : { y: -6, transition: { type: "spring", stiffness: 220, damping: 22 } }}
      whileTap={reduced ? undefined : { scale: .985 }}
      onContextMenu={onContextMenu}
      className="group relative min-w-0 overflow-hidden rounded-2xl border border-white/[.075] bg-[#0a1930]/75 p-4 shadow-[0_12px_40px_-28px_rgba(34,211,238,.35)] backdrop-blur-xl transition-colors duration-300 hover:border-cyan-300/25 hover:bg-[#10233b]/90 hover:shadow-[0_18px_55px_-28px_rgba(34,211,238,.34)] sm:p-5"
    >
      <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-cyan-300/[.07] blur-3xl transition-opacity group-hover:opacity-150" />
      <div className="relative flex items-start gap-3.5">
        <motion.div whileHover={reduced ? undefined : { rotate: 2, scale: 1.06 }} transition={{ type: "spring", stiffness: 220, damping: 22 }} className="relative shrink-0 rounded-2xl p-[2px] bg-gradient-to-br from-cyan-300/70 via-sky-400/20 to-blue-500/20">
          <div className="rounded-[14px] bg-[#071225] p-[2px]"><UserAvatar user={friend} size={54} /></div>
          <span className={`absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-[3px] border-[#0a1930] ${active ? "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,.8)]" : "bg-slate-500"}`} aria-label={active ? "Ativo recentemente" : "Offline"} />
        </motion.div>
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex min-w-0 items-center gap-1.5">
            <h3 className="truncate text-sm font-semibold tracking-[-.02em] text-slate-100 group-hover:text-cyan-100">{friend.displayName}</h3>
            {friend.currentStreak >= 30 && <Crown size={13} className="shrink-0 text-amber-300" aria-label="Sequência de 30 dias ou mais" />}
          </div>
          <p className="mt-0.5 truncate text-xs text-slate-400">{friend.username ? `@${friend.username}` : "Sua conexão no EnergyOS"}</p>
          <p className={`mt-2 flex items-center gap-1.5 text-[10px] font-medium ${active ? "text-emerald-300" : "text-slate-500"}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-emerald-400" : "bg-slate-500"}`} />
            {active ? `Ativo há ${relativeTime(friend.lastActiveAt)}` : friend.lastActiveAt ? `Visto há ${relativeTime(friend.lastActiveAt)}` : "Ainda sem atividade"}
          </p>
        </div>
        <button type="button" onClick={onToggleFavorite} aria-label={favorite ? `Remover ${friend.displayName} dos favoritos` : `Favoritar ${friend.displayName}`} aria-pressed={favorite} className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border transition ${favorite ? "border-pink-300/20 bg-pink-300/10 text-pink-300" : "border-transparent text-slate-500 hover:border-white/10 hover:bg-white/5 hover:text-pink-300"}`}>
          <Heart size={15} fill={favorite ? "currentColor" : "none"} />
        </button>
      </div>

      <div className="relative mt-4 flex items-center gap-2 border-t border-white/[.06] pt-3.5">
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-orange-300/[.08] px-2.5 py-1.5 text-xs font-semibold text-orange-200">
          <Image src={streakIconSource(friend.currentStreak)} alt="" width={13} height={13} unoptimized />
          {friend.currentStreak} <span className="font-normal text-orange-100/60">dias</span>
        </span>
        {friend.unreadCount > 0 && <span className="ml-auto rounded-full bg-cyan-300 px-2 py-1 text-[10px] font-bold text-[#061321]">{friend.unreadCount > 99 ? "99+" : friend.unreadCount} novas</span>}
      </div>

      <div className="relative mt-3 grid grid-cols-[1fr_auto_auto] gap-2">
        <button type="button" onClick={onChat} className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-3 text-xs font-bold text-[#061321] transition hover:bg-cyan-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200">
          <MessageCircle size={14} /> Conversar
        </button>
        <a href={`/perfil/${friend.id}`} aria-label={`Ver perfil de ${friend.displayName}`} className="grid h-9 w-9 place-items-center rounded-xl border border-white/[.08] text-slate-300 transition hover:border-cyan-200/25 hover:bg-cyan-200/[.07] hover:text-cyan-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-200">
          <ArrowUpRight size={15} />
        </a>
        <button type="button" onClick={onContextMenu} aria-label={`Mais opções para ${friend.displayName}`} className="grid h-9 w-9 place-items-center rounded-xl border border-white/[.08] text-slate-400 transition hover:border-white/15 hover:bg-white/[.06] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-200">
          <SlidersHorizontal size={14} />
        </button>
      </div>
    </motion.article>
  );
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

  /* Current user's app-level profile id (parseProfileId(uid)). All ownership
     comparisons (senderId, read receipts, isMe, etc.) must use this, NEVER the
     raw Firebase user.uid — the server stores the hashed UUID form. */
  const [myProfileId, setMyProfileId] = useState<string | null>(null);
  /* Ownership comparisons (senderId === currentUserId) must use the app-level
     profile id, never the raw user.uid. We also gate ChatThread rendering on
     profileIdReady so the comparison never runs against the uid fallback
     during the (brief) window before getProfile() settles. */
  const [profileIdReady, setProfileIdReady] = useState(false);
  /* Ownership key: only ever the normalized id. The raw uid is never valid,
     so there is no fallback — profileIdReady gates every consumer. */
  const currentUserId = myProfileId ?? "";

  /* Conversation list context menu */
  const [listMenu, setListMenu] = useState<{ x: number; y: number; friend: FriendSummary } | null>(null);

  /* Search */
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [friendFilter, setFriendFilter] = useState<"all" | "active" | "favorites">("all");
  const [friendSort, setFriendSort] = useState<"active" | "streak" | "name">("active");
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => new Set());
  const favoritesLoadedRef = useRef(false);
  const [clock, setClock] = useState(() => Date.now());

  useEffect(() => {
    try {
      const stored = localStorage.getItem("energyos:friend-favorites");
      if (stored) setFavoriteIds(new Set(JSON.parse(stored) as string[]));
    } catch { /* use an empty favorites list when storage is unavailable */ }
    favoritesLoadedRef.current = true;
  }, []);

  useEffect(() => {
    if (favoritesLoadedRef.current) localStorage.setItem("energyos:friend-favorites", JSON.stringify([...favoriteIds]));
  }, [favoriteIds]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
      if (event.key === "Escape") {
        setSearchFocused(false);
        searchInputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

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
    Promise.resolve().then(loadData).then(() => { if (cancelled) return; });
    return () => { cancelled = true; };
  }, [authLoading, user, loadData]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    let attempts = 0;
    const retry = () => {
      if (!active) return;
      attempts += 1;
      if (attempts <= 3) setTimeout(attempt, 1200 * attempts);
      // never turn profileIdReady on without a resolved id: the raw uid is
      // never a valid ownership key, so the chat stays on its loading state.
    };
    const attempt = () => {
      if (!active) return;
      api.getProfile()
        .then(({ user: profile }) => {
          if (!active || !profile?.id) { retry(); return; }
          setMyProfileId(profile.id);
          setProfileIdReady(true);
        })
        .catch(() => retry());
    };
    attempt();
    return () => { active = false; };
  }, [user]);

  /* Search debounce */
  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const normalizedQuery = q.trim().replace(/^@+/, "");
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const { results } = await api.searchUsers(normalizedQuery);
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
  const activeFriends = useMemo(() => friends.filter((friend) => isRecentlyActive(friend, 15, clock)), [friends, clock]);
  const unreadTotal = useMemo(() => friends.reduce((total, friend) => total + friend.unreadCount, 0), [friends]);
  const networkStreakDays = useMemo(() => friends.reduce((total, friend) => total + friend.currentStreak, 0), [friends]);
  const visibleFriends = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase("pt-BR").replace(/^@+/, "");
    return friends
      .filter((friend) => !query || friend.displayName.toLocaleLowerCase("pt-BR").includes(query) || friend.username?.toLocaleLowerCase("pt-BR").includes(query))
      .filter((friend) => friendFilter !== "active" || activeFriends.some((active) => active.id === friend.id))
      .filter((friend) => friendFilter !== "favorites" || favoriteIds.has(friend.id))
      .sort((a, b) => friendSort === "streak" ? b.currentStreak - a.currentStreak : friendSort === "name" ? a.displayName.localeCompare(b.displayName, "pt-BR") : (b.lastActiveAt ? new Date(b.lastActiveAt).getTime() : 0) - (a.lastActiveAt ? new Date(a.lastActiveAt).getTime() : 0));
  }, [friends, searchQuery, friendFilter, friendSort, activeFriends, favoriteIds]);

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
      <main className="relative min-h-screen w-full max-w-none px-4 py-7 sm:px-6 sm:py-8 lg:px-8 lg:py-10 xl:px-12">
        <Header eyebrow="Social" title="Amigos" />

        <motion.section initial="hidden" animate="visible" variants={stagger} className="relative isolate mb-7 mt-3 overflow-hidden rounded-[28px] border border-cyan-200/[.11] bg-[linear-gradient(125deg,rgba(10,25,48,.96),rgba(7,18,37,.88)_52%,rgba(14,35,59,.86))] px-5 py-7 shadow-[0_25px_90px_-48px_rgba(34,211,238,.36)] sm:px-8 sm:py-9 lg:px-10">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
            <div className="absolute -right-20 -top-36 h-80 w-80 rounded-full bg-cyan-300/[.12] blur-[100px]" />
            <div className="absolute -bottom-40 left-[28%] h-72 w-72 rounded-full bg-blue-500/[.12] blur-[100px]" />
            <div className="absolute inset-0 opacity-[.13] [background-image:radial-gradient(rgba(190,230,255,.6)_1px,transparent_1px)] [background-size:23px_23px]" />
          </div>
          <motion.div variants={fadeUp} className="relative z-10 max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-200/15 bg-cyan-200/[.06] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[.18em] text-cyan-100/80"><Sparkles size={13} /> Sua rede em movimento</div>
            <h1 className="font-display text-3xl font-semibold leading-[1.08] tracking-[-.045em] text-white sm:text-4xl lg:text-[3.35rem]">Conecte-se. <span className="bg-gradient-to-r from-cyan-200 via-sky-300 to-blue-400 bg-clip-text text-transparent">Evolua.</span> Cresça.</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300/75 sm:text-base">Sua rede de crescimento dentro do EnergyOS. Celebre consistência, acompanhe seu círculo e mantenha a energia em movimento.</p>
          </motion.div>

          <motion.div variants={stagger} className="relative z-10 mt-7 grid grid-cols-2 gap-2.5 sm:mt-8 sm:grid-cols-4 sm:gap-3">
            {[
              { label: "Amigos", value: friends.length, icon: UsersRound, tint: "text-cyan-200", accent: "bg-cyan-200" },
              { label: "Ativos · 15 min", value: activeFriends.length, icon: Radio, tint: "text-emerald-300", accent: "bg-emerald-300" },
              { label: "Não lidas", value: unreadTotal, icon: MessageCircle, tint: "text-sky-300", accent: "bg-sky-300" },
              { label: "Dias de sequência", value: networkStreakDays, icon: Flame, tint: "text-orange-300", accent: "bg-orange-300" },
            ].map(({ label, value, icon: Icon, tint, accent }) => (
              <motion.div key={label} variants={fadeUp} whileHover={reduced ? undefined : { y: -3 }} className="relative overflow-hidden rounded-2xl border border-white/[.075] bg-[#061326]/55 p-3.5 backdrop-blur-xl sm:p-4">
                <span className={`absolute inset-x-4 top-0 h-px ${accent} opacity-40`} />
                <div className="flex items-center justify-between"><span className="text-[10px] font-medium uppercase tracking-[.13em] text-slate-400 sm:text-[11px]">{label}</span><Icon size={15} className={tint} /></div>
                <div className={`mt-2 text-2xl font-semibold tracking-[-.04em] ${tint}`}><AnimatedMetric value={value} reduced={!!reduced} /></div>
              </motion.div>
            ))}
          </motion.div>
        </motion.section>

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
          className="relative mb-8"
        >
          <div className={`relative flex items-center gap-3 rounded-2xl border bg-[#09182d]/80 px-4 py-3.5 shadow-[0_12px_45px_-35px_rgba(34,211,238,.8)] backdrop-blur-xl transition-all duration-300 ${searchFocused ? "border-cyan-200/40 shadow-[0_0_0_4px_rgba(34,211,238,.07),0_15px_50px_-30px_rgba(34,211,238,.55)]" : "border-white/[.08] hover:border-white/[.15]"}`}>
            <Search size={18} className={`shrink-0 transition-colors ${searchFocused ? "text-cyan-200" : "text-slate-400"}`} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Buscar usuarios..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() => {
                setSearchFocused(true);
                if (!searchQuery) handleSearch("");
              }}
              onBlur={() => window.setTimeout(() => setSearchFocused(false), 150)}
              className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 outline-none"
            />
            {searching && <Loader2 size={16} className="shrink-0 animate-spin text-[var(--accent)]" />}
            <span className="hidden shrink-0 items-center gap-1 rounded-md border border-white/10 bg-white/[.04] px-2 py-1 text-[10px] text-slate-400 sm:inline-flex"><Command size={11} /> K</span>
          </div>

          <AnimatePresence>
            {searchFocused && searchResults.length > 0 && (
              <motion.div
                variants={stagger}
                initial="hidden"
                animate="visible"
                exit="hidden"
                className="absolute inset-x-0 z-30 mt-2 space-y-1.5 rounded-2xl border border-white/10 bg-[#071426]/95 p-2 shadow-2xl shadow-black/50 backdrop-blur-2xl"
              >
                <p className="px-1 text-[10px] uppercase tracking-widest text-[var(--text-faint)]">
                  {searchQuery.trim() ? "Pessoas para conhecer" : "Sugestões para sua rede"}
                </p>
                {searchResults.map((r) => (
                  <motion.div
                    key={r.id}
                    variants={fadeUp}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-white/[.045]"
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

        <motion.section variants={fadeUp} initial="hidden" animate="visible" className="mb-8">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div><p className="mb-1 text-[10px] font-semibold uppercase tracking-[.2em] text-cyan-200/65">Suas conexões em destaque</p><h2 className="font-display text-xl font-semibold tracking-[-.03em] text-slate-100 sm:text-2xl">Seu círculo principal</h2></div>
            <span className="hidden items-center gap-1.5 pb-1 text-[11px] text-slate-500 sm:flex"><Activity size={13} className="text-cyan-200/70" /> Sinais da sua rede</span>
          </div>
          {friends.length === 0 ? (
            <div className="flex min-h-36 items-center justify-between gap-4 rounded-2xl border border-dashed border-cyan-200/15 bg-[#09182d]/50 p-5 sm:p-7">
              <div><p className="font-semibold text-slate-100">Seu próximo capítulo começa com uma conexão.</p><p className="mt-1 text-sm text-slate-400">Busque alguém pelo nome ou username e convide para crescer junto.</p></div>
              <UsersRound size={25} className="shrink-0 text-cyan-200/60" />
            </div>
          ) : (
            <motion.div variants={stagger} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[...friends].sort((a, b) => Number(favoriteIds.has(b.id)) - Number(favoriteIds.has(a.id)) || Number(isRecentlyActive(b, 15, clock)) - Number(isRecentlyActive(a, 15, clock)) || b.currentStreak - a.currentStreak).slice(0, 4).map((friend) => (
                <motion.button key={friend.id} variants={fadeUp} layout whileHover={reduced ? undefined : { y: -4 }} onClick={() => setActiveChat(friend)} className="group relative flex min-w-0 items-center gap-3 overflow-hidden rounded-2xl border border-cyan-200/[.12] bg-[linear-gradient(115deg,rgba(14,35,59,.88),rgba(7,18,37,.92))] p-3.5 text-left shadow-[0_12px_40px_-34px_rgba(34,211,238,.55)] transition hover:border-cyan-200/30 hover:shadow-[0_16px_45px_-30px_rgba(34,211,238,.42)]">
                  <span aria-hidden="true" className="absolute -right-5 -top-8 h-24 w-24 rounded-full bg-cyan-300/[.08] blur-2xl" />
                  <span className="relative rounded-[14px] bg-gradient-to-br from-cyan-200/80 via-sky-300/20 to-blue-500/50 p-[2px]"><span className="block rounded-xl bg-[#071225] p-[2px]"><UserAvatar user={friend} size={46} /></span><span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#0a1930] ${isRecentlyActive(friend, 15, clock) ? "bg-emerald-400" : "bg-slate-500"}`} /></span>
                  <span className="relative min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-100">{friend.displayName}</span><span className="mt-1 flex items-center gap-1 text-[10px] text-slate-400"><Flame size={11} className="text-orange-300" /> {friend.currentStreak} dias de sequência</span></span>
                  <ArrowRight size={15} className="relative shrink-0 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-cyan-200" />
                </motion.button>
              ))}
            </motion.div>
          )}
        </motion.section>

        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
          <motion.section layout variants={fadeUp} initial="hidden" animate="visible" className="min-w-0">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div><p className="mb-1 text-[10px] font-semibold uppercase tracking-[.2em] text-slate-500">Sua rede</p><h2 className="font-display text-xl font-semibold tracking-[-.03em] text-slate-100">Amigos <span className="ml-1 text-sm font-medium text-slate-500">{visibleFriends.length}</span></h2></div>
              <label className="flex items-center gap-2 self-start rounded-xl border border-white/[.08] bg-[#09182d]/65 px-3 py-2 text-xs text-slate-400 sm:self-auto"><ArrowDownWideNarrow size={14} className="text-cyan-200/75" /><span className="sr-only">Ordenar amigos</span><select value={friendSort} onChange={(event) => setFriendSort(event.target.value as typeof friendSort)} className="bg-transparent text-xs text-slate-300 outline-none"><option value="active">Ativos recentemente</option><option value="streak">Maior sequência</option><option value="name">Nome</option></select></label>
            </div>
            <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Filtrar amigos">
              {([{ id: "all", label: "Todos" }, { id: "active", label: "Ativos" }, { id: "favorites", label: "Favoritos" }] as const).map(({ id, label }) => <button key={id} type="button" aria-pressed={friendFilter === id} onClick={() => setFriendFilter(id)} className={`shrink-0 rounded-lg px-3 py-2 text-xs font-medium transition ${friendFilter === id ? "bg-cyan-200/[.11] text-cyan-100 ring-1 ring-cyan-200/15" : "text-slate-500 hover:bg-white/[.04] hover:text-slate-300"}`}>{label}{id === "active" && <span className="ml-1.5 text-[10px] opacity-65">{activeFriends.length}</span>}</button>)}
            </div>
            {visibleFriends.length === 0 ? (
              <div className="grid min-h-48 place-items-center rounded-2xl border border-dashed border-white/10 bg-[#09182d]/40 px-6 py-10 text-center"><div><div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-2xl border border-cyan-200/10 bg-cyan-200/[.06] text-cyan-200"><UsersRound size={19} /></div><p className="text-sm font-medium text-slate-200">{friends.length ? "Nenhuma conexão neste filtro" : "Sua rede está começando"}</p><p className="mt-1 max-w-xs text-xs leading-5 text-slate-500">{friends.length ? "Experimente outro filtro ou busque alguém pelo nome." : "Use a busca acima para encontrar pessoas e construir seu círculo."}</p></div></div>
            ) : (
              <motion.div layout variants={stagger} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                <AnimatePresence mode="popLayout">{visibleFriends.map((friend) => <FriendCard key={friend.id} friend={friend} favorite={favoriteIds.has(friend.id)} reduced={!!reduced} onChat={() => { setActiveChat(friend); if (friend.unreadCount) setFriends((prev) => prev.map((item) => item.id === friend.id ? { ...item, unreadCount: 0 } : item)); }} onToggleFavorite={() => setFavoriteIds((prev) => { const next = new Set(prev); if (next.has(friend.id)) next.delete(friend.id); else next.add(friend.id); return next; })} onContextMenu={(event) => { event.preventDefault(); setListMenu({ x: event.clientX, y: event.clientY, friend }); }} />)}</AnimatePresence>
              </motion.div>
            )}
          </motion.section>

          <motion.aside initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: .15, duration: .35 }} className="space-y-4 xl:sticky xl:top-6">
            <section className="overflow-hidden rounded-2xl border border-white/[.08] bg-[#09182d]/70 p-4 backdrop-blur-xl sm:p-5">
              <div className="mb-4 flex items-center justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-slate-500">Sinal da comunidade</p><h2 className="mt-1 text-sm font-semibold text-slate-100">Pulso da sua rede</h2></div><span className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-300/[.08] text-emerald-300"><Radio size={15} /></span></div>
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-300/10 bg-emerald-300/[.045] px-3 py-2.5"><span className="relative flex h-2 w-2">{!reduced && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-50" />}<span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-300" /></span><p className="text-xs text-slate-300"><strong className="font-semibold text-emerald-200">{activeFriends.length}</strong> {activeFriends.length === 1 ? "amigo ativo" : "amigos ativos"} nos últimos 15 min</p></div>
              <div className="space-y-1">
                {friends.filter((friend) => isRecentlyActive(friend, 15, clock)).slice(0, 4).map((friend) => <div key={friend.id} className="flex items-center gap-2.5 rounded-xl px-2 py-2 transition hover:bg-white/[.035]"><UserAvatar user={friend} size={30} /><div className="min-w-0 flex-1"><p className="truncate text-xs font-medium text-slate-200">{friend.displayName}</p><p className="mt-0.5 text-[10px] text-emerald-300/75">Ativo há {relativeTime(friend.lastActiveAt)}</p></div><button type="button" onClick={() => setActiveChat(friend)} aria-label={`Conversar com ${friend.displayName}`} className="grid h-7 w-7 place-items-center rounded-lg text-slate-500 hover:bg-cyan-200/10 hover:text-cyan-100"><MessageCircle size={13} /></button></div>)}
                {activeFriends.length === 0 && <p className="px-2 py-3 text-xs leading-5 text-slate-500">Quando seus amigos estiverem por aqui, você verá a presença deles neste espaço.</p>}
              </div>
            </section>

            <section className="rounded-2xl border border-cyan-200/[.1] bg-[linear-gradient(145deg,rgba(13,34,58,.8),rgba(7,18,37,.8))] p-4 sm:p-5">
              <div className="flex items-center gap-2 text-cyan-100"><Zap size={15} /><h2 className="text-sm font-semibold">Uma conversa pode acender o dia</h2></div>
              {friends.filter((friend) => friend.unreadCount > 0).length ? <div className="mt-3 space-y-2">{friends.filter((friend) => friend.unreadCount > 0).slice(0, 3).map((friend) => <button key={friend.id} type="button" onClick={() => { setActiveChat(friend); setFriends((prev) => prev.map((item) => item.id === friend.id ? { ...item, unreadCount: 0 } : item)); }} className="flex w-full items-center gap-2.5 rounded-xl border border-white/[.06] bg-black/10 p-2.5 text-left transition hover:border-cyan-200/20 hover:bg-cyan-200/[.04]"><UserAvatar user={friend} size={30} /><span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium text-slate-200">{friend.displayName}</span><span className="mt-0.5 block text-[10px] text-slate-500">Tem {friend.unreadCount} mensagem(ns) para você</span></span><ArrowRight size={13} className="shrink-0 text-cyan-200/60" /></button>)}</div> : <p className="mt-2 text-xs leading-5 text-slate-400">Sua caixa está em dia. Chame alguém para celebrar uma sequência ou planejar o próximo foco.</p>}
            </section>
          </motion.aside>
        </div>

        {/* -------------------------------------------------------------- */}
        {/*  DM Chat Panel                                                 */}
        {/* -------------------------------------------------------------- */}
        {activeChat && (
          <ChatPanel
            key={activeChat.id}
            friend={activeChat}
            currentUserId={currentUserId}
            profileIdReady={profileIdReady}
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
  profileIdReady,
  reduced,
  onClose,
  onRead,
}: {
  friend: FriendSummary;
  currentUserId: string;
  profileIdReady: boolean;
  reduced: boolean;
  onClose: () => void;
  onRead: () => void;
}) {
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [replyingTo, setReplyingTo] = useState<DirectMessage | null>(null);
  const [readMessageIds, setReadMessageIds] = useState<Set<number>>(() => new Set());
  const lastIdRef = useRef<number | undefined>(undefined);
  const lastReadCheckRef = useRef<number | undefined>(undefined);
  // Optimistic sends: messages shown immediately with a negative temp id while
  // the request is in flight. Merged back into every server list so polls can
  // never "lose" a message that hasn't been confirmed yet.
  const pendingRef = useRef<DirectMessage[]>([]);
  const tempIdRef = useRef(0);
  const incrementalMergeLoggedRef = useRef(false);

  const nextTempId = useCallback(() => -(++tempIdRef.current), []);

  const applyServerMessages = useCallback((msgs: DirectMessage[], source: "initial" | "poll" | "refresh" = "refresh") => {
    setMessages((previous) => {
      // Polling is incremental: its response contains only IDs newer than the
      // cursor. Keep the conversation history and replace matching rows so
      // server-side edits/reactions still refresh existing messages.
      const byId = new Map(previous.map((message) => [message.id, message]));
      for (const message of msgs) byId.set(message.id, message);

      for (const pending of pendingRef.current) {
        if (!byId.has(pending.id)) byId.set(pending.id, pending);
      }

      const merged = [...byId.values()].sort((a, b) => {
        const byTime = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        return byTime || a.id - b.id;
      });

      if (process.env.NODE_ENV === "development" && source === "poll" && msgs.length > 0) {
        const returnedIds = new Set(msgs.map((message) => message.id));
        const retainedCount = previous.filter((message) => !returnedIds.has(message.id)).length;
        if (retainedCount > 0 && !incrementalMergeLoggedRef.current) {
          incrementalMergeLoggedRef.current = true;
          console.debug("[dm-chat] merged incremental poll without dropping history", {
            conversationId: friend.id,
            previousCount: previous.length,
            receivedCount: msgs.length,
            retainedCount,
            mergedCount: merged.length,
          });
        }
      }

      return merged;
    });

    // The poll cursor must be the largest persisted ID. Using the final
    // timestamp-sorted entry can accidentally select a negative optimistic ID.
    const newestServerId = msgs.reduce((max, message) => Math.max(max, message.id), lastIdRef.current ?? 0);
    if (newestServerId > 0) lastIdRef.current = newestServerId;
  }, [friend.id]);

  const confirmMessage = useCallback((tempId: number, message: DirectMessage) => {
    pendingRef.current = pendingRef.current.filter((p) => p.id !== tempId);
    setMessages((prev) => {
      const hasTemp = prev.some((m) => m.id === tempId);
      const updated = hasTemp
        ? prev.map((m) => (m.id === tempId ? message : m))
        : [...prev, message];
      // Sort by timestamp ascending to ensure correct order after confirmation
      return updated.sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    });
  }, []);

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
      applyServerMessages(msgs, "initial");
    });
    return () => { cancelled = true; };
  }, [friend.id, applyServerMessages]);

  /* Poll for new messages every 2 seconds */
  const isPollingRef = useRef(true);
  useEffect(() => {
    const handleVisibilityChange = () => {
      isPollingRef.current = !document.hidden;
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    handleVisibilityChange(); // Set initial state

    const interval = setInterval(async () => {
      if (!isPollingRef.current) return;

      // Use incremental fetch: only get messages after the last known ID
      const afterId = lastIdRef.current;
      try {
        const { messages: msgs } = await api.getMessages(friend.id, afterId);
        if (msgs.length > 0) {
          applyServerMessages(msgs, "poll");
        }
      } catch { /* silent */ }
    }, 2000); // 2-second polling for near real-time feel

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(interval);
    };
  }, [friend.id, applyServerMessages]);

  /* Poll for read receipts (every 3 seconds for sender to see when recipient reads) */
  useEffect(() => {
    if (document.hidden) return;

    const interval = setInterval(async () => {
      // Only fetch read status after we have messages
      const lastId = lastIdRef.current;
      if (!lastId || lastId <= 0) return;

      // Only check if we haven't already fetched for this message
      if (lastReadCheckRef.current === lastId) return;
      lastReadCheckRef.current = lastId;

      try {
        const { messageIds } = await api.getDmReadMessageIds(friend.id, lastId);
        setReadMessageIds(new Set(messageIds));
      } catch { /* silent */ }
    }, 3000);

    return () => clearInterval(interval);
  }, [friend.id]);

  /* Optimistic helper: append a temp message immediately, return its id. */
  const addOptimisticMessage = useCallback((message: DirectMessage) => {
    pendingRef.current = [...pendingRef.current, message];
    setMessages((prev) => {
      const withNew = [...prev, message];
      // Sort by timestamp ascending to ensure correct position
      return withNew.sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    });
  }, []);

  /* Input state for composer */
  async function handleSend(body: string) {
    const tempId = nextTempId();
    addOptimisticMessage({
      id: tempId,
      senderId: currentUserId,
      recipientId: friend.id,
      body,
      messageType: "TEXT",
      createdAt: new Date().toISOString(),
      pending: true,
    });
    try {
      const { message } = await api.sendMessage(friend.id, body);
      confirmMessage(tempId, message);
    } catch (err) {
      pendingRef.current = pendingRef.current.filter((p) => p.id !== tempId);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      throw err;
    }
  }

  async function handleReply(body: string, replyToId: number) {
    const tempId = nextTempId();
    addOptimisticMessage({
      id: tempId,
      senderId: currentUserId,
      recipientId: friend.id,
      body,
      messageType: "TEXT",
      createdAt: new Date().toISOString(),
      replyToId,
      pending: true,
    });
    setReplyingTo(null);
    try {
      const { message } = await api.sendMessage(friend.id, body, { replyToId });
      confirmMessage(tempId, message);
    } catch (err) {
      pendingRef.current = pendingRef.current.filter((p) => p.id !== tempId);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      throw err;
    }
  }

  async function handleSendMedia(opts: { messageType: string; mediaUrl?: string; body?: string; mediaDurationSeconds?: number; mediaFileName?: string; mediaMimeType?: string; mediaSizeBytes?: number }) {
    const tempId = nextTempId();
    addOptimisticMessage({
      id: tempId,
      senderId: currentUserId,
      recipientId: friend.id,
      body: opts.body,
      messageType: opts.messageType,
      mediaUrl: opts.mediaUrl,
      mediaDurationSeconds: opts.mediaDurationSeconds,
      mediaFileName: opts.mediaFileName,
      mediaMimeType: opts.mediaMimeType,
      mediaSizeBytes: opts.mediaSizeBytes,
      createdAt: new Date().toISOString(),
      pending: true,
    });
    try {
      const { message } = await api.sendMessage(friend.id, opts.body ?? "", opts);
      confirmMessage(tempId, message);
    } catch (err) {
      pendingRef.current = pendingRef.current.filter((p) => p.id !== tempId);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      throw err;
    }
  }

  async function handleEditMessage(messageId: number, newBody: string) {
    const { message } = await api.editDmMessage(messageId, newBody);
    setMessages((prev) => {
      const updated = prev.map((m) => (m.id === messageId ? message : m));
      return updated.sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    });
  }

  async function handleDeleteMessage(messageId: number) {
    await api.deleteDmMessage(messageId);
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  }

  async function handleReactMessage(messageId: number, emoji: string) {
    const { message } = await api.reactToDmMessage(messageId, emoji);
    setMessages((prev) => {
      const updated = prev.map((m) => (m.id === messageId ? message : m));
      return updated.sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    });
  }

  async function handleTogglePin(messageId: number) {
    await api.pinDmMessage(messageId);
    const { messages: msgs } = await api.getMessages(friend.id);
    applyServerMessages(msgs, "refresh");
  }

  /* Convert to unified type */
  const chatMessages = useMemo(
    () => messages.map((m) => {
      const chatMessage = dmToChatMessage(m);
      if (m.senderId === friend.id) {
        chatMessage.senderName = friend.displayName;
        chatMessage.senderPhotoUrl = friend.photoUrl;
      }
      return chatMessage;
    }),
    [messages, friend.displayName, friend.id, friend.photoUrl],
  );

  return (
    <Modal onClose={onClose} variant="side-right" surface="glass" panelClassName="isolate h-[100dvh] w-full max-w-none overflow-hidden border-l border-white/10 bg-[linear-gradient(155deg,#10233a_0%,#091626_46%,#050d18_100%)] shadow-[-24px_0_80px_-32px_rgba(0,0,0,.85)] sm:max-w-xl">
      <div className="isolate flex h-full min-h-0 w-full flex-col overflow-hidden bg-[radial-gradient(ellipse_at_70%_10%,rgba(34,211,238,.07),transparent_48%)]">
        {/* Conversation Header - Premium Design */}
        <div className="z-10 flex min-h-[76px] shrink-0 items-center gap-3 border-b border-white/10 bg-[#091626]/90 px-4 pt-[max(.75rem,env(safe-area-inset-top,0px))] pb-3 shadow-[0_8px_24px_-20px_rgba(0,0,0,.9)] backdrop-blur-xl">
          <div className="relative">
            <UserAvatar user={friend} size={36} />
            {/* Online indicator */}
            <span className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-[var(--green)] border-2 border-[var(--bg)]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[var(--text)]">
              {friend.displayName}
            </p>
            {friend.username && (
              <p className="text-xs text-[var(--text-muted)]">
                @{friend.username}
              </p>
            )}
            <p className="text-xs text-[var(--text-faint)]">
              {friend.lastActiveAt ? `Ativo: ${relativeTime(friend.lastActiveAt)}` : 'Offline'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-[var(--text-muted)] transition hover:bg-[var(--accent-bg)] hover:text-[var(--accent)]"
            aria-label="Fechar conversa"
          >
            <XIcon size={18} />
          </button>
        </div>

        {/* Message History - Proper scrollable area */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(113,212,255,.25) transparent' }}>
          {profileIdReady ? <ChatThread
            messages={chatMessages}
            currentUserId={currentUserId}
            reduced={reduced}
            conversationId={`dm:${friend.id}`}
            onSend={handleSend}
            onReply={handleReply}
            onEdit={handleEditMessage}
            onDelete={handleDeleteMessage}
            onReact={handleReactMessage}
            onTogglePin={handleTogglePin}
            showAvatar={false} // Don't show avatar for DMs - cleaner look
            showSenderName={true}
            readMessageIds={readMessageIds}
            onReplyMessage={(m) => {
              const dm = messages.find((x) => x.id === m.id);
              if (dm) setReplyingTo(dm);
            }}
            replyingTo={replyingTo ? dmToChatMessage(replyingTo) : null}
            onCancelReply={() => setReplyingTo(null)}
            inputSlot={
              <ChatComposer
                replying={Boolean(replyingTo)}
                onSendText={async (body) => {
                  if (replyingTo) await handleReply(body, replyingTo.id);
                  else await handleSend(body);
                }}
                onSendMedia={handleSendMedia}
              />
            }
          /> : (
            <div className="flex min-h-0 flex-1 items-center justify-center" aria-label="Carregando conversa" aria-busy="true">
              <Loader2 size={18} className="animate-spin text-[var(--accent)]" />
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
