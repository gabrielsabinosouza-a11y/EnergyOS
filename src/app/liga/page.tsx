"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useAuthRedirect } from "@/lib/auth-context";
import {
  Trophy, ChevronLeft, Clock, ArrowUp, ArrowDown, Sparkles, Users, Flame,
  Loader2, TrendingUp, Crown, Star, Medal,
} from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { api } from "@/lib/api-client";
import type { NewLeagueTier, LeagueGroup, LeagueGroupMember } from "@/types";

const TIER_CONFIG: Record<NewLeagueTier, { 
  label: string; color: string; glow: string; icon: React.ElementType; 
  description: string; shortLabel: string;
}> = {
  BRONZE: { label: "Bronze", color: "#cd7f32", glow: "rgba(205,127,50,0.4)", icon: Medal, description: "O inicio da jornada", shortLabel: "BR" },
  PRATA: { label: "Prata", color: "#c0c0c0", glow: "rgba(192,192,192,0.4)", icon: Medal, description: "Consistencia crescendo", shortLabel: "PR" },
  OURO: { label: "Ouro", color: "#ffd700", glow: "rgba(255,215,0,0.4)", icon: Trophy, description: "Dominio do foco", shortLabel: "OU" },
  DIAMANTE: { label: "Diamante", color: "#00bfff", glow: "rgba(0,191,255,0.4)", icon: Crown, description: "Elite do foco", shortLabel: "DI" },
  LENDAS: { label: "Lendas", color: "#ff69b4", glow: "rgba(255,105,180,0.4)", icon: Star, description: "Os melhores entre os melhores", shortLabel: "LE" },
};

const TIER_ORDER: NewLeagueTier[] = ["BRONZE", "PRATA", "OURO", "DIAMANTE", "LENDAS"];
const PROMOTION_COUNT = 3;
const DEMOTION_COUNT = 5;

function useWeekCountdown(weekEnd: string): { days: number; hours: number; minutes: number; seconds: number } {
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number }>(calculateTimeLeft(weekEnd));
  useEffect(() => {
    const timer = setInterval(() => setTimeLeft(calculateTimeLeft(weekEnd)), 1000);
    return () => clearInterval(timer);
  }, [weekEnd]);
  return timeLeft;
}

function calculateTimeLeft(weekEnd: string) {
  const endDate = new Date(weekEnd + "T23:59:59");
  const now = new Date();
  const diff = endDate.getTime() - now.getTime();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((diff % (1000 * 60)) / 1000),
  };
}

function formatCountdown(t: { days: number; hours: number; minutes: number; seconds: number }): string {
  if (t.days === 0 && t.hours === 0) return `${t.minutes}m`;
  if (t.days === 0) return `${t.hours}h ${t.minutes}m`;
  return `${t.days}d ${t.hours}h`;
}

export default function LigaPage() {
  const { user, loading } = useAuthRedirect({ ifGuest: "/" });
  const [snapshot, setSnapshot] = useState<{
    currentTier: NewLeagueTier;
    currentGroup: LeagueGroup;
    members: LeagueGroupMember[];
    userRank: number;
    weekStart: string;
    weekEnd: string;
    isLegendsGroup: boolean;
    promotionZoneEnd: number;
    demotionZoneStart: number;
    liveCohort?: { members: any[] };
  } | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const timeLeft = snapshot ? useWeekCountdown(snapshot.weekEnd) : { days: 0, hours: 0, minutes: 0, seconds: 0 };

  useEffect(() => {
    if (!loading && user) fetchLeagueData();
  }, [loading, user]);

  const fetchLeagueData = useCallback(async () => {
    setLoadingData(true);
    setError(null);
    try {
      const data = await api.get("/api/league-new");
      setSnapshot(data);
    } catch (err) {
      setError("Erro ao carregar dados da liga");
    } finally {
      setLoadingData(false);
    }
  }, []);

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
        <main className="min-h-screen px-5 py-10 sm:px-8 lg:px-12 lg:py-10">
          <header className="mb-8 flex items-center gap-3">
            <Link href="/dashboard" className="flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
              <ChevronLeft size={18} /> Voltar
            </Link>
            <div className="ml-auto" />
            <Trophy size={18} className="text-[var(--accent)]" />
            <span className="font-display text-xl font-semibold tracking-[-0.04em]">Liga</span>
          </header>
          <div className="flex items-center justify-center py-32">
            <Loader2 size={28} className="animate-spin text-[var(--accent)]" />
          </div>
        </main>
      </AppShell>
    );
  }

  const tierConfig = TIER_CONFIG[snapshot.currentTier];
  const userMember = snapshot.members.find((m) => m.profileId === user?.uid);
  const isInPromotionZone = snapshot.userRank > 0 && snapshot.userRank <= snapshot.promotionZoneEnd;
  const isInDemotionZone = snapshot.userRank > 0 && snapshot.userRank >= snapshot.demotionZoneStart && snapshot.currentTier !== "BRONZE";
  const isLegends = snapshot.currentTier === "LENDAS";
  const isDiamante = snapshot.currentTier === "DIAMANTE";
  const currentTierIndex = TIER_ORDER.indexOf(snapshot.currentTier);
  const nextTier = currentTierIndex < TIER_ORDER.length - 1 ? TIER_ORDER[currentTierIndex + 1] : null;

  return (
    <AppShell>
      <main className="min-h-screen px-5 py-10 sm:px-8 lg:px-12 lg:py-10">
        <header className="mb-8 flex items-center gap-3">
          <Link href="/dashboard" className="flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
            <ChevronLeft size={18} /> Voltar
          </Link>
          <div className="ml-auto" />
          <Trophy size={18} className="text-[var(--accent)]" />
          <span className="font-display text-xl font-semibold tracking-[-0.04em]">Liga</span>
        </header>

        {/* Current Tier Hero */}
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="relative overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-gradient-to-br p-6 shadow-xl"
               style={{ background: `linear-gradient(135deg, ${tierConfig.color}15, ${tierConfig.color}08)` }}>
            <span aria-hidden className="absolute inset-0 opacity-30"
                  style={{ background: `radial-gradient(circle at center, ${tierConfig.glow} 0%, transparent 70%)` }} />
            
            <div className="relative z-10">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-center gap-5">
                  <motion.div initial={{ scale: 0.5, rotate: -20 }} animate={{ scale: 1, rotate: 0 }}
                              transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.15 }}
                              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-4xl"
                              style={{ background: `${tierConfig.color}20`, boxShadow: `0 0 40px ${tierConfig.glow}`, border: `1px solid ${tierConfig.color}40` }}>
                    <tierConfig.icon style={{ color: tierConfig.color }} />
                  </motion.div>
                  <div>
                    <h2 className="font-display text-3xl font-bold tracking-tight" style={{ color: tierConfig.color }}>
                      {tierConfig.label}{isLegends && <span className="ml-2 text-2xl">✨</span>}
                    </h2>
                    <p className="mt-0.5 text-sm text-[var(--text-muted)]">{tierConfig.description}</p>
                    {isDiamante && (
                      <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                                  className="mt-2 flex items-center gap-1.5 text-[10px] text-amber-400">
                        <Crown size={12} />
                        <span>Top 5 avança para <strong>Lendas</strong></span>
                      </motion.div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-start gap-2 sm:items-end">
                  {userMember && (
                    <div className="text-right">
                      <p className="text-[10px] text-[var(--text-faint)] mb-0.5">SEU XP</p>
                      <div className="flex items-center justify-end gap-1">
                        <Flame size={14} className="text-[var(--orange)]" />
                        <span className="font-mono text-xl font-bold" style={{ color: tierConfig.color }}>
                          {userMember.weeklyXP.toLocaleString("pt-BR")}
                        </span>
                      </div>
                    </div>
                  )}
                  {formatCountdown(timeLeft) && (
                    <div className="flex items-center gap-1.5 text-right">
                      <p className="text-[10px] text-[var(--text-faint)]">RESET EM</p>
                      <motion.div animate={{ opacity: [0.7, 1, 0.7] }} transition={{ duration: 1.5, repeat: Infinity }}
                                  className="font-mono text-lg font-bold" style={{ color: tierConfig.color }}>
                        {formatCountdown(timeLeft)}
                      </motion.div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 flex items-center justify-center gap-1">
                {TIER_ORDER.map((t, i) => {
                  const config = TIER_CONFIG[t];
                  const isCurrent = t === snapshot.currentTier;
                  const isPast = currentTierIndex > i;
                  return (
                    <div key={t} className="flex flex-col items-center gap-1.5">
                      <div className="relative flex h-8 w-12 sm:w-16 items-center justify-center rounded-xl text-lg font-bold transition-all"
                           style={{ background: isCurrent ? `${config.color}25` : isPast ? `${config.color}10` : "rgba(255,255,255,.03)",
                                   border: `1px solid ${isCurrent ? config.color + "60" : "rgba(255,255,255,.06)"}`,
                                   boxShadow: isCurrent ? `0 0 20px ${config.glow}` : "none",
                                   color: isCurrent ? config.color : isPast ? `${config.color}90` : "var(--text-faint)" }}>
                        <config.icon size={isCurrent ? 20 : 16} />
                        {isCurrent && (
                          <motion.div className="absolute -inset-1 rounded-xl border-2" style={{ borderColor: config.color }}
                                      animate={{ scale: [1, 1.05, 1], opacity: [1, 0.7, 1] }} transition={{ duration: 2, repeat: Infinity }} />
                        )}
                      </div>
                      <span className="text-[10px] font-medium" style={{ color: isCurrent ? config.color : isPast ? `${config.color}80` : "var(--text-faint)" }}>
                        {config.shortLabel}
                      </span>
                      {i < TIER_ORDER.length - 1 && <ArrowUp size={12} className="text-[var(--text-faint)] mx-1 hidden sm:block" />}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </motion.section>

        {/* Live Cohort */}
        {snapshot.liveCohort?.members?.length ? (
          <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-8">
            <div className="mb-4 flex items-center gap-2">
              <Sparkles size={16} className="text-amber-400" />
              <span className="eyebrow amber">FOCANDO AGORA</span>
            </div>
            <div className="flex flex-wrap gap-3">
              {snapshot.liveCohort.members.map((member, index) => (
                <motion.div key={member.profileId} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: index * 0.05 }}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--bg-surface-hover)] border border-amber-400/20">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-400 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-white">{member.displayName?.charAt(0) || "?"}</span>
                  </div>
                  <span className="text-[10px] text-[var(--text)]">{member.displayName}</span>
                  <motion.div animate={{ opacity: [1, 0.5, 1] }} transition={{ duration: 1, repeat: Infinity, delay: index * 0.2 }}
                              className="w-2 h-2 rounded-full bg-green-400" />
                </motion.div>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-[var(--text-faint)]">Usuários focando no mesmo período que você (janela de 1 hora)</p>
          </motion.section>
        ) : null}

        {/* Leaderboard */}
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mb-8">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp size={16} />
            <span className="eyebrow">RANKING DA SEMANA</span>
          </div>
          
          <div className="panel p-0">
            <div className="grid grid-cols-[40px_1fr_80px_60px] gap-3 px-4 py-3 border-b border-[var(--border-subtle)] text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
              <span className="text-center">Pos</span>
              <span>Usuário</span>
              <span className="text-right">XP</span>
              <span className="text-center"></span>
            </div>

            <div className="divide-y divide-[var(--border-subtle)]">
              {snapshot.members.map((member, index) => {
                const isCurrentUser = member.profileId === user?.uid;
                const isInTop3 = member.rank <= 3;
                const isInPromoZone = member.rank <= snapshot.promotionZoneEnd;
                const isInDemoZone = member.rank >= snapshot.demotionZoneStart;

                return (
                  <motion.div key={member.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.02 }}
                              className={`grid grid-cols-[40px_1fr_80px_60px] gap-3 px-4 py-3 items-center ${
                                isCurrentUser ? "bg-[var(--bg-surface-hover)]" :
                                isInPromoZone && !isInDemoZone ? "bg-green-500/5" :
                                isInDemoZone ? "bg-red-500/5" : ""
                              }`}>
                    <div className="flex items-center justify-center">
                      {isInTop3 ? (
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                             style={{ background: member.rank === 1 ? "#ffd700" : member.rank === 2 ? "#c0c0c0" : "#cd7f32" }}>
                          {member.rank}
                        </div>
                      ) : (
                        <span className="text-[10px] font-mono text-[var(--text-faint)]">{member.rank}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center"
                           style={{ background: isCurrentUser ? `linear-gradient(135deg, ${tierConfig.color}20, ${tierConfig.color}40)` : "var(--bg-tertiary)" }}>
                        {member.profile?.photoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={member.profile.photoUrl} alt={member.profile.displayName} className="w-full h-full rounded-full object-cover" />
                        ) : (
                          <span className="text-[10px] font-bold text-white">{member.profile?.displayName?.charAt(0) || member.displayName?.charAt(0) || "?"}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium text-[var(--text)] truncate">
                          {member.profile?.displayName || member.displayName || "Anônimo"}
                        </p>
                        {isCurrentUser && <p className="text-[8px] text-amber-400">você</p>}
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-1">
                      <Flame size={12} className="text-[var(--orange)]" />
                      <span className="text-[10px] font-mono text-[var(--text)]">{member.weeklyXP.toLocaleString("pt-BR")}</span>
                    </div>
                    <div className="flex items-center justify-center">
                      {isInPromoZone && !isInDemoZone && (
                        <motion.div animate={{ y: [-2, 0, -2] }} transition={{ duration: 1.5, repeat: Infinity }}>
                          <ArrowUp size={14} className="text-green-400" />
                        </motion.div>
                      )}
                      {isInDemoZone && (
                        <motion.div animate={{ y: [2, 0, 2] }} transition={{ duration: 1.5, repeat: Infinity }}>
                          <ArrowDown size={14} className="text-red-400" />
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 px-2">
            <div className="flex items-center gap-2">
              <div className="h-0.5 flex-1 bg-green-400/30" />
              <span className="text-[10px] text-green-400 font-medium whitespace-nowrap">Zona de Promoção (Top {snapshot.promotionZoneEnd})</span>
            </div>
            {snapshot.currentTier !== "BRONZE" && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[10px] text-red-400 font-medium whitespace-nowrap">Zona de Rebaixamento (Top {snapshot.demotionZoneStart}+)</span>
                <div className="h-0.5 flex-1 bg-red-400/30" />
              </div>
            )}
          </div>
        </motion.section>

        {/* Tier Info */}
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="grid gap-5 md:grid-cols-2">
          <div className="panel p-5">
            <div className="mb-3 flex items-center gap-2">
              <Users size={16} />
              <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">SOBRE SEU TIER</span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
              {isLegends ? "Lendas é o tier mais alto. Parabéns por chegar tão longe! Os top 3 ainda ganham moedas, mas não há promoção acima deste nível."
               : isDiamante ? "Fique no Top 5 do seu grupo para avançar para a Liga Lendas na próxima semana!"
               : nextTier ? `Fique no Top ${snapshot.promotionZoneEnd} para ser promovido para ${TIER_CONFIG[nextTier].label}.`
               : "Mantenha o bom trabalho!"}
            </p>
            {nextTier && (
              <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
                <p className="text-[10px] text-[var(--text-faint)] mb-2">Próximo tier</p>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center"
                       style={{ background: `linear-gradient(135deg, ${TIER_CONFIG[nextTier].color}20, ${TIER_CONFIG[nextTier].color}40)` }}>
                    <TIER_CONFIG[nextTier].icon size={14} style={{ color: TIER_CONFIG[nextTier].color }} />
                  </div>
                  <span className="text-sm font-medium text-[var(--text)]">{TIER_CONFIG[nextTier].label}</span>
                </div>
              </div>
            )}
            {isDiamante && (
              <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
                <p className="text-[10px] text-amber-400 mb-2 flex items-center gap-1">
                  <Crown size={12} /> Qualificação para Lendas
                </p>
                <p className="text-[11px] text-[var(--text-muted)]">Termine a semana no Top 5 para entrar na Liga Lendas!</p>
              </div>
            )}
          </div>

          <div className="panel p-5">
            <div className="mb-3 flex items-center gap-2">
              <TrendingUp size={16} />
              <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">SUA POSIÇÃO</span>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[var(--text-faint)]">Ranking atual</span>
                <span className="font-mono text-xl font-bold" style={{ color: tierConfig.color }}>
                  #{snapshot.userRank}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[var(--text-faint)]">Total de membros</span>
                <span className="font-mono text-sm">{snapshot.members.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[var(--text-faint)]">Tier</span>
                <span className="text-sm font-medium" style={{ color: tierConfig.color }}>{tierConfig.label}</span>
              </div>
              {isInPromotionZone && (
                <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                            className="p-3 rounded-xl bg-green-500/10 border border-green-500/20">
                  <p className="text-[10px] text-green-400 font-medium flex items-center gap-1">
                    <ArrowUp size={12} /> Você está na zona de promoção!
                  </p>
                </motion.div>
              )}
              {isInDemotionZone && (
                <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                            className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                  <p className="text-[10px] text-red-400 font-medium flex items-center gap-1">
                    <ArrowDown size={12} /> Cuidado: zona de rebaixamento
                  </p>
                </motion.div>
              )}
            </div>
          </div>
        </motion.section>

        {error && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      className="mt-4 rounded-lg border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-400">
            {error}
          </motion.div>
        )}
      </main>
    </AppShell>
  );
}
