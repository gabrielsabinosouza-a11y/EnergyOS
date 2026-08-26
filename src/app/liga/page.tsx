"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Loader2, Trophy, Flame, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Header } from "@/components/navigation";
import { useAuthRedirect } from "@/lib/auth-context";
import { api } from "@/lib/api-client";
import type { LeagueSnapshot, LeagueTier, LeagueResult } from "@/types";

const TIER_META: Record<LeagueTier, { label: string; color: string; glow: string; icon: string; description: string }> = {
  faisca: { label: "Faísca", color: "#c47a4a", glow: "rgba(196,122,74,.45)", icon: "⚡", description: "onde tudo começa" },
  chama: { label: "Chama", color: "#ffb86b", glow: "rgba(255,184,107,.45)", icon: "🔥", description: "o fogo está acesso" },
  aura: { label: "Aura", color: "#ffd76b", glow: "rgba(255,215,107,.5)", icon: "✨", description: "uma energia especial" },
  nucleo: { label: "Núcleo", color: "#71d4ff", glow: "rgba(113,212,255,.55)", icon: "💎", description: "o ápice da consistência" },
};

const TIER_ORDER: LeagueTier[] = ["faisca", "chama", "aura", "nucleo"];

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.05 } } };
const rowFade = { hidden: { opacity: 0, x: -8 }, visible: { opacity: 1, x: 0, transition: { duration: 0.3, ease: "easeOut" as const } } };

function UserAvatar({ photoUrl, displayName, size = 36 }: { photoUrl?: string; displayName: string; size?: number }) {
  const initial = (displayName?.[0] ?? "?").toUpperCase();
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={displayName}
        width={size}
        height={size}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="flex items-center justify-center rounded-full font-display font-bold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: "linear-gradient(135deg, var(--accent) 0%, var(--purple) 100%)",
      }}
    >
      {initial}
    </div>
  );
}

function formatCountdown(targetIso: string): string {
  const now = Date.now();
  const target = new Date(targetIso).getTime();
  const diff = Math.max(0, target - now);
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}min`;
  return `${minutes}min`;
}

function ResultBanner({ result }: { result?: LeagueResult }) {
  if (result === "promoted") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium"
        style={{ background: "rgba(74,222,128,.12)", color: "var(--green)", border: "1px solid rgba(74,222,128,.2)" }}
      >
        <ArrowUp size={14} />
        Subiu de nível!
      </motion.div>
    );
  }
  if (result === "demoted") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium"
        style={{ background: "rgba(248,113,113,.12)", color: "var(--red)", border: "1px solid rgba(248,113,113,.2)" }}
      >
        <ArrowDown size={14} />
        Desceu de nível
      </motion.div>
    );
  }
  if (result === "stayed") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium"
        style={{ background: "rgba(255,255,255,.05)", color: "var(--text-muted)", border: "1px solid rgba(255,255,255,.08)" }}
      >
        <Minus size={14} />
        Manteve a posição
      </motion.div>
    );
  }
  return null;
}

export default function LigaPage() {
  const { user, loading } = useAuthRedirect({ ifGuest: "/" });
  const reduced = useReducedMotion();
  const [snapshot, setSnapshot] = useState<LeagueSnapshot | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [countdown, setCountdown] = useState("");

  const tierMeta = snapshot ? TIER_META[snapshot.tier] : null;

  const userEntry = snapshot?.entries.find((e) => e.isCurrentUser);

  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;

    api
      .getLeague()
      .then((data) => {
        if (!cancelled) setSnapshot(data.snapshot);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingData(false);
      });

    return () => {
      cancelled = true;
    };
  }, [loading, user?.uid]);

  useEffect(() => {
    if (!snapshot?.resetsAt) return;

    function tick() {
      setCountdown(formatCountdown(snapshot!.resetsAt));
    }
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [snapshot?.resetsAt]);

  if (loading || !user) {
    return (
      <div className="min-h-screen theme-bg flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-[var(--accent)]" />
      </div>
    );
  }

  return (
    <AppShell>
      <main className="min-h-screen px-5 py-7 sm:px-8 lg:px-12 lg:py-10">
        <Header eyebrow="Competição" title="Liga" />

        {loadingData || !snapshot || !tierMeta ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 size={28} className="animate-spin text-[var(--accent)]" />
          </div>
        ) : snapshot.entries.length === 0 ? (
          <div className="glass-card flex flex-col items-center justify-center p-16 text-center">
            <Trophy size={48} className="mb-4 text-[var(--text-faint)]" />
            <p className="font-display text-lg text-[var(--text-secondary)]">Nenhum participante na liga ainda</p>
            <p className="mt-2 text-sm text-[var(--text-muted)]">Comece a focar para entrar na competição!</p>
          </div>
        ) : (
          <>
            {/* Tier Hero Card */}
            <motion.div
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="glass-card relative mb-6 overflow-hidden p-6 sm:p-8"
            >
              {/* Ambient glow */}
              <span
                aria-hidden
                className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full blur-3xl"
                style={{ background: tierMeta.glow, opacity: 0.35 }}
              />

              <div className="relative z-10">
                <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-center gap-5">
                    <motion.div
                      initial={reduced ? {} : { scale: 0.5, rotate: -20 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.15 }}
                      className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-4xl"
                      style={{
                        background: `${tierMeta.color}15`,
                        boxShadow: `0 0 40px ${tierMeta.glow}`,
                        border: `1px solid ${tierMeta.color}40`,
                      }}
                    >
                      {tierMeta.icon}
                    </motion.div>
                    <div>
                      <h2
                        className="font-display text-2xl font-bold tracking-tight"
                        style={{ color: tierMeta.color }}
                      >
                        {tierMeta.label}
                      </h2>
                      <p className="mt-0.5 text-sm text-[var(--text-muted)]">{tierMeta.description}</p>
                      <ResultBanner result={snapshot.lastWeekResult} />
                    </div>
                  </div>

                  <div className="flex flex-col items-start gap-2 sm:items-end">
                    {userEntry && (
                      <div className="text-sm text-[var(--text-muted)]">
                        Seu XP:{" "}
                        <span className="font-mono font-bold" style={{ color: tierMeta.color }}>
                          {userEntry.xp.toLocaleString("pt-BR")}
                        </span>
                      </div>
                    )}
                    {countdown && (
                      <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--green)]" />
                        Reinicia em {countdown}
                      </div>
                    )}
                  </div>
                </div>

                {/* Tier Progression Bar */}
                <div className="mt-6 flex items-center gap-1">
                  {TIER_ORDER.map((t, i) => {
                    const m = TIER_META[t];
                    const isCurrent = t === snapshot.tier;
                    const isPast = TIER_ORDER.indexOf(snapshot.tier) > i;
                    return (
                      <div key={t} className="flex flex-1 flex-col items-center gap-1.5">
                        <div
                          className="relative flex h-8 w-full items-center justify-center rounded-lg text-sm font-bold transition-all"
                          style={{
                            background: isCurrent ? `${m.color}25` : isPast ? `${m.color}10` : "rgba(255,255,255,.03)",
                            border: `1px solid ${isCurrent ? m.color + "60" : "rgba(255,255,255,.06)"}`,
                            boxShadow: isCurrent ? `0 0 20px ${m.glow}` : "none",
                            color: isCurrent ? m.color : isPast ? `${m.color}90` : "var(--text-faint)",
                          }}
                        >
                          <span>{m.icon}</span>
                        </div>
                        <span
                          className="text-[10px] font-medium"
                          style={{ color: isCurrent ? m.color : isPast ? `${m.color}80` : "var(--text-faint)" }}
                        >
                          {m.label}
                        </span>
                        {i < TIER_ORDER.length - 1 && (
                          <div className="absolute" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>

            {/* Leaderboard Table */}
            <motion.div
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="glass-card mb-6 overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-6 py-4">
                <h3 className="font-display text-lg text-[var(--text-secondary)]">
                  Classificação
                </h3>
                <span className="text-xs text-[var(--text-muted)]">
                  {snapshot.entries.length} participante{snapshot.entries.length !== 1 ? "s" : ""}
                </span>
              </div>

              <div className="overflow-x-auto">
                <motion.table
                  variants={stagger}
                  initial="hidden"
                  animate="visible"
                  className="w-full text-left text-sm"
                >
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] text-[11px] uppercase tracking-wider text-[var(--text-faint)]">
                      <th className="w-12 px-4 py-3 text-center font-medium">#</th>
                      <th className="px-4 py-3 font-medium">Participante</th>
                      <th className="w-20 px-4 py-3 text-right font-medium">XP</th>
                      <th className="w-20 px-4 py-3 text-center font-medium">Sequência</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.entries.map((entry) => {
                      const isPromo = snapshot.promotionUntilRank !== null && entry.rank <= snapshot.promotionUntilRank;
                      const isDemo = snapshot.demotionFromRank !== null && entry.rank >= snapshot.demotionFromRank;
                      const isCurrentUser = entry.isCurrentUser;
                      const borderColor = isPromo ? "var(--green)" : isDemo ? "var(--red)" : "transparent";
                      const bgStyle = isCurrentUser
                        ? `${tierMeta.color}12`
                        : undefined;

                      return (
                        <motion.tr
                          key={entry.profileId}
                          variants={rowFade}
                          className="border-b border-[var(--border-subtle)] transition-colors last:border-b-0"
                          style={{
                            background: bgStyle,
                            borderLeft: `3px solid ${borderColor}`,
                          }}
                        >
                          <td className="px-4 py-3 text-center">
                            <span
                              className="font-mono text-xs font-bold"
                              style={{
                                color: isPromo ? "var(--green)" : isDemo ? "var(--red)" : "var(--text-muted)",
                              }}
                            >
                              {entry.rank}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <UserAvatar photoUrl={entry.photoUrl} displayName={entry.displayName} size={36} />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span
                                    className="truncate font-medium"
                                    style={{ color: isCurrentUser ? tierMeta.color : "var(--text)" }}
                                  >
                                    {entry.displayName}
                                  </span>
                                  {entry.isFriend && (
                                    <span
                                      className="shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-medium"
                                      style={{ background: "var(--accent-bg)", color: "var(--accent)" }}
                                    >
                                      amigo
                                    </span>
                                  )}
                                </div>
                                {entry.username && (
                                  <span className="text-xs text-[var(--text-faint)]">@{entry.username}</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-sm font-semibold" style={{ color: tierMeta.color }}>
                            {entry.xp.toLocaleString("pt-BR")}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)]">
                              <Flame size={12} className="text-[var(--orange)]" />
                              {entry.currentStreak}
                            </span>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </motion.table>
              </div>
            </motion.div>

            {/* How it works */}
            <motion.div
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="glass-card p-6 sm:p-8"
            >
              <div className="mb-4 flex items-center gap-2">
                <Trophy size={16} className="text-[var(--orange)]" />
                <h3 className="font-display text-base text-[var(--text-secondary)]">Como funciona a Liga</h3>
              </div>

              <div className="space-y-3 text-sm leading-relaxed text-[var(--text-muted)]">
                <p>
                  Seu XP é calculado com base nos minutos de foco da semana, com bônus de streak.
                </p>
                <p>
                  No fim de semana, os top N sobem de tier e os últimos N descem.
                </p>
              </div>

              <div className="mt-5 flex items-center gap-2 text-xs">
                {TIER_ORDER.map((t, i) => (
                  <span key={t} className="flex items-center gap-1.5">
                    <span
                      className="flex h-6 w-6 items-center justify-center rounded-md text-sm"
                      style={{ background: `${TIER_META[t].color}15`, border: `1px solid ${TIER_META[t].color}30` }}
                    >
                      {TIER_META[t].icon}
                    </span>
                    <span style={{ color: TIER_META[t].color }}>{TIER_META[t].label}</span>
                    {i < TIER_ORDER.length - 1 && (
                      <span className="mx-1 text-[var(--text-faint)]">→</span>
                    )}
                  </span>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </main>
    </AppShell>
  );
}
