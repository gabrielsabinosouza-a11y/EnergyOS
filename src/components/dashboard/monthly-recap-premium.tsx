"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { X, Download, Share2, ChevronLeft, ChevronRight, Timer, Award } from "lucide-react";
import Image from "next/image";
import { Modal } from "@/components/modal";
import { RewardToast } from "@/components/reward-toast";
import { AnimatedNumber } from "@/components/ui";
import { NEW_TIER_META, resolveNewTier } from "@/lib/league-new-meta";
import type { NewLeagueTier } from "@/types";
import { useAuthRedirect } from "@/lib/auth-context";

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
    gardenCount?: number;
    hasBeenShared?: boolean;
  };
  userName: string;
  userPhotoUrl?: string;
  onShare?: (blob: Blob) => void;
  onCoinsAwarded?: (amount: number, newBalance: number) => void;
}

interface RecapIconAssets {
  focusIcon?: string;
  streakIcon?: string;
  leagueIcon?: string;
  tagIcon?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SLIDE_COUNT = 6;
const SHARE_REWARD_COINS = 50;

const SLIDE_THEMES = {
  intro: {
    bg: "linear-gradient(135deg, #0a0e1a 0%, #111827 100%)",
    accent: "#71d4ff",
    glow: "rgba(113,212,255,0.35)",
  },
  focus: {
    bg: "linear-gradient(135deg, #0a1628 0%, #1a3a5a 100%)",
    accent: "#71d4ff",
    glow: "rgba(113,212,255,0.4)",
  },
  streak: {
    bg: "linear-gradient(135deg, #1a0e08 0%, #3a2110 100%)",
    accent: "#ff8c42",
    glow: "rgba(255,140,66,0.4)",
  },
  league: (tier: NewLeagueTier | null) => {
    const meta = tier ? NEW_TIER_META[tier] : NEW_TIER_META.BRONZE;
    return {
      bg: `linear-gradient(135deg, ${meta.color}22 0%, ${meta.color}44 100%)`,
      accent: meta.color,
      glow: meta.glow,
    };
  },
  tag: {
    bg: "linear-gradient(135deg, #1a0e28 0%, #3a1a5a 100%)",
    accent: "#b69cff",
    glow: "rgba(182,156,255,0.4)",
  },
  summary: {
    bg: "linear-gradient(135deg, #0a0e1a 0%, #111827 100%)",
    accent: "#71d4ff",
    glow: "rgba(113,212,255,0.35)",
  },
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

// ─── Sparkle Effect ──────────────────────────────────────────────────────────

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
              y: [-10, -20, -10, 0],
            }}
            transition={{ duration, delay, repeat: Infinity, ease: "easeInOut" }}
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
  animate = true,
}: {
  children: React.ReactNode;
  color: string;
  glow: string;
  animate?: boolean;
}) {
  const reduced = useReducedMotion();
  const shouldAnimate = animate && !reduced;

  if (!shouldAnimate) {
    return (
      <div className="relative flex items-center justify-center">
        <div
          className="absolute rounded-full"
          style={{
            width: "140%",
            height: "140%",
            background: `radial-gradient(circle, ${glow} 0%, transparent 70%)`,
            filter: "blur(20px)",
            opacity: 0.6,
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
      initial={{ scale: 0.7, rotateY: -15, opacity: 0 }}
      animate={{ scale: 1, rotateY: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
    >
      <motion.div
        className="absolute rounded-full"
        style={{
          width: "140%",
          height: "140%",
          background: `radial-gradient(circle, ${glow} 0%, transparent 70%)`,
          filter: "blur(20px)",
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

// ─── Slide Wrapper ───────────────────────────────────────────────────────────

function SlideFrame({
  children,
  bg,
}: {
  children: React.ReactNode;
  bg: string;
}) {
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden p-8 text-center"
      style={{ background: bg }}
    >
      {children}
    </div>
  );
}

// ─── Progress Bar (Duolingo-style top segments) ──────────────────────────────

function ProgressBar({ current, total }: { current: number; total: number }) {
  return (
    <div className="absolute top-3 left-3 right-3 z-20 flex gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="h-[3px] flex-1 rounded-full transition-all duration-500"
          style={{
            background: i <= current ? "#ffffff" : "rgba(255,255,255,0.2)",
            opacity: i === current ? 1 : i < current ? 0.7 : 0.4,
          }}
        />
      ))}
    </div>
  );
}

// ─── Ambient Background ──────────────────────────────────────────────────────

function AmbientGlow({ accent, glow }: { accent: string; glow: string }) {
  return (
    <>
      <div
        className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 rounded-full"
        style={{
          width: "80%",
          height: "60%",
          background: `radial-gradient(circle, ${glow} 0%, transparent 70%)`,
          filter: "blur(40px)",
        }}
      />
      <div
        className="pointer-events-none absolute bottom-1/4 left-1/4 rounded-full"
        style={{
          width: "40%",
          height: "30%",
          background: `radial-gradient(circle, ${accent}11 0%, transparent 70%)`,
          filter: "blur(30px)",
        }}
      />
    </>
  );
}

// ─── Individual Slides ───────────────────────────────────────────────────────

function IntroSlide({
  monthLabel,
  userName,
  userPhotoUrl,
  theme,
}: {
  monthLabel: string;
  userName: string;
  userPhotoUrl?: string;
  theme: typeof SLIDE_THEMES.intro;
}) {
  const reduced = useReducedMotion();

  return (
    <SlideFrame bg={theme.bg}>
      <AmbientGlow accent={theme.accent} glow={theme.glow} />

      <motion.div
        className="relative z-10 flex flex-col items-center"
        initial={reduced ? undefined : { opacity: 0, y: 30 }}
        animate={reduced ? undefined : { opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
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
          transition={{ delay: 0.2, duration: 0.6, ease: "easeOut" }}
        >
          {monthLabel}
        </motion.h2>

        <motion.div
          className="mt-6 flex items-center gap-3"
          initial={reduced ? undefined : { opacity: 0, y: 20 }}
          animate={reduced ? undefined : { opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
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
          transition={{ delay: 0.6 }}
        >
          TOQUE PARA COMEÇAR
        </motion.p>
      </motion.div>
    </SlideFrame>
  );
}

function StatSlide({
  value,
  label,
  description,
  theme,
  icon,
}: {
  value: string;
  label: string;
  description: string;
  theme: { bg: string; accent: string; glow: string };
  icon: React.ReactNode;
}) {
  const reduced = useReducedMotion();

  const numericValue = parseFloat(value.replace(/[^0-9.]/g, "")) || 0;
  const suffix = value.includes("h") ? value.replace(/[0-9.]/g, "") : value.includes("dias") ? "dias" : "";

  return (
    <SlideFrame bg={theme.bg}>
      <AmbientGlow accent={theme.accent} glow={theme.glow} />

      <motion.div
        className="relative z-10 flex flex-col items-center"
        initial={reduced ? undefined : { opacity: 0, y: 30 }}
        animate={reduced ? undefined : { opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        <motion.div
          className="mb-6"
          initial={reduced ? undefined : { scale: 0.5, opacity: 0 }}
          animate={reduced ? undefined : { scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
        >
          <Icon3DContainer color={theme.accent} glow={theme.glow} animate={!reduced}>
            {icon}
          </Icon3DContainer>
        </motion.div>

        <motion.div
          className="flex items-baseline gap-2"
          initial={reduced ? undefined : { opacity: 0, scale: 0.5 }}
          animate={reduced ? undefined : { opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
        >
          <AnimatedNumber
            value={numericValue}
            className="font-display text-6xl font-extrabold md:text-7xl"
            style={{ color: theme.accent }}
            duration={1.2}
          />
          {suffix && (
            <span className="font-display text-3xl font-extrabold" style={{ color: theme.accent }}>
              {suffix}
            </span>
          )}
        </motion.div>

        <motion.span
          className="mt-3 text-sm font-semibold uppercase tracking-wider"
          style={{ color: theme.accent }}
          initial={reduced ? undefined : { opacity: 0, y: 10 }}
          animate={reduced ? undefined : { opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          {label}
        </motion.span>

        <motion.p
          className="mt-3 max-w-[260px] text-sm leading-relaxed"
          style={{ color: "rgba(231,244,255,.55)" }}
          initial={reduced ? undefined : { opacity: 0, y: 10 }}
          animate={reduced ? undefined : { opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          {description}
        </motion.p>
      </motion.div>
    </SlideFrame>
  );
}

function SummarySlide({
  recap,
  userName,
  userPhotoUrl,
  onDownload,
  onShare,
  theme,
  iconAssets,
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
  const { meta } = tierMeta(recap.leagueTier);
  const tierColor = meta ? meta.color : "#71d4ff";

  const focusValue = formatMinutes(recap.totalFocusMinutes);
  const streakValue = `${recap.longestStreak} dias`;
  const leagueValue = meta ? meta.label : "—";
  const gardenValue = `${recap.gardenCount ?? 0} energia${recap.gardenCount === 1 ? "" : "s"}`;

  const stats = [
    { label: "Foco Total", value: focusValue, color: "#71d4ff", icon: iconAssets?.focusIcon, fallback: <Timer size={18} style={{ color: "#71d4ff" }} /> },
    { label: "Sequência", value: streakValue, color: "#ff8c42", icon: iconAssets?.streakIcon, fallback: <Image src="/streak/streak_alive.png" alt="Seq" width={18} height={18} unoptimized draggable={false} /> },
    { label: "Liga", value: leagueValue, color: tierColor, icon: iconAssets?.leagueIcon ?? meta?.iconPath, fallback: <Award size={18} style={{ color: tierColor }} /> },
    { label: "Jardim", value: gardenValue, color: "#6bffb8", icon: iconAssets?.tagIcon, fallback: <Image src="/energies/earth/earth_full.png" alt="Jardim" width={18} height={18} unoptimized draggable={false} /> },
  ];

  return (
    <SlideFrame bg={theme.bg}>
      <AmbientGlow accent={theme.accent} glow={theme.glow} />

      <motion.div
        className="relative z-10 flex w-full max-w-[320px] flex-col items-center"
        initial={reduced ? undefined : { opacity: 0, y: 30 }}
        animate={reduced ? undefined : { opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        <p className="text-xs font-medium" style={{ color: "rgba(231,244,255,.42)" }}>
          Recap de
        </p>
        <h2
          className="font-display mt-1 text-2xl font-extrabold"
          style={{
            background: "linear-gradient(135deg, #71d4ff, #b69cff, #ffb86b)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          {formatMonth(recap.recapMonth)}
        </h2>

        <div className="mt-3 flex items-center gap-2">
          {userPhotoUrl ? (
            <img
              src={userPhotoUrl}
              alt={userName}
              className="h-7 w-7 rounded-full object-cover ring-1 ring-[rgba(255,255,255,.15)]"
            />
          ) : null}
          <span className="text-xs font-medium" style={{ color: "rgba(231,244,255,.72)" }}>
            {userName}
          </span>
        </div>

        <div className="mt-5 grid w-full grid-cols-2 gap-2.5">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              className="overflow-hidden rounded-xl border border-[rgba(255,255,255,.08)] bg-[rgba(255,255,255,.035)] p-3"
              style={{
                boxShadow: `0 0 20px -8px ${s.color}22`,
                backdropFilter: "blur(10px)",
              }}
              initial={reduced ? undefined : { opacity: 0, y: 16 }}
              animate={reduced ? undefined : { opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.08 }}
            >
              <div className="flex items-center gap-1.5">
                {typeof s.icon === "string" ? (
                  <Image src={s.icon} alt={s.label} width={18} height={18} unoptimized draggable={false} />
                ) : (
                  s.fallback
                )}
                <span className="text-[10px] font-medium" style={{ color: "rgba(231,244,255,.6)" }}>
                  {s.label}
                </span>
              </div>
              <p className="mt-1 font-display text-base font-extrabold" style={{ color: s.color }}>
                {s.value}
              </p>
              {s.label === "Liga" && recap.leaguePromoted && (
                <p className="text-[9px] font-semibold" style={{ color: "#4ade80" }}>
                  ⬆ Promovido!
                </p>
              )}
            </motion.div>
          ))}
        </div>

        <motion.div
          className="mt-5 flex gap-2.5"
          initial={reduced ? undefined : { opacity: 0, y: 16 }}
          animate={reduced ? undefined : { opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
        >
          <button onClick={onDownload} className="primary-button min-w-[110px] gap-1.5 text-xs">
            <Download size={14} />
            Baixar
          </button>
          <button
            onClick={onShare}
            className="icon-button min-w-[110px] gap-1.5 text-xs"
            style={{ width: "auto", padding: "0 14px" }}
          >
            <Share2 size={14} />
            Compartilhar
          </button>
        </motion.div>

        <motion.p
          className="mt-3 text-[10px] tracking-wider"
          style={{ color: "rgba(231,244,255,.25)" }}
          initial={reduced ? undefined : { opacity: 0 }}
          animate={reduced ? undefined : { opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          energyOS
        </motion.p>
      </motion.div>
    </SlideFrame>
  );
}

// ─── Canvas Capture for Export ───────────────────────────────────────────────

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

  const focusValue = formatMinutes(recap.totalFocusMinutes);
  const streakValue = `${recap.longestStreak} dias`;
  const leagueValue = meta ? meta.label : "—";
  const gardenValue = `${recap.gardenCount ?? 0}`;

  // Background
  const bg = ctx.createLinearGradient(0, 0, 0, CARD_H);
  bg.addColorStop(0, "#0a0e1a");
  bg.addColorStop(1, "#111827");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // Grid noise
  ctx.strokeStyle = "rgba(113,212,255,.035)";
  ctx.lineWidth = 1;
  for (let y = 0; y < CARD_H; y += 44) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(CARD_W, y);
    ctx.stroke();
  }

  // Glow blobs
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

  // Top accent line
  const accentGrad = ctx.createLinearGradient(0, 0, CARD_W, 0);
  accentGrad.addColorStop(0, "rgba(113,212,255,0)");
  accentGrad.addColorStop(0.5, "rgba(113,212,255,.6)");
  accentGrad.addColorStop(1, "rgba(113,212,255,0)");
  ctx.fillStyle = accentGrad;
  ctx.fillRect(0, 0, CARD_W, 3);

  let y = 112;

  // Title
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

  // Divider
  const divGrad = ctx.createLinearGradient(CARD_W * 0.3, 0, CARD_W * 0.7, 0);
  divGrad.addColorStop(0, "rgba(113,212,255,0)");
  divGrad.addColorStop(0.5, "rgba(113,212,255,.35)");
  divGrad.addColorStop(1, "rgba(113,212,255,0)");
  ctx.fillStyle = divGrad;
  ctx.fillRect(CARD_W * 0.3, y, CARD_W * 0.4, 2);
  y += 50;

  // User
  if (userPhotoUrl) {
    try {
      const img = await loadImage(userPhotoUrl);
      ctx.save();
      ctx.beginPath();
      ctx.arc(CARD_W / 2 - ctx.measureText(userName).width / 2 - 30, y - 16, 22, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, CARD_W / 2 - ctx.measureText(userName).width / 2 - 52, y - 38, 44, 44);
      ctx.restore();
    } catch { /* fallback */ }
  }
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(231,244,255,.72)";
  ctx.font = "600 30px 'Inter', -apple-system, sans-serif";
  ctx.fillText(userName, CARD_W / 2, y + 8);
  y += 76;

  // Stats grid
  const colW = (CARD_W - pad * 2) / 2;
  const rowH = 272;
  const gridTop = y + 22;

  const tierImg = tier && meta ? await loadImage(meta.iconPath).catch(() => null) : null;
  const streakImg = await loadImage("/streak/streak_alive.png").catch(() => null);
  const gardenImg = await loadImage("/energies/earth/earth_full.png").catch(() => null);

  const stats = [
    { label: "Foco total", value: focusValue, color: "#71d4ff", glow: "rgba(113,212,255,.35)", icon: null as HTMLImageElement | null, kind: "focus" as const },
    { label: "Sequência", value: streakValue, color: "#ff8c42", glow: "rgba(255,140,66,.35)", icon: streakImg, kind: "streak" as const },
    { label: "Liga", value: leagueValue, color: tierColor, glow: `${tierColor}55`, icon: tierImg, kind: "tier" as const },
    { label: "Jardim", value: gardenValue, color: "#6bffb8", glow: "rgba(107,255,184,.35)", icon: gardenImg, kind: "garden" as const },
  ];

  for (const s of stats) {
    const sx = pad + (s.kind === "streak" || s.kind === "garden" ? 1 : 0) * colW;
    const sy = gridTop + (s.kind === "tier" || s.kind === "garden" ? 1 : 0) * rowH;
    const cw = colW - 16;
    const ch = rowH - 20;
    const cardR = 22;

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

    const glowGrad = ctx.createRadialGradient(sx + cw / 2, sy + ch * 0.6, 0, sx + cw / 2, sy + ch * 0.6, 110);
    glowGrad.addColorStop(0, s.glow);
    glowGrad.addColorStop(1, "transparent");
    ctx.fillStyle = glowGrad;
    ctx.fillRect(sx, sy, cw, ch);

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

    if (s.icon) {
      const s2 = 36;
      ctx.drawImage(s.icon, chipX - s2 / 2, chipY - s2 / 2, s2, s2);
    }

    ctx.fillStyle = "rgba(231,244,255,.45)";
    ctx.font = "500 23px 'Inter', -apple-system, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(s.label, sx + 76, sy + 52);

    ctx.fillStyle = s.color;
    ctx.font = "800 56px 'Inter', -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(s.value, sx + cw / 2, sy + ch - 52);
  }

  y = gridTop + 2 * rowH + 38;

  if (recap.leaguePromoted) {
    ctx.textAlign = "center";
    ctx.fillStyle = "#4ade80";
    ctx.font = "700 28px 'Inter', -apple-system, sans-serif";
    ctx.fillText("⬆ Promovido!", CARD_W / 2, y + 10);
  }

  // Footer
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
  const { user } = useAuthRedirect({ ifGuest: "/" });

  const monthLabel = formatMonth(recap.recapMonth);
  const { meta, tier } = tierMeta(recap.leagueTier);
  const theme = SLIDE_THEMES;

  const iconAssets: RecapIconAssets = {
    focusIcon: undefined,
    streakIcon: "/streak/streak_alive.png",
    leagueIcon: meta?.iconPath,
    tagIcon: "/energies/earth/earth_full.png",
  };

  const getLeagueTheme = () => theme.league(tier);

  // Navigation
  const goToNextSlide = useCallback(() => {
    setCurrentSlide((s) => Math.min(s + 1, SLIDE_COUNT - 1));
  }, []);

  const goToPrevSlide = useCallback(() => {
    setCurrentSlide((s) => Math.max(s - 1, 0));
  }, []);

  const handleSlideTap = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const third = rect.width / 3;
      if (x < third) goToPrevSlide();
      else if (x > third * 2) goToNextSlide();
    },
    [goToPrevSlide, goToNextSlide],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === "ArrowLeft") goToPrevSlide();
      if (e.key === "ArrowRight" || e.key === " ") goToNextSlide();
      if (e.key === "Escape") setOpen(false);
    },
    [open, goToPrevSlide, goToNextSlide],
  );

  useEffect(() => {
    if (open) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [open, handleKeyDown]);

  // Reset slide when opening
  useEffect(() => {
    if (open) setCurrentSlide(0);
  }, [open]);

  // Share handler
  const handleShare = useCallback(async () => {
    if (isSharing) return;
    setIsSharing(true);

    try {
      if (user?.uid && recap.id && !recap.hasBeenShared) {
        const response = await fetch("/api/recap/share", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recapId: recap.id }),
        });

        if (response.ok) {
          const result = await response.json();
          if (result.wasFirstShare && result.newBalance !== undefined) {
            setRewardToast({ amount: SHARE_REWARD_COINS, balance: result.newBalance });
            if (onCoinsAwarded) onCoinsAwarded(SHARE_REWARD_COINS, result.newBalance);
          }
        }
      }

      const blob = await captureRecapCard(recap, userName, userPhotoUrl);

      if (onExternalShare) onExternalShare(blob);

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
        } catch {
          // User cancelled
        }
      }
    } finally {
      setIsSharing(false);
    }
  }, [recap, isSharing, monthLabel, onExternalShare, onCoinsAwarded, user, userName, userPhotoUrl]);

  // Download handler
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

  // Render slide content
  const renderCurrentSlide = () => {
    switch (currentSlide) {
      case 0:
        return <IntroSlide monthLabel={monthLabel} userName={userName} userPhotoUrl={userPhotoUrl} theme={theme.intro} />;
      case 1:
        return (
          <StatSlide
            value={formatMinutes(recap.totalFocusMinutes)}
            label="Foco Total"
            description="Você dedicou isso à sua energia este mês"
            theme={theme.focus}
            icon={iconAssets.focusIcon ? (
              <Image src={iconAssets.focusIcon} alt="Foco" width={64} height={64} className="relative z-10" unoptimized draggable={false} />
            ) : (
              <Timer size={48} color={theme.focus.accent} />
            )}
          />
        );
      case 2:
        return (
          <StatSlide
            value={`${recap.longestStreak} dias`}
            label="Sequência"
            description="Melhor sequência de foco do mês"
            theme={theme.streak}
            icon={iconAssets.streakIcon ? (
              <Image src={iconAssets.streakIcon} alt="Seq" width={64} height={64} className="relative z-10" unoptimized draggable={false} />
            ) : (
              <Image src="/streak/streak_alive.png" alt="Seq" width={64} height={64} className="relative z-10" unoptimized draggable={false} />
            )}
          />
        );
      case 3:
        return (
          <StatSlide
            value={meta ? meta.label : "—"}
            label="Liga"
            description={`Você terminou o mês na liga ${meta ? meta.label : "—"}`}
            theme={getLeagueTheme()}
            icon={iconAssets.leagueIcon ? (
              <Image src={iconAssets.leagueIcon} alt="Liga" width={64} height={64} className="relative z-10" unoptimized draggable={false} />
            ) : meta ? (
              <Image src={meta.iconPath} alt={meta.label} width={64} height={64} className="relative z-10" unoptimized draggable={false} />
            ) : (
              <Award size={48} color={getLeagueTheme().accent} />
            )}
          />
        );
      case 4:
        return (
          <StatSlide
            value={`${recap.gardenCount ?? 0}`}
            label="Jardim"
            description="Energias e auras plantadas no seu jardim este ano"
            theme={theme.tag}
            icon={
              <Image src="/energies/earth/earth_full.png" alt="Jardim" width={64} height={64} className="relative z-10" unoptimized draggable={false} />
            }
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
      {/* Trigger button */}
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
            <Image src={meta.iconPath} alt={meta.label} width={20} height={20} unoptimized draggable={false} />
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

      {/* Modal */}
      <AnimatePresence>
        {open && (
          <Modal onClose={() => setOpen(false)}>
            {/* Use a fixed-aspect container that works within the modal's constraints */}
            <div className="relative flex w-full max-w-[420px] flex-col items-center">
              {/* Close button */}
              <button
                onClick={() => setOpen(false)}
                className="absolute right-2 top-2 z-30 rounded-full bg-[rgba(0,0,0,0.4)] p-2 backdrop-blur-sm transition-colors hover:bg-[rgba(0,0,0,0.6)]"
                aria-label="Fechar"
              >
                <X size={18} className="text-white/80" />
              </button>

              {/* Story-style slide viewport */}
              <div
                className="relative w-full overflow-hidden rounded-2xl"
                style={{
                  aspectRatio: "9/16",
                  maxHeight: "calc(100dvh - 80px)",
                  boxShadow: "0 25px 60px -12px rgba(0, 0, 0, 0.6)",
                }}
                onClick={handleSlideTap}
              >
                {/* Progress bar */}
                <ProgressBar current={currentSlide} total={SLIDE_COUNT} />

                {/* Navigation arrows (desktop only) */}
                {!reduced && (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); goToPrevSlide(); }}
                      className="absolute left-2 top-1/2 -translate-y-1/2 z-20 rounded-full bg-[rgba(0,0,0,0.35)] p-1.5 backdrop-blur-sm transition-all hover:bg-[rgba(0,0,0,0.55)] disabled:opacity-0"
                      disabled={currentSlide === 0}
                      aria-label="Slide anterior"
                    >
                      <ChevronLeft size={18} className="text-white/70" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); goToNextSlide(); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 z-20 rounded-full bg-[rgba(0,0,0,0.35)] p-1.5 backdrop-blur-sm transition-all hover:bg-[rgba(0,0,0,0.55)] disabled:opacity-0"
                      disabled={currentSlide === SLIDE_COUNT - 1}
                      aria-label="Próximo slide"
                    >
                      <ChevronRight size={18} className="text-white/70" />
                    </button>
                  </>
                )}

                {/* Slides with crossfade */}
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={currentSlide}
                    className="absolute inset-0"
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.02 }}
                    transition={{ duration: reduced ? 0 : 0.25, ease: "easeInOut" }}
                  >
                    {renderCurrentSlide()}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Bottom hint */}
              <motion.p
                className="mt-3 text-[10px] tracking-wider"
                style={{ color: "rgba(231,244,255,.25)" }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.5 }}
              >
                TOQUE NOS LADOS OU USE AS SETAS PARA NAVEGAR
              </motion.p>
            </div>

            <RewardToast toast={rewardToast} onDone={() => setRewardToast(null)} />
          </Modal>
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Standalone helpers ──────────────────────────────────────────────────────

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
