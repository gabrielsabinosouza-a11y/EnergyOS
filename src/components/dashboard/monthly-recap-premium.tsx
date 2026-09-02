"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { X, Download, Share2, ChevronLeft, ChevronRight, Timer, Award } from "lucide-react";
import Image from "next/image";
import { Modal } from "@/components/modal";
import { RewardToast } from "@/components/reward-toast";
import { AnimatedNumber } from "@/components/ui";
import { NEW_TIER_META, resolveNewTier } from "@/lib/league-new-meta";
import type { NewLeagueTier } from "@/types";
import { useSession } from "next-auth/react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MonthlyRecapPremiumProps {
  recap: {
    id: number;
    recapMonth: string;
    totalFocusMinutes: number;
    longestStreak: number;
    leagueTier?: string;
    leaguePromoted?: boolean;
    productivityTag?: string;
    hasBeenShared?: boolean;
  };
  userName: string;
  userPhotoUrl?: string;
  onShare?: (blob: Blob) => void;
  onCoinsAwarded?: (amount: number, newBalance: number) => void;
}

// Interface for icon assets - these will be provided as PNG paths
interface RecapIconAssets {
  focusIcon?: string;
  streakIcon?: string;
  leagueIcon?: string;
  tagIcon?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SLIDE_COUNT = 6; // intro + 4 stats + summary
const SHARE_REWARD_COINS = 50;

// Slide theme colors matching the stat categories
const SLIDE_THEMES = {
  intro: { 
    bg: "linear-gradient(135deg, #0a0e1a 0%, #111827 100%)", 
    accent: "#71d4ff",
    glow: "rgba(113,212,255,0.35)"
  },
  focus: { 
    bg: "linear-gradient(135deg, #0a1628 0%, #1a3a5a 100%)", 
    accent: "#71d4ff",
    glow: "rgba(113,212,255,0.4)"
  },
  streak: { 
    bg: "linear-gradient(135deg, #1a0e08 0%, #3a2110 100%)", 
    accent: "#ff8c42",
    glow: "rgba(255,140,66,0.4)"
  },
  league: (tier: NewLeagueTier | null) => {
    const meta = tier ? NEW_TIER_META[tier] : NEW_TIER_META.BRONZE;
    return {
      bg: `linear-gradient(135deg, ${meta.color}22 0%, ${meta.color}44 100%)`,
      accent: meta.color,
      glow: meta.glow
    };
  },
  tag: { 
    bg: "linear-gradient(135deg, #1a0e28 0%, #3a1a5a 100%)", 
    accent: "#b69cff",
    glow: "rgba(182,156,255,0.4)"
  },
  summary: { 
    bg: "linear-gradient(135deg, #0a0e1a 0%, #111827 100%)", 
    accent: "#71d4ff",
    glow: "rgba(113,212,255,0.35)"
  }
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function tierMeta(tier?: string) {
  const resolved = resolveNewTier(tier);
  if (resolved) return { tier: resolved, meta: NEW_TIER_META[resolved] };
  return { tier: null as NewLeagueTier | null, meta: null };
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

// ─── Particle/Sparkle Effects ────────────────────────────────────────────────

function SparkleEffect({ color = "#ffffff", count = 8 }: { color?: string; count?: number }) {
  const reduced = useReducedMotion();
  
  if (reduced) return null;
  
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: count }).map((_, i) => {
        const size = Math.random() * 4 + 2;
        const x = Math.random() * 100;
        const y = Math.random() * 100;
        const delay = Math.random() * 3;
        const duration = Math.random() * 3 + 2;
        
        return (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              width: size,
              height: size,
              background: color,
              boxShadow: `0 0 ${size * 2}px ${color}`,
              left: `${x}%`,
              top: `${y}%`,
            }}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ 
              opacity: [0.2, 0.8, 0.2, 0],
              scale: [0, 1, 0],
              y: [-10, -20, -10, 0]
            }}
            transition={{
              duration,
              delay,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        );
      })}
    </div>
  );
}

// ─── 3D Icon Container ───────────────────────────────────────────────────────

function Icon3DContainer({
  children,
  color,
  glow,
  animate = true
}: {
  children: React.ReactNode;
  color: string;
  glow: string;
  animate?: boolean;
}) {
  const reduced = useReducedMotion();
  
  if (!animate || reduced) {
    return (
      <div 
        className="relative flex items-center justify-center"
        style={{
          transformStyle: "preserve-3d",
          perspective: 1000
        }}
      >
        {/* Glow background */}
        <div 
          className="absolute rounded-full"
          style={{
            width: "140%",
            height: "140%",
            background: `radial-gradient(circle, ${glow} 0%, transparent 70%)`,
            filter: "blur(20px)",
            opacity: 0.6
          }}
        />
        <SparkleEffect color={color} count={6} />
        {children}
      </div>
    );
  }
  
  return (
    <motion.div
      className="relative flex items-center justify-center"
      style={{
        transformStyle: "preserve-3d",
        perspective: 1000
      }}
      initial={{ scale: 0.7, rotateY: -15, opacity: 0 }}
      animate={{ scale: 1, rotateY: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
    >
      {/* Glow background */}
      <motion.div 
        className="absolute rounded-full"
        style={{
          width: "140%",
          height: "140%",
          background: `radial-gradient(circle, ${glow} 0%, transparent 70%)`,
          filter: "blur(20px)",
          opacity: 0.6
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.6 }}
        transition={{ delay: 0.2, duration: 0.5 }}
      />
      <SparkleEffect color={color} count={6} />
      {children}
    </motion.div>
  );
}

// ─── Individual Slide Components ─────────────────────────────────────────────

function SlideContainer({
  children,
  bg,
  onSwipeLeft,
  onSwipeRight
}: {
  children: React.ReactNode;
  bg: string;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}) {
  return (
    <motion.div
      className="relative h-full w-full overflow-hidden rounded-2xl"
      style={{ background: bg }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.9}
      onDragEnd={(_, info) => {
        if (info.offset.x > 50 && onSwipeRight) onSwipeRight();
        if (info.offset.x < -50 && onSwipeLeft) onSwipeLeft();
      }}
      onClick={(e) => {
        // Click on left/right edges to navigate
        const rect = (e.target as HTMLElement).getBoundingClientRect();
        const x = e.clientX - rect.left;
        if (x < rect.width * 0.2 && onSwipeRight) onSwipeRight();
        if (x > rect.width * 0.8 && onSwipeLeft) onSwipeLeft();
      }}
    >
      {children}
    </motion.div>
  );
}

function ProgressIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="absolute top-4 left-0 right-0 z-20 flex items-center justify-center">
      <div className="flex gap-1.5">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className="h-1 rounded-full transition-all duration-300"
            style={{
              width: i === current ? "24px" : "6px",
              background: i === current ? "#ffffff" : "rgba(255,255,255,0.3)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

// Slide 1: Intro
function IntroSlide({
  monthLabel,
  userName,
  userPhotoUrl,
  theme
}: {
  monthLabel: string;
  userName: string;
  userPhotoUrl?: string;
  theme: typeof SLIDE_THEMES.intro;
}) {
  const reduced = useReducedMotion();
  
  return (
    <SlideContainer bg={theme.bg}>
      <div className="relative flex h-full w-full flex-col items-center justify-center p-8 text-center">
        {/* Ambient glow blobs */}
        <div
          className="absolute top-1/4 right-1/4 rounded-full"
          style={{
            width: "60%",
            height: "40%",
            background: `radial-gradient(circle, ${theme.glow} 0%, transparent 70%)`,
            filter: "blur(40px)",
          }}
        />
        <div
          className="absolute bottom-1/4 left-1/4 rounded-full"
          style={{
            width: "40%",
            height: "30%",
            background: `radial-gradient(circle, ${theme.accent}11 0%, transparent 70%)`,
            filter: "blur(30px)",
          }}
        />

        <motion.div
          className="relative z-10 flex flex-col items-center"
          initial={reduced ? undefined : { opacity: 0, y: 30 }}
          animate={reduced ? undefined : { opacity: 1, y: 0 }}
          transition={reduced ? undefined : { duration: 0.8, ease: "easeOut" }}
        >
          <p className="text-sm font-medium" style={{ color: "rgba(231,244,255,.42)" }}>
            Recap de
          </p>
          <motion.h2
            className="font-display mt-2 text-4xl font-extrabold md:text-5xl"
            style={{
              background: "linear-gradient(135deg, #71d4ff, #b69cff, #ffb86b)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
            initial={reduced ? undefined : { opacity: 0, scale: 0.8 }}
            animate={reduced ? undefined : { opacity: 1, scale: 1 }}
            transition={reduced ? undefined : { delay: 0.2, duration: 0.6, ease: "easeOut" }}
          >
            {monthLabel}
          </motion.h2>

          {/* User info */}
          <motion.div 
            className="mt-6 flex items-center gap-3"
            initial={reduced ? undefined : { opacity: 0, y: 20 }}
            animate={reduced ? undefined : { opacity: 1, y: 0 }}
            transition={reduced ? undefined : { delay: 0.4, duration: 0.6 }}
          >
            {userPhotoUrl ? (
              <img
                src={userPhotoUrl}
                alt={userName}
                className="h-10 w-10 rounded-full object-cover ring-2 ring-[rgba(255,255,255,.2)]"
              />
            ) : (
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--accent-secondary)]" />
            )}
            <span className="text-lg font-semibold" style={{ color: "rgba(231,244,255,.8)" }}>
              {userName}
            </span>
          </motion.div>

          <motion.p
            className="mt-4 text-xs tracking-wider"
            style={{ color: "rgba(231,244,255,.4)" }}
            initial={reduced ? undefined : { opacity: 0 }}
            animate={reduced ? undefined : { opacity: 1 }}
            transition={reduced ? undefined : { delay: 0.6 }}
          >
            TOQUE PARA COMEÇAR
          </motion.p>
        </motion.div>
      </div>
    </SlideContainer>
  );
}

// Slide 2: Focus Total
function FocusSlide({
  value,
  theme,
  iconPath
}: {
  value: string;
  theme: typeof SLIDE_THEMES.focus;
  iconPath?: string;
}) {
  const reduced = useReducedMotion();
  
  return (
    <SlideContainer bg={theme.bg}>
      <div className="relative flex h-full w-full flex-col items-center justify-center p-8 text-center">
        {/* Ambient glow */}
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 rounded-full"
          style={{
            width: "80%",
            height: "60%",
            background: `radial-gradient(circle, ${theme.glow} 0%, transparent 70%)`,
            filter: "blur(40px)",
          }}
        />

        <motion.div
          className="relative z-10 flex flex-col items-center"
          initial={reduced ? undefined : { opacity: 0, y: 30 }}
          animate={reduced ? undefined : { opacity: 1, y: 0 }}
          transition={reduced ? undefined : { duration: 0.8, ease: "easeOut" }}
        >
          {/* Icon */}
          <motion.div 
            className="mb-4"
            initial={reduced ? undefined : { scale: 0.5, opacity: 0 }}
            animate={reduced ? undefined : { scale: 1, opacity: 1 }}
            transition={reduced ? undefined : { type: "spring", stiffness: 200, damping: 20 }}
          >
            <Icon3DContainer color={theme.accent} glow={theme.glow} animate={!reduced}>
              {iconPath ? (
                <Image
                  src={iconPath}
                  alt="Foco Total"
                  width={80}
                  height={80}
                  className="relative z-10"
                  unoptimized
                  draggable={false}
                />
              ) : (
                <Timer size={48} color={theme.accent} />
              )}
            </Icon3DContainer>
          </motion.div>

          {/* Hero number with count-up animation */}
          <motion.div
            className="flex items-baseline gap-2"
            initial={reduced ? undefined : { opacity: 0, scale: 0.5 }}
            animate={reduced ? undefined : { opacity: 1, scale: 1 }}
            transition={reduced ? undefined : { delay: 0.2, duration: 0.6 }}
          >
            <AnimatedNumber
              value={parseFloat(value.replace(/[^0-9.]/g, '')) || 0}
              className="font-display text-5xl font-extrabold md:text-7xl"
              style={{ color: theme.accent }}
              duration={1.2}
            />
            {value.includes('h') && <span className="font-display text-3xl font-extrabold" style={{ color: theme.accent }}>{value.replace(/[0-9.]/g, '')}</span>}
          </motion.div>

          <motion.span
            className="mt-2 text-xs uppercase tracking-wider"
            style={{ color: "rgba(231,244,255,.5)" }}
            initial={reduced ? undefined : { opacity: 0, y: 10 }}
            animate={reduced ? undefined : { opacity: 1, y: 0 }}
            transition={reduced ? undefined : { delay: 0.4 }}
          >
            Foco Total
          </motion.span>

          <motion.p
            className="mt-4 max-w-md text-sm"
            style={{ color: "rgba(231,244,255,.6)" }}
            initial={reduced ? undefined : { opacity: 0, y: 10 }}
            animate={reduced ? undefined : { opacity: 1, y: 0 }}
            transition={reduced ? undefined : { delay: 0.6 }}
          >
            Você dedicou isso à sua energia esse mês
          </motion.p>
        </motion.div>
      </div>
    </SlideContainer>
  );
}

// Slide 3: Streak
function StreakSlide({
  value,
  theme,
  iconPath
}: {
  value: string;
  theme: typeof SLIDE_THEMES.streak;
  iconPath?: string;
}) {
  const reduced = useReducedMotion();
  
  return (
    <SlideContainer bg={theme.bg}>
      <div className="relative flex h-full w-full flex-col items-center justify-center p-8 text-center">
        {/* Ambient glow */}
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 rounded-full"
          style={{
            width: "80%",
            height: "60%",
            background: `radial-gradient(circle, ${theme.glow} 0%, transparent 70%)`,
            filter: "blur(40px)",
          }}
        />

        <motion.div
          className="relative z-10 flex flex-col items-center"
          initial={reduced ? undefined : { opacity: 0, y: 30 }}
          animate={reduced ? undefined : { opacity: 1, y: 0 }}
          transition={reduced ? undefined : { duration: 0.8, ease: "easeOut" }}
        >
          {/* Icon */}
          <motion.div 
            className="mb-4"
            initial={reduced ? undefined : { scale: 0.5, opacity: 0 }}
            animate={reduced ? undefined : { scale: 1, opacity: 1 }}
            transition={reduced ? undefined : { type: "spring", stiffness: 200, damping: 20 }}
          >
            <Icon3DContainer color={theme.accent} glow={theme.glow} animate={!reduced}>
              {iconPath ? (
                <Image
                  src={iconPath}
                  alt="Sequência"
                  width={80}
                  height={80}
                  className="relative z-10"
                  unoptimized
                  draggable={false}
                />
              ) : (
                <Image
                  src="/streak/streak_alive.png"
                  alt="Sequência"
                  width={80}
                  height={80}
                  className="relative z-10"
                  unoptimized
                  draggable={false}
                />
              )}
            </Icon3DContainer>
          </motion.div>

          {/* Hero number */}
          <motion.div
            className="flex items-baseline gap-2"
            initial={reduced ? undefined : { opacity: 0, scale: 0.5 }}
            animate={reduced ? undefined : { opacity: 1, scale: 1 }}
            transition={reduced ? undefined : { delay: 0.2, duration: 0.6 }}
          >
            <AnimatedNumber
              value={parseFloat(value) || 0}
              className="font-display text-5xl font-extrabold md:text-7xl"
              style={{ color: theme.accent }}
              duration={1.2}
            />
            {value.includes('dias') && <span className="font-display text-3xl font-extrabold" style={{ color: theme.accent }}>{value.replace(/[0-9.]/g, '')}</span>}
          </motion.div>

          <motion.span
            className="mt-2 text-xs uppercase tracking-wider"
            style={{ color: "rgba(231,244,255,.5)" }}
            initial={reduced ? undefined : { opacity: 0, y: 10 }}
            animate={reduced ? undefined : { opacity: 1, y: 0 }}
            transition={reduced ? undefined : { delay: 0.4 }}
          >
            Sequência
          </motion.span>

          <motion.p
            className="mt-4 max-w-md text-sm"
            style={{ color: "rgba(231,244,255,.6)" }}
            initial={reduced ? undefined : { opacity: 0, y: 10 }}
            animate={reduced ? undefined : { opacity: 1, y: 0 }}
            transition={reduced ? undefined : { delay: 0.6 }}
          >
            Melhor sequência de foco do mês
          </motion.p>
        </motion.div>
      </div>
    </SlideContainer>
  );
}

// Slide 4: League
function LeagueSlide({
  tierLabel,
  theme,
  iconPath,
  tier
}: {
  tierLabel: string;
  theme: ReturnType<typeof SLIDE_THEMES.league>;
  iconPath?: string;
  tier?: NewLeagueTier | null;
}) {
  const reduced = useReducedMotion();
  const meta = tier ? NEW_TIER_META[tier] : null;
  
  return (
    <SlideContainer bg={theme.bg}>
      <div className="relative flex h-full w-full flex-col items-center justify-center p-8 text-center">
        {/* Ambient glow */}
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 rounded-full"
          style={{
            width: "80%",
            height: "60%",
            background: `radial-gradient(circle, ${theme.glow} 0%, transparent 70%)`,
            filter: "blur(40px)",
          }}
        />

        <motion.div
          className="relative z-10 flex flex-col items-center"
          initial={reduced ? undefined : { opacity: 0, y: 30 }}
          animate={reduced ? undefined : { opacity: 1, y: 0 }}
          transition={reduced ? undefined : { duration: 0.8, ease: "easeOut" }}
        >
          {/* Icon */}
          <motion.div 
            className="mb-4"
            initial={reduced ? undefined : { scale: 0.5, opacity: 0 }}
            animate={reduced ? undefined : { scale: 1, opacity: 1 }}
            transition={reduced ? undefined : { type: "spring", stiffness: 200, damping: 20 }}
          >
            <Icon3DContainer color={theme.accent} glow={theme.glow} animate={!reduced}>
              {iconPath ? (
                <Image
                  src={iconPath}
                  alt={tierLabel}
                  width={80}
                  height={80}
                  className="relative z-10"
                  unoptimized
                  draggable={false}
                />
              ) : meta ? (
                <Image
                  src={meta.iconPath}
                  alt={tierLabel}
                  width={80}
                  height={80}
                  className="relative z-10"
                  unoptimized
                  draggable={false}
                />
              ) : (
                <Award size={48} color={theme.accent} />
              )}
            </Icon3DContainer>
          </motion.div>

          {/* League name */}
          <motion.h3
            className="font-display text-4xl font-extrabold md:text-6xl"
            style={{ 
              color: theme.accent,
              textShadow: `0 0 20px ${theme.accent}`
            }}
            initial={reduced ? undefined : { opacity: 0, scale: 0.5 }}
            animate={reduced ? undefined : { opacity: 1, scale: 1 }}
            transition={reduced ? undefined : { delay: 0.2, duration: 0.6 }}
          >
            {tierLabel}
          </motion.h3>

          <motion.span
            className="mt-2 text-xs uppercase tracking-wider"
            style={{ color: "rgba(231,244,255,.5)" }}
            initial={reduced ? undefined : { opacity: 0, y: 10 }}
            animate={reduced ? undefined : { opacity: 1, y: 0 }}
            transition={reduced ? undefined : { delay: 0.4 }}
          >
            Liga
          </motion.span>

          <motion.p
            className="mt-4 max-w-md text-sm"
            style={{ color: "rgba(231,244,255,.6)" }}
            initial={reduced ? undefined : { opacity: 0, y: 10 }}
            animate={reduced ? undefined : { opacity: 1, y: 0 }}
            transition={reduced ? undefined : { delay: 0.6 }}
          >
            Você terminou o mês na liga {tierLabel}
          </motion.p>
        </motion.div>
      </div>
    </SlideContainer>
  );
}

// Slide 5: Tag/Achievement
function TagSlide({
  value,
  theme,
  iconPath
}: {
  value: string;
  theme: typeof SLIDE_THEMES.tag;
  iconPath?: string;
}) {
  const reduced = useReducedMotion();
  
  return (
    <SlideContainer bg={theme.bg}>
      <div className="relative flex h-full w-full flex-col items-center justify-center p-8 text-center">
        {/* Ambient glow */}
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 rounded-full"
          style={{
            width: "80%",
            height: "60%",
            background: `radial-gradient(circle, ${theme.glow} 0%, transparent 70%)`,
            filter: "blur(40px)",
          }}
        />

        <motion.div
          className="relative z-10 flex flex-col items-center"
          initial={reduced ? undefined : { opacity: 0, y: 30 }}
          animate={reduced ? undefined : { opacity: 1, y: 0 }}
          transition={reduced ? undefined : { duration: 0.8, ease: "easeOut" }}
        >
          {/* Icon */}
          <motion.div 
            className="mb-4"
            initial={reduced ? undefined : { scale: 0.5, opacity: 0 }}
            animate={reduced ? undefined : { scale: 1, opacity: 1 }}
            transition={reduced ? undefined : { type: "spring", stiffness: 200, damping: 20 }}
          >
            <Icon3DContainer color={theme.accent} glow={theme.glow} animate={!reduced}>
              {iconPath ? (
                <Image
                  src={iconPath}
                  alt={value}
                  width={80}
                  height={80}
                  className="relative z-10"
                  unoptimized
                  draggable={false}
                />
              ) : (
                <Award size={48} color={theme.accent} />
              )}
            </Icon3DContainer>
          </motion.div>

          {/* Achievement name */}
          <motion.h3
            className="font-display text-2xl font-extrabold md:text-3xl max-w-xs"
            style={{ 
              color: theme.accent,
              textShadow: `0 0 20px ${theme.accent}`
            }}
            initial={reduced ? undefined : { opacity: 0, scale: 0.5 }}
            animate={reduced ? undefined : { opacity: 1, scale: 1 }}
            transition={reduced ? undefined : { delay: 0.2, duration: 0.6 }}
          >
            {value}
          </motion.h3>

          <motion.span
            className="mt-2 text-xs uppercase tracking-wider"
            style={{ color: "rgba(231,244,255,.5)" }}
            initial={reduced ? undefined : { opacity: 0, y: 10 }}
            animate={reduced ? undefined : { opacity: 1, y: 0 }}
            transition={reduced ? undefined : { delay: 0.4 }}
          >
            Tag em Destaque
          </motion.span>

          <motion.p
            className="mt-4 max-w-md text-sm"
            style={{ color: "rgba(231,244,255,.6)" }}
            initial={reduced ? undefined : { opacity: 0, y: 10 }}
            animate={reduced ? undefined : { opacity: 1, y: 0 }}
            transition={reduced ? undefined : { delay: 0.6 }}
          >
            Conquista destacada do mês
          </motion.p>
        </motion.div>
      </div>
    </SlideContainer>
  );
}

// Slide 6: Summary/Export
function SummarySlide({
  recap,
  userName,
  userPhotoUrl,
  onDownload,
  onShare,
  theme,
  iconAssets
}: {
  recap: MonthlyRecapPremiumProps["recap"];
  userName: string;
  userPhotoUrl?: string;
  onDownload: () => void;
  onShare: () => void;
  theme: typeof SLIDE_THEMES.summary;
  iconAssets?: RecapIconAssets;
}) {
  const reduced = useReducedMotion();
  const { meta, tier } = tierMeta(recap.leagueTier);
  const tierColor = meta ? meta.color : "#71d4ff";

  // Format values
  const focusValue = formatMinutes(recap.totalFocusMinutes);
  const streakValue = `${recap.longestStreak} dias`;
  const leagueValue = meta ? meta.label : "—";
  const tagValue = recap.productivityTag ?? "—";

  return (
    <SlideContainer bg={theme.bg}>
      <div className="relative flex h-full w-full flex-col items-center justify-center p-6 text-center">
        {/* Ambient glow blobs */}
        <div
          className="absolute top-1/4 right-1/4 rounded-full"
          style={{
            width: "50%",
            height: "30%",
            background: `radial-gradient(circle, ${theme.glow} 0%, transparent 70%)`,
            filter: "blur(30px)",
          }}
        />
        <div
          className="absolute bottom-1/4 left-1/4 rounded-full"
          style={{
            width: "40%",
            height: "25%",
            background: `radial-gradient(circle, rgba(182,156,255,.07) 0%, transparent 70%)`,
            filter: "blur(30px)",
          }}
        />

        <motion.div
          className="relative z-10 flex w-full flex-col items-center"
          initial={reduced ? undefined : { opacity: 0, y: 30 }}
          animate={reduced ? undefined : { opacity: 1, y: 0 }}
          transition={reduced ? undefined : { duration: 0.8, ease: "easeOut" }}
        >
          {/* Title */}
          <p className="text-xs font-medium" style={{ color: "rgba(231,244,255,.42)" }}>
            Recap de
          </p>
          <h2
            className="font-display mt-1 text-2xl font-extrabold md:text-3xl"
            style={{
              background: "linear-gradient(135deg, #71d4ff, #b69cff, #ffb86b)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            {formatMonth(recap.recapMonth)}
          </h2>

          {/* User info */}
          <div className="mt-4 flex items-center gap-2">
            {userPhotoUrl ? (
              <img
                src={userPhotoUrl}
                alt={userName}
                className="h-8 w-8 rounded-full object-cover ring-1 ring-[rgba(255,255,255,.15)]"
              />
            ) : null}
            <span className="text-sm font-medium" style={{ color: "rgba(231,244,255,.72)" }}>
              {userName}
            </span>
          </div>

          {/* Stats grid - premium 2x2 layout */}
          <div className="mt-6 grid w-full grid-cols-2 gap-3">
            {/* Focus */}
            <motion.div
              className="relative overflow-hidden rounded-2xl border border-[rgba(255,255,255,.1)] bg-[rgba(255,255,255,.04)] p-3"
              style={{
                boxShadow: `0 0 20px -8px rgba(113,212,255,.15)`,
                backdropFilter: "blur(10px)"
              }}
              initial={reduced ? undefined : { opacity: 0, y: 20 }}
              animate={reduced ? undefined : { opacity: 1, y: 0 }}
              transition={reduced ? undefined : { delay: 0.2 }}
            >
              <div className="flex items-center gap-2">
                {iconAssets?.focusIcon ? (
                  <Image src={iconAssets.focusIcon} alt="Foco" width={24} height={24} unoptimized draggable={false} />
                ) : (
                  <Timer size={20} style={{ color: "#71d4ff" }} />
                )}
                <span className="text-xs font-medium" style={{ color: "rgba(231,244,255,.7)" }}>
                  Foco Total
                </span>
              </div>
              <p className="mt-1 font-display text-lg font-extrabold" style={{ color: "#71d4ff" }}>
                {focusValue}
              </p>
            </motion.div>

            {/* Streak */}
            <motion.div
              className="relative overflow-hidden rounded-2xl border border-[rgba(255,255,255,.1)] bg-[rgba(255,255,255,.04)] p-3"
              style={{
                boxShadow: `0 0 20px -8px rgba(255,140,66,.15)`,
                backdropFilter: "blur(10px)"
              }}
              initial={reduced ? undefined : { opacity: 0, y: 20 }}
              animate={reduced ? undefined : { opacity: 1, y: 0 }}
              transition={reduced ? undefined : { delay: 0.3 }}
            >
              <div className="flex items-center gap-2">
                {iconAssets?.streakIcon ? (
                  <Image src={iconAssets.streakIcon} alt="Sequência" width={24} height={24} unoptimized draggable={false} />
                ) : (
                  <Image src="/streak/streak_alive.png" alt="Sequência" width={24} height={24} unoptimized draggable={false} />
                )}
                <span className="text-xs font-medium" style={{ color: "rgba(231,244,255,.7)" }}>
                  Sequência
                </span>
              </div>
              <p className="mt-1 font-display text-lg font-extrabold" style={{ color: "#ff8c42" }}>
                {streakValue}
              </p>
            </motion.div>

            {/* League */}
            <motion.div
              className="relative overflow-hidden rounded-2xl border border-[rgba(255,255,255,.1)] bg-[rgba(255,255,255,.04)] p-3"
              style={{
                boxShadow: `0 0 20px -8px ${tierColor}11`,
                backdropFilter: "blur(10px)"
              }}
              initial={reduced ? undefined : { opacity: 0, y: 20 }}
              animate={reduced ? undefined : { opacity: 1, y: 0 }}
              transition={reduced ? undefined : { delay: 0.4 }}
            >
              <div className="flex items-center gap-2">
                {iconAssets?.leagueIcon ? (
                  <Image src={iconAssets.leagueIcon} alt="Liga" width={24} height={24} unoptimized draggable={false} />
                ) : meta ? (
                  <Image src={meta.iconPath} alt={leagueValue} width={24} height={24} unoptimized draggable={false} />
                ) : (
                  <Award size={20} style={{ color: tierColor }} />
                )}
                <span className="text-xs font-medium" style={{ color: "rgba(231,244,255,.7)" }}>
                  Liga
                </span>
              </div>
              <p className="mt-1 font-display text-lg font-extrabold" style={{ color: tierColor }}>
                {leagueValue}
              </p>
              {recap.leaguePromoted && (
                <p className="text-[10px] font-semibold" style={{ color: "#4ade80" }}>
                  ⬆ Promovido!
                </p>
              )}
            </motion.div>

            {/* Tag */}
            <motion.div
              className="relative overflow-hidden rounded-2xl border border-[rgba(255,255,255,.1)] bg-[rgba(255,255,255,.04)] p-3"
              style={{
                boxShadow: `0 0 20px -8px rgba(182,156,255,.15)`,
                backdropFilter: "blur(10px)"
              }}
              initial={reduced ? undefined : { opacity: 0, y: 20 }}
              animate={reduced ? undefined : { opacity: 1, y: 0 }}
              transition={reduced ? undefined : { delay: 0.5 }}
            >
              <div className="flex items-center gap-2">
                {iconAssets?.tagIcon ? (
                  <Image src={iconAssets.tagIcon} alt="Tag" width={24} height={24} unoptimized draggable={false} />
                ) : (
                  <Award size={20} style={{ color: "#b69cff" }} />
                )}
                <span className="text-xs font-medium" style={{ color: "rgba(231,244,255,.7)" }}>
                  Tag
                </span>
              </div>
              <p className="mt-1 font-display text-base font-extrabold truncate" style={{ color: "#b69cff" }}>
                {tagValue}
              </p>
            </motion.div>
          </div>

          {/* Action buttons */}
          <motion.div 
            className="mt-6 flex gap-3"
            initial={reduced ? undefined : { opacity: 0, y: 20 }}
            animate={reduced ? undefined : { opacity: 1, y: 0 }}
            transition={reduced ? undefined : { delay: 0.6 }}
          >
            <button
              onClick={onDownload}
              className="primary-button min-w-[120px]"
            >
              <Download size={15} />
              Baixar
            </button>
            <button
              onClick={onShare}
              className="icon-button min-w-[120px]"
              style={{ width: "auto", padding: "0 14px", gap: "6px", fontSize: "12px", fontWeight: 700 }}
            >
              <Share2 size={15} />
              Compartilhar
            </button>
          </motion.div>

          {/* Footer */}
          <motion.p
            className="mt-4 text-xs tracking-wider"
            style={{ color: "rgba(231,244,255,.3)" }}
            initial={reduced ? undefined : { opacity: 0 }}
            animate={reduced ? undefined : { opacity: 1 }}
            transition={reduced ? undefined : { delay: 0.8 }}
          >
            energyOS
          </motion.p>
        </motion.div>
      </div>
    </SlideContainer>
  );
}

// ─── Canvas Capture for Export ───────────────────────────────────────────────

// Constants for card dimensions
const CARD_W = 1080;
const CARD_H = 1920; // 9:16 aspect ratio for stories

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
    img.onerror = () => reject(new Error("img load failed"));
    img.src = src;
  });
}

export async function captureRecapCard(
  recap: MonthlyRecapPremiumProps["recap"],
  userName: string,
  userPhotoUrl?: string,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d")!;
  const pad = 72;

  const { meta, tier } = tierMeta(recap.leagueTier);
  const tierColor = meta ? meta.color : "#71d4ff";
  const monthLabel = formatMonth(recap.recapMonth);

  // Format values
  const focusValue = formatMinutes(recap.totalFocusMinutes);
  const streakValue = `${recap.longestStreak} dias`;
  const leagueValue = meta ? meta.label : "—";
  const tagValue = recap.productivityTag ?? "—";

  // ── Background gradient ──
  const bg = ctx.createLinearGradient(0, 0, 0, CARD_H);
  bg.addColorStop(0, "#0a0e1a");
  bg.addColorStop(1, "#111827");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // ── Subtle grid noise ──
  ctx.strokeStyle = "rgba(113,212,255,.035)";
  ctx.lineWidth = 1;
  for (let y = 0; y < CARD_H; y += 44) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(CARD_W, y);
    ctx.stroke();
  }

  // ── Ambient glow blobs ──
  const drawGlow = (cx: number, cy: number, r: number, color: string) => {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, color);
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  };
  drawGlow(CARD_W * 0.78, 150, 280, "rgba(113,212,255,.07)");
  drawGlow(CARD_W * 0.22, CARD_H * 0.55, 260, "rgba(182,156,255,.05)");
  drawGlow(CARD_W * 0.85, CARD_H * 0.78, 220, "rgba(255,184,107,.05)");

  // ── Top accent line ──
  const accentGrad = ctx.createLinearGradient(0, 0, CARD_W, 0);
  accentGrad.addColorStop(0, "rgba(113,212,255,0)");
  accentGrad.addColorStop(0.5, "rgba(113,212,255,.6)");
  accentGrad.addColorStop(1, "rgba(113,212,255,0)");
  ctx.fillStyle = accentGrad;
  ctx.fillRect(0, 0, CARD_W, 3);

  let y = 112;

  // ── Title ──
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(231,244,255,.42)";
  ctx.font = "500 34px 'Inter', -apple-system, sans-serif";
  ctx.fillText("Recap de", CARD_W / 2, y);
  y += 68;

  const titleGrad = ctx.createLinearGradient(CARD_W * 0.2, 0, CARD_W * 0.8, 0);
  titleGrad.addColorStop(0, "#71d4ff");
  titleGrad.addColorStop(0.5, "#b69cff");
  titleGrad.addColorStop(1, "#ffb86b");
  ctx.fillStyle = titleGrad;
  ctx.font = "800 72px 'Inter', -apple-system, sans-serif";
  ctx.fillText(monthLabel, CARD_W / 2, y);
  y += 70;

  // ── Divider ──
  const divGrad = ctx.createLinearGradient(CARD_W * 0.3, 0, CARD_W * 0.7, 0);
  divGrad.addColorStop(0, "rgba(113,212,255,0)");
  divGrad.addColorStop(0.5, "rgba(113,212,255,.35)");
  divGrad.addColorStop(1, "rgba(113,212,255,0)");
  ctx.fillStyle = divGrad;
  ctx.fillRect(CARD_W * 0.3, y, CARD_W * 0.4, 2);
  y += 50;

  // ── User ──
  if (userPhotoUrl) {
    try {
      const img = await loadImage(userPhotoUrl);
      ctx.save();
      ctx.beginPath();
      ctx.arc(CARD_W / 2 - ctx.measureText(userName).width / 2 - 30, y - 16, 22, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, CARD_W / 2 - ctx.measureText(userName).width / 2 - 52, y - 38, 44, 44);
      ctx.restore();
    } catch { /* fallback: no avatar */ }
  }
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(231,244,255,.72)";
  ctx.font = "600 30px 'Inter', -apple-system, sans-serif";
  ctx.fillText(userName, CARD_W / 2, y + 8);
  y += 76;

  // ── Stats grid ──
  const colW = (CARD_W - pad * 2) / 2;
  const rowH = 272;
  const gridTop = y + 22;

  // Preload images for icons
  const tierImg = tier && meta ? await loadImage(meta.iconPath).catch(() => null) : null;
  const streakImg = await loadImage("/streak/streak_alive.png").catch(() => null);

  const stats = [
    {
      label: "Foco total",
      value: focusValue,
      color: "#71d4ff",
      glow: "rgba(113,212,255,.35)",
      icon: null as HTMLImageElement | null,
      kind: "focus"
    },
    {
      label: "Sequência",
      value: streakValue,
      color: "#ff8c42",
      glow: "rgba(255,140,66,.35)",
      icon: streakImg,
      kind: "streak"
    },
    {
      label: "Liga",
      value: leagueValue,
      color: tierColor,
      glow: `${tierColor}55`,
      icon: tierImg,
      kind: "tier"
    },
    {
      label: "Tag",
      value: tagValue,
      color: "#b69cff",
      glow: "rgba(182,156,255,.35)",
      icon: null as HTMLImageElement | null,
      kind: "tag"
    },
  ];

  for (const s of stats) {
    const sx = pad + (s.kind === "streak" || s.kind === "tag" ? 1 : 0) * colW;
    const sy = gridTop + (s.kind === "tier" || s.kind === "tag" ? 1 : 0) * rowH;
    const cw = colW - 16;
    const ch = rowH - 20;
    const cardR = 22;

    // ── Soft drop shadow + colored ambient shadow ──
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,.5)";
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 10;
    roundRect(ctx, sx, sy, cw, ch, cardR);
    ctx.fillStyle = "rgba(15,23,42,.6)";
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.shadowColor = s.glow;
    ctx.shadowBlur = 30;
    roundRect(ctx, sx, sy, cw, ch, cardR);
    ctx.fillStyle = "rgba(255,255,255,.045)";
    ctx.fill();
    ctx.restore();

    // ── Glass tile fill + thin glowing border ──
    roundRect(ctx, sx, sy, cw, ch, cardR);
    ctx.fillStyle = "rgba(255,255,255,.04)";
    ctx.fill();
    ctx.save();
    ctx.shadowColor = s.glow;
    ctx.shadowBlur = 12;
    ctx.strokeStyle = hexToRgba(s.color, 0.5);
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.restore();

    // ── Glow behind main content ──
    const glowGrad = ctx.createRadialGradient(sx + cw / 2, sy + ch * 0.6, 0, sx + cw / 2, sy + ch * 0.6, 110);
    glowGrad.addColorStop(0, s.glow);
    glowGrad.addColorStop(1, "transparent");
    ctx.fillStyle = glowGrad;
    ctx.fillRect(sx, sy, cw, ch);

    // ── Icon chip ──
    const chipX = sx + 34;
    const chipY = sy + 56;
    const chipR = 26;
    const chipGrad = ctx.createRadialGradient(chipX, chipY, 2, chipX, chipY, chipR);
    chipGrad.addColorStop(0, s.color + "55");
    chipGrad.addColorStop(1, s.color + "0d");
    ctx.save();
    ctx.beginPath();
    ctx.arc(chipX, chipY, chipR, 0, Math.PI * 2);
    ctx.fillStyle = chipGrad;
    ctx.shadowColor = s.glow;
    ctx.shadowBlur = 14;
    ctx.fill();
    ctx.strokeStyle = hexToRgba(s.color, 0.4);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // ── Icon content ──
    if (s.icon) {
      const s2 = 36;
      ctx.drawImage(s.icon, chipX - s2 / 2, chipY - s2 / 2, s2, s2);
    }

    // ── Label ──
    ctx.fillStyle = "rgba(231,244,255,.45)";
    ctx.font = "500 23px 'Inter', -apple-system, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(s.label, sx + 76, sy + 52);

    // ── Value ──
    ctx.fillStyle = s.color;
    ctx.font = "800 56px 'Inter', -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(s.value, sx + cw / 2, sy + ch - 52);
  }

  y = gridTop + 2 * rowH + 38;

  // ── Promotion badge ──
  if (recap.leaguePromoted) {
    ctx.textAlign = "center";
    ctx.fillStyle = "#4ade80";
    ctx.font = "700 28px 'Inter', -apple-system, sans-serif";
    ctx.fillText("⬆ Promovido!", CARD_W / 2, y + 10);
  }

  // ── Footer ──
  const footY = CARD_H - 110;
  const footLine = ctx.createLinearGradient(CARD_W * 0.25, 0, CARD_W * 0.75, 0);
  footLine.addColorStop(0, "rgba(113,212,255,0)");
  footLine.addColorStop(0.5, "rgba(113,212,255,.18)");
  footLine.addColorStop(1, "rgba(113,212,255,0)");
  ctx.fillStyle = footLine;
  ctx.fillRect(CARD_W * 0.25, footY, CARD_W * 0.5, 1);

  const brandGlow = ctx.createRadialGradient(CARD_W / 2, footY + 55, 0, CARD_W / 2, footY + 55, 160);
  brandGlow.addColorStop(0, "rgba(113,212,255,.08)");
  brandGlow.addColorStop(1, "transparent");
  ctx.fillStyle = brandGlow;
  ctx.fillRect(CARD_W / 2 - 160, footY + 10, 320, 90);

  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(231,244,255,.22)";
  ctx.font = "800 36px 'Inter', -apple-system, sans-serif";
  ctx.fillText("energyOS", CARD_W / 2, footY + 60);

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob!), "image/png"));
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function MonthlyRecapPremium({
  recap,
  userName,
  userPhotoUrl,
  onShare: onExternalShare,
  onCoinsAwarded,
}: MonthlyRecapPremiumProps) {
  const [open, setOpen] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isSharing, setIsSharing] = useState(false);
  const [rewardToast, setRewardToast] = useState<{ amount: number; balance: number } | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const reduced = useReducedMotion();
  const { data: session } = useSession();
  
  const cardRef = useRef<HTMLDivElement>(null);

  // Slide data
  const monthLabel = formatMonth(recap.recapMonth);
  const { meta, tier } = tierMeta(recap.leagueTier);
  const theme = SLIDE_THEMES;
  
  // Icon assets - these would be provided as props when real PNGs are available
  const iconAssets: RecapIconAssets = {
    focusIcon: "/icons/focus-icon.png",      // Placeholder - will be replaced with real assets
    streakIcon: "/streak/streak_alive.png", // Using existing streak icon
    leagueIcon: meta?.iconPath,             // Using tier icon
    tagIcon: "/icons/tag-icon.png"          // Placeholder - will be replaced with real assets
  };

  // Calculate themes for each slide
  const getLeagueTheme = () => theme.league(tier);

  // Navigation handlers
  const goToNextSlide = useCallback(() => {
    if (currentSlide < SLIDE_COUNT - 1) {
      setCurrentSlide(currentSlide + 1);
    }
  }, [currentSlide]);

  const goToPrevSlide = useCallback(() => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  }, [currentSlide]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!open) return;
    if (e.key === "ArrowLeft") goToPrevSlide();
    if (e.key === "ArrowRight") goToNextSlide();
    if (e.key === "Escape") setOpen(false);
  }, [open, goToPrevSlide, goToNextSlide]);

  useEffect(() => {
    if (open) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [open, handleKeyDown]);

  // Handle share with reward logic
  const handleShare = useCallback(async () => {
    if (isSharing) return;
    
    setIsSharing(true);
    
    try {
      // For now, we'll award coins immediately on tap since Web Share API
      // doesn't reliably let us detect if the share was completed
      // The backend will handle the one-time tracking
      
      if (session?.user?.id && recap.id && !recap.hasBeenShared) {
        // Award coins and mark as shared
        const response = await fetch("/api/recap/share", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recapId: recap.id }),
        });
        
        if (response.ok) {
          const result = await response.json();
          if (result.wasFirstShare && result.newBalance !== undefined) {
            // Show reward toast
            setRewardToast({ amount: SHARE_REWARD_COINS, balance: result.newBalance });
            
            // Update local recap state if needed
            if (onCoinsAwarded) {
              onCoinsAwarded(SHARE_REWARD_COINS, result.newBalance);
            }
          }
        }
      }
      
      // Capture the card for sharing
      const blob = await captureRecapCard(recap, userName, userPhotoUrl);
      
      // Trigger external share if provided
      if (onExternalShare) {
        onExternalShare(blob);
      }
      
      // Fallback to native share
      if (navigator.share && navigator.canShare) {
        try {
          const file = new File([blob], `recap-${recap.recapMonth.slice(0, 7)}.png`, { type: "image/png" });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: `Meu recap de ${monthLabel} no energyOS`,
              text: `Confira meu progresso no energyOS - ${formatMinutes(recap.totalFocusMinutes)} de foco, ${recap.longestStreak} dias de sequência!`,
            });
          }
        } catch (error) {
          // User cancelled share - that's fine
          console.log("Share cancelled by user");
        }
      }
    } finally {
      setIsSharing(false);
    }
  }, [session, recap, isSharing, monthLabel, onExternalShare, onCoinsAwarded]);

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

  // Render the appropriate slide
  const renderSlide = () => {
    switch (currentSlide) {
      case 0:
        return (
          <IntroSlide
            monthLabel={monthLabel}
            userName={userName}
            userPhotoUrl={userPhotoUrl}
            theme={theme.intro}
          />
        );
      case 1:
        return (
          <FocusSlide
            value={formatMinutes(recap.totalFocusMinutes)}
            theme={theme.focus}
            iconPath={iconAssets.focusIcon}
          />
        );
      case 2:
        return (
          <StreakSlide
            value={`${recap.longestStreak} dias`}
            theme={theme.streak}
            iconPath={iconAssets.streakIcon}
          />
        );
      case 3:
        return (
          <LeagueSlide
            tierLabel={meta ? meta.label : "—"}
            theme={getLeagueTheme()}
            iconPath={iconAssets.leagueIcon}
            tier={tier}
          />
        );
      case 4:
        return (
          <TagSlide
            value={recap.productivityTag ?? "—"}
            theme={theme.tag}
            iconPath={iconAssets.tagIcon}
          />
        );
      case 5:
        return (
          <SummarySlide
            recap={recap}
            userName={userName}
            userPhotoUrl={userPhotoUrl}
            onDownload={handleDownload}
            onShare={handleShare}
            theme={theme.summary}
            iconAssets={iconAssets}
          />
        );
      default:
        return null;
    }
  };

  return (
    <>
      {/* Trigger button - same as original but updated label */}
      <motion.button
        whileHover={reduced ? undefined : { scale: 1.01 }}
        whileTap={reduced ? undefined : { scale: 0.98 }}
        onClick={() => setOpen(true)}
        className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] px-4 py-3.5 text-left transition-colors hover:border-[var(--accent-border)] hover:bg-[var(--bg-surface-hover)]"
      >
        <div
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
          style={{ background: "rgba(255,255,255,.05)" }}
        >
          {meta ? (
            <Image
              src={meta.iconPath}
              alt={meta.label}
              width={20}
              height={20}
              unoptimized
              draggable={false}
            />
          ) : (
            <Award size={18} style={{ color: "#71d4ff" }} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[var(--text)]">
            Ver recap de {monthLabel}
          </p>
          <p className="truncate text-xs text-[var(--text-muted)]">
            {formatMinutes(recap.totalFocusMinutes)} de foco · {recap.longestStreak} dias de sequência
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-[var(--accent-border)] bg-[var(--accent)]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">
          Premium
        </span>
      </motion.button>

      {/* Modal Overlay */}
      <AnimatePresence>
        {open && (
          <Modal onClose={() => setOpen(false)}>
            <div className="flex w-full max-w-[420px] flex-col items-center gap-4">
              {/* Close button */}
              <button
                onClick={() => setOpen(false)}
                className="icon-button self-end z-30"
                aria-label="Fechar"
                style={{ background: "rgba(0,0,0,0.3)", backdropFilter: "blur(10px)" }}
              >
                <X size={20} />
              </button>

              {/* Slide container with perspective */}
              <div 
                className="relative w-full overflow-hidden rounded-2xl"
                style={{
                  aspectRatio: "9/16",
                  perspective: 1000,
                  boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)"
                }}
              >
                {/* Progress indicator */}
                <ProgressIndicator current={currentSlide} total={SLIDE_COUNT} />
                
                {/* Navigation arrows - desktop */}
                {!reduced && (
                  <>
                    <button
                      onClick={goToPrevSlide}
                      className="absolute left-2 top-1/2 -translate-y-1/2 z-20 rounded-full bg-[rgba(0,0,0,0.3)] p-2 backdrop-blur-sm transition-all hover:bg-[rgba(0,0,0,0.5)]"
                      disabled={currentSlide === 0}
                      aria-label="Slide anterior"
                    >
                      <ChevronLeft size={20} className="text-white/70" />
                    </button>
                    <button
                      onClick={goToNextSlide}
                      className="absolute right-2 top-1/2 -translate-y-1/2 z-20 rounded-full bg-[rgba(0,0,0,0.3)] p-2 backdrop-blur-sm transition-all hover:bg-[rgba(0,0,0,0.5)]"
                      disabled={currentSlide === SLIDE_COUNT - 1}
                      aria-label="Próximo slide"
                    >
                      <ChevronRight size={20} className="text-white/70" />
                    </button>
                  </>
                )}

                {/* Slide content with transition */}
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={currentSlide}
                    className="absolute inset-0"
                    initial={{ x: currentSlide > 0 ? "100%" : "-100%", opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: currentSlide < SLIDE_COUNT - 1 ? "-100%" : "100%", opacity: 0 }}
                    transition={{ 
                      type: "spring", 
                      stiffness: 300, 
                      damping: 30,
                      duration: 0.6
                    }}
                    style={{ 
                      transformStyle: "preserve-3d",
                      perspective: 1000
                    }}
                  >
                    {renderSlide()}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Swipe hint for first slide */}
              {currentSlide === 0 && (
                <motion.p 
                  className="text-xs tracking-wider"
                  style={{ color: "rgba(231,244,255,.3)" }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.5 }}
                >
                  ARRASTE OU CLIQUE NAS LATERAL PARA NAVEGAR
                </motion.p>
              )}
            </div>

            {/* Reward Toast */}
            <RewardToast
              toast={rewardToast}
              onDone={() => setRewardToast(null)}
            />
          </Modal>
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Helper functions for standalone usage ────────────────────────────────────

// Re-export the download and share functions using the canvas capture
export async function downloadRecapImage(
  recap: MonthlyRecapPremiumProps["recap"],
  userName: string,
  userPhotoUrl?: string,
) {
  const blob = await captureRecapCard(recap, userName, userPhotoUrl);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `recap-${recap.recapMonth.slice(0, 7)}.png`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function shareRecapImage(
  recap: MonthlyRecapPremiumProps["recap"],
  userName: string,
  userPhotoUrl?: string,
) {
  const blob = await captureRecapCard(recap, userName, userPhotoUrl);
  if (navigator.share && navigator.canShare) {
    const file = new File([blob], `recap-${recap.recapMonth.slice(0, 7)}.png`, { type: "image/png" });
    if (navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        text: `Meu recap de ${formatMonth(recap.recapMonth)} no energyOS`,
      });
      return;
    }
  }
  await downloadRecapImage(recap, userName, userPhotoUrl);
}