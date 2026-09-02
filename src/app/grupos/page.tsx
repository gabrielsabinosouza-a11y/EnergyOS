"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import Image from "next/image";
import {
  ArrowLeft, ArrowUp, ArrowDown, Check, Crown, Loader2,
  MessageCircle, Package, Plus, Send, Timer, Trophy,
  TrendingUp, Users, X as XIcon, Zap, Settings,
  Image as ImageIcon, Mic, Square,
  Sticker, Shield, ShieldCheck, Trash2, UserMinus,
  ArrowRightLeft,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Header } from "@/components/navigation";
import { useAuthRedirect } from "@/lib/auth-context";
import { streakIconSource } from "@/lib/energy-assets";
import { api } from "@/lib/api-client";
import type { FriendSummary, GroupDetail, GroupMessage, GroupSummary } from "@/types";
import type { GroupLeaderboardEntry, MemberContribution } from "@/lib/db/group-leaderboard";
import type { GroupMilestoneStatus, GroupWeeklyQuestStatus } from "@/lib/db/group-milestones";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

type Period = "WEEK" | "MONTH" | "YEAR" | "ALL_TIME";

const PERIOD_LABELS: Record<Period, string> = {
  WEEK: "Semana",
  MONTH: "Mês",
  YEAR: "Ano",
  ALL_TIME: "Total",
};

const MEDAL_IMAGES = ["/places/first_place.png", "/places/second_place.png", "/places/third_place.png"] as const;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function fmtMinutes(m: number): string {
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}min` : `${h}h`;
}

function UserAvatar({ user, size = 40 }: { user: { displayName: string; photoUrl?: string }; size?: number }) {
  if (user.photoUrl) {
    return <img src={user.photoUrl} alt={user.displayName} width={size} height={size} className="shrink-0 rounded-full object-cover" />;
  }
  return (
    <div className="flex shrink-0 items-center justify-center rounded-full text-xs font-bold text-black"
      style={{ width: size, height: size, background: "linear-gradient(135deg, #71d4ff, #b69cff)" }}>
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
  return `${Math.floor(hrs / 24)}d`;
}

function fmtDuration(seconds?: number): string {
  if (!seconds || seconds <= 0) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Compress an image file to a small data-URL (used for group avatars). */
async function imageToDataUrl(file: File): Promise<string> {
  const MAX = 400;
  let bitmap: ImageBitmap;
  if (typeof createImageBitmap === "function") {
    try {
      bitmap = await createImageBitmap(file);
    } catch {
      // fall through to the FileReader path below (e.g. Safari parity issues)
      return readAsDataUrl(file);
    }
  } else {
    return readAsDataUrl(file);
  }
  const scale = Math.min(1, MAX / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas não suportado");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.82);
}

/** Fallback: re-encode via an <img> element when createImageBitmap is unavailable. */
function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new globalThis.Image();
    img.onload = () => {
      const MAX = 400;
      const scale = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { URL.revokeObjectURL(url); reject(new Error("Canvas não suportado")); return; }
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Não foi possível ler a imagem")); };
    img.src = url;
  });
}

/** Upload a media file to Cloudinary and return its secure URL (+ optional duration). */
async function uploadToCloudinary(file: File): Promise<{ secureUrl: string; durationSeconds: number | undefined }> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
  if (!cloudName || !uploadPreset) throw new Error("Cloudinary não configurado.");

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);

  // Imagens usam o endpoint de imagem; áudio e vídeo usam o de vídeo/raw.
  const isImage = file.type.startsWith("image/");
  const endpoint = isImage
    ? `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`
    : `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`;

  const res = await fetch(endpoint, { method: "POST", body: formData });
  if (!res.ok) throw new Error("Falha no upload.");
  const data = await res.json();
  const duration = Number(data.duration);
  return {
    secureUrl: data.secure_url as string,
    durationSeconds: Number.isFinite(duration) && duration > 0 ? Math.round(duration) : undefined,
  };
}

/** Reads a video's duration in seconds (0 if it can't be determined). */
async function readVideoDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const d = Number.isFinite(video.duration) ? video.duration : 0;
      URL.revokeObjectURL(url);
      resolve(Math.round(d));
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(0);
    };
    video.src = url;
  });
}

const ROLE_ORDER: Record<string, number> = { OWNER: 0, ADMIN: 1, MEMBER: 2 };

/* ------------------------------------------------------------------ */
/*  Animations                                                         */
/* ------------------------------------------------------------------ */

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.05 } } };
const fadeUp = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const } } };
const slideLeft = {
  hidden: { x: "100%", opacity: 0 },
  visible: { x: 0, opacity: 1, transition: { type: "spring" as const, stiffness: 300, damping: 30 } },
  exit: { x: "100%", opacity: 0, transition: { duration: 0.2 } },
};

/* ------------------------------------------------------------------ */
/*  Leaderboard sub-components                                         */
/* ------------------------------------------------------------------ */

function PeriodFilter({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  return (
    <div className="flex overflow-hidden rounded-xl border border-[var(--border-subtle)]">
      {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`px-3 py-1.5 text-xs transition ${
            value === p
              ? "bg-[var(--accent-bg)] text-[var(--accent)]"
              : "text-[var(--text-muted)] hover:text-[var(--text)]"
          }`}
        >
          {PERIOD_LABELS[p]}
        </button>
      ))}
    </div>
  );
}

function RankCell({ rank, size = 22 }: { rank: number; size?: number }) {
  if (rank <= 3) {
    return (
      <div className="relative flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
        <Image
          src={MEDAL_IMAGES[rank - 1]}
          alt={`${rank}º lugar`}
          width={size}
          height={size}
          style={{ objectFit: "contain" }}
          unoptimized
          draggable={false}
        />
      </div>
    );
  }
  return <span className="font-mono text-[10px] text-[var(--text-faint)]">{rank}</span>;
}

function LeaderboardRow({
  entry, index, isMe, onClick,
}: {
  entry: GroupLeaderboardEntry; index: number; isMe: boolean; onClick: () => void;
}) {
  return (
    <motion.button
      initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.025 }}
      onClick={onClick}
      className={`grid w-full grid-cols-[32px_1fr_80px_28px] items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-[var(--bg-surface-hover)] ${
        isMe ? "bg-[var(--accent-bg)]/40" : ""
      }`}
    >
      <div className="flex items-center justify-center"><RankCell rank={entry.rank} /></div>
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-xl leading-none">{entry.groupAvatarEmoji}</span>
        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium text-[var(--text)]">
            {entry.groupName}
            {entry.rank <= 3 && <span className="ml-1 text-[9px]">👑</span>}
          </p>
          <p className="text-[9px] text-[var(--text-faint)] flex items-center gap-1">
            <Users size={9} />{entry.memberCount}
          </p>
        </div>
      </div>
      <div className="text-right">
        <span className="font-mono text-[11px] text-[var(--accent)]">{fmtMinutes(entry.totalMinutes)}</span>
      </div>
      <div className="flex items-center justify-center">
        {isMe && <span className="text-[8px] font-bold text-amber-400">você</span>}
      </div>
    </motion.button>
  );
}

function GlobalLeaderboard({
  userGroupIds, onOpenGroup,
}: {
  userGroupIds: number[];
  onOpenGroup: (id: number) => void;
}) {
  const [period, setPeriod] = useState<Period>("ALL_TIME");
  const [entries, setEntries] = useState<GroupLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (p: Period) => {
    setLoading(true);
    try {
      const data = await api.getGlobalGroupsLeaderboard(p);
      setEntries(data.entries);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(period); }, [period, load]);

  const userEntry = entries.find((e) => userGroupIds.includes(e.groupId));

  return (
    <div className="glass-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3">
        <div className="flex items-center gap-2">
          <Trophy size={15} className="text-[var(--accent)]" />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
            Ranking Global
          </span>
        </div>
        <PeriodFilter value={period} onChange={setPeriod} />
      </div>

      {/* Your position card */}
      {userEntry && (
        <div className="border-b border-[var(--border-subtle)] bg-[var(--accent-bg)]/20 px-4 py-3">
          <p className="mb-1 text-[9px] uppercase tracking-widest text-[var(--text-faint)]">Sua posição</p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">{userEntry.groupAvatarEmoji}</span>
              <span className="text-sm font-medium text-[var(--text)]">{userEntry.groupName}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm font-bold text-[var(--accent)]">
                #{userEntry.rank}
              </span>
              <span className="font-mono text-xs text-[var(--text-muted)]">
                {fmtMinutes(userEntry.totalMinutes)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Column headers */}
      <div className="grid grid-cols-[32px_1fr_80px_28px] gap-2 border-b border-[var(--border-subtle)] px-4 py-2 text-[9px] font-semibold uppercase tracking-widest text-[var(--text-faint)]">
        <span className="text-center">Pos</span>
        <span>Grupo</span>
        <span className="text-right">Foco</span>
        <span />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={22} className="animate-spin text-[var(--accent)]" />
        </div>
      ) : entries.length === 0 ? (
        <p className="py-10 text-center text-xs text-[var(--text-muted)]">
          Nenhum grupo com foco registrado ainda.
        </p>
      ) : (
        <div className="divide-y divide-[var(--border-subtle)]">
          {entries.map((entry, i) => (
            <LeaderboardRow
              key={entry.groupId}
              entry={entry}
              index={i}
              isMe={userGroupIds.includes(entry.groupId)}
              onClick={() => onOpenGroup(entry.groupId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Milestone progress bar                                             */
/* ------------------------------------------------------------------ */

function MilestoneBar({ milestones, totalMinutes }: { milestones: GroupMilestoneStatus[]; totalMinutes: number }) {
  const next = milestones.find((m) => !m.unlockedAt);
  const prev = milestones.filter((m) => m.unlockedAt).at(-1);

  if (!next) {
    return (
      <div className="glass-card p-4 text-center text-xs text-[var(--text-muted)]">
        🏆 Todos os marcos desbloqueados!
      </div>
    );
  }

  const base = prev?.thresholdMinutes ?? 0;
  const progress = Math.min(((totalMinutes - base) / (next.thresholdMinutes - base)) * 100, 100);

  return (
    <div className="glass-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
          Próximo marco
        </span>
        <span className="text-[10px] text-[var(--accent)]">+{next.coinsPerMember} moedas/membro</span>
      </div>
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="text-[var(--text)]">{next.label}</span>
        <span className="font-mono text-[var(--text-faint)]">
          {fmtMinutes(totalMinutes)} / {fmtMinutes(next.thresholdMinutes)}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-surface-hover)]">
        <motion.div
          className="h-full rounded-full bg-[var(--accent)]"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
      {progress >= 90 && (
        <p className="mt-1.5 text-[10px] text-amber-400">Quase lá! 🔥</p>
      )}

      {/* Unlocked milestones */}
      {milestones.filter((m) => m.unlockedAt).length > 0 && (
        <div className="mt-3 border-t border-[var(--border-subtle)] pt-3">
          <p className="mb-2 text-[9px] uppercase tracking-widest text-[var(--text-faint)]">Marcos conquistados</p>
          <div className="flex flex-wrap gap-2">
            {milestones.filter((m) => m.unlockedAt).map((m) => (
              <div key={m.thresholdMinutes}
                className="flex items-center gap-1 rounded-full border border-[var(--accent)]/20 bg-[var(--accent-bg)] px-2 py-0.5 text-[9px] text-[var(--accent)]">
                <Trophy size={9} /> {m.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Weekly group quest widget                                          */
/* ------------------------------------------------------------------ */

function WeeklyQuestWidget({ groupId }: { groupId: number }) {
  const [quest, setQuest] = useState<GroupWeeklyQuestStatus | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getGroupWeeklyQuest(groupId).then((d) => setQuest(d.quest)).catch(() => {});
  }, [groupId]);

  async function handleClaim() {
    if (claiming || claimed) return;
    setClaiming(true);
    setError("");
    try {
      await api.claimGroupWeeklyQuest(groupId);
      setClaimed(true);
      setQuest((q) => q ? { ...q, claimedAt: new Date().toISOString() } : q);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao resgatar.");
    } finally {
      setClaiming(false);
    }
  }

  if (!quest) return null;

  const progress = Math.min((quest.currentMinutes / quest.targetMinutes) * 100, 100);
  const isComplete = !!quest.completedAt;
  const isClaimed = !!quest.claimedAt || claimed;
  const canClaim = isComplete && !isClaimed && quest.contributedMinutes > 0;

  return (
    <div className={`glass-card p-4 ${isComplete && !isClaimed ? "border-amber-400/30" : ""}`}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap size={14} className="text-amber-400" />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
            Missão Semanal do Grupo
          </span>
        </div>
        {isClaimed && <Check size={14} className="text-green-400" />}
      </div>

      <p className="mb-2 text-xs text-[var(--text)]">
        Foquem {fmtMinutes(quest.targetMinutes)} combinados esta semana
      </p>

      <div className="mb-1 flex items-center justify-between text-[10px] text-[var(--text-faint)]">
        <span>{fmtMinutes(quest.currentMinutes)} / {fmtMinutes(quest.targetMinutes)}</span>
        <span>+{quest.coinsPerMember} moedas</span>
      </div>

      <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-surface-hover)]">
        <motion.div
          className={`h-full rounded-full ${isComplete ? "bg-green-400" : "bg-[var(--accent)]"}`}
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>

      {quest.contributedMinutes > 0 && (
        <p className="mb-2 text-[9px] text-[var(--text-faint)]">
          Sua contribuição: {fmtMinutes(quest.contributedMinutes)}
        </p>
      )}

      {canClaim && (
        <motion.button
          whileTap={{ scale: 0.94 }}
          onClick={handleClaim}
          disabled={claiming}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400/10 border border-amber-400/30 py-2 text-xs font-bold text-amber-400 transition hover:bg-amber-400/20"
        >
          {claiming ? <Loader2 size={13} className="animate-spin" /> : <Package size={13} />}
          Resgatar +{quest.coinsPerMember} moedas
        </motion.button>
      )}

      {isClaimed && (
        <p className="text-center text-[10px] text-green-400">✓ Recompensa resgatada!</p>
      )}

      {error && <p className="mt-1 text-[10px] text-[var(--red)]">{error}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Member contributions list                                          */
/* ------------------------------------------------------------------ */

function MemberContributions({ groupId, period }: { groupId: number; period: Period }) {
  const [data, setData] = useState<{ members: MemberContribution[]; groupTotal: number } | null>(null);

  useEffect(() => {
    api.getGroupMemberContributions(groupId, period).then(setData).catch(() => {});
  }, [groupId, period]);

  if (!data) return <div className="flex justify-center py-4"><Loader2 size={18} className="animate-spin text-[var(--accent)]" /></div>;

  return (
    <div className="space-y-2">
      {data.members.map((m, i) => (
        <div key={m.profileId} className="flex items-center gap-3">
          <span className="w-4 text-center font-mono text-[10px] text-[var(--text-faint)]">{i + 1}</span>
          <UserAvatar user={{ displayName: m.displayName, photoUrl: m.photoUrl }} size={28} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] text-[var(--text)]">{m.displayName}</p>
            <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-[var(--bg-surface-hover)]">
              <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${m.percentage}%` }} />
            </div>
          </div>
          <span className="font-mono text-[10px] text-[var(--accent)]">{fmtMinutes(m.minutes)}</span>
          <span className="text-[9px] text-[var(--text-faint)]">{m.percentage.toFixed(0)}%</span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function GruposPage() {
  const { user, loading: authLoading } = useAuthRedirect({ ifGuest: "/" });
  const reduced = useReducedMotion() ?? false;

  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [userGroupIds, setUserGroupIds] = useState<number[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"meus" | "ranking">("meus");

  /* Create form */
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createIcon, setCreateIcon] = useState<string | null>(null);
  const [createIconName, setCreateIconName] = useState("");
  const [inviteIds, setInviteIds] = useState<string[]>([]);
  const [friends, setFriends] = useState<FriendSummary[]>([]);
  const [creating, setCreating] = useState(false);

  /* Detail view */
  const [activeGroup, setActiveGroup] = useState<GroupDetail | null>(null);

  const loadGroups = useCallback(async () => {
    try {
      setError(null);
      const { groups: g } = await api.getGroups();
      setGroups(g);
      setUserGroupIds(g.map((x) => x.id));
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

  useEffect(() => {
    if (!showCreate || friends.length > 0) return;
    api.getFriends().then(({ friends: f }) => setFriends(f)).catch(() => {});
  }, [showCreate, friends.length]);

  const handleCreate = useCallback(async () => {
    const name = createName.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      const { group } = await api.createGroup({ name, avatarUrl: createIcon ?? undefined, inviteIds });
      setGroups((prev) => [
        { id: group.id, name: group.name, avatarEmoji: group.avatarEmoji, avatarUrl: group.avatarUrl,
          memberCount: group.members.length, weeklyFocusMinutes: group.weeklyFocusMinutes, unreadCount: 0 },
        ...prev,
      ]);
      setUserGroupIds((prev) => [...prev, group.id]);
      setActiveGroup(group);
      setShowCreate(false);
      setCreateName("");
      setCreateIcon(null);
      setCreateIconName("");
      setInviteIds([]);
    } catch {
      setError("Não foi possível criar o grupo.");
    } finally {
      setCreating(false);
    }
  }, [createName, createIcon, inviteIds, creating]);

  async function handleCreateIcon(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 7 * 1024 * 1024) {
      setError("Escolha uma imagem de até 7 MB.");
      event.target.value = "";
      return;
    }
    try {
      setCreateIcon(await imageToDataUrl(file));
      setCreateIconName(file.name);
      setError(null);
    } catch {
      setError("Não foi possível ler o ícone.");
    } finally {
      event.target.value = "";
    }
  }

  const openGroup = useCallback((id: number) => {
    api.getGroup(id).then(({ group }) => setActiveGroup(group)).catch(() => {});
  }, []);

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
              onRead={(groupId) => setGroups((prev) => prev.map((g) => g.id === groupId ? { ...g, unreadCount: 0 } : g))}
            />
          ) : (
            <motion.div key="list" initial={reduced ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>

              {/* Top bar with tabs */}
              <div className="mb-6 flex items-center justify-between">
                <div className="flex overflow-hidden rounded-xl border border-[var(--border-subtle)]">
                  {(["meus", "ranking"] as const).map((t) => (
                    <button key={t} onClick={() => setTab(t)}
                      className={`px-4 py-2 text-sm transition ${t === tab ? "bg-[var(--accent-bg)] text-[var(--accent)]" : "text-[var(--text-muted)] hover:text-[var(--text)]"}`}>
                      {t === "meus" ? "Meus grupos" : "🏆 Ranking"}
                    </button>
                  ))}
                </div>
                {tab === "meus" && (
                  <button onClick={() => setShowCreate((v) => !v)}
                    className="btn-primary flex items-center gap-2 px-4 py-2 text-sm">
                    {showCreate ? <XIcon size={16} /> : <Plus size={16} />}
                    {showCreate ? "Cancelar" : "Criar grupo"}
                  </button>
                )}
              </div>

              {/* Ranking tab */}
              {tab === "ranking" && (
                <GlobalLeaderboard userGroupIds={userGroupIds} onOpenGroup={openGroup} />
              )}

              {/* Meus grupos tab */}
              {tab === "meus" && (
                <>
                  {/* Create form */}
                  <AnimatePresence>
                    {showCreate && (
                      <motion.div variants={fadeUp} initial="hidden" animate="visible" exit="hidden"
                        className="glass-card mb-8 space-y-5 p-5">
                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">Nome do grupo</label>
                          <input type="text" placeholder="Ex: Time Foco Total" value={createName}
                            onChange={(e) => setCreateName(e.target.value)}
                            className="glass-card w-full px-4 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--text-faint)] outline-none focus:border-[var(--accent)]/40" />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">Ícone do grupo</label>
                          <input id="create-group-icon" type="file" accept="image/*" className="sr-only" onChange={handleCreateIcon} />
                          <label htmlFor="create-group-icon" className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-[var(--border-subtle)] p-3 transition hover:border-[var(--accent)]/50">
                            <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[var(--accent-bg)]">
                              {createIcon ? <img src={createIcon} alt="Prévia do ícone" className="h-full w-full object-cover" /> : <ImageIcon size={22} className="text-[var(--accent)]" />}
                            </span>
                            <span className="min-w-0 text-xs text-[var(--text-muted)]">
                              <strong className="block text-[var(--text)]">{createIconName || "Escolher imagem"}</strong>
                              PNG, JPG ou WEBP até 7 MB
                            </span>
                          </label>
                        </div>
                        {friends.length > 0 && (
                          <div>
                            <label className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">Convidar amigos</label>
                            <div className="max-h-48 space-y-1 overflow-y-auto">
                              {friends.map((f) => {
                                const selected = inviteIds.includes(f.id);
                                return (
                                  <button key={f.id}
                                    onClick={() => setInviteIds((prev) => selected ? prev.filter((id) => id !== f.id) : [...prev, f.id])}
                                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition ${selected ? "bg-[var(--accent-bg)] border border-[var(--accent)]/30" : "glass-card hover:brightness-110"}`}>
                                    <UserAvatar user={f} size={32} />
                                    <p className="truncate text-sm text-[var(--text)]">{f.displayName}</p>
                                    <div className={`ml-auto flex h-5 w-5 items-center justify-center rounded-md border transition ${selected ? "border-[var(--accent)] bg-[var(--accent)] text-black" : "border-[var(--border-subtle)]"}`}>
                                      {selected && <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="2 6 5 9 10 3" /></svg>}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        <div className="flex items-center gap-3 pt-2">
                          <button onClick={handleCreate} disabled={!createName.trim() || creating}
                            className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm disabled:opacity-30">
                            {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                            Criar
                          </button>
                          <button onClick={() => setShowCreate(false)}
                            className="rounded-xl px-5 py-2.5 text-sm text-[var(--text-muted)] transition hover:text-[var(--text)]">
                            Cancelar
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Groups grid */}
                  {groups.length === 0 ? (
                    <div className="glass-card p-12 text-center">
                      <p className="mb-1 text-3xl">🎯</p>
                      <p className="text-sm text-[var(--text-muted)]">Nenhum grupo ainda</p>
                      <p className="mt-1 text-xs text-[var(--text-faint)]">Comece criando um grupo!</p>
                    </div>
                  ) : (
                    <motion.div variants={stagger} initial="hidden" animate="visible"
                      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {groups.map((g) => (
                        <motion.button key={g.id} variants={fadeUp}
                          whileHover={reduced ? undefined : { y: -2, transition: { duration: 0.15 } }}
                          whileTap={reduced ? undefined : { scale: 0.98 }}
                          onClick={() => {
                            api.getGroup(g.id).then(({ group }) => setActiveGroup(group));
                            if (g.unreadCount > 0) setGroups((prev) => prev.map((x) => x.id === g.id ? { ...x, unreadCount: 0 } : x));
                          }}
                          className="glass-card group relative flex flex-col items-center gap-3 px-4 py-6 text-center transition hover:border-[var(--accent)]/30">
                          <span className="text-4xl leading-none">{g.avatarEmoji}</span>
                          <p className="font-display text-sm font-medium text-[var(--text)] group-hover:text-[var(--accent)]">{g.name}</p>
                          <div className="flex items-center gap-4 text-[11px] text-[var(--text-muted)]">
                            <span className="flex items-center gap-1"><Users size={12} />{g.memberCount}</span>
                            <span className="flex items-center gap-1 text-[var(--green)]"><Timer size={12} />{g.weeklyFocusMinutes}min</span>
                          </div>
                          {g.unreadCount > 0 && (
                            <span className="absolute right-3 top-3 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[var(--accent)] px-1.5 text-[10px] font-bold text-black">
                              {g.unreadCount > 99 ? "99+" : g.unreadCount}
                            </span>
                          )}
                          <MessageCircle size={16} className="absolute bottom-3 right-3 text-[var(--text-faint)] transition group-hover:text-[var(--accent)]" />
                        </motion.button>
                      ))}
                    </motion.div>
                  )}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </AppShell>
  );
}

/* ------------------------------------------------------------------ */
/*  Group Detail Panel                                                 */
/* ------------------------------------------------------------------ */

function GroupDetailPanel({
  group: initialGroup, currentUserId, reduced, onBack, onRead,
}: {
  group: GroupDetail; currentUserId: string; reduced: boolean;
  onBack: () => void; onRead: (groupId: number) => void;
}) {
  const [group, setGroup] = useState<GroupDetail>(initialGroup);
  const [tab, setTab] = useState<"chat" | "members" | "stats" | "settings">("chat");
  const [statsPeriod, setStatsPeriod] = useState<Period>("ALL_TIME");
  const [milestones, setMilestones] = useState<GroupMilestoneStatus[]>([]);
  const [totalMinutes, setTotalMinutes] = useState(0);

  /* Member/role derived */
  const me = group.members.find((m) => m.id === currentUserId);
  const myRole = me?.role ?? "MEMBER";
  const isOwner = myRole === "OWNER";
  const isAdmin = myRole === "ADMIN";

  /* Chat state */
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
  const [stickers, setStickers] = useState<{ id: string; emoji: string }[]>([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [recording, setRecording] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastIdRef = useRef<number | undefined>(undefined);
  const fileRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);

  /* Settings state */
  const [editName, setEditName] = useState(group.name);
  const [editDesc, setEditDesc] = useState(group.description ?? "");
  const [editPublic, setEditPublic] = useState(group.isPublic);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingIcon, setSavingIcon] = useState(false);
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<"leave" | "delete" | null>(null);
  const [inviteIds, setInviteIds] = useState<string[]>([]);
  const [friends, setFriends] = useState<FriendSummary[]>([]);
  const [inviting, setInviting] = useState(false);
  const [messageError, setMessageError] = useState("");
  const iconRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    api.markGroupRead(group.id).then(() => { if (!cancelled) onRead(group.id); });
    return () => { cancelled = true; };
  }, [group.id, onRead]);

  useEffect(() => {
    let cancelled = false;
    api.getGroupMessages(group.id).then(({ messages: msgs }) => {
      if (cancelled) return;
      setMessages(msgs);
      lastIdRef.current = msgs.length > 0 ? msgs[msgs.length - 1].id : undefined;
    });
    return () => { cancelled = true; };
  }, [group.id]);

  /* Load milestones + rank when stats tab opens */
  useEffect(() => {
    if (tab !== "stats") return;
    api.getGroupMilestones(group.id).then((d) => {
      setMilestones(d.milestones);
      setTotalMinutes(d.totalMinutes);
    }).catch(() => {});
  }, [tab, group.id]);

  /* Poll messages */
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

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (!tab.includes("settings")) return;
    if (friends.length > 0) return;
    api.getFriends().then(({ friends: f }) => setFriends(f)).catch(() => {});
  }, [tab, friends.length]);

  useEffect(() => {
    if (!showStickers || stickers.length > 0) return;
    api.getGroupStickers().then((d) => setStickers(d.stickers)).catch(() => {});
  }, [showStickers, stickers.length]);

  function appendMessage(message: GroupMessage) {
    setMessages((prev) => [...prev, message]);
    lastIdRef.current = message.id;
  }

  async function sendMediaMessage(opts: { messageType: string; mediaUrl?: string; body?: string; mediaDurationSeconds?: number }) {
    setSending(true);
    try {
      const { message } = await api.sendGroupMessage(group.id, opts.body ?? "", {
        messageType: opts.messageType,
        mediaUrl: opts.mediaUrl,
        mediaDurationSeconds: opts.mediaDurationSeconds,
      });
      appendMessage(message);
    } catch {
      setMessageError("Não foi possível enviar a mídia.");
    } finally {
      setSending(false);
    }
  }

  async function handleSend() {
    const body = input.trim();
    if (!body || sending) return;
    setInput("");
    setSending(true);
    setMessageError("");
    try {
      const { message } = await api.sendGroupMessage(group.id, body);
      appendMessage(message);
    } catch { setInput(body); }
    finally { setSending(false); }
  }

  async function handleSendImage(file: File) {
    if (uploadingMedia) return;
    setUploadingMedia(true);
    setMessageError("");
    try {
      const { secureUrl } = await uploadToCloudinary(file);
      await sendMediaMessage({ messageType: "IMAGE", mediaUrl: secureUrl });
    } catch {
      setMessageError("Não foi possível enviar a imagem.");
    } finally {
      setUploadingMedia(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const MAX_VIDEO_SECONDS = 30;

  async function handleSendVideo(file: File) {
    if (uploadingMedia) return;
    setUploadingMedia(true);
    setMessageError("");
    try {
      const durationSeconds = await readVideoDuration(file);
      if (durationSeconds > 0 && durationSeconds > MAX_VIDEO_SECONDS) {
        setMessageError(`Vídeos devem ter no máximo ${MAX_VIDEO_SECONDS}s.`);
        return;
      }
      const { secureUrl } = await uploadToCloudinary(file);
      await sendMediaMessage({ messageType: "VIDEO", mediaUrl: secureUrl, mediaDurationSeconds: durationSeconds || undefined });
    } catch {
      setMessageError("Não foi possível enviar o vídeo.");
    } finally {
      setUploadingMedia(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.type.startsWith("image/")) await handleSendImage(file);
    else if (file.type.startsWith("video/")) await handleSendVideo(file);
    else setMessageError("Formato de arquivo não suportado.");
  }

  async function handleSendSticker(emoji: string) {
    if (sending) return;
    setShowStickers(false);
    await sendMediaMessage({ messageType: "STICKER", body: emoji });
  }

  async function handleSendVoice(blob: Blob) {
    if (sending) return;
    setMessageError("");
    try {
      setUploadingMedia(true);
      const file = new File([blob], "voice.webm", { type: "audio/webm" });
      const { secureUrl, durationSeconds } = await uploadToCloudinary(file);
      await sendMediaMessage({
        messageType: "AUDIO",
        mediaUrl: secureUrl,
        mediaDurationSeconds: durationSeconds ?? Math.round(blob.size / 16000),
      });
    } catch {
      setMessageError("Não foi possível enviar o áudio.");
    } finally {
      setUploadingMedia(false);
    }
  }

  async function startRecording() {
    setMessageError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recordingChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordingChunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(recordingChunksRef.current, { type: "audio/webm" });
        recordingChunksRef.current = [];
        if (blob.size > 0) await handleSendVoice(blob);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
    } catch {
      setMessageError("Microfone não disponível.");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setRecording(false);
  }

  /* Members */
  async function performMemberOp(op: "role" | "remove" | "transfer", targetId: string, role?: string) {
    if (busyMemberId) return;
    setBusyMemberId(targetId);
    setMessageError("");
    try {
      if (op === "role") {
        await api.updateGroupMemberRole(group.id, targetId, role as import("@/types").GroupRole);
      } else if (op === "remove") {
        await api.removeGroupMember(group.id, targetId);
      } else {
        await api.groupAction(group.id, "transfer", { targetProfileId: targetId });
      }
      setGroup((g) => g ? { ...g, members: g.members.filter((m) => m.id !== (op === "remove" ? targetId : undefined)) } : g);
      if (op === "role") {
        setGroup((g) => g ? { ...g, members: g.members.map((m) => m.id === targetId ? { ...m, role: role as import("@/types").GroupRole } : m) } : g);
      }
      if (op === "transfer") {
        setGroup((g) => g ? { ...g, members: g.members.map((m) => m.id === targetId ? { ...m, role: "OWNER" } : m.id === currentUserId ? { ...m, role: "ADMIN" } : m) } : g);
      }
    } catch (e) {
      setMessageError(e instanceof Error ? e.message : "Operação falhou.");
    } finally {
      setBusyMemberId(null);
    }
  }

  async function saveSettings() {
    if (savingSettings) return;
    setSavingSettings(true);
    setMessageError("");
    try {
      await api.updateGroupDetails(group.id, { name: editName, description: editDesc, isPublic: editPublic });
      setGroup((g) => g ? { ...g, name: editName, description: editDesc, isPublic: editPublic } : g);
    } catch (e) {
      setMessageError(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleIconUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 7 * 1024 * 1024) {
      setMessageError("Escolha uma imagem de até 7 MB.");
      event.target.value = "";
      return;
    }
    setSavingIcon(true);
    setMessageError("");
    try {
      const avatarUrl = await imageToDataUrl(file);
      await api.updateGroupDetails(group.id, { avatarUrl });
      setGroup((g) => g ? { ...g, avatarUrl } : g);
    } catch {
      setMessageError("Não foi possível atualizar o ícone.");
    } finally {
      setSavingIcon(false);
      event.target.value = "";
    }
  }

  async function inviteFriends() {
    if (inviting || inviteIds.length === 0) return;
    setInviting(true);
    setMessageError("");
    try {
      await api.inviteToGroup(group.id, inviteIds);
      const { group: fresh } = await api.getGroup(group.id, "WEEK");
      setGroup(fresh);
      setInviteIds([]);
    } catch (e) {
      setMessageError(e instanceof Error ? e.message : "Não foi possível convidar.");
    } finally {
      setInviting(false);
    }
  }

  async function doConfirmAction() {
    if (!confirmAction) return;
    setSavingSettings(true);
    try {
      await api.groupAction(group.id, confirmAction);
      onBack();
    } catch (e) {
      setMessageError(e instanceof Error ? e.message : "Ação falhou.");
      setConfirmAction(null);
      setSavingSettings(false);
    }
  }

  const sortedMembers = group.members.slice().sort(
    (a, b) => (ROLE_ORDER[a.role] ?? 2) - (ROLE_ORDER[b.role] ?? 2) || a.displayName.localeCompare(b.displayName),
  );

  return (
    <motion.div variants={slideLeft} initial="hidden" animate="visible" exit="exit"
      className="-mx-5 -my-7 flex min-h-[100dvh] flex-col sm:-mx-8 lg:-mx-12 lg:-my-10">

      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg)]/80 px-5 py-3 backdrop-blur-lg sm:px-8 lg:px-12">
        <button onClick={onBack}
          className="rounded-lg p-1.5 text-[var(--text-muted)] transition hover:bg-[var(--accent-bg)] hover:text-[var(--accent)]">
          <ArrowLeft size={20} />
        </button>
        {group.avatarUrl ? (
          <img src={group.avatarUrl} alt={group.name} className="h-9 w-9 shrink-0 rounded-xl object-cover" />
        ) : (
          <span className="text-2xl leading-none">{group.avatarEmoji}</span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-sm font-medium text-[var(--text)]">{group.name}</p>
          <p className="text-[11px] text-[var(--text-faint)]">
            {group.members.length} membros · {group.weeklyFocusMinutes}min/semana
          </p>
        </div>
        <div className="flex overflow-hidden rounded-xl border border-[var(--border-subtle)]">
          {(["chat", "members", "stats"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs transition ${t === tab ? "bg-[var(--accent-bg)] text-[var(--accent)]" : "text-[var(--text-muted)] hover:text-[var(--text)]"}`}>
              {t === "chat" && <><MessageCircle size={13} />Chat</>}
              {t === "members" && <><Users size={13} />Membros</>}
              {t === "stats" && <><TrendingUp size={13} />Stats</>}
            </button>
          ))}
          <button onClick={() => setTab((t) => (t === "settings" ? "chat" : "settings"))}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs transition ${tab === "settings" ? "bg-[var(--accent-bg)] text-[var(--accent)]" : "text-[var(--text-muted)] hover:text-[var(--text)]"}`}>
            <Settings size={13} />
          </button>
        </div>
      </div>

      {/* Message error banner */}
      {messageError && (
        <div className="border-b border-[var(--red)]/20 bg-[var(--red-bg)] px-5 py-2 text-xs text-[var(--red)] sm:px-8 lg:px-12">
          {messageError}
        </div>
      )}

      {/* Chat tab */}
      {tab === "chat" && (
        <>
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-4 sm:px-8 lg:px-12">
            {messages.length === 0 && (
              <p className="pt-12 text-center text-xs text-[var(--text-faint)]">Nenhuma mensagem ainda</p>
            )}
            {messages.map((msg) => {
              const isMe = msg.senderId === currentUserId;
              return (
                <motion.div key={msg.id} initial={reduced ? false : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
                  className={`flex gap-2.5 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                  <div className="mt-0.5 shrink-0">
                    <UserAvatar user={{ displayName: msg.senderName, photoUrl: msg.senderPhotoUrl }} size={32} />
                  </div>
                  <div className={`max-w-[75%] ${isMe ? "items-end" : "items-start"}`}>
                    {!isMe && <p className="mb-0.5 text-[10px] font-medium text-[var(--text-muted)]">{msg.senderName}</p>}
                    <div className={`overflow-hidden rounded-2xl ${isMe ? "rounded-br-md bg-[var(--accent)]" : "glass-card rounded-bl-md"}`}>
                      {msg.messageType === "IMAGE" && msg.mediaUrl && (
                        <img src={msg.mediaUrl} alt="imagem" className="max-h-72 w-full object-cover" />
                      )}
                      {msg.messageType === "VIDEO" && msg.mediaUrl && (
                        <video src={msg.mediaUrl} controls className="max-h-72 w-full object-cover" />
                      )}
                      {msg.messageType === "AUDIO" && msg.mediaUrl && (
                        <div className="px-3 py-2">
                          <audio src={msg.mediaUrl} controls className="w-64 max-w-full" />
                          {msg.mediaDurationSeconds != null && (
                            <p className={`mt-0.5 text-[9px] ${isMe ? "text-black/70" : "text-[var(--text-faint)]"}`}>
                              {fmtDuration(msg.mediaDurationSeconds)}
                            </p>
                          )}
                        </div>
                      )}
                      {msg.messageType === "STICKER" && (
                        <div className="px-3 py-2 text-5xl leading-none">{msg.body || msg.mediaUrl}</div>
                      )}
                      {(msg.body || msg.messageType === "TEXT") && (
                        <div className={`px-4 py-2.5 text-sm leading-relaxed ${isMe ? "text-black" : "text-[var(--text)]"}`}>
                          {msg.body}
                        </div>
                      )}
                    </div>
                    <p className={`mt-0.5 text-[9px] ${isMe ? "text-right text-[var(--text-faint)]" : "text-[var(--text-faint)]"}`}>
                      {relativeTime(msg.createdAt)}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
          <div className="border-t border-[var(--border-subtle)] bg-[var(--bg)]/80 px-5 py-3 backdrop-blur-lg sm:px-8 lg:px-12">
            {/* Sticker picker */}
            <AnimatePresence>
              {showStickers && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
                  className="mb-2 grid max-h-40 grid-cols-8 gap-1 overflow-y-auto rounded-xl border border-[var(--border-subtle)] p-2">
                  {stickers.map((s) => (
                    <button key={s.id} onClick={() => handleSendSticker(s.emoji)}
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-xl transition hover:bg-[var(--accent-bg)]">
                      {s.emoji}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
            <div className="glass-card flex items-center gap-1.5 px-2 py-2">
              <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden"
                onChange={handleFileChange} />
              <button onClick={() => fileRef.current?.click()} disabled={uploadingMedia || sending || recording}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] transition hover:bg-[var(--accent-bg)] hover:text-[var(--accent)] disabled:opacity-30">
                {uploadingMedia ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={15} />}
              </button>
              <button onClick={() => setShowStickers((v) => !v)} disabled={recording}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] transition hover:bg-[var(--accent-bg)] hover:text-[var(--accent)] disabled:opacity-30">
                <Sticker size={15} />
              </button>
              <input type="text" placeholder="Mensagem..." value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                className="w-full bg-transparent text-sm text-[var(--text)] placeholder:text-[var(--text-faint)] outline-none" />
              {recording ? (
                <button onClick={stopRecording}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--red)] text-white transition hover:brightness-110">
                  <Square size={13} />
                </button>
              ) : (
                <button onClick={startRecording} disabled={uploadingMedia || sending}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] transition hover:bg-[var(--accent-bg)] hover:text-[var(--accent)] disabled:opacity-30">
                  <Mic size={15} />
                </button>
              )}
              <button onClick={handleSend} disabled={!input.trim() || sending || recording}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)] text-black transition hover:brightness-110 disabled:opacity-30">
                {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Members tab */}
      {tab === "members" && (
        <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-8 lg:px-12">
          <div className="glass-card mb-6 flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--green-bg)] text-[var(--green)]">
              <Timer size={22} />
            </div>
            <div>
              <p className="text-lg font-bold text-[var(--text)]">{group.weeklyFocusMinutes}<span className="ml-1 text-xs font-normal text-[var(--text-muted)]">min</span></p>
              <p className="text-[11px] text-[var(--text-faint)]">foco total da semana</p>
            </div>
            <div className="ml-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent-bg)] text-[var(--accent)]">
              <Users size={22} />
            </div>
            <div>
              <p className="text-lg font-bold text-[var(--text)]">{group.members.length}</p>
              <p className="text-[11px] text-[var(--text-faint)]">membros</p>
            </div>
          </div>
          <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-2">
            {sortedMembers.map((m) => {
              const canManageThis = isOwner
                ? m.role !== "OWNER"
                : isAdmin && m.role !== "OWNER" && m.id !== currentUserId;
              const canToggleRole = isOwner
                ? m.role !== "OWNER"
                : isAdmin && m.role !== "OWNER" && m.id !== currentUserId;
              return (
                <motion.div key={m.id} variants={fadeUp} className="glass-card flex items-center gap-3 px-4 py-3">
                  <UserAvatar user={{ displayName: m.displayName, photoUrl: m.photoUrl }} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-[var(--text)]">{m.displayName}</p>
                      {m.role === "OWNER" && <Crown size={13} className="shrink-0 text-[var(--orange)]" />}
                      {m.role === "ADMIN" && <ShieldCheck size={13} className="shrink-0 text-[var(--accent)]" />}
                      {m.id === currentUserId && <span className="text-[9px] text-[var(--text-faint)]">(você)</span>}
                    </div>
                    {m.username && <p className="truncate text-xs text-[var(--text-muted)]">@{m.username}</p>}
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-[var(--orange)]">
                    <Image src={streakIconSource(m.currentStreak)} alt="streak" width={12} height={12} style={{ objectFit: "contain" }} unoptimized />
                    {m.currentStreak}
                  </div>
                  {canManageThis && (
                    <div className="flex items-center gap-1">
                      {isOwner && m.role !== "OWNER" && (
                        <button title="Transferir propriedade" disabled={busyMemberId === m.id}
                          onClick={() => performMemberOp("transfer", m.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] transition hover:bg-[var(--accent-bg)] hover:text-[var(--accent)] disabled:opacity-30">
                          {busyMemberId === m.id ? <Loader2 size={13} className="animate-spin" /> : <ArrowRightLeft size={14} />}
                        </button>
                      )}
                      {canToggleRole && (
                        <button title={m.role === "ADMIN" ? "Rebaixar para membro" : "Promover a admin"}
                          onClick={() => performMemberOp("role", m.id, m.role === "ADMIN" ? "MEMBER" : "ADMIN")}
                          disabled={busyMemberId === m.id}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] transition hover:bg-[var(--accent-bg)] hover:text-[var(--accent)] disabled:opacity-30">
                          {busyMemberId === m.id ? <Loader2 size={13} className="animate-spin" /> : <Shield size={14} />}
                        </button>
                      )}
                      <button title="Remover" onClick={() => performMemberOp("remove", m.id)}
                        disabled={busyMemberId === m.id}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] transition hover:bg-[var(--red-bg)] hover:text-[var(--red)] disabled:opacity-30">
                        <UserMinus size={14} />
                      </button>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      )}

      {/* Stats tab */}
      {tab === "stats" && (
        <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-8 lg:px-12 space-y-5">
          <WeeklyQuestWidget groupId={group.id} />
          {milestones.length > 0 && <MilestoneBar milestones={milestones} totalMinutes={totalMinutes} />}
          <div className="glass-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp size={14} className="text-[var(--accent)]" />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">Contribuições</span>
              </div>
              <PeriodFilter value={statsPeriod} onChange={setStatsPeriod} />
            </div>
            <MemberContributions groupId={group.id} period={statsPeriod} />
          </div>
        </div>
      )}

      {/* Settings tab */}
      {tab === "settings" && (
        <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-8 lg:px-12 space-y-5">
          <div className="flex items-center gap-2">
            <Settings size={14} className="text-[var(--accent)]" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">Configurações do grupo</span>
          </div>

          {/* Icon / emoji */}
          <div className="glass-card flex flex-col items-center gap-4 p-5 sm:flex-row">
            {group.avatarUrl ? (
              <img src={group.avatarUrl} alt={group.name} className="h-16 w-16 rounded-2xl object-cover" />
            ) : (
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl text-4xl">{group.avatarEmoji}</span>
            )}
            <div className="flex-1 text-center sm:text-left">
              <p className="text-sm font-medium text-[var(--text)]">Ícone do grupo</p>
              <p className="text-xs text-[var(--text-faint)]">Envie uma imagem (até 7 MB)</p>
            </div>
            {(isOwner || isAdmin) && (
              <>
                <input ref={iconRef} type="file" accept="image/*" className="hidden" onChange={handleIconUpload} />
                <button onClick={() => iconRef.current?.click()} disabled={savingIcon}
                  className="btn-primary flex items-center gap-2 px-4 py-2 text-xs disabled:opacity-30">
                  {savingIcon ? <Loader2 size={13} className="animate-spin" /> : <ImageIcon size={13} />}
                  {savingIcon ? "Enviando..." : "Alterar ícone"}
                </button>
              </>
            )}
          </div>

          {(isOwner || isAdmin) && (
            <>
              {/* Name / description / privacy */}
              <div className="glass-card space-y-4 p-5">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">Nome do grupo</label>
                  <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                    className="glass-card w-full px-4 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--text-faint)] outline-none focus:border-[var(--accent)]/40" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">Descrição</label>
                  <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={3}
                    placeholder="Descreva o objetivo do grupo..."
                    className="glass-card w-full resize-none px-4 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--text-faint)] outline-none focus:border-[var(--accent)]/40" />
                </div>
                <label className="flex cursor-pointer items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-[var(--text)]">Grupo público</p>
                    <p className="text-xs text-[var(--text-faint)]">Aparece no ranking global para todos</p>
                  </div>
                  <button role="switch" aria-checked={editPublic} onClick={() => setEditPublic((v) => !v)}
                    className={`relative h-6 w-11 shrink-0 rounded-full transition ${editPublic ? "bg-[var(--accent)]" : "bg-[var(--bg-surface-hover)]"}`}>
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${editPublic ? "left-[22px]" : "left-0.5"}`} />
                  </button>
                </label>
                <button onClick={saveSettings} disabled={savingSettings}
                  className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm disabled:opacity-30">
                  {savingSettings ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  Salvar alterações
                </button>
              </div>
            </>
          )}

          {/* Invite */}
          {(isOwner || isAdmin) && (
            <div className="glass-card space-y-3 p-5">
              <p className="text-sm font-medium text-[var(--text)]">Convidar amigos</p>
              {friends.length === 0 ? (
                <p className="text-xs text-[var(--text-faint)]">Nenhum amigo disponível para convidar.</p>
              ) : (
                <div className="max-h-48 space-y-1 overflow-y-auto">
                  {friends.filter((f) => !group.members.some((m) => m.id === f.id)).map((f) => {
                    const selected = inviteIds.includes(f.id);
                    return (
                      <button key={f.id}
                        onClick={() => setInviteIds((prev) => selected ? prev.filter((x) => x !== f.id) : [...prev, f.id])}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition ${selected ? "bg-[var(--accent-bg)] border border-[var(--accent)]/30" : "glass-card hover:brightness-110"}`}>
                        <UserAvatar user={f} size={32} />
                        <p className="truncate text-sm text-[var(--text)]">{f.displayName}</p>
                        <div className={`ml-auto flex h-5 w-5 items-center justify-center rounded-md border transition ${selected ? "border-[var(--accent)] bg-[var(--accent)] text-black" : "border-[var(--border-subtle)]"}`}>
                          {selected && <Check size={11} />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              <button onClick={inviteFriends} disabled={inviting || inviteIds.length === 0}
                className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm disabled:opacity-30">
                {inviting ? <Loader2 size={14} className="animate-spin" /> : <Users size={14} />}
                Convidar {inviteIds.length > 0 ? `(${inviteIds.length})` : ""}
              </button>
            </div>
          )}

          {/* Danger zone */}
          <div className="glass-card space-y-3 border-[var(--red)]/20 p-5">
            <p className="text-sm font-semibold text-[var(--red)]">Zona de perigo</p>
            {!isOwner && (
              <button onClick={() => setConfirmAction("leave")}
                className="flex w-full items-center justify-between rounded-xl border border-[var(--red)]/30 px-4 py-3 text-sm text-[var(--red)] transition hover:bg-[var(--red-bg)]">
                Sair do grupo
                <UserMinus size={16} />
              </button>
            )}
            {isOwner && (
              <>
                <p className="text-xs text-[var(--text-faint)]">
                  O dono não pode sair sem transferir a propriedade. Use o botão de transferência na aba Membros e depois exclua o grupo se desejar.
                </p>
                <button onClick={() => setConfirmAction("delete")}
                  className="flex w-full items-center justify-between rounded-xl border border-[var(--red)]/30 px-4 py-3 text-sm text-[var(--red)] transition hover:bg-[var(--red-bg)]">
                  Excluir grupo
                  <Trash2 size={16} />
                </button>
              </>
            )}
          </div>

          {/* Confirm dialog */}
          <AnimatePresence>
            {confirmAction && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
                <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
                  className="glass-card w-full max-w-sm space-y-4 p-6">
                  <p className="text-base font-semibold text-[var(--text)]">
                    {confirmAction === "delete" ? "Excluir grupo?" : "Sair do grupo?"}
                  </p>
                  <p className="text-sm text-[var(--text-muted)]">
                    {confirmAction === "delete"
                      ? "Todos os membros, mensagens e contribuições serão apagados. Esta ação não pode ser desfeita."
                      : "Você deixará de ver as mensagens e participação neste grupo."}
                  </p>
                  <div className="flex items-center justify-end gap-3">
                    <button onClick={() => setConfirmAction(null)}
                      className="rounded-xl px-4 py-2 text-sm text-[var(--text-muted)] transition hover:text-[var(--text)]">
                      Cancelar
                    </button>
                    <button onClick={doConfirmAction} disabled={savingSettings}
                      className="flex items-center gap-2 rounded-xl bg-[var(--red)] px-4 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-30">
                      {savingSettings ? <Loader2 size={14} className="animate-spin" /> : null}
                      {confirmAction === "delete" ? "Excluir" : "Sair"}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}
