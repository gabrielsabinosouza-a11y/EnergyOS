"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthRedirect } from "@/lib/auth-context";
import {
  Trophy, ChevronLeft, Clock, ArrowUp, ArrowDown,
  Sparkles, Users, Loader2, TrendingUp, Crown, Star, Medal,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { api } from "@/lib/api-client";
import { ProfileModal } from "@/components/profile-modal";
import { Avatar as SharedAvatar } from "@/components/avatar";
import type { NewLeagueTier } from "@/types";
import type { LeagueNewSnapshot } from "@/lib/db/league-new";

// ── Tier config ───────────────────────────────────────────────────────────────

const TIER_CONFIG: Record<NewLeagueTier, {
  label: string; color: string; glow: string;
  icon: React.ElementType; description: string; shortLabel: string;
  iconPath: string;
}> = {
  BRONZE:   { label: "Bronze",   color: "#cd7f32", glow: "rgba(205,127,50,0.4)",  icon: Medal,  description: "O início da jornada",           shortLabel: "BR", iconPath: "/leaderboard/bronze.png"   },
  PRATA:    { label: "Prata",    color: "#c0c0c0", glow: "rgba(192,192,192,0.4)", icon: Medal,  description: "Consistência crescendo",         shortLabel: "PR", iconPath: "/leaderboard/prata.png"    },
  OURO:     { label: "Ouro",     color: "#ffd700", glow: "rgba(255,215,0,0.4)",   icon: Trophy, description: "Domínio do foco",               shortLabel: "OU", iconPath: "/leaderboard/ouro.png"     },
  DIAMANTE: { label: "Diamante", color: "#00bfff", glow: "rgba(0,191,255,0.4)",   icon: Crown,  description: "Elite do foco",                 shortLabel: "DI", iconPath: "/leaderboard/diamante.png" },
  LENDAS:   { label: "Lendas",   color: "#ff69b4", glow: "rgba(255,105,180,0.4)", icon: Star,   description: "Os melhores entre os melhores", shortLabel: "LE", iconPath: "/leaderboard/lendas.png"   },
};

const TIER_ORDER: NewLeagueTier[] = ["BRONZE", "PRATA", "OURO", "DIAMANTE", "LENDAS"];

const PROMOTION_TEXT: Record<NewLeagueTier, string> = {
  BRONZE:   "Fique no Top 10 para ser promovido para Prata.",
  PRATA:    "Fique no Top 10 para ser promovido para Ouro.",
  OURO:     "Fique no Top 7 para ser promovido para Diamante.",
  DIAMANTE: "Fique no Top 5 para ser promovido para Lendas.",
  LENDAS:   "Lendas é o tier mais alto. Os top 3 ganham moedas ao final da semana.",
};

const MEDAL_IMAGES = ["/places/first_place.png", "/places/second_place.png", "/places/third_place.png"] as const;

function MedalBadge({ rank, size = 28 }: { rank: number; size?: number }) {
  if (rank > 3) return <span className="font-mono text-[10px] text-[var(--text-faint)]">{rank}</span>;
  return (
    <div
      className="relative flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      title={rank === 1 ? "1º lugar" : rank === 2 ? "2º lugar" : "3º lugar"}
    >
      <Image src={MEDAL_IMAGES[rank - 1]} alt={`${rank}º lugar`} width={size} height={size} style={{ objectFit: "contain" }} unoptimized draggable={false} />
    </div>
  );
}

// ── Countdown hook ────────────────────────────────────────────────────────────

function useCountdown(weekEnd: string) {
  const calc = (end: string) => {
    const diff = new Date(end + "T23:59:59").getTime() - Date.now();
    if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    return {
      days: Math.floor(diff / 86400000),
      hours: Math.floor((diff % 86400000) / 3600000),
      minutes: Math.floor((diff % 3600000) / 60000),
      seconds: Math.floor((diff % 60000) / 1000),
    };
  };
  const [t, setT] = useState(calc(weekEnd));
  useEffect(() => {
    const id = setInterval(() => setT(calc(weekEnd)), 1000);
    return () => clearInterval(id);
  }, [weekEnd]);
  return t;
}

function fmtCountdown(t: { days: number; hours: number; minutes: number; seconds: number }) {
  if (t.days > 0) return `${t.days}d ${t.hours}h`;
  if (t.hours > 0) return `${t.hours}h ${t.minutes}m`;
  return `${t.minutes}m ${t.seconds}s`;
}

// ── Avatar cell ───────────────────────────────────────────────────────────────

function Avatar({ photoUrl, name, size = 32, equippedDecorationId }: { photoUrl?: string; name?: string; size?: number; equippedDecorationId?: string }) {
  return (
    <SharedAvatar
      photoUrl={photoUrl}
      name={name}
      size={size}
      equippedDecorationId={equippedDecorationId}
    />
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LigaPage() {
  const { user, loading } = useAuthRedirect({ ifGuest: "/" });
  const [snapshot, setSnapshot] = useState<LeagueNewSnapshot | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  const timeLeft = useCountdown(snapshot?.weekEnd ?? new Date().toISOString().slice(0, 10));

  const fetchData = useCallback(async () => {
    setLoadingData(true);
    setError(null);
    try {
      const data = await api.getLeagueNew();
      setSnapshot(data);
    } catch {
      setError("Erro ao carregar dados da liga.");
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (!loading && user) void fetchData();
  }, [loading, user, fetchData]);

  if (loading || !user) {
    return (
      <div className="min-h-screen theme-bg flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-[var(--accent)]" />
      </div>
    );
  }

  if (loadingData || !snapshot) {
    return (
      <AppShell>
        <main className="min-h-screen px-5 py-10 sm:px-8 lg:px-12">
          <div className="flex items-center justify-center py-32">
            <Loader2 size={28} className="animate-spin text-[var(--accent)]" />
          </div>
        </main>
      </AppShell>
    );
  }

  const tierCfg = TIER_CONFIG[snapshot.currentTier];
  const currentTierIdx = TIER_ORDER.indexOf(snapshot.currentTier);
  const nextTier = currentTierIdx < TIER_ORDER.length - 1 ? TIER_ORDER[currentTierIdx + 1] : null;
  const isLendas = snapshot.currentTier === "LENDAS";
  const isDiamante = snapshot.currentTier === "DIAMANTE";
  const userMember = snapshot.members.find((m) => m.profileId === user.uid);
  const displayRank = snapshot.userRank > 0 ? snapshot.userRank : null;
  const isInPromo = displayRank !== null && displayRank <= snapshot.promotionZoneEnd;
  const isInDemo = displayRank !== null && displayRank >= snapshot.demotionZoneStart && snapshot.currentTier !== "BRONZE";

  return (
    <AppShell>
      <main className="min-h-screen px-5 py-10 sm:px-8 lg:px-12">
        {/* Header */}
        <header className="mb-8 flex items-center gap-3">
          <Link href="/dashboard" className="flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
            <ChevronLeft size={18} /> Voltar
          </Link>
          <div className="ml-auto" />
          <Trophy size={18} className="text-[var(--accent)]" />
          <span className="font-display text-xl font-semibold tracking-[-0.04em]">Liga</span>
        </header>

        {/* Tier hero */}
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div
            className="relative overflow-hidden rounded-2xl border border-[var(--border-subtle)] p-6 shadow-xl"
            style={{ background: `linear-gradient(135deg, ${tierCfg.color}15, ${tierCfg.color}08)` }}
          >
            <span aria-hidden className="absolute inset-0 opacity-30"
              style={{ background: `radial-gradient(circle at center, ${tierCfg.glow} 0%, transparent 70%)` }} />

            <div className="relative z-10">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-center gap-5">
                  <motion.div
                    initial={{ scale: 0.5, rotate: -20 }} animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.15 }}
                    className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl sm:h-28 sm:w-28"
                    style={{ background: `${tierCfg.color}20`, boxShadow: `0 0 40px ${tierCfg.glow}`, border: `1px solid ${tierCfg.color}40` }}
                  >
                    <Image src={tierCfg.iconPath} alt={tierCfg.label} fill sizes="112px" className="object-contain p-1.5" unoptimized />
                  </motion.div>
                  <div>
                    <h2 className="font-display text-3xl font-bold tracking-tight" style={{ color: tierCfg.color }}>
                      {tierCfg.label}{isLendas && <span className="ml-2">✨</span>}
                    </h2>
                    <p className="mt-0.5 text-sm text-[var(--text-muted)]">{tierCfg.description}</p>
                    {isDiamante && (
                      <p className="mt-1.5 flex items-center gap-1 text-[10px] text-amber-400">
                        <Crown size={11} /> Top 5 avança para <strong>Lendas</strong>
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-start gap-2 sm:items-end">
                  {userMember && (
                    <div className="text-right">
                      <p className="text-[10px] text-[var(--text-faint)] mb-0.5">SEU XP</p>
                      <div className="flex items-center justify-end gap-1">
                        <Image src="/energies/flame/flame_start.png" alt="streak" width={14} height={14} style={{ objectFit: "contain" }} unoptimized />
                        <span className="font-mono text-xl font-bold" style={{ color: tierCfg.color }}>
                          {userMember.weeklyXP.toLocaleString("pt-BR")}
                        </span>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <Clock size={12} className="text-[var(--text-faint)]" />
                    <p className="text-[10px] text-[var(--text-faint)]">RESET EM</p>
                    <motion.span
                      animate={{ opacity: [0.7, 1, 0.7] }} transition={{ duration: 1.5, repeat: Infinity }}
                      className="font-mono text-sm font-bold" style={{ color: tierCfg.color }}
                    >
                      {fmtCountdown(timeLeft)}
                    </motion.span>
                  </div>
                </div>
              </div>

              {/* Tier progress bar */}
              <div className="mt-6 flex items-center justify-center gap-2">
                {TIER_ORDER.map((t, i) => {
                  const cfg = TIER_CONFIG[t];
                  const isCurrent = t === snapshot.currentTier;
                  const isPast = currentTierIdx > i;
                  return (
                    <div key={t} className="flex flex-col items-center gap-1">
                      <div
                        className="relative flex h-8 w-12 sm:w-16 items-center justify-center rounded-xl transition-all"
                        style={{
                          background: isCurrent ? `${cfg.color}25` : isPast ? `${cfg.color}10` : "rgba(255,255,255,.03)",
                          border: `1px solid ${isCurrent ? cfg.color + "60" : "rgba(255,255,255,.06)"}`,
                          boxShadow: isCurrent ? `0 0 20px ${cfg.glow}` : "none",
                        }}
                      >
                        <Image src={cfg.iconPath} alt={cfg.label} fill sizes="64px" className="object-contain p-1" style={{ filter: isCurrent || isPast ? "none" : "grayscale(1) opacity(.5)" }} unoptimized />
                        {isCurrent && (
                          <motion.div
                            className="absolute -inset-1 rounded-xl border-2"
                            style={{ borderColor: cfg.color }}
                            animate={{ scale: [1, 1.05, 1], opacity: [1, 0.6, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                          />
                        )}
                      </div>
                      <span className="text-[10px] font-medium" style={{ color: isCurrent ? cfg.color : isPast ? `${cfg.color}80` : "var(--text-faint)" }}>
                        {cfg.shortLabel}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </motion.section>

        {/* Live cohort */}
        {(snapshot.liveCohort?.members?.length ?? 0) > 0 && (
          <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-8">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles size={15} className="text-amber-400" />
              <span className="eyebrow" style={{ color: "#fbbf24" }}>FOCANDO AGORA</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {snapshot.liveCohort!.members.map((m, i) => (
                <motion.div
                  key={m.profileId}
                  initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-2 rounded-xl border border-amber-400/20 bg-[var(--bg-surface-hover)] px-3 py-2"
                >
                  <Avatar photoUrl={m.photoUrl} name={m.displayName} size={28} />
                  <span className="text-[10px] text-[var(--text)]">{m.displayName}</span>
                  <motion.div
                    animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                    className="h-2 w-2 rounded-full bg-green-400"
                  />
                </motion.div>
              ))}
            </div>
          </motion.section>
        )}

        {/* Leaderboard */}
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mb-8">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp size={16} />
            <span className="eyebrow">RANKING DA SEMANA</span>
          </div>

          <div className="panel p-0 overflow-hidden">
            <div className="grid grid-cols-[40px_1fr_80px_32px] gap-2 border-b border-[var(--border-subtle)] px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
              <span className="text-center">Pos</span>
              <span>Usuário</span>
              <span className="text-right">XP</span>
              <span />
            </div>

            <div className="divide-y divide-[var(--border-subtle)]">
              {snapshot.members.map((member, index) => {
                const isMe = member.profileId === user.uid;
                // rank from DB is 1-indexed (calculateGroupRanks uses i+1)
                // but guard against legacy 0 values
                const displayMemberRank = member.rank > 0 ? member.rank : index + 1;
                const inPromo = displayMemberRank <= snapshot.promotionZoneEnd;
                const inDemo = displayMemberRank >= snapshot.demotionZoneStart;
                const photoUrl = member.profile?.photoUrl;
                const name = member.profile?.displayName ?? member.displayName ?? "Anônimo";

                return (
                  <motion.button
                    key={member.id}
                    initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.02 }}
                    onClick={() => setSelectedProfileId(member.profileId)}
                    className={`grid w-full grid-cols-[40px_1fr_80px_32px] gap-2 px-4 py-3 items-center text-left transition-colors hover:bg-[var(--bg-surface-hover)] ${
                      isMe ? "bg-[var(--bg-surface-hover)]" : inPromo && !inDemo ? "bg-green-500/5" : inDemo ? "bg-red-500/5" : ""
                    }`}
                  >
                    {/* Rank */}
                    <div className="flex items-center justify-center">
                      <MedalBadge rank={displayMemberRank} />
                    </div>

                    {/* Avatar + name */}
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar photoUrl={photoUrl} name={name} size={32} equippedDecorationId={member.profile?.equippedDecorationId} />
                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-medium text-[var(--text)]">{name}</p>
                        {isMe && <p className="text-[8px] text-amber-400">você</p>}
                      </div>
                    </div>

                    {/* XP */}
                    <div className="flex items-center justify-end gap-1">
                      <Image src="/energies/flame/flame_start.png" alt="streak" width={11} height={11} style={{ objectFit: "contain" }} unoptimized />
                      <span className="font-mono text-[10px] text-[var(--text)]">{member.weeklyXP.toLocaleString("pt-BR")}</span>
                    </div>

                    {/* Zone indicator */}
                    <div className="flex items-center justify-center">
                      {inPromo && !inDemo && (
                        <motion.div animate={{ y: [-2, 0, -2] }} transition={{ duration: 1.5, repeat: Infinity }}>
                          <ArrowUp size={13} className="text-green-400" />
                        </motion.div>
                      )}
                      {inDemo && (
                        <motion.div animate={{ y: [2, 0, 2] }} transition={{ duration: 1.5, repeat: Infinity }}>
                          <ArrowDown size={13} className="text-red-400" />
                        </motion.div>
                      )}
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Zone legend */}
          <div className="mt-3 space-y-1.5 px-1">
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-green-400/30" />
              <span className="text-[10px] text-green-400 whitespace-nowrap">Promoção (Top {snapshot.promotionZoneEnd})</span>
            </div>
            {snapshot.currentTier !== "BRONZE" && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-red-400 whitespace-nowrap">Rebaixamento (#{snapshot.demotionZoneStart}+)</span>
                <div className="h-px flex-1 bg-red-400/30" />
              </div>
            )}
          </div>
        </motion.section>

        {/* Info cards */}
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="grid gap-5 md:grid-cols-2">
          <div className="panel p-5">
            <div className="mb-3 flex items-center gap-2">
              <Users size={15} />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">SOBRE SEU TIER</span>
            </div>
            <p className="text-[11px] leading-relaxed text-[var(--text-muted)]">
              {PROMOTION_TEXT[snapshot.currentTier]}
            </p>
            <div className="mt-3 flex flex-col gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-faint)]">Recompensas do pódio</p>
              <div className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1.5 font-medium text-[var(--text)]">
                  <Image src="/places/first_place.png" alt="1º" width={16} height={16} unoptimized draggable={false} /> 1º lugar
                </span>
                <span className="font-mono font-bold text-[var(--accent)]">150 moedas</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1.5 font-medium text-[var(--text)]">
                  <Image src="/places/second_place.png" alt="2º" width={16} height={16} unoptimized draggable={false} /> 2º lugar
                </span>
                <span className="font-mono font-bold text-[var(--accent)]">100 moedas</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1.5 font-medium text-[var(--text)]">
                  <Image src="/places/third_place.png" alt="3º" width={16} height={16} unoptimized draggable={false} /> 3º lugar
                </span>
                <span className="font-mono font-bold text-[var(--accent)]">75 moedas</span>
              </div>
            </div>
            {nextTier && (() => {
              const next = TIER_CONFIG[nextTier];
              return (
                <div className="mt-4 border-t border-[var(--border-subtle)] pt-4">
                  <p className="mb-2 text-[10px] text-[var(--text-faint)]">Próximo tier</p>
                  <div className="flex items-center gap-2">
                    <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg"
                      style={{ background: `${next.color}20`, border: `1px solid ${next.color}30` }}>
                      <Image src={next.iconPath} alt={next.label} fill sizes="36px" className="object-contain p-0.5" unoptimized />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium" style={{ color: next.color }}>
                        {next.label}
                      </span>
                      <span className="text-[10px] text-[var(--text-faint)]">{next.description}</span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="panel p-5">
            <div className="mb-3 flex items-center gap-2">
              <TrendingUp size={15} />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">SUA POSIÇÃO</span>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[var(--text-faint)]">Ranking atual</span>
                <span className="font-mono text-xl font-bold" style={{ color: tierCfg.color }}>
                  {displayRank !== null ? `#${displayRank}` : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[var(--text-faint)]">Membros no grupo</span>
                <span className="font-mono text-sm">{snapshot.members.length}</span>
              </div>
              {isInPromo && (
                <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-3">
                  <p className="flex items-center gap-1 text-[10px] font-medium text-green-400">
                    <ArrowUp size={11} /> Você está na zona de promoção!
                  </p>
                </div>
              )}
              {isInDemo && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3">
                  <p className="flex items-center gap-1 text-[10px] font-medium text-red-400">
                    <ArrowDown size={11} /> Cuidado: zona de rebaixamento
                  </p>
                </div>
              )}
            </div>
          </div>
        </motion.section>

        {error && (
          <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}
      </main>

      {/* Profile modal */}
      <AnimatePresence>
        {selectedProfileId && (
          <ProfileModal
            profileId={selectedProfileId}
            onClose={() => setSelectedProfileId(null)}
          />
        )}
      </AnimatePresence>
    </AppShell>
  );
}
