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
import { ParticleField, Recap3DIcon, RecapProgressBar } from "@/components/recap/recap-fx";
import { useRecapSound } from "@/lib/recap-sound";
import { NEW_TIER_META } from "@/lib/league-new-meta";
import type { NewLeagueTier } from "@/types";
import { useAuthRedirect } from "@/lib/auth-context";
import { FinalRecapSurface } from "./recap-final-surface";
import {
  ACCENT,
  RECAP_ART,
  RECAP_PALETTE,
  focusCopy,
  formatMinutes,
  formatMonth,
  gardenCopy,
  gardenScopeLabel,
  leagueCopy,
  plural,
  streakCopy,
  tierMeta,
  xpCopy,
  xpSegments,
  type RecapData,
} from "./recap-theme";

export type { RecapData } from "./recap-theme";

// ─── Types ────────────────────────────────────────────────────────────────────

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
 * Largura do modal 9:16.
 * 56.25dvh - 3.9375rem = (100dvh - 7rem) * 9/16 → altura útil do card.
 * `min()` com 100vw-2rem mantém as margens em telas estreitas (320px+).
 */
const MODAL_WIDTH = "min(420px, calc(56.25dvh - 3.9375rem), calc(100vw - 2rem))";


// ─── Helpers ─────────────────────────────────────────────────────────────────

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

/** Carrega a primeira arte que existir na lista de caminhos. */
async function loadFirstImage(sources: readonly string[]): Promise<HTMLImageElement | null> {
  for (const src of sources) {
    const img = await loadImage(src).catch(() => null);
    if (img) return img;
  }
  return null;
}

/**
 * Superfície de vidro no canvas: preenchimento translúcido, borda com a cor da
 * métrica, spotlight interno e sombra suave (o `backdrop-filter` do DOM não
 * existe no canvas, então vira cor sólida equivalente).
 */
function drawGlassPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  accent: string,
  radius = 28,
) {
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.55)";
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 14;
  roundRect(ctx, x, y, w, h, radius);
  ctx.fillStyle = "rgba(11,22,39,.74)";
  ctx.fill();
  ctx.restore();

  ctx.save();
  roundRect(ctx, x, y, w, h, radius);
  const g = ctx.createLinearGradient(x, y, x + w * 0.6, y + h);
  g.addColorStop(0, hexToRgba(accent, 0.17));
  g.addColorStop(0.55, "rgba(255,255,255,.02)");
  g.addColorStop(1, hexToRgba(accent, 0.07));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = hexToRgba(accent, 0.34);
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  ctx.save();
  roundRect(ctx, x, y, w, h, radius);
  ctx.clip();
  const inner = ctx.createRadialGradient(x + w * 0.12, y, 0, x + w * 0.12, y, w * 0.78);
  inner.addColorStop(0, hexToRgba(accent, 0.18));
  inner.addColorStop(1, "transparent");
  ctx.fillStyle = inner;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

/** Texto com quebra de linha (e reticências quando passa do limite). */
function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 2,
): number {
  const words = text.split(" ");
  let line = "";
  let lineY = y;
  let lines = 0;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      if (lines === maxLines - 1) {
        let clipped = line;
        while (clipped.length > 0 && ctx.measureText(`${clipped}…`).width > maxWidth) {
          clipped = clipped.slice(0, -1);
        }
        ctx.fillText(`${clipped}…`, x, lineY);
        return lineY + lineHeight;
      }
      ctx.fillText(line, x, lineY);
      line = word;
      lineY += lineHeight;
      lines += 1;
    } else {
      line = test;
    }
  }
  if (line && lines < maxLines) {
    ctx.fillText(line, x, lineY);
    lineY += lineHeight;
  }
  return lineY;
}

/**
 * Exporta o recap como imagem 1080×1920 (9:16).
 *
 * O desenho é feito à mão no canvas (sem html2canvas/dom-to-image): por isso
 * `backdrop-filter`/blur do redesign NUNCA é rasterizado — cada superfície de
 * vidro vira uma cor sólida equivalente, garantindo um PNG correto.
 *
 * A composição espelha a tela final: herói com a arte central, painel
 * dominante de foco, faixa secundária (sequência + liga) e faixa terciária
 * (jardim + XP), fechando com o detalhamento do mês.
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
  const pad = 72;
  const CX = CARD_W / 2;

  const { meta } = tierMeta(recap.leagueTier);
  const tierColor = meta ? meta.color : RECAP_PALETTE.cyan;
  const monthLabel = formatMonth(recap.recapMonth);
  const garden = recap.gardenCount ?? 0;
  const xp = recap.totalXp ?? 0;
  const focusHours = Math.floor((recap.totalFocusMinutes ?? 0) / 60);
  const focusMins = (recap.totalFocusMinutes ?? 0) % 60;
  const focusValue = focusHours > 0 ? String(focusHours) : String(recap.totalFocusMinutes ?? 0);
  const focusUnit = focusHours > 0 ? (focusMins > 0 ? `horas · ${focusMins} min` : "horas") : "minutos";

  // ── Background ──
  const bg = ctx.createLinearGradient(0, 0, 0, CARD_H);
  bg.addColorStop(0, "#050B16");
  bg.addColorStop(0.55, "#071021");
  bg.addColorStop(1, "#04080f");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // Grid noise
  ctx.strokeStyle = "rgba(113,212,255,.028)";
  ctx.lineWidth = 1;
  for (let y = 0; y < CARD_H; y += 56) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CARD_W, y); ctx.stroke();
  }
  for (let x = 0; x < CARD_W; x += 56) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CARD_H); ctx.stroke();
  }

  // Atmosfera
  drawGlow(ctx, CARD_W * 0.12, 140, 460, "rgba(92,200,255,.12)");
  drawGlow(ctx, CARD_W * 0.92, 120, 420, "rgba(169,139,255,.11)");
  drawGlow(ctx, CARD_W * 0.1, CARD_H * 0.78, 420, "rgba(255,176,103,.06)");
  drawGlow(ctx, CARD_W * 0.9, CARD_H * 0.86, 380, "rgba(61,220,132,.06)");

  // Top accent line
  const accentLine = ctx.createLinearGradient(0, 0, CARD_W, 0);
  accentLine.addColorStop(0, "rgba(92,200,255,0)");
  accentLine.addColorStop(0.5, "rgba(169,139,255,.75)");
  accentLine.addColorStop(1, "rgba(92,200,255,0)");
  ctx.fillStyle = accentLine;
  ctx.fillRect(0, 0, CARD_W, 4);

  // ── Header ──
  let y = 116;
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(231,244,255,.36)";
  ctx.font = "700 26px 'Inter', -apple-system, sans-serif";
  ctx.fillText("ENERGYOS  ·  RECAP DE", CX, y);

  y += 92;
  const titleGrad = ctx.createLinearGradient(pad, 0, CARD_W - pad, 0);
  titleGrad.addColorStop(0, "#5CC8FF");
  titleGrad.addColorStop(0.5, "#A98BFF");
  titleGrad.addColorStop(1, "#FFB067");
  ctx.fillStyle = titleGrad;
  ctx.font = "800 72px 'Inter', -apple-system, sans-serif";
  ctx.fillText(monthLabel.toUpperCase(), CX, y);

  // User avatar + name
  y += 46;
  if (userPhotoUrl) {
    try {
      const img = await loadImage(userPhotoUrl);
      const avatarR = 26;
      ctx.font = "600 30px 'Inter', -apple-system, sans-serif";
      const nameW = ctx.measureText(userName).width;
      const totalW = avatarR * 2 + 14 + nameW;
      const avatarX = CX - totalW / 2 + avatarR;
      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarX, y + 4, avatarR, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, avatarX - avatarR, y + 4 - avatarR, avatarR * 2, avatarR * 2);
      ctx.restore();
      ctx.fillStyle = "rgba(231,244,255,.74)";
      ctx.textAlign = "left";
      ctx.fillText(userName, avatarX + avatarR + 14, y + 14);
      ctx.textAlign = "center";
    } catch {
      ctx.fillStyle = "rgba(231,244,255,.74)";
      ctx.font = "600 30px 'Inter', -apple-system, sans-serif";
      ctx.fillText(userName, CX, y + 14);
    }
  } else {
    ctx.fillStyle = "rgba(231,244,255,.74)";
    ctx.font = "600 30px 'Inter', -apple-system, sans-serif";
    ctx.fillText(userName, CX, y + 14);
  }

  // ── Herói: arte central com luz radial ──
  const heroSize = 390;
  const heroCx = CX;
  const heroCy = 486;
  drawGlow(ctx, heroCx, heroCy, 320, "rgba(169,139,255,.22)");
  drawGlow(ctx, heroCx, heroCy + 160, 200, "rgba(92,200,255,.10)");
  const heroArt = await loadFirstImage(RECAP_ART.heroi);
  if (heroArt) {
    ctx.save();
    ctx.shadowColor = "rgba(169,139,255,.45)";
    ctx.shadowBlur = 46;
    ctx.drawImage(heroArt, heroCx - heroSize / 2, heroCy - heroSize / 2, heroSize, heroSize);
    ctx.restore();
  }

  // ── Painel dominante: FOCO ──
  const focusY = 700;
  const focusH = 320;
  drawGlassPanel(ctx, pad, focusY, CARD_W - pad * 2, focusH, ACCENT.focus);

  const clockArt = await loadFirstImage(RECAP_ART.foco);
  if (clockArt) {
    ctx.save();
    ctx.shadowColor = hexToRgba(ACCENT.focus, 0.55);
    ctx.shadowBlur = 40;
    ctx.drawImage(clockArt, CARD_W - pad - 200, focusY + 56, 200, 200);
    ctx.restore();
  }

  const focusTextX = pad + 44;
  ctx.textAlign = "left";
  ctx.fillStyle = hexToRgba(ACCENT.focus, 0.85);
  ctx.font = "700 24px 'Inter', -apple-system, sans-serif";
  ctx.fillText("FOCO TOTAL DO MÊS", focusTextX, focusY + 62);

  ctx.fillStyle = ACCENT.focus;
  ctx.font = "800 104px 'Inter', -apple-system, sans-serif";
  ctx.fillText(focusValue, focusTextX, focusY + 168);

  const focusValueW = ctx.measureText(focusValue).width;
  ctx.fillStyle = "rgba(231,244,255,.66)";
  ctx.font = "600 28px 'Inter', -apple-system, sans-serif";
  ctx.fillText(focusUnit, focusTextX + focusValueW + 18, focusY + 168);

  // Barra luminosa
  const focusBar = ctx.createLinearGradient(focusTextX, 0, focusTextX + 220, 0);
  focusBar.addColorStop(0, hexToRgba(ACCENT.focus, 0.9));
  focusBar.addColorStop(1, "transparent");
  ctx.fillStyle = focusBar;
  roundRect(ctx, focusTextX, focusY + 198, 220, 4, 2);
  ctx.fill();

  ctx.fillStyle = "rgba(231,244,255,.6)";
  ctx.font = "400 26px 'Inter', -apple-system, sans-serif";
  drawWrappedText(ctx, focusCopy(recap.totalFocusMinutes ?? 0), focusTextX, focusY + 240, 600, 36, 2);

  // ── Faixa secundária: SEQUÊNCIA + LIGA ──
  const row2Y = focusY + focusH + 24;
  const row2H = 260;
  const colW = (CARD_W - pad * 2 - 24) / 2;

  // Sequência
  drawGlassPanel(ctx, pad, row2Y, colW, row2H, ACCENT.streak);
  const flameArt = await loadFirstImage(RECAP_ART.sequencia);
  if (flameArt) {
    ctx.save();
    ctx.shadowColor = hexToRgba(ACCENT.streak, 0.5);
    ctx.shadowBlur = 30;
    ctx.drawImage(flameArt, pad + colW - 124, row2Y + 38, 100, 100);
    ctx.restore();
  }
  ctx.textAlign = "left";
  ctx.fillStyle = hexToRgba(ACCENT.streak, 0.85);
  ctx.font = "700 22px 'Inter', -apple-system, sans-serif";
  ctx.fillText("MELHOR SEQUÊNCIA", pad + 36, row2Y + 62);
  ctx.fillStyle = ACCENT.streak;
  ctx.font = "800 82px 'Inter', -apple-system, sans-serif";
  ctx.fillText(String(recap.longestStreak ?? 0), pad + 36, row2Y + 142);
  const daysW = ctx.measureText(String(recap.longestStreak ?? 0)).width;
  ctx.fillStyle = "rgba(231,244,255,.66)";
  ctx.font = "600 26px 'Inter', -apple-system, sans-serif";
  ctx.fillText(plural(recap.longestStreak ?? 0, "dia", "dias"), pad + 36 + daysW + 14, row2Y + 142);
  ctx.fillStyle = "rgba(231,244,255,.5)";
  ctx.font = "400 23px 'Inter', -apple-system, sans-serif";
  drawWrappedText(ctx, streakCopy(recap.longestStreak ?? 0), pad + 36, row2Y + 190, colW - 72, 32, 2);

  // Liga
  const leagueX = pad + colW + 24;
  drawGlassPanel(ctx, leagueX, row2Y, colW, row2H, tierColor);
  const leagueArt = meta ? await loadFirstImage([meta.iconPath]) : null;
  if (leagueArt) {
    ctx.save();
    ctx.shadowColor = hexToRgba(tierColor, 0.5);
    ctx.shadowBlur = 30;
    ctx.drawImage(leagueArt, leagueX + 36, row2Y + 50, 110, 110);
    ctx.restore();
  }
  ctx.fillStyle = hexToRgba(tierColor, 0.85);
  ctx.font = "700 22px 'Inter', -apple-system, sans-serif";
  ctx.fillText("LIGA DO MÊS", leagueX + 170, row2Y + 80);
  ctx.fillStyle = tierColor;
  ctx.font = "800 62px 'Inter', -apple-system, sans-serif";
  ctx.fillText((meta?.label ?? "—").toUpperCase(), leagueX + 170, row2Y + 144);
  ctx.fillStyle = "rgba(231,244,255,.55)";
  ctx.font = "400 24px 'Inter', -apple-system, sans-serif";
  ctx.fillText(meta?.description ?? "Participe da liga.", leagueX + 36, row2Y + 202);
  if (recap.leagueAtStart && recap.leagueAtStart !== recap.leagueTier) {
    ctx.fillStyle = "#3DDC84";
    ctx.font = "600 22px 'Inter', -apple-system, sans-serif";
    ctx.fillText(`${recap.leagueAtStart} → ${recap.leagueTier}`, leagueX + 36, row2Y + 236);
  }

  // ── Faixa terciária: JARDIM + XP ──
  const row3Y = row2Y + row2H + 24;
  const row3H = 240;

  // Jardim
  drawGlassPanel(ctx, pad, row3Y, colW, row3H, ACCENT.garden);
  const gardenArt = await loadFirstImage(RECAP_ART.jardim);
  if (gardenArt) {
    ctx.save();
    ctx.shadowColor = hexToRgba(ACCENT.garden, 0.5);
    ctx.shadowBlur = 28;
    ctx.drawImage(gardenArt, pad + colW - 118, row3Y + 34, 92, 92);
    ctx.restore();
  }
  ctx.fillStyle = hexToRgba(ACCENT.garden, 0.85);
  ctx.font = "700 22px 'Inter', -apple-system, sans-serif";
  ctx.fillText("ENERGIAS DO ANO", pad + 36, row3Y + 58);
  ctx.fillStyle = ACCENT.garden;
  ctx.font = "800 72px 'Inter', -apple-system, sans-serif";
  ctx.fillText(String(garden), pad + 36, row3Y + 134);
  const gardenW = ctx.measureText(String(garden)).width;
  ctx.fillStyle = "rgba(231,244,255,.66)";
  ctx.font = "600 24px 'Inter', -apple-system, sans-serif";
  ctx.fillText(plural(garden, "energia", "energias"), pad + 36 + gardenW + 12, row3Y + 134);
  ctx.fillStyle = "rgba(231,244,255,.38)";
  ctx.font = "500 18px 'Inter', -apple-system, sans-serif";
  ctx.fillText(gardenScopeLabel(recap.recapMonth).toUpperCase(), pad + 36, row3Y + 162);
  ctx.fillStyle = "rgba(231,244,255,.5)";
  ctx.font = "400 22px 'Inter', -apple-system, sans-serif";
  drawWrappedText(ctx, gardenCopy(garden), pad + 36, row3Y + 194, colW - 72, 28, 2);

  // XP
  const xpX = pad + colW + 24;
  drawGlassPanel(ctx, xpX, row3Y, colW, row3H, ACCENT.xp);
  const xpArt = await loadFirstImage(RECAP_ART.xpProgressao);
  if (xpArt) {
    ctx.save();
    ctx.shadowColor = hexToRgba(ACCENT.xp, 0.5);
    ctx.shadowBlur = 26;
    ctx.drawImage(xpArt, xpX + colW - 108, row3Y + 30, 82, 82);
    ctx.restore();
  }
  ctx.fillStyle = hexToRgba(ACCENT.xp, 0.85);
  ctx.font = "700 22px 'Inter', -apple-system, sans-serif";
  ctx.fillText("XP DO MÊS", xpX + 36, row3Y + 60);
  ctx.fillStyle = ACCENT.xp;
  ctx.font = "800 72px 'Inter', -apple-system, sans-serif";
  ctx.fillText(xp.toLocaleString("pt-BR"), xpX + 36, row3Y + 136);

  // Barra de fontes do XP (dados reais)
  const segments = xpSegments(recap);
  const segmentTotal = segments.reduce((sum, segment) => sum + segment.value, 0);
  if (segmentTotal > 0) {
    const barX = xpX + 36;
    const barW = colW - 72;
    const barY = row3Y + 162;
    let cursor = barX;
    segments.forEach((segment) => {
      const w = (segment.value / segmentTotal) * barW;
      ctx.fillStyle = segment.color;
      roundRect(ctx, cursor, barY, Math.max(6, w - 4), 8, 4);
      ctx.fill();
      cursor += w;
    });
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(231,244,255,.45)";
    ctx.font = "400 18px 'Inter', -apple-system, sans-serif";
    ctx.fillText(
      segments.map((segment) => `${segment.label} ${segment.value.toLocaleString("pt-BR")}`).join("  ·  "),
      barX,
      barY + 34,
    );
  }

  // ── Detalhamento do mês ──
  const detailY = row3Y + row3H + 24;
  const detailH = 150;
  ctx.save();
  roundRect(ctx, pad, detailY, CARD_W - pad * 2, detailH, 24);
  ctx.fillStyle = "rgba(255,255,255,.03)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,.09)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  const details: Array<[string, string]> = [
    ["METAS", String(recap.goalsCompleted ?? 0)],
    ["MISSÕES", String(recap.missionsCompleted ?? 0)],
    ["CONQUISTAS", String(recap.achievementsUnlocked ?? 0)],
    ["MOEDAS +", (recap.coinsGained ?? 0).toLocaleString("pt-BR")],
    ["MOEDAS −", (recap.coinsSpent ?? 0).toLocaleString("pt-BR")],
  ];
  const cellW = (CARD_W - pad * 2) / details.length;
  details.forEach(([label, value], index) => {
    const cx = pad + cellW * index + cellW / 2;
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(231,244,255,.35)";
    ctx.font = "600 18px 'Inter', -apple-system, sans-serif";
    ctx.fillText(label, cx, detailY + 58);
    ctx.fillStyle = "rgba(231,244,255,.85)";
    ctx.font = "700 42px 'Inter', -apple-system, sans-serif";
    ctx.fillText(value, cx, detailY + 108);
  });

  // ── Frase-resumo do mês (fecha a composição antes do rodapé) ──
  const summary = `${formatMinutes(recap.totalFocusMinutes ?? 0)} de foco  ·  ${recap.longestStreak ?? 0} ${plural(recap.longestStreak ?? 0, "dia", "dias")} de sequência  ·  ${xp.toLocaleString("pt-BR")} XP`;
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(231,244,255,.62)";
  ctx.font = "500 22px 'Inter', -apple-system, sans-serif";
  drawWrappedText(ctx, summary, CX, detailY + detailH + 56, CARD_W - pad * 2, 30, 1);

  // ── Footer ──
  const footY = CARD_H - 132;
  const footDiv = ctx.createLinearGradient(CARD_W * 0.25, 0, CARD_W * 0.75, 0);
  footDiv.addColorStop(0, "rgba(113,212,255,0)");
  footDiv.addColorStop(0.5, "rgba(113,212,255,.2)");
  footDiv.addColorStop(1, "rgba(113,212,255,0)");
  ctx.fillStyle = footDiv;
  ctx.fillRect(CARD_W * 0.25, footY, CARD_W * 0.5, 1);

  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(231,244,255,.22)";
  ctx.font = "800 36px 'Inter', -apple-system, sans-serif";
  ctx.fillText("ENERGYOS", CX, footY + 66);
  ctx.fillStyle = "rgba(231,244,255,.26)";
  ctx.font = "400 20px 'Inter', -apple-system, sans-serif";
  ctx.fillText(
    `Gerado em ${new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}`,
    CX,
    footY + 100,
  );

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
            label="XP do mês"
            copy={xpCopy(recap.totalXp ?? 0)}
            theme={THEMES.xp}
            iconSrc={RECAP_ART.xp}
            icon={<Zap size={52} color={THEMES.xp.accent} strokeWidth={1.5} />}
          />
        );
      case 6:
        // O slide final NÃO usa o cartão 9:16 — ele vira a superfície editorial
        // larga (FinalRecapSurface) renderizada pelo modal.
        return null;
      default:
        return null;
    }
  }

  // Cabeçalho da tela final — progresso, som (o fechar fica no próprio modal).
  const finalHeader = (
    <div className="flex items-center gap-3">
      <span className="hidden shrink-0 text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--text-faint)] sm:block">
        Recap · {currentSlide + 1}/{SLIDE_COUNT}
      </span>
      <RecapProgressBar current={currentSlide} total={SLIDE_COUNT} accent={theme.accent} />
      <button
        type="button"
        onClick={toggleSound}
        aria-label={soundEnabled ? "Desativar sons do recap" : "Ativar sons do recap"}
        aria-pressed={soundEnabled}
        className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-full bg-white/[.07] text-white/75 transition hover:bg-white/[.13] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
      >
        {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
      </button>
    </div>
  );

  // Rodapé da tela final — navegação, download e compartilhamento.
  const finalFooter = (
    <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-3">
      <motion.button
        type="button"
        whileHover={reduced ? undefined : { y: -2 }}
        whileTap={reduced ? undefined : { scale: 0.97 }}
        onClick={goPrev}
        className="order-last col-span-2 flex h-11 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-white/10 bg-white/[.04] px-4 text-xs font-semibold text-[var(--text-secondary)] transition hover:bg-white/[.09] hover:text-[var(--text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 sm:order-first sm:col-span-1 sm:w-auto"
      >
        <ChevronLeft size={14} />
        Voltar
      </motion.button>

      <motion.button
        type="button"
        whileHover={reduced ? undefined : { y: -2 }}
        whileTap={reduced ? undefined : { scale: 0.97 }}
        onClick={handleDownload}
        disabled={isDownloading}
        className="flex h-11 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-4 text-xs font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 disabled:opacity-60"
        style={{
          background: "linear-gradient(135deg, #71d4ff, #5CC8FF)",
          color: "#07111f",
          boxShadow: "0 10px 26px -12px rgba(113,212,255,.85)",
        }}
      >
        {isDownloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
        Baixar PNG
      </motion.button>

      <motion.button
        type="button"
        whileHover={reduced ? undefined : { y: -2 }}
        whileTap={reduced ? undefined : { scale: 0.97 }}
        onClick={handleShare}
        disabled={isSharing}
        className="flex h-11 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-4 text-xs font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 disabled:opacity-60"
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
  );

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
          <Modal
            onClose={() => setOpen(false)}
            title={isSummary ? finalHeader : undefined}
            footer={isSummary ? finalFooter : undefined}
            panelClassName={
              isSummary
                ? "lg:max-h-[min(94dvh,940px)] lg:max-w-[1180px] bg-[radial-gradient(1200px_620px_at_12%_-12%,rgba(92,200,255,.14),transparent_60%),radial-gradient(980px_520px_at_88%_-6%,rgba(169,139,255,.13),transparent_62%),radial-gradient(900px_620px_at_60%_112%,rgba(255,176,103,.07),transparent_62%)]"
                : ""
            }
          >
            {isSummary ? (
              <motion.div
                initial={reduced ? undefined : { opacity: 0, y: 20, scale: 0.99 }}
                animate={reduced ? undefined : { opacity: 1, y: 0, scale: 1 }}
                transition={reduced ? undefined : { duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
              >
                <FinalRecapSurface
                  recap={recap}
                  userName={userName}
                  userPhotoUrl={userPhotoUrl}
                  monthLabel={monthLabel}
                />
              </motion.div>
            ) : (
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
                  {/*
                    Cross-fade (modo sincronizado): o slide que entra aparece
                    IMEDIATAMENTE. Com `mode="wait"` o AnimatePresence esperava
                    a saída do slide anterior — que nunca terminava, porque os
                    slides têm animações infinitas (bloom, flutuação, partículas)
                    — e o usuário ficava olhando um slide em branco por mais de
                    um segundo a cada avanço.
                  */}
                  <AnimatePresence initial={false}>
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
                  <RecapProgressBar current={currentSlide} total={SLIDE_COUNT} accent={theme.accent} />

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
            )}

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
