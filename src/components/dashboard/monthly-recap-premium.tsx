"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  X,
  Download,
  Share2,
  ChevronLeft,
  ChevronRight,
  Timer,
  Award,
  Zap,
  Flame,
  Trophy,
  Volume2,
  VolumeX,
  Loader2,
} from "lucide-react";
import Image from "next/image";
import { Modal } from "@/components/modal";
import { RewardToast } from "@/components/reward-toast";
import { AnimatedNumber } from "@/components/ui";
import { ParticleField, Recap3DIcon, TiltCard } from "@/components/recap/recap-fx";
import { useRecapSound } from "@/lib/recap-sound";
import { NEW_TIER_META, resolveNewTier } from "@/lib/league-new-meta";
import type { NewLeagueTier } from "@/types";
import { useAuthRedirect } from "@/lib/auth-context";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RecapData {
  id: number;
  recapMonth: string;
  totalFocusMinutes: number;
  longestStreak: number;
  leagueTier?: string;
  leaguePromoted?: boolean;
  productivityTag?: string;
  gardenCount?: number;
  totalXp: number;
  coinsGained?: number;
  coinsSpent?: number;
  missionsCompleted?: number;
  goalsCompleted?: number;
  achievementsUnlocked?: number;
  topFocusCategory?: string;
  hasBeenShared?: boolean;
  status?: "live" | "final";
}

interface MonthlyRecapPremiumProps {
  recap: RecapData;
  userName: string;
  userPhotoUrl?: string;
  onShare?: (blob: Blob) => void;
  onCoinsAwarded?: (amount: number, newBalance: number) => void;
  /** Recap do mês corrente (ainda em andamento) — dados atualizados ao vivo. */
  isLive?: boolean;
  /** Status do recap: 'live' enquanto o mês está em andamento, 'final' após o fechamento. */
  status?: "live" | "final";
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SLIDE_COUNT = 7;
const SHARE_REWARD_COINS = 50;

/**
 * Artes 3D dos slides. Cada slide aceita VÁRIOS caminhos: o primeiro que
 * carregar é usado e, se nenhum existir, o ícone line original entra como
 * fallback (sem quebrar nada).
 *
 * - /recaps/*.png           → artes 3D já disponíveis no repositório
 * - /recap/icons/recap-*.png → nomes previstos para os novos assets
 */
const RECAP_ART = {
  foco: ["/recaps/clock.png", "/recap/icons/recap-foco.png"],
  sequencia: ["/recaps/streak.png", "/recap/icons/recap-sequencia.png"],
  jardim: ["/recaps/energy.png", "/recap/icons/recap-jardim.png"],
  xp: ["/recaps/xp.png", "/recap/icons/recap-xp.png", "/xp/xp_double_thunder.png"],
} as const;

/** Cores de destaque por slide (as únicas cores novas do redesign). */
const ACCENT = {
  focus: "#5CC8FF",
  streak: "#FFB067",
  garden: "#3DDC84",
  xp: "#B69CFF",
} as const;

/**
 * Largura do modal 9:16.
 * 56.25dvh - 3.9375rem = (100dvh - 7rem) * 9/16 → altura útil do card.
 * `min()` com 100vw-2rem mantém as margens em telas estreitas (320px+).
 */
const MODAL_WIDTH = "min(420px, calc(56.25dvh - 3.9375rem), calc(100vw - 2rem))";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function plural(n: number, singular: string, pluralForm: string): string {
  return n === 1 ? singular : pluralForm;
}

function formatMinutes(total: number): string {
  if (total < 60) return `${total}min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function formatMonth(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function tierMeta(tier?: string) {
  const resolved = resolveNewTier(tier);
  if (resolved) return { tier: resolved, meta: NEW_TIER_META[resolved] };
  return { tier: null as NewLeagueTier | null, meta: null };
}

// Contextual copy lines — the "rarity framing" that makes stats feel earned
function focusCopy(minutes: number): string {
  if (minutes === 0) return "Cada minuto de foco conta. O próximo mês é seu.";
  if (minutes < 120) return "Você plantou as primeiras sementes. Continue.";
  if (minutes < 300) return "Mais de 2 horas de foco puro. Isso é consistência.";
  if (minutes < 600) return "Você está entre os mais dedicados da plataforma.";
  if (minutes < 1200) return "Nível de foco que menos de 20% dos usuários atingem.";
  return "Foco de elite. Você está no topo da plataforma.";
}

function streakCopy(days: number): string {
  if (days === 0) return "Amanhã é um novo começo. Construa sua sequência.";
  if (days === 1) return "1 dia é o começo de tudo. Não pare agora.";
  if (days < 7) return `${days} ${plural(days, "dia", "dias")} seguidos. A sequência está ganhando força.`;
  if (days < 14) return "Uma semana inteira de consistência. Isso é raro.";
  if (days < 30) return "Menos de 15% dos usuários chegam aqui. Você chegou.";
  return "Sequência lendária. Você faz parte de um grupo seleto.";
}

function leagueCopy(tier: NewLeagueTier | null, promoted: boolean): string {
  if (promoted) return "Você subiu de liga este mês. Trabalho duro recompensado.";
  if (!tier) return "Participe da liga e compete com os melhores.";
  const copies: Record<NewLeagueTier, string> = {
    BRONZE:   "Você está construindo sua base. A ascensão começa aqui.",
    PRATA:    "Consistência acima da média. A Prata é só o começo.",
    OURO:     "Liga Ouro — você está entre os 30% mais focados.",
    DIAMANTE: "Elite do foco. Menos de 10% chegam ao Diamante.",
    LENDAS:   "Liga Lendas. Você está entre os melhores da plataforma.",
  };
  return copies[tier];
}

function gardenCopy(count: number): string {
  if (count === 0) return "Seu jardim aguarda. Cada sessão planta uma energia.";
  if (count === 1) return "1 energia plantada. Seu jardim está nascendo.";
  if (count < 5) return `${count} energias cultivadas. O jardim está crescendo.`;
  if (count < 15) return `${count} energias. Um jardim vibrante tomando forma.`;
  return `${count} energias. Jardim exuberante — dedicação visível.`;
}

function xpCopy(xp: number): string {
  if (xp === 0) return "Cada sessão de foco gera XP. Sua jornada começa aqui.";
  if (xp < 1000) return `${xp.toLocaleString("pt-BR")} XP acumulados. Todo ponto conta na sua evolução.`;
  if (xp < 5000) return "Mais de 1.000 XP! Você já está evoluindo de verdade.";
  if (xp < 20000) return "Milhares de XP. Sua consistência está virando poder.";
  return "XP de elite. Sua jornada impressiona até os veteranos.";
}

// ─── Primitive sub-components ─────────────────────────────────────────────────

function AmbientGlow({ accent, glow }: { accent: string; glow: string }) {
  return (
    <>
      <div
        className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 rounded-full"
        style={{ width: "90%", height: "55%", background: `radial-gradient(circle, ${glow} 0%, transparent 70%)`, filter: "blur(50px)", opacity: 0.5 }}
      />
      <div
        className="pointer-events-none absolute bottom-1/4 left-1/4 rounded-full"
        style={{ width: "45%", height: "30%", background: `radial-gradient(circle, ${accent}18 0%, transparent 70%)`, filter: "blur(35px)" }}
      />
    </>
  );
}

/** Barras de progresso segmentadas — o preenchimento acompanha a troca de slide. */
function ProgressBar({ current, total, accent }: { current: number; total: number; accent: string }) {
  const reduced = useReducedMotion();
  return (
    <div
      className="flex flex-1 gap-1"
      role="progressbar"
      aria-label="Progresso do recap"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={current + 1}
    >
      {Array.from({ length: total }).map((_, index) => (
        <div key={index} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/15">
          <motion.div
            className="h-full w-full origin-left rounded-full"
            style={{ background: `linear-gradient(90deg, ${accent}, rgba(255,255,255,.9))` }}
            initial={false}
            animate={{ scaleX: index <= current ? 1 : 0 }}
            transition={{ duration: reduced ? 0 : 0.34, ease: "easeOut" }}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * Moldura do slide: área útil com respiro de 20px nas laterais e folga no topo
 * para o cabeçalho (progresso + som + fechar). Nenhum elemento encosta nas
 * bordas do cartão.
 */
function SlideFrame({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`absolute inset-0 flex flex-col items-center justify-center overflow-hidden px-5 pb-6 pt-16 text-center ${className}`}>
      {children}
    </div>
  );
}

/** Linha luminosa sob o número principal. */
function GlowUnderline({ accent, width = 68 }: { accent: string; width?: number }) {
  return (
    <span
      aria-hidden="true"
      className="mt-2 block h-[3px] rounded-full"
      style={{
        width,
        background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
        boxShadow: `0 0 14px ${accent}`,
      }}
    />
  );
}

// ─── Slide themes ─────────────────────────────────────────────────────────────

const THEMES = {
  intro:   { bg: "linear-gradient(160deg, #07111f 0%, #0d1b2d 100%)", accent: "#71d4ff", glow: "rgba(113,212,255,0.3)"  },
  focus:   { bg: "linear-gradient(160deg, #071828 0%, #0a2540 100%)", accent: ACCENT.focus,  glow: "rgba(92,200,255,0.35)" },
  streak:  { bg: "linear-gradient(160deg, #1a0e06 0%, #2d1a08 100%)", accent: ACCENT.streak, glow: "rgba(255,176,103,0.38)" },
  garden:  { bg: "linear-gradient(160deg, #071a0e 0%, #0d2a18 100%)", accent: ACCENT.garden, glow: "rgba(61,220,132,0.32)" },
  xp:      { bg: "linear-gradient(160deg, #12061f 0%, #26103f 100%)", accent: ACCENT.xp,     glow: "rgba(182,156,255,0.38)" },
  summary: { bg: "linear-gradient(160deg, #07111f 0%, #0d1b2d 100%)", accent: "#71d4ff", glow: "rgba(113,212,255,0.3)"  },
};

function leagueTheme(tier: NewLeagueTier | null) {
  const meta = tier ? NEW_TIER_META[tier] : NEW_TIER_META.BRONZE;
  const hex = meta.color;
  return {
    bg: `linear-gradient(160deg, #07111f 0%, ${hex}18 100%)`,
    accent: hex,
    glow: meta.glow,
  };
}

// ─── Intro slide ──────────────────────────────────────────────────────────────

function IntroSlide({ monthLabel, userName, userPhotoUrl, theme }: {
  monthLabel: string; userName: string; userPhotoUrl?: string;
  theme: { bg: string; accent: string; glow: string };
}) {
  const reduced = useReducedMotion();
  return (
    <SlideFrame>
      <AmbientGlow accent={theme.accent} glow={theme.glow} />
      <ParticleField accent={theme.accent} count={16} />

      <motion.div
        className="relative z-10 flex flex-col items-center gap-3"
        initial={reduced ? undefined : { opacity: 0, y: 28 }}
        animate={reduced ? undefined : { opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
      >
        {/* Logo mark */}
        <motion.div
          className="mb-1 grid h-14 w-14 place-items-center rounded-2xl"
          style={{ background: theme.accent, boxShadow: `0 0 32px ${theme.glow}` }}
          animate={reduced ? undefined : { y: [0, -6, 0] }}
          transition={reduced ? undefined : { duration: 4, repeat: Infinity, ease: "easeInOut" }}
        >
          <Zap size={28} color="#07111f" strokeWidth={2.5} />
        </motion.div>

        <p className="text-xs font-medium tracking-[0.28em] uppercase" style={{ color: "rgba(231,244,255,.4)" }}>
          Recap de
        </p>

        <motion.h2
          className="font-display max-w-full text-[clamp(1.4rem,6vw,2.25rem)] font-extrabold leading-none break-words capitalize"
          style={{ background: "linear-gradient(135deg, #71d4ff 0%, #b69cff 50%, #ffb86b 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
          initial={reduced ? undefined : { opacity: 0, scale: 0.82 }}
          animate={reduced ? undefined : { opacity: 1, scale: 1 }}
          transition={{ delay: 0.18, duration: 0.55, ease: "easeOut" }}
        >
          {monthLabel}
        </motion.h2>

        <motion.div
          className="mt-1 flex items-center gap-2.5"
          initial={reduced ? undefined : { opacity: 0, y: 14 }}
          animate={reduced ? undefined : { opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.5 }}
        >
          {userPhotoUrl ? (
            <Image
              src={userPhotoUrl}
              alt={userName}
              width={36}
              height={36}
              className="h-9 w-9 rounded-full object-cover ring-2 ring-[rgba(255,255,255,.18)]"
              unoptimized
              draggable={false}
            />
          ) : (
            <div className="h-9 w-9 rounded-full" style={{ background: `linear-gradient(135deg, ${theme.accent}, #b69cff)` }} />
          )}
          <span className="text-base font-semibold" style={{ color: "rgba(231,244,255,.82)" }}>{userName}</span>
        </motion.div>

        <motion.p
          className="mt-3 text-[10px] tracking-[0.2em] uppercase"
          style={{ color: "rgba(231,244,255,.3)" }}
          initial={reduced ? undefined : { opacity: 0 }}
          animate={reduced ? undefined : { opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          Toque para começar
        </motion.p>
      </motion.div>
    </SlideFrame>
  );
}

// ─── Hero stat slide ──────────────────────────────────────────────────────────

function HeroStatSlide({ numericValue, valueSuffix, label, copy, theme, icon, iconSrc, animateNumber = true }: {
  numericValue: number;
  valueSuffix?: string;
  label: string;
  copy: string;
  theme: { bg: string; accent: string; glow: string };
  icon: React.ReactNode;
  iconSrc?: string | readonly string[];
  animateNumber?: boolean;
}) {
  const reduced = useReducedMotion();
  return (
    <SlideFrame>
      <AmbientGlow accent={theme.accent} glow={theme.glow} />
      <ParticleField accent={theme.accent} />

      <motion.div
        className="relative z-10 flex w-full flex-col items-center"
        initial={reduced ? undefined : { opacity: 0, y: 24 }}
        animate={reduced ? undefined : { opacity: 1, y: 0 }}
        transition={{ duration: 0.65, ease: "easeOut" }}
      >
        {/* Ícone 3D com bloom de LED */}
        <motion.div
          className="relative mb-5 flex items-center justify-center"
          initial={reduced ? undefined : { scale: 0.55, opacity: 0 }}
          animate={reduced ? undefined : { scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 220, damping: 22 }}
        >
          <Recap3DIcon
            src={iconSrc}
            fallback={icon}
            alt={label}
            accent={theme.accent}
            size={132}
            artSize={92}
          />
        </motion.div>

        {/* Número principal + unidade em linhas próprias */}
        <motion.div
          className="flex w-full flex-col items-center gap-1"
          initial={reduced ? undefined : { opacity: 0, scale: 0.6 }}
          animate={reduced ? undefined : { opacity: 1, scale: 1 }}
          transition={{ delay: 0.18, duration: 0.55, ease: "easeOut" }}
        >
          {animateNumber ? (
            <AnimatedNumber
              value={numericValue}
              className="font-display max-w-full font-extrabold leading-none tabular-nums"
              style={{ fontSize: "clamp(2.5rem, 12vw, 5rem)", color: theme.accent, letterSpacing: "-0.04em" }}
              duration={1.1}
            />
          ) : (
            <span
              className="font-display max-w-full font-extrabold leading-none tabular-nums"
              style={{ fontSize: "clamp(2.5rem, 12vw, 5rem)", color: theme.accent, letterSpacing: "-0.04em" }}
            >
              {numericValue}
            </span>
          )}
          {valueSuffix ? (
            <span
              className="font-display max-w-full text-center font-bold leading-tight break-words"
              style={{ fontSize: "clamp(0.85rem, 3.4vw, 1.35rem)", color: theme.accent, opacity: 0.85 }}
            >
              {valueSuffix}
            </span>
          ) : null}
          <GlowUnderline accent={theme.accent} />
        </motion.div>

        {/* Label */}
        <motion.p
          className="mt-3 text-xs font-bold uppercase tracking-[0.18em] sm:text-sm"
          style={{ color: theme.accent }}
          initial={reduced ? undefined : { opacity: 0, y: 8 }}
          animate={reduced ? undefined : { opacity: 1, y: 0 }}
          transition={{ delay: 0.32 }}
        >
          {label}
        </motion.p>

        {/* Contextual copy */}
        <motion.p
          className="mt-4 max-w-[280px] text-[13px] leading-relaxed text-balance"
          style={{ color: "rgba(231,244,255,.52)" }}
          initial={reduced ? undefined : { opacity: 0, y: 8 }}
          animate={reduced ? undefined : { opacity: 1, y: 0 }}
          transition={{ delay: 0.48 }}
        >
          {copy}
        </motion.p>
      </motion.div>
    </SlideFrame>
  );
}

// ─── League slide (text value, not numeric) ───────────────────────────────────

function LeagueSlide({ tier, meta, promoted, theme }: {
  tier: NewLeagueTier | null;
  meta: (typeof NEW_TIER_META)[NewLeagueTier] | null;
  promoted: boolean;
  theme: { bg: string; accent: string; glow: string };
}) {
  const reduced = useReducedMotion();
  const label = meta ? meta.label : "—";
  const copy = leagueCopy(tier, promoted);

  return (
    <SlideFrame>
      <AmbientGlow accent={theme.accent} glow={theme.glow} />
      <ParticleField accent={theme.accent} />

      <motion.div
        className="relative z-10 flex w-full flex-col items-center"
        initial={reduced ? undefined : { opacity: 0, y: 24 }}
        animate={reduced ? undefined : { opacity: 1, y: 0 }}
        transition={{ duration: 0.65, ease: "easeOut" }}
      >
        {/* League icon halo */}
        <motion.div
          className="relative mb-5 flex items-center justify-center"
          initial={reduced ? undefined : { scale: 0.55, opacity: 0 }}
          animate={reduced ? undefined : { scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 220, damping: 22 }}
        >
          <Recap3DIcon
            src={meta?.iconPath}
            fallback={<Award size={52} color={theme.accent} />}
            alt={meta?.label ?? "Liga"}
            accent={theme.accent}
            size={140}
            artSize={96}
          />
        </motion.div>

        {/* Hero text */}
        <motion.p
          className="font-display max-w-full break-words text-[clamp(2rem,9vw,3.5rem)] font-extrabold leading-none uppercase"
          style={{ color: theme.accent, letterSpacing: "-0.03em" }}
          initial={reduced ? undefined : { opacity: 0, scale: 0.65 }}
          animate={reduced ? undefined : { opacity: 1, scale: 1 }}
          transition={{ delay: 0.18, duration: 0.55, ease: "easeOut" }}
        >
          {label}
        </motion.p>
        <GlowUnderline accent={theme.accent} />

        <motion.p
          className="mt-3 text-xs font-bold uppercase tracking-[0.18em] sm:text-sm"
          style={{ color: theme.accent }}
          initial={reduced ? undefined : { opacity: 0, y: 8 }}
          animate={reduced ? undefined : { opacity: 1, y: 0 }}
          transition={{ delay: 0.32 }}
        >
          Liga do mês
        </motion.p>

        {promoted && (
          <motion.div
            className="mt-3 flex items-center gap-1.5 rounded-full px-3 py-1"
            style={{ background: "rgba(74,222,128,.12)", border: "1px solid rgba(74,222,128,.25)" }}
            initial={reduced ? undefined : { opacity: 0, scale: 0.8 }}
            animate={reduced ? undefined : { opacity: 1, scale: 1 }}
            transition={{ delay: 0.42, type: "spring" }}
          >
            <Trophy size={12} color="#4ade80" />
            <span className="text-xs font-bold" style={{ color: "#4ade80" }}>Promovido!</span>
          </motion.div>
        )}

        <motion.p
          className="mt-4 max-w-[280px] text-[13px] leading-relaxed text-balance"
          style={{ color: "rgba(231,244,255,.52)" }}
          initial={reduced ? undefined : { opacity: 0, y: 8 }}
          animate={reduced ? undefined : { opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          {copy}
        </motion.p>
      </motion.div>
    </SlideFrame>
  );
}

// ─── Summary slide ────────────────────────────────────────────────────────────

interface SummaryStat {
  key: string;
  label: string;
  value: string;
  color: string;
  art?: readonly string[];
  fallback: React.ReactNode;
  wide?: boolean;
}

/** Ícone do card de estatística: arte 3D se existir, ícone line como fallback. */
function SummaryStatIcon({ art, label, fallback }: { art?: readonly string[]; label: string; fallback: React.ReactNode }) {
  const [failed, setFailed] = useState<string[]>([]);
  const current = (art ?? []).find((candidate) => !failed.includes(candidate)) ?? null;

  if (!current) {
    return <span aria-hidden="true" className="grid place-items-center">{fallback}</span>;
  }

  return (
    <Image
      src={current}
      alt={label}
      width={16}
      height={16}
      style={{ objectFit: "contain" }}
      unoptimized
      draggable={false}
      onError={() => setFailed((prev) => (prev.includes(current) ? prev : [...prev, current]))}
    />
  );
}

function SummarySlide({ recap, userName, userPhotoUrl, monthLabel, theme }: {
  recap: RecapData; userName: string; userPhotoUrl?: string; monthLabel: string;
  theme: { bg: string; accent: string; glow: string };
}) {
  const reduced = useReducedMotion();
  const { meta } = tierMeta(recap.leagueTier);
  const tierColor = meta ? meta.color : "#71d4ff";
  const garden = recap.gardenCount ?? 0;

  const stats: SummaryStat[] = [
    {
      key: "foco",
      label: "Foco",
      value: formatMinutes(recap.totalFocusMinutes),
      color: ACCENT.focus,
      art: RECAP_ART.foco,
      fallback: <Timer size={16} color={ACCENT.focus} strokeWidth={1.8} />,
    },
    {
      key: "sequencia",
      label: plural(recap.longestStreak, "dia", "dias"),
      value: String(recap.longestStreak),
      color: ACCENT.streak,
      art: RECAP_ART.sequencia,
      fallback: <Flame size={16} color={ACCENT.streak} strokeWidth={1.8} />,
    },
    {
      key: "liga",
      label: "Liga",
      value: meta ? meta.label : "—",
      color: tierColor,
      art: meta?.iconPath ? [meta.iconPath] : undefined,
      fallback: <Award size={16} color={tierColor} strokeWidth={1.8} />,
    },
    {
      key: "jardim",
      label: plural(garden, "energia", "energias"),
      value: String(garden),
      color: ACCENT.garden,
      art: RECAP_ART.jardim,
      fallback: <Zap size={16} color={ACCENT.garden} strokeWidth={1.8} />,
    },
    {
      key: "xp",
      label: "XP total",
      value: (recap.totalXp ?? 0).toLocaleString("pt-BR"),
      color: ACCENT.xp,
      art: RECAP_ART.xp,
      fallback: <Zap size={16} color={ACCENT.xp} strokeWidth={1.8} />,
      wide: true,
    },
  ];

  return (
    <SlideFrame className="justify-center gap-0">
      <AmbientGlow accent={theme.accent} glow={theme.glow} />

      <motion.div
        className="relative z-10 flex w-full max-w-[320px] flex-col items-center"
        initial={reduced ? undefined : { opacity: 0, y: 24 }}
        animate={reduced ? undefined : { opacity: 1, y: 0 }}
        transition={{ duration: 0.65, ease: "easeOut" }}
      >
        {/* Bloco de título centralizado (abaixo do cabeçalho) */}
        <p className="text-[10px] font-medium tracking-[0.28em] uppercase" style={{ color: "rgba(231,244,255,.38)" }}>Recap de</p>
        <h2
          className="font-display mt-1 max-w-full text-center text-[clamp(1.35rem,5.5vw,1.9rem)] font-extrabold leading-tight break-words capitalize"
          style={{ background: "linear-gradient(135deg, #71d4ff, #b69cff, #ffb86b)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
        >
          {monthLabel}
        </h2>

        {userPhotoUrl ? (
          <div className="mt-2 flex items-center gap-2">
            <Image
              src={userPhotoUrl}
              alt={userName}
              width={28}
              height={28}
              className="h-7 w-7 rounded-full object-cover ring-1 ring-[rgba(255,255,255,.15)]"
              unoptimized
              draggable={false}
            />
            <span className="text-xs font-medium" style={{ color: "rgba(231,244,255,.7)" }}>{userName}</span>
          </div>
        ) : null}

        {/* Bento 2 colunas — o 5º card ocupa as duas colunas, alturas iguais */}
        <div className="mt-4 grid w-full grid-cols-2 gap-2.5" style={{ gridAutoRows: "1fr" }}>
          {stats.map((stat, index) => (
            <motion.div
              key={stat.key}
              className={stat.wide ? "col-span-2" : ""}
              initial={reduced ? undefined : { opacity: 0, y: 16, scale: 0.94 }}
              animate={reduced ? undefined : { opacity: 1, y: 0, scale: 1 }}
              transition={reduced ? undefined : { delay: 0.12 + index * 0.07, type: "spring", stiffness: 260, damping: 20 }}
            >
              <TiltCard
                accent={stat.color}
                className={`flex items-center justify-center px-2 py-2.5 ${
                  stat.wide ? "flex-row gap-3 text-left" : "flex-col gap-2 text-center"
                }`}
              >
                <span
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full"
                  style={{ background: `${stat.color}22`, boxShadow: `0 0 14px -4px ${stat.color}` }}
                >
                  <SummaryStatIcon art={stat.art} label={stat.label} fallback={stat.fallback} />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span
                    className="font-display max-w-full truncate text-[clamp(0.95rem,4.2vw,1.3rem)] font-extrabold leading-none tabular-nums"
                    style={{ color: stat.color }}
                  >
                    {stat.value}
                  </span>
                  <span className="mt-1 max-w-full truncate text-[9px] uppercase tracking-wider" style={{ color: "rgba(231,244,255,.45)" }}>
                    {stat.label}
                  </span>
                </span>
              </TiltCard>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </SlideFrame>
  );
}

// ─── Canvas export — 9:16 story format ───────────────────────────────────────

const CARD_W = 1080;
const CARD_H = 1920;

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("img load failed: " + src));
    img.src = src;
  });
}

function drawGlow(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, color);
  g.addColorStop(1, "transparent");
  ctx.fillStyle = g;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
}

/**
 * Exporta o recap como imagem 1080×1920 (9:16).
 *
 * O desenho é feito à mão no canvas (sem html2canvas/dom-to-image): por isso
 * `backdrop-filter`/blur do redesign NUNCA é rasterizado — cada superfície de
 * vidro vira uma cor sólida equivalente, guaranteeing um PNG correto.
 */
export async function captureRecapCard(
  recap: RecapData,
  userName: string,
  userPhotoUrl?: string,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d")!;
  const pad = 80;
  const CX = CARD_W / 2;

  const { meta } = tierMeta(recap.leagueTier);
  const tierColor = meta ? meta.color : "#71d4ff";
  const monthLabel = formatMonth(recap.recapMonth);
  const garden = recap.gardenCount ?? 0;

  // ── Background ──
  const bg = ctx.createLinearGradient(0, 0, 0, CARD_H);
  bg.addColorStop(0, "#07111f");
  bg.addColorStop(1, "#0d1b2d");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // Grid noise
  ctx.strokeStyle = "rgba(113,212,255,.03)";
  ctx.lineWidth = 1;
  for (let y = 0; y < CARD_H; y += 48) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CARD_W, y); ctx.stroke();
  }
  for (let x = 0; x < CARD_W; x += 48) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CARD_H); ctx.stroke();
  }

  // Ambient glows
  drawGlow(ctx, CARD_W * 0.8, 200, 320, "rgba(113,212,255,.06)");
  drawGlow(ctx, CARD_W * 0.15, CARD_H * 0.42, 280, "rgba(182,156,255,.04)");
  drawGlow(ctx, CARD_W * 0.85, CARD_H * 0.72, 260, "rgba(255,184,107,.04)");
  drawGlow(ctx, CARD_W * 0.2, CARD_H * 0.88, 240, "rgba(74,222,128,.04)");

  // Top accent line
  const accentLine = ctx.createLinearGradient(0, 0, CARD_W, 0);
  accentLine.addColorStop(0, "rgba(113,212,255,0)");
  accentLine.addColorStop(0.5, "rgba(113,212,255,.7)");
  accentLine.addColorStop(1, "rgba(113,212,255,0)");
  ctx.fillStyle = accentLine;
  ctx.fillRect(0, 0, CARD_W, 4);

  // ── Header ──
  let y = 150;
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(231,244,255,.38)";
  ctx.font = "500 32px 'Inter', -apple-system, sans-serif";
  ctx.fillText("RECAP DE", CX, y);
  y += 86;

  const titleGrad = ctx.createLinearGradient(CARD_W * 0.2, 0, CARD_W * 0.8, 0);
  titleGrad.addColorStop(0, "#71d4ff");
  titleGrad.addColorStop(0.5, "#b69cff");
  titleGrad.addColorStop(1, "#ffb86b");
  ctx.fillStyle = titleGrad;
  ctx.font = "800 78px 'Inter', -apple-system, sans-serif";
  ctx.fillText(monthLabel.toUpperCase(), CX, y);
  y += 76;

  // User avatar + name
  if (userPhotoUrl) {
    try {
      const img = await loadImage(userPhotoUrl);
      const avatarR = 26;
      const nameW = ctx.measureText(userName).width;
      const totalW = avatarR * 2 + 14 + nameW;
      const avatarX = CX - totalW / 2 + avatarR;
      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarX, y + 4, avatarR, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, avatarX - avatarR, y + 4 - avatarR, avatarR * 2, avatarR * 2);
      ctx.restore();
      ctx.fillStyle = "rgba(231,244,255,.72)";
      ctx.font = "600 30px 'Inter', -apple-system, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(userName, avatarX + avatarR + 14, y + 12);
      ctx.textAlign = "center";
    } catch {
      ctx.fillStyle = "rgba(231,244,255,.72)";
      ctx.font = "600 30px 'Inter', -apple-system, sans-serif";
      ctx.fillText(userName, CX, y + 12);
    }
  } else {
    ctx.fillStyle = "rgba(231,244,255,.72)";
    ctx.font = "600 30px 'Inter', -apple-system, sans-serif";
    ctx.fillText(userName, CX, y + 12);
  }
  y += 90;

  // ── Bento grid: 2 colunas, o 5º card ocupa as duas ──
  const stats = [
    { key: "foco", label: "Foco", value: formatMinutes(recap.totalFocusMinutes), color: ACCENT.focus, art: RECAP_ART.foco },
    { key: "sequencia", label: plural(recap.longestStreak, "dia", "dias"), value: String(recap.longestStreak), color: ACCENT.streak, art: RECAP_ART.sequencia },
    { key: "liga", label: "Liga", value: meta ? meta.label : "—", color: tierColor, art: meta?.iconPath ? [meta.iconPath] : [] },
    { key: "jardim", label: plural(garden, "energia", "energias"), value: String(garden), color: ACCENT.garden, art: RECAP_ART.jardim },
    { key: "xp", label: "XP total", value: (recap.totalXp ?? 0).toLocaleString("pt-BR"), color: ACCENT.xp, art: RECAP_ART.xp },
  ];

  const gap = 28;
  const colW = (CARD_W - pad * 2 - gap) / 2;
  const rowH = 270;
  const gridTop = y;
  const arts = await Promise.all(
    stats.map(async (stat) => {
      for (const candidate of stat.art) {
        const img = await loadImage(candidate).catch(() => null);
        if (img) return img;
      }
      return null;
    }),
  );

  stats.forEach((stat, index) => {
    const wide = index === stats.length - 1;
    const col = wide ? 0 : index % 2;
    const row = wide ? 2 : Math.floor(index / 2);
    const x = pad + col * (colW + gap);
    const yTop = gridTop + row * (rowH + gap);
    const w = wide ? CARD_W - pad * 2 : colW;
    const h = rowH;

    // Vidro → cor sólida (o canvas não rasteriza backdrop-filter)
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,.45)";
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 12;
    roundRect(ctx, x, yTop, w, h, 30);
    ctx.fillStyle = "rgba(12,22,38,.72)";
    ctx.fill();
    ctx.restore();

    ctx.save();
    roundRect(ctx, x, yTop, w, h, 30);
    ctx.fillStyle = hexToRgba(stat.color, 0.07);
    ctx.fill();
    ctx.strokeStyle = hexToRgba(stat.color, 0.42);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // Brilho interno no topo-esquerda
    const inner = ctx.createRadialGradient(x + w * 0.2, yTop, 0, x + w * 0.2, yTop, w * 0.6);
    inner.addColorStop(0, hexToRgba(stat.color, 0.16));
    inner.addColorStop(1, "transparent");
    ctx.fillStyle = inner;
    ctx.fillRect(x, yTop, w, h);

    // Arte 3D (opcional) — no card largo fica à esquerda, nos demais no topo-direita.
    // Sem o arquivo, entra um marcador circular para o layout não ficar torto.
    const art = arts[index];
    const artSize = wide ? 84 : 72;
    const artX = wide ? x + 44 : x + w - artSize - 30;
    const artY = wide ? yTop + (h - artSize) / 2 : yTop + 26;
    if (art) {
      ctx.drawImage(art, artX, artY, artSize, artSize);
    } else {
      ctx.save();
      ctx.beginPath();
      ctx.arc(artX + artSize / 2, artY + artSize / 2, artSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(stat.color, 0.16);
      ctx.fill();
      ctx.strokeStyle = hexToRgba(stat.color, 0.5);
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    const textX = wide && art ? x + 152 : x + 34;
    const valueY = wide ? yTop + 148 : yTop + 168;
    const labelY = valueY + 46;
    const barY = labelY + 18;

    // Valor
    ctx.fillStyle = stat.color;
    ctx.font = "800 76px 'Inter', -apple-system, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(stat.value, textX, valueY);

    // Label
    ctx.fillStyle = hexToRgba(stat.color, 0.78);
    ctx.font = "700 26px 'Inter', -apple-system, sans-serif";
    ctx.fillText(stat.label.toUpperCase(), textX, labelY);

    // Barra luminosa
    ctx.fillStyle = hexToRgba(stat.color, 0.55);
    roundRect(ctx, textX, barY, 120, 4, 2);
    ctx.fill();
  });

  // ── Destaque do mês ──
  const highlightY = gridTop + 3 * (rowH + gap) + 90;
  const div = ctx.createLinearGradient(CARD_W * 0.25, 0, CARD_W * 0.75, 0);
  div.addColorStop(0, "rgba(113,212,255,0)");
  div.addColorStop(0.5, "rgba(113,212,255,.28)");
  div.addColorStop(1, "rgba(113,212,255,0)");
  ctx.fillStyle = div;
  ctx.fillRect(CARD_W * 0.25, highlightY, CARD_W * 0.5, 2);

  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(231,244,255,.5)";
  ctx.font = "400 34px 'Inter', -apple-system, sans-serif";
  const highlight = focusCopy(recap.totalFocusMinutes);
  const words = highlight.split(" ");
  let line = "";
  let lineY = highlightY + 76;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > CARD_W - pad * 2 - 60 && line) {
      ctx.fillText(line, CX, lineY);
      line = word;
      lineY += 44;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, CX, lineY);

  // ── Footer ──
  const footY = CARD_H - 150;
  const footDiv = ctx.createLinearGradient(CARD_W * 0.25, 0, CARD_W * 0.75, 0);
  footDiv.addColorStop(0, "rgba(113,212,255,0)");
  footDiv.addColorStop(0.5, "rgba(113,212,255,.18)");
  footDiv.addColorStop(1, "rgba(113,212,255,0)");
  ctx.fillStyle = footDiv;
  ctx.fillRect(CARD_W * 0.25, footY, CARD_W * 0.5, 1);

  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(231,244,255,.2)";
  ctx.font = "800 38px 'Inter', -apple-system, sans-serif";
  ctx.fillText("ENERGYOS", CX, footY + 74);

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob!), "image/png"));
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MonthlyRecapPremium({
  recap,
  userName,
  userPhotoUrl,
  onShare: onExternalShare,
  onCoinsAwarded,
  isLive,
}: MonthlyRecapPremiumProps) {
  const [open, setOpen] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isSharing, setIsSharing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [rewardToast, setRewardToast] = useState<{ amount: number; balance: number } | null>(null);
  const reduced = useReducedMotion();
  const { user } = useAuthRedirect({ ifGuest: "/" });
  const { enabled: soundEnabled, toggle: toggleSound, play: playSound } = useRecapSound();

  const monthLabel = formatMonth(recap.recapMonth);
  const { meta, tier } = tierMeta(recap.leagueTier);
  const garden = recap.gardenCount ?? 0;
  const isSummary = currentSlide === SLIDE_COUNT - 1;

  const theme = useMemo(() => {
    switch (currentSlide) {
      case 1: return THEMES.focus;
      case 2: return THEMES.streak;
      case 3: return leagueTheme(tier);
      case 4: return THEMES.garden;
      case 5: return THEMES.xp;
      case 6: return THEMES.summary;
      default: return THEMES.intro;
    }
  }, [currentSlide, tier]);

  const goNext = useCallback(() => {
    if (currentSlide >= SLIDE_COUNT - 1) return;
    playSound("slide");
    setCurrentSlide(currentSlide + 1);
  }, [currentSlide, playSound]);

  const goPrev = useCallback(() => {
    if (currentSlide <= 0) return;
    playSound("slide");
    setCurrentSlide(currentSlide - 1);
  }, [currentSlide, playSound]);

  // Zonas de toque: 30% à esquerda (anterior) e 30% à direita (próximo).
  const handleTapZone = useCallback((direction: "prev" | "next") => {
    if (direction === "prev") goPrev();
    else goNext();
  }, [goNext, goPrev]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, goNext, goPrev]);

  // Som: tique do contador + brilho do slide final.
  useEffect(() => {
    if (!open) return;
    if (isSummary) {
      playSound("sparkle");
      return;
    }
    if (currentSlide === 0) return;
    const timer = window.setTimeout(() => playSound("tick"), 260);
    return () => window.clearTimeout(timer);
  }, [currentSlide, isSummary, open, playSound]);

  const handleDownload = useCallback(async () => {
    setIsDownloading(true);
    try {
      const blob = await captureRecapCard(recap, userName, userPhotoUrl);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `recap-${recap.recapMonth.slice(0, 7)}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsDownloading(false);
    }
  }, [recap, userName, userPhotoUrl]);

  const handleShare = useCallback(async () => {
    if (isSharing) return;
    setIsSharing(true);
    try {
      if (user?.uid && recap.id && !recap.hasBeenShared) {
        const res = await fetch("/api/recap/share", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recapId: recap.id }),
        });
        if (res.ok) {
          const result = await res.json();
          if (result.wasFirstShare && result.newBalance !== undefined) {
            setRewardToast({ amount: SHARE_REWARD_COINS, balance: result.newBalance });
            onCoinsAwarded?.(SHARE_REWARD_COINS, result.newBalance);
          }
        }
      }
      const blob = await captureRecapCard(recap, userName, userPhotoUrl);
      if (onExternalShare) onExternalShare(blob);
      if (navigator.share && navigator.canShare) {
        const file = new File([blob], `recap-${recap.recapMonth.slice(0, 7)}.png`, { type: "image/png" });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: `Meu recap de ${monthLabel} no energyOS`,
            text: `${formatMinutes(recap.totalFocusMinutes)} de foco, ${recap.longestStreak} ${plural(recap.longestStreak, "dia", "dias")} de sequência, ${(recap.totalXp ?? 0).toLocaleString("pt-BR")} XP!`,
          }).catch(() => {/* user cancelled */});
        }
      }
    } finally {
      setIsSharing(false);
    }
  }, [recap, isSharing, monthLabel, onExternalShare, onCoinsAwarded, user, userName, userPhotoUrl]);

  function renderSlide() {
    switch (currentSlide) {
      case 0:
        return <IntroSlide monthLabel={monthLabel} userName={userName} userPhotoUrl={userPhotoUrl} theme={THEMES.intro} />;
      case 1:
        return (
          <HeroStatSlide
            numericValue={Math.floor(recap.totalFocusMinutes / 60)}
            valueSuffix={recap.totalFocusMinutes < 60 ? "min" : "h"}
            label="Foco total"
            copy={focusCopy(recap.totalFocusMinutes)}
            theme={THEMES.focus}
            iconSrc={RECAP_ART.foco}
            icon={<Timer size={48} color={THEMES.focus.accent} strokeWidth={1.5} />}
          />
        );
      case 2:
        return (
          <HeroStatSlide
            numericValue={recap.longestStreak}
            valueSuffix={plural(recap.longestStreak, "dia", "dias")}
            label="Sequência"
            copy={streakCopy(recap.longestStreak)}
            theme={THEMES.streak}
            iconSrc={RECAP_ART.sequencia}
            icon={<Flame size={52} color={THEMES.streak.accent} strokeWidth={1.5} />}
          />
        );
      case 3:
        return (
          <LeagueSlide
            tier={tier}
            meta={meta}
            promoted={recap.leaguePromoted ?? false}
            theme={leagueTheme(tier)}
          />
        );
      case 4:
        return (
          <HeroStatSlide
            numericValue={garden}
            valueSuffix={plural(garden, "energia", "energias")}
            label="Jardim"
            copy={gardenCopy(garden)}
            theme={THEMES.garden}
            iconSrc={RECAP_ART.jardim}
            icon={<Zap size={52} color={THEMES.garden.accent} strokeWidth={1.5} />}
          />
        );
      case 5:
        return (
          <HeroStatSlide
            numericValue={recap.totalXp ?? 0}
            valueSuffix="XP"
            label="XP total"
            copy={xpCopy(recap.totalXp ?? 0)}
            theme={THEMES.xp}
            iconSrc={RECAP_ART.xp}
            icon={<Zap size={52} color={THEMES.xp.accent} strokeWidth={1.5} />}
          />
        );
      case 6:
        return (
          <SummarySlide
            recap={recap}
            userName={userName}
            userPhotoUrl={userPhotoUrl}
            monthLabel={monthLabel}
            theme={THEMES.summary}
          />
        );
      default:
        return null;
    }
  }

  return (
    <>
      {/* Trigger button */}
      <motion.button
        whileHover={reduced ? undefined : { scale: 1.01 }}
        whileTap={reduced ? undefined : { scale: 0.98 }}
        onClick={() => { setCurrentSlide(0); setOpen(true); }}
        className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] px-4 py-3.5 text-left transition-colors hover:border-[var(--accent-border)] hover:bg-[var(--bg-surface-hover)]"
      >
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: "rgba(255,255,255,.05)" }}>
          {meta ? (
            <Image src={meta.iconPath} alt={meta.label} width={20} height={20} unoptimized draggable={false} />
          ) : (
            <Award size={18} style={{ color: "#71d4ff" }} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[var(--text)]">Ver recap de {monthLabel}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[var(--text-muted)]">
            {isLive && <span className="text-[var(--accent)]">Ao vivo</span>}
            <span className="inline-flex items-center gap-0.5">
              <Timer size={10} />
              {formatMinutes(recap.totalFocusMinutes)}
            </span>
            <span className="inline-flex items-center gap-0.5">
              <Flame size={10} />
              {recap.longestStreak} {plural(recap.longestStreak, "dia", "dias")}
            </span>
            <span className="inline-flex items-center gap-0.5">
              <Zap size={10} />
              {(recap.totalXp ?? 0).toLocaleString("pt-BR")} XP
            </span>
          </div>
        </div>
        {isLive ? (
          <span className="shrink-0 rounded-full border border-[var(--accent-border)] bg-[var(--accent)]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">
            Ao vivo
          </span>
        ) : recap.status === "final" ? (
          <span className="shrink-0 rounded-full border border-[#4ade80]/30 bg-[#4ade80]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#4ade80]">
            Final
          </span>
        ) : (
          <span className="shrink-0 rounded-full border border-[var(--accent-border)] bg-[var(--accent)]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">
            Ao vivo
          </span>
        )}
      </motion.button>

      {/* Modal */}
      <AnimatePresence>
        {open && (
          <Modal onClose={() => setOpen(false)}>
            <div className="mx-auto flex flex-col items-center gap-2.5 pb-2 sm:pb-0" style={{ width: MODAL_WIDTH }}>
              {/* Cartão 9:16 — header / content / footer */}
              <div
                className="relative flex flex-col overflow-hidden rounded-2xl"
                style={{
                  width: "100%",
                  aspectRatio: "9 / 16",
                  background: "#07111f",
                  boxShadow: "0 25px 60px -12px rgba(0,0,0,.65), 0 0 60px -20px rgba(113,212,255,.35)",
                }}
              >
                {/* Fundo do slide (cross-fade) */}
                <motion.div
                  key={`bg-${currentSlide}`}
                  aria-hidden="true"
                  className="absolute inset-0"
                  style={{ background: theme.bg }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reduced ? 0 : 0.3, ease: "easeOut" }}
                />

                {/* Conteúdo */}
                <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center overflow-hidden">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={currentSlide}
                      className="absolute inset-0"
                      initial={reduced ? { opacity: 0 } : { opacity: 0, x: 48 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={reduced ? { opacity: 0 } : { opacity: 0, x: -48 }}
                      transition={{ duration: reduced ? 0 : 0.3, ease: "easeOut" }}
                    >
                      {renderSlide()}
                    </motion.div>
                  </AnimatePresence>

                  {/* Zonas de toque (invisíveis) — 30% em cada lado */}
                  <div
                    aria-hidden="true"
                    onClick={() => handleTapZone("prev")}
                    className="absolute inset-y-0 left-0 z-20 w-[30%] cursor-pointer"
                  />
                  <div
                    aria-hidden="true"
                    onClick={() => handleTapZone("next")}
                    className="absolute inset-y-0 right-0 z-20 w-[30%] cursor-pointer"
                  />
                </div>

                {/* Cabeçalho — progresso, som e fechar */}
                <div className="absolute inset-x-0 top-0 z-30 flex items-center gap-2 px-3 pt-3">
                  <ProgressBar current={currentSlide} total={SLIDE_COUNT} accent={theme.accent} />

                  <button
                    type="button"
                    onClick={toggleSound}
                    aria-label={soundEnabled ? "Desativar sons do recap" : "Ativar sons do recap"}
                    aria-pressed={soundEnabled}
                    className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-full bg-[rgba(0,0,0,0.45)] text-white/75 backdrop-blur-sm transition hover:bg-[rgba(0,0,0,0.65)] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
                  >
                    {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Fechar"
                    className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-full bg-[rgba(0,0,0,0.45)] text-white/75 backdrop-blur-sm transition hover:bg-[rgba(0,0,0,0.65)] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Setas — encostadas na borda do cartão, fora da área de conteúdo */}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); goPrev(); }}
                  disabled={currentSlide === 0}
                  aria-label="Slide anterior"
                  className="absolute top-1/2 left-1 z-30 grid h-8 w-8 -translate-y-1/2 cursor-pointer place-items-center rounded-full bg-[rgba(0,0,0,0.35)] text-white/70 backdrop-blur-sm transition hover:bg-[rgba(0,0,0,0.55)] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 disabled:pointer-events-none disabled:opacity-0"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); goNext(); }}
                  disabled={currentSlide === SLIDE_COUNT - 1}
                  aria-label="Próximo slide"
                  className="absolute top-1/2 right-1 z-30 grid h-8 w-8 -translate-y-1/2 cursor-pointer place-items-center rounded-full bg-[rgba(0,0,0,0.35)] text-white/70 backdrop-blur-sm transition hover:bg-[rgba(0,0,0,0.55)] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 disabled:pointer-events-none disabled:opacity-0"
                >
                  <ChevronRight size={18} />
                </button>

                {/* Rodapé — ações do slide final (fora do conteúdo, sem sobreposição) */}
                {isSummary ? (
                  <div className="relative z-20 shrink-0 px-5 pt-1 pb-4">
                    <p className="mb-2 text-center text-[9px] font-bold uppercase tracking-[0.4em]" style={{ color: "rgba(231,244,255,.2)" }}>
                      energyOS
                    </p>
                    <div className="flex items-center gap-2.5">
                      <motion.button
                        type="button"
                        whileHover={reduced ? undefined : { y: -2 }}
                        whileTap={reduced ? undefined : { scale: 0.97 }}
                        onClick={handleDownload}
                        disabled={isDownloading}
                        className="flex h-11 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl text-xs font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 disabled:opacity-60"
                        style={{
                          background: "linear-gradient(135deg, #71d4ff, #5CC8FF)",
                          color: "#07111f",
                          boxShadow: "0 10px 26px -12px rgba(113,212,255,.85)",
                        }}
                      >
                        {isDownloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                        Baixar
                      </motion.button>
                      <motion.button
                        type="button"
                        whileHover={reduced ? undefined : { y: -2 }}
                        whileTap={reduced ? undefined : { scale: 0.97 }}
                        onClick={handleShare}
                        disabled={isSharing}
                        className="flex h-11 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl text-xs font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 disabled:opacity-60"
                        style={{
                          background: "rgba(255,255,255,.07)",
                          border: "1px solid rgba(113,212,255,.35)",
                          color: "#71d4ff",
                          backdropFilter: "blur(10px)",
                          WebkitBackdropFilter: "blur(10px)",
                        }}
                      >
                        {isSharing ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}
                        Compartilhar
                      </motion.button>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Dica fora e abaixo do cartão */}
              <motion.p
                className="px-2 text-center text-[10px] tracking-[0.18em] uppercase"
                style={{ color: "rgba(231,244,255,.28)" }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
              >
                Toque nos lados ou use as setas para navegar
              </motion.p>
            </div>

            <RewardToast toast={rewardToast} onDone={() => setRewardToast(null)} />
          </Modal>
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Standalone helpers ───────────────────────────────────────────────────────

export async function downloadRecapImage(recap: RecapData, userName: string, userPhotoUrl?: string) {
  const blob = await captureRecapCard(recap, userName, userPhotoUrl);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `recap-${recap.recapMonth.slice(0, 7)}.png`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function shareRecapImage(recap: RecapData, userName: string, userPhotoUrl?: string) {
  const blob = await captureRecapCard(recap, userName, userPhotoUrl);
  if (navigator.share && navigator.canShare) {
    const file = new File([blob], `recap-${recap.recapMonth.slice(0, 7)}.png`, { type: "image/png" });
    if (navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], text: `Meu recap de ${formatMonth(recap.recapMonth)} no energyOS` });
      return;
    }
  }
  await downloadRecapImage(recap, userName, userPhotoUrl);
}
