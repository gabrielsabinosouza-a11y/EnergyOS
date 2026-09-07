"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import Image from "next/image";
import {
  ArrowLeft, ArrowUp, ArrowDown, Check, Loader2,
  MessageCircle, Plus, Timer, Trophy,
  TrendingUp, Users, X as XIcon, Zap, Settings,
  Image as ImageIcon,
  Trash2, UserMinus,
  VolumeX, Ban, MoreVertical, Volume2, UserCheck,
  Sparkles, Mail,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Header } from "@/components/navigation";
import { ChatThread, ChatComposer, ConversationContextMenu, convActions } from "@/components/chat";
import { groupPinnedToChatMessage, groupToChatMessage } from "@/types";
import { useAuthRedirect } from "@/lib/auth-context";
import { streakIconSource } from "@/lib/energy-assets";
import { api } from "@/lib/api-client";
import type { FriendSummary, GroupDetail, GroupInvite, GroupMessage, GroupPinnedMessage, GroupSummary, GroupMember } from "@/types";
import type { GroupLeaderboardEntry, MemberContribution } from "@/lib/db/group-leaderboard";
import type { GroupMilestoneStatus, GroupWeeklyQuestStatus } from "@/lib/db/group-milestones";
import type { GroupAchievementStatus } from "@/lib/db/group-achievements";

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

type MemberAction =
  | { type: "ban"; member: GroupMember }
  | { type: "unban"; member: GroupMember }
  | { type: "kick"; member: GroupMember }
  | { type: "promote"; member: GroupMember }
  | { type: "demote"; member: GroupMember }
  | { type: "mute"; member: GroupMember }
  | { type: "unmute"; member: GroupMember };

function MemberActionMenu({
  anchor, actions, busy, onAction, onClose,
}: {
  anchor: { x: number; y: number };
  actions: MemberAction[];
  busy: boolean;
  onAction: (a: MemberAction) => void;
  onClose: () => void;
}) {
  const icons: Record<MemberAction["type"], React.ReactNode> = {
    ban: <Ban size={13} />,
    unban: <UserCheck size={13} />,
    kick: <UserMinus size={13} />,
    promote: <ArrowUp size={13} />,
    demote: <ArrowDown size={13} />,
    mute: <VolumeX size={13} />,
    unmute: <Volume2 size={13} />,
  };
  const labels: Record<MemberAction["type"], string> = {
    ban: "Banir do grupo",
    unban: "Desbanir",
    kick: "Expulsar",
    promote: "Promover a admin",
    demote: "Rebaixar a membro",
    mute: "Silenciar",
    unmute: "Desilenciar",
  };
  return (
    <>
      <div className="fixed inset-0 z-50" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card fixed z-50 w-52 overflow-hidden rounded-xl border-[var(--border)] p-1 shadow-xl"
        style={{ left: anchor.x, top: anchor.y }}
      >
        {actions.map((a) => (
          <button
            key={a.type}
            disabled={busy}
            onClick={() => onAction(a)}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[var(--text)] transition hover:bg-[var(--accent-bg)] disabled:opacity-40"
          >
            {icons[a.type]}
            {labels[a.type]}
          </button>
        ))}
      </motion.div>
    </>
  );
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
        <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[var(--accent-bg)] text-lg leading-none">
          {typeof entry.groupAvatarUrl === "string" && entry.groupAvatarUrl.trim() ? (
            <img
              src={entry.groupAvatarUrl}
              alt={entry.groupName}
              width={32}
              height={32}
              className="h-8 w-8 object-cover"
            />
          ) : (
            entry.groupAvatarEmoji
          )}
        </span>
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

  useEffect(() => { Promise.resolve().then(() => void load(period)); }, [period, load]);

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
              <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[var(--accent-bg)] text-base leading-none">
                {typeof userEntry.groupAvatarUrl === "string" && userEntry.groupAvatarUrl.trim() ? (
                  <img
                    src={userEntry.groupAvatarUrl}
                    alt={userEntry.groupName}
                    width={28}
                    height={28}
                    className="h-7 w-7 object-cover"
                  />
                ) : (
                  userEntry.groupAvatarEmoji
                )}
              </span>
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
  // Live completion: a milestone is complete when it was unlocked OR current
  // progress already reached/passed its threshold (covers stale label rows).
  const isComplete = (m: GroupMilestoneStatus) => !!m.unlockedAt || totalMinutes >= m.thresholdMinutes;
  const next = milestones.find((m) => !isComplete(m));
  const prev = milestones.filter((m) => isComplete(m)).at(-1);

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
      {milestones.filter((m) => isComplete(m)).length > 0 && (
        <div className="mt-3 border-t border-[var(--border-subtle)] pt-3">
          <p className="mb-2 text-[9px] uppercase tracking-widest text-[var(--text-faint)]">Marcos conquistados</p>
          <div className="flex flex-wrap gap-2">
            {milestones.filter((m) => isComplete(m)).map((m) => (
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
  const [error, setError] = useState("");

  useEffect(() => {
    api.getGroupWeeklyQuest(groupId)
      .then((d) => setQuest(d.quest))
      .catch((e) => setError(e instanceof Error ? e.message : "Erro ao carregar missão."));
  }, [groupId]);

  if (!quest) return null;

  const progress = Math.min((quest.currentMinutes / quest.targetMinutes) * 100, 100);
  const isComplete = !!quest.completedAt;
  const isCredited = !!quest.claimedAt;

  return (
    <div className={`glass-card p-4 ${isComplete && !isCredited ? "border-amber-400/30" : ""}`}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap size={14} className="text-amber-400" />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
            Missão Semanal do Grupo
          </span>
        </div>
        {isComplete && <Check size={14} className="text-green-400" />}
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

      {isCredited && (
        <p className="text-center text-[10px] text-green-400">✓ Recompensa resgatada!</p>
      )}

      {isComplete && !isCredited && quest.contributedMinutes > 0 && (
        <p className="text-center text-[10px] text-green-400">✓ Recompensa creditada automaticamente!</p>
      )}

      {isComplete && quest.contributedMinutes === 0 && (
        <p className="mt-1 text-center text-[10px] text-[var(--text-faint)]">
          Contributors receberam +{quest.coinsPerMember} moedas. Participe com foco para ganhar as próximas.
        </p>
      )}

      {error && <p className="mt-1 text-[10px] text-[var(--red)]">{error}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Group achievements                                                  */
/* ------------------------------------------------------------------ */

function GroupAchievementsWidget({ groupId }: { groupId: number }) {
  const [achievements, setAchievements] = useState<GroupAchievementStatus[] | null>(null);

  useEffect(() => {
    api.getGroupAchievements(groupId)
      .then((d) => setAchievements(d.achievements))
      .catch(() => { /* silent */ });
  }, [groupId]);

  if (!achievements || achievements.length === 0) return null;

  return (
    <div className="space-y-4">
      {achievements.map((status) => <GroupAchievementCard key={status.id} status={status} />)}
    </div>
  );
}

function GroupAchievementCard({ status }: { status: GroupAchievementStatus }) {
  const unlocked = !!status.unlockedAt;

  return (
    <div className={`glass-card p-4 ${unlocked ? "border-[var(--accent)]/40" : ""}`}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className={unlocked ? "text-[var(--accent)]" : "text-[var(--text-muted)]"} />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
            Conquista de Grupo
          </span>
        </div>
        {unlocked && <Check size={14} className="text-green-400" />}
      </div>

      <p className="mb-1 text-xs font-medium text-[var(--text)]">{status.title}</p>
      <p className="text-[10px] text-[var(--text-faint)]">{status.description}</p>
      <p className="mt-2 text-[10px]">
        {unlocked ? (
          <span className="text-[var(--accent)]">
            Conquistada! +{status.coinsPerMember} moedas por membro 🎉
          </span>
        ) : (
          <span className="text-[var(--text-muted)]">🔒 {status.requirement}</span>
        )}
      </p>
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
  const [tab, setTab] = useState<"meus" | "ranking" | "inbox">("meus");
  const [invites, setInvites] = useState<GroupInvite[]>([]);
  const [respondingInvite, setRespondingInvite] = useState<number | null>(null);

  /* Create form */
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createIcon, setCreateIcon] = useState<string | null>(null);
  const [createIconName, setCreateIconName] = useState("");
  const [inviteIds, setInviteIds] = useState<string[]>([]);
  const [friends, setFriends] = useState<FriendSummary[]>([]);
  const [createMemberUsernames, setCreateMemberUsernames] = useState<string[]>([]);
  const [usernameInput, setUsernameInput] = useState("");
  const [creating, setCreating] = useState(false);

  /* Detail view */
  const [activeGroup, setActiveGroup] = useState<GroupDetail | null>(null);

  /* Current user's app-level profile id (parseProfileId(uid)). All ownership
     comparisons (member.id, senderId, etc.) must use this, NEVER user.uid. */
    const [myProfileId, setMyProfileId] = useState<string | null>(null);
  const [profileIdReady, setProfileIdReady] = useState(false);

  const currentUserId = myProfileId ?? user?.uid ?? "";

  /* Conversation list context menu */
  const [listMenu, setListMenu] = useState<{ x: number; y: number; group: GroupSummary } | null>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    api.getProfile()
      .then(({ user: profile }) => { if (active && profile?.id) setMyProfileId(profile.id); })
      .catch(() => {})
      .finally(() => { if (active) setProfileIdReady(true); });
    return () => { active = false; };
  }, [user]);

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

  const loadInvites = useCallback(async () => {
    try {
      const { invites: pending } = await api.getGroupInvites();
      setInvites(pending);
    } catch {
      setError("Não foi possível carregar os convites.");
    }
  }, []);

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    Promise.all([loadGroups(), loadInvites()]).then(() => { if (cancelled) return; });
    return () => { cancelled = true; };
  }, [authLoading, user?.uid, loadGroups, loadInvites]);

  async function respondToInvite(invite: GroupInvite, response: "accepted" | "rejected") {
    if (respondingInvite) return;
    setRespondingInvite(invite.id);
    try {
      await api.respondToGroupInvite(invite.id, response);
      setInvites((prev) => prev.filter((item) => item.id !== invite.id));
      if (response === "accepted") await loadGroups();
    } catch {
      setError("Não foi possível responder ao convite.");
    } finally {
      setRespondingInvite(null);
    }
  }

  useEffect(() => {
    if (!showCreate || friends.length > 0) return;
    api.getFriends().then(({ friends: f }) => setFriends(f)).catch(() => {});
  }, [showCreate, friends.length]);

  const handleCreate = useCallback(async () => {
    const name = createName.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      const { group } = createMemberUsernames.length > 0
        ? await api.createGroupWithUsernames({ name, avatarUrl: createIcon ?? undefined, memberUsernames: createMemberUsernames })
        : await api.createGroup({ name, avatarUrl: createIcon ?? undefined, inviteIds });
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
      setCreateMemberUsernames([]);
      setUsernameInput("");
    } catch {
      setError("Não foi possível criar o grupo.");
    } finally {
      setCreating(false);
    }
  }, [createName, createIcon, inviteIds, createMemberUsernames, creating]);

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
      <main className={`relative ${activeGroup ? "flex h-[calc(100dvh-126px-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] flex-col px-5 sm:px-8 lg:h-auto lg:min-h-screen lg:px-12" : "min-h-screen px-5 py-7 sm:px-8 lg:px-12 lg:py-10"}`}>
        {!activeGroup && <Header eyebrow="Comunidade" title="Grupos" />}

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
              currentUserId={currentUserId}
              profileIdReady={profileIdReady}
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
                  {(["meus", "inbox", "ranking"] as const).map((t) => (
                    <button key={t} onClick={() => setTab(t)}
                      className={`px-4 py-2 text-sm transition ${t === tab ? "bg-[var(--accent-bg)] text-[var(--accent)]" : "text-[var(--text-muted)] hover:text-[var(--text)]"}`}>
                      {t === "meus" ? "Meus grupos" : t === "inbox" ? (
                        <span className="inline-flex items-center gap-1.5">Caixa de Entrada
                          {invites.length > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[10px] font-bold text-black">{invites.length > 99 ? "99+" : invites.length}</span>}
                        </span>
                      ) : "🏆 Ranking"}
                    </button>
                  ))}
                </div>
                {tab === "meus" && (
                  <button onClick={() => { setShowCreate((v) => !v); if (showCreate) { setCreateMemberUsernames([]); setUsernameInput(""); } }}
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

              {tab === "inbox" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Mail size={18} className="text-[var(--accent)]" />
                    <h2 className="font-display text-lg font-semibold text-[var(--text)]">Caixa de Entrada</h2>
                  </div>
                  {invites.length === 0 ? (
                    <div className="glass-card p-10 text-center text-sm text-[var(--text-muted)]">Nenhum convite pendente.</div>
                  ) : invites.map((invite) => (
                    <div key={invite.id} className="glass-card flex items-center gap-3 p-4">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[var(--accent-bg)] text-2xl">
                        {invite.groupAvatarUrl ? <img src={invite.groupAvatarUrl} alt={invite.groupName} className="h-full w-full object-cover" /> : invite.groupAvatarEmoji}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-[var(--text)]">{invite.groupName}</p>
                        <p className="text-xs text-[var(--text-muted)]">Convite de {invite.invitedBy.displayName}</p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button onClick={() => respondToInvite(invite, "rejected")} disabled={respondingInvite === invite.id} className="rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-xs text-[var(--text-muted)] disabled:opacity-40">Recusar</button>
                        <button onClick={() => respondToInvite(invite, "accepted")} disabled={respondingInvite === invite.id} className="btn-primary px-3 py-2 text-xs disabled:opacity-40">{respondingInvite === invite.id ? <Loader2 size={14} className="animate-spin" /> : "Aceitar"}</button>
                      </div>
                    </div>
                  ))}
                </div>
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
                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">Ou adicionar por @</label>
                          {createMemberUsernames.length > 0 && (
                            <div className="mb-2 flex flex-wrap gap-1.5">
                              {createMemberUsernames.map((u) => (
                                <span key={u}
                                  className="inline-flex items-center gap-1 rounded-full bg-black/10 px-2 py-0.5 text-sm text-[var(--text)]">
                                  @{u}
                                  <button type="button" onClick={() => setCreateMemberUsernames((prev) => prev.filter((v) => v !== u))}
                                    className="ml-0.5 rounded-full p-0.5 transition hover:bg-black/10">
                                    <XIcon size={11} />
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                          <input type="text" placeholder="@usuario" value={usernameInput}
                            onChange={(e) => setUsernameInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                const val = usernameInput.trim().replace(/^@/, "");
                                if (val && !createMemberUsernames.includes(val)) {
                                  setCreateMemberUsernames((prev) => [...prev, val]);
                                }
                                setUsernameInput("");
                              }
                            }}
                            className="glass-card w-full px-4 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--text-faint)] outline-none focus:border-[var(--accent)]/40" />
                          <p className="mt-1 text-[11px] text-[var(--text-faint)]">Separe com espaço ou Enter. O servidor valida no momento da criação.</p>
                        </div>
                        <div className="flex items-center gap-3 pt-2">
                          <button onClick={handleCreate} disabled={!createName.trim() || creating}
                            className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm disabled:opacity-30">
                            {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                            Criar
                          </button>
                          <button onClick={() => { setShowCreate(false); setCreateMemberUsernames([]); setUsernameInput(""); }}
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
                          onContextMenu={(e) => {
                            e.preventDefault();
                            setListMenu({ x: e.clientX, y: e.clientY, group: g });
                          }}
                          onClick={() => {
                            api.getGroup(g.id)
                              .then(({ group }) => { setError(null); setActiveGroup(group); })
                              .catch(() => setError("Não foi possível abrir o grupo."));
                            if (g.unreadCount > 0) setGroups((prev) => prev.map((x) => x.id === g.id ? { ...x, unreadCount: 0 } : x));
                          }}
                          className="glass-card group relative flex flex-col items-center gap-3 px-4 py-6 text-center transition hover:border-[var(--accent)]/30">
                          <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[var(--accent-bg)] text-4xl leading-none">
                            {typeof g.avatarUrl === "string" && g.avatarUrl.trim() ? (
                              <img
                                src={g.avatarUrl}
                                alt={g.name}
                                width={48}
                                height={48}
                                className="h-12 w-12 object-cover"
                              />
                            ) : (
                              g.avatarEmoji
                            )}
                          </span>
                          <p className="font-display text-sm font-medium text-[var(--text)] group-hover:text-[var(--accent)]">{g.name}</p>
                          <div className="flex items-center gap-4 text-[11px] text-[var(--text-muted)]">
                            <span className="flex items-center gap-1"><Users size={12} />{g.memberCount}</span>
                            <span className="flex items-center gap-1 text-[var(--green)]"><Timer size={12} />{fmtMinutes(g.weeklyFocusMinutes)}</span>
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

        {/* Conversation list context menu */}
        {listMenu && (
          <ConversationContextMenu
            x={listMenu.x}
            y={listMenu.y}
            onClose={() => setListMenu(null)}
            actions={[
              convActions.markAsRead(() => {
                if (listMenu.group.unreadCount > 0) {
                  api.markGroupRead(listMenu.group.id).catch(() => {});
                  setGroups((prev) =>
                    prev.map((x) =>
                      x.id === listMenu.group.id ? { ...x, unreadCount: 0 } : x,
                    ),
                  );
                }
              }),
              convActions.leave(() => {
                api.groupAction(listMenu.group.id, "leave")
                  .then(() => {
                    setGroups((prev) => prev.filter((x) => x.id !== listMenu.group.id));
                    setUserGroupIds((prev) => prev.filter((id) => id !== listMenu.group.id));
                  })
                  .catch(() => setError("Não foi possível sair do grupo."));
              }),
            ]}
          />
        )}
      </main>
    </AppShell>
  );
}

/* ------------------------------------------------------------------ */
/*  Group Detail Panel                                                 */
/* ------------------------------------------------------------------ */

function GroupDetailPanel({
  group: initialGroup, currentUserId, profileIdReady, reduced, onBack, onRead,
}: {
  group: GroupDetail; currentUserId: string; profileIdReady: boolean; reduced: boolean;
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
  const [pinnedMessages, setPinnedMessages] = useState<GroupPinnedMessage[]>([]);
  const [replyingTo, setReplyingTo] = useState<GroupMessage | null>(null);
  const lastIdRef = useRef<number | undefined>(undefined);

  /* Settings state */
  const [editName, setEditName] = useState(group.name);
  const [editDesc, setEditDesc] = useState(group.description ?? "");
  const [editPublic, setEditPublic] = useState(group.isPublic);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingIcon, setSavingIcon] = useState(false);
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);
  const [memberMenu, setMemberMenu] = useState<{ x: number; y: number; member: GroupMember } | null>(null);
  const [confirmAction, setConfirmAction] = useState<"leave" | "delete" | null>(null);
  const [inviteIds, setInviteIds] = useState<string[]>([]);
  const [friends, setFriends] = useState<FriendSummary[]>([]);
  const [inviting, setInviting] = useState(false);
  const [messageError, setMessageError] = useState("");
  const iconRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    api.markGroupRead(group.id).then(() => { if (!cancelled) onRead(group.id); }).catch(() => {});
    return () => { cancelled = true; };
  }, [group.id, onRead]);

  useEffect(() => {
    let cancelled = false;
    api.getGroupMessages(group.id)
      .then(({ messages: msgs }) => {
        if (cancelled) return;
        setMessages(msgs);
        lastIdRef.current = msgs.length > 0 ? msgs[msgs.length - 1].id : undefined;
      })
      .catch(() => { if (!cancelled) setMessageError("Não foi possível carregar as mensagens."); });
    api.getGroupPinnedMessages(group.id)
      .then(({ pins }) => { if (!cancelled) setPinnedMessages(pins); })
      .catch(() => { /* silent */ });
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

  /* Poll messages (and pins, so expired pins leave the banner automatically) */
  useEffect(() => {
    if (tab !== "chat") return;
    const interval = setInterval(async () => {
      try {
        const [{ messages: msgs }, { pins }] = await Promise.all([
          api.getGroupMessages(group.id),
          api.getGroupPinnedMessages(group.id),
        ]);
        setMessages(msgs);
        setPinnedMessages(pins);
        if (msgs.length > 0) {
          lastIdRef.current = msgs[msgs.length - 1].id;
        }
      } catch { /* silent */ }
    }, 5000);
    return () => clearInterval(interval);
  }, [group.id, tab]);

  useEffect(() => {
    if (!tab.includes("settings")) return;
    if (friends.length > 0) return;
    api.getFriends().then(({ friends: f }) => setFriends(f)).catch(() => {});
  }, [tab, friends.length]);

  /* Composer persistence — the composer UI (upload + mic) lives in the shared
     ChatComposer; these wrappers persist to the group API and surface failures
     by rethrowing so the composer can restore input + show an error. */
  function appendMessage(message: GroupMessage) {
    setMessages((prev) => [...prev, message]);
    lastIdRef.current = message.id;
  }

  const chatMessages = messages.map((m) => groupToChatMessage(m));
  const pinnedChatMessages = pinnedMessages.map(groupPinnedToChatMessage);

  async function handleSend(body: string) {
    const { message } = await api.sendGroupMessage(group.id, body);
    appendMessage(message);
  }

  async function handleReply(body: string, replyToId: number) {
    const { message } = await api.sendGroupMessage(group.id, body, { replyToId });
    appendMessage(message);
    setReplyingTo(null);
  }

  async function handleComposerSend(body: string) {
    setMessageError("");
    if (replyingTo) await handleReply(body, replyingTo.id);
    else await handleSend(body);
  }

  async function handleComposerSendMedia(opts: { messageType: string; mediaUrl?: string; body?: string; mediaDurationSeconds?: number; mediaFileName?: string; mediaMimeType?: string; mediaSizeBytes?: number }) {
    const { message } = await api.sendGroupMessage(group.id, opts.body ?? "", {
      messageType: opts.messageType,
      mediaUrl: opts.mediaUrl,
      mediaDurationSeconds: opts.mediaDurationSeconds,
    });
    appendMessage(message);
  }

  async function handleEditMessage(messageId: number, newBody: string) {
    try {
      const { message } = await api.editGroupMessage(messageId, group.id, newBody);
      setMessages((prev) => prev.map((m) => (m.id === messageId ? message : m)));
    } catch {
      setMessageError("Não foi possível editar a mensagem.");
    }
  }

  async function handleDeleteMessage(messageId: number) {
    try {
      await api.deleteGroupMessage(messageId, group.id);
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    } catch {
      setMessageError("Não foi possível apagar a mensagem.");
    }
  }

  async function handleReactMessage(messageId: number, emoji: string) {
    try {
      const { message } = await api.reactToGroupMessage(messageId, emoji);
      setMessages((prev) => prev.map((m) => (m.id === messageId ? message : m)));
    } catch {
      setMessageError("Não foi possível reagir à mensagem.");
    }
  }

  async function handleTogglePin(messageId: number, durationDays?: 7 | 14 | 30) {
    try {
      await api.pinGroupMessage(messageId, durationDays);
      const [{ messages: msgs }, { pins }] = await Promise.all([
        api.getGroupMessages(group.id),
        api.getGroupPinnedMessages(group.id),
      ]);
      setMessages(msgs);
      setPinnedMessages(pins);
      lastIdRef.current = msgs.length > 0 ? msgs[msgs.length - 1].id : undefined;
      setMessageError("");
    } catch (e) {
      setMessageError(e instanceof Error && e.message ? e.message : "Não foi possível fixar a mensagem.");
    }
  }

  /* Members */
  async function runMemberAction(action: MemberAction) {
    setMemberMenu(null);
    if (busyMemberId) return;
    const m = action.member;
    setBusyMemberId(m.id);
    setMessageError("");
    try {
      if (action.type === "ban") {
        await api.setGroupMemberBanned(group.id, m.id, true);
        setGroup((g) => g ? { ...g, members: g.members.map((x) => x.id === m.id ? { ...x, isBanned: true } : x) } : g);
      } else if (action.type === "unban") {
        await api.setGroupMemberBanned(group.id, m.id, false);
        setGroup((g) => g ? { ...g, members: g.members.map((x) => x.id === m.id ? { ...x, isBanned: false } : x) } : g);
      } else if (action.type === "kick") {
        await api.removeGroupMember(group.id, m.id);
        setGroup((g) => g ? { ...g, members: g.members.filter((x) => x.id !== m.id) } : g);
      } else if (action.type === "promote" || action.type === "demote") {
        const role = action.type === "promote" ? "ADMIN" : "MEMBER";
        await api.updateGroupMemberRole(group.id, m.id, role);
        setGroup((g) => g ? { ...g, members: g.members.map((x) => x.id === m.id ? { ...x, role } : x) } : g);
      } else if (action.type === "mute") {
        await api.setGroupMemberMuted(group.id, m.id, true);
        setGroup((g) => g ? { ...g, members: g.members.map((x) => x.id === m.id ? { ...x, isMuted: true } : x) } : g);
      } else if (action.type === "unmute") {
        await api.setGroupMemberMuted(group.id, m.id, false);
        setGroup((g) => g ? { ...g, members: g.members.map((x) => x.id === m.id ? { ...x, isMuted: false } : x) } : g);
      }
    } catch (e) {
      setMessageError(e instanceof Error ? e.message : "Operação falhou.");
    } finally {
      setBusyMemberId(null);
    }
  }

  function actionsFor(m: GroupMember): MemberAction[] {
    if (m.id === currentUserId || m.role === "OWNER") return [];
    const actions: MemberAction[] = [];
    if (m.isBanned) {
      if (isOwner || (isAdmin && m.role === "MEMBER")) actions.push({ type: "unban", member: m });
      if (isOwner) actions.push({ type: "kick", member: m });
      return actions;
    }
    if ((isOwner || isAdmin) && m.role === "MEMBER") {
      actions.push(m.isMuted ? { type: "unmute", member: m } : { type: "mute", member: m });
    }
    if (isOwner) {
      if (m.role === "ADMIN") actions.push({ type: "demote", member: m }, { type: "ban", member: m });
      if (m.role === "MEMBER") actions.push({ type: "promote", member: m }, { type: "ban", member: m });
    }
    return actions;
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
            className="-mx-5 flex min-h-0 flex-1 flex-col overflow-hidden sm:-mx-8 lg:-mx-12">

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
            {group.members.length} membros · {fmtMinutes(group.weeklyFocusMinutes)}/semana
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
        <div className="flex min-h-0 flex-1 flex-col">
        {profileIdReady ? (
        <ChatThread
          messages={chatMessages}
          currentUserId={currentUserId}
          reduced={reduced}
          showAvatar
          showSenderName
          deleteSenderRoles={isOwner
            ? (["OWNER", "ADMIN", "MEMBER"] as const)
            : isAdmin
              ? (["MEMBER"] as const)
              : undefined}
          mentionMembers={group.members.map((m) => ({ id: m.id, displayName: m.displayName, username: m.username }))}
          onSend={handleSend}
          onReply={handleReply}
          onEdit={handleEditMessage}
          onDelete={handleDeleteMessage}
          onReact={handleReactMessage}
          onTogglePin={handleTogglePin}
          pinnedMessages={pinnedChatMessages}
          onReplyMessage={(m) => {
            const gm = messages.find((x) => x.id === m.id);
            if (gm) setReplyingTo(gm);
          }}
          replyingTo={replyingTo ? groupToChatMessage(replyingTo) : null}
          onCancelReply={() => setReplyingTo(null)}
          inputSlot={
            <ChatComposer
              replying={Boolean(replyingTo)}
              mentionMembers={group.members.map((m) => ({ id: m.id, displayName: m.displayName, username: m.username, photoUrl: m.photoUrl }))}
              currentUserId={currentUserId}
              onSendText={handleComposerSend}
              onSendMedia={handleComposerSendMedia}
            />
          }
          />
        ) : (
        <div className="flex-1 min-h-0 flex items-center justify-center">
          <Loader2 size={18} className="animate-spin text-[var(--text-muted)]" />
        </div>
        )}
        </div>
      )}

      {/* Members tab */}
      {tab === "members" && (
        <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-8 lg:px-12">
          <div className="glass-card mb-6 flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--green-bg)] text-[var(--green)]">
              <Timer size={22} />
            </div>
            <div>
              <p className="text-lg font-bold text-[var(--text)]">{(() => { const m = group.weeklyFocusMinutes; const h = Math.floor(m / 60); const r = m % 60; return r > 0 ? `${h}h ${r}min` : `${h}h`; })()}<span className="ml-1 text-xs font-normal text-[var(--text-muted)]">foco</span></p>
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
              return (
                <motion.div key={m.id} variants={fadeUp} className="glass-card flex items-center gap-3 px-4 py-3">
                  <UserAvatar user={{ displayName: m.displayName, photoUrl: m.photoUrl }} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-[var(--text)]">{m.displayName}</p>
                      {m.role === "OWNER" && <Image src="/tags/owner.png" alt="Dono do grupo" width={28} height={28} className="h-7 w-7 shrink-0 object-contain" unoptimized />}
                      {m.role === "ADMIN" && <Image src="/tags/admin.png" alt="Administrador" width={28} height={28} className="h-7 w-7 shrink-0 object-contain" unoptimized />}
                      {m.id === currentUserId && <span className="text-[9px] text-[var(--text-faint)]">(você)</span>}
                    </div>
                    {m.username && <p className="truncate text-xs text-[var(--text-muted)]">@{m.username}</p>}
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-[var(--orange)]">
                    <Image src={streakIconSource(m.currentStreak)} alt="streak" width={12} height={12} style={{ objectFit: "contain" }} unoptimized />
                    {m.currentStreak}
                  </div>
                  {m.isBanned && (
                    <span className="rounded-full bg-[var(--red-bg)] px-2 py-0.5 text-[9px] font-medium text-[var(--red)]">
                      banido
                    </span>
                  )}
                  {m.isMuted && (
                    <span className="rounded-full bg-[var(--accent-bg)] px-2 py-0.5 text-[9px] font-medium text-[var(--accent)]">
                      silenciado
                    </span>
                  )}
                  {actionsFor(m).length > 0 && (
                    <button
                      title="Ações"
                      onClick={(e) => {
                        e.stopPropagation();
                        const rect = e.currentTarget.getBoundingClientRect();
                        setMemberMenu({ x: rect.right - 208, y: rect.bottom + 4, member: m });
                      }}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] transition hover:bg-[var(--accent-bg)] hover:text-[var(--accent)]"
                    >
                      <MoreVertical size={15} />
                    </button>
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
          <GroupAchievementsWidget groupId={group.id} />
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
            {isOwner && (
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

          {isOwner && (
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
          {me && !me.isBanned && (
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
                  O dono não pode sair do grupo nem transferir a propriedade para outro membro.
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

      {memberMenu && (
        <MemberActionMenu
          anchor={memberMenu}
          actions={actionsFor(memberMenu.member)}
          busy={busyMemberId !== null}
          onAction={runMemberAction}
          onClose={() => setMemberMenu(null)}
        />
      )}
    </motion.div>
  );
}
