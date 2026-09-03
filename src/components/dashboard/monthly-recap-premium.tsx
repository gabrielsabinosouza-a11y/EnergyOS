"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { X, Download, Share2, ChevronLeft, ChevronRight, Timer, Award, Zap, Flame, Trophy } from "lucide-react";
import Image from "next/image";
import { Modal } from "@/components/modal";
import { RewardToast } from "@/components/reward-toast";
import { AnimatedNumber } from "@/components/ui";
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
  hasBeenShared?: boolean;
}

interface MonthlyRecapPremiumProps {
  recap: RecapData;
  userName: string;
  userPhotoUrl?: string;
  onShare?: (blob: Blob) => void;
  onCoinsAwarded?: (amount: number, newBalance: number) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SLIDE_COUNT = 6;
const SHARE_REWARD_COINS = 50;

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

function ProgressBar({ current, total }: { current: number; total: number }) {
  return (
    <div className="absolute top-3 left-3 right-3 z-20 flex gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="h-[3px] flex-1 rounded-full transition-all duration-500"
          style={{
            background: i <= current ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.18)",
          }}
        />
      ))}
    </div>
  );
}

function SlideFrame({ children, bg }: { children: React.ReactNode; bg: string }) {
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden p-8 text-center"
      style={{ background: bg }}
    >
      {children}
    </div>
  );
}

function SparkleEffect({ color = "#ffffff", count = 8 }: { color?: string; count?: number }) {
  const reduced = useReducedMotion();
  if (reduced) return null;
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: count }).map((_, i) => {
        const size = 2 + (i % 3) + 1;
        const x = 10 + (i * 13) % 80;
        const y = 5 + (i * 17) % 85;
        const delay = (i * 0.4) % 3;
        const duration = 2.5 + (i % 3) * 0.8;
        return (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{ width: size, height: size, background: color, boxShadow: `0 0 ${size * 2}px ${color}`, left: `${x}%`, top: `${y}%` }}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: [0.15, 0.75, 0.15, 0], scale: [0, 1, 0], y: [-8, -18, -8, 0] }}
            transition={{ duration, delay, repeat: Infinity, ease: "easeInOut" }}
          />
        );
      })}
    </div>
  );
}

// ─── Slide themes ─────────────────────────────────────────────────────────────

const THEMES = {
  intro:   { bg: "linear-gradient(160deg, #07111f 0%, #0d1b2d 100%)",          accent: "#71d4ff", glow: "rgba(113,212,255,0.3)"  },
  focus:   { bg: "linear-gradient(160deg, #071828 0%, #0a2540 100%)",          accent: "#71d4ff", glow: "rgba(113,212,255,0.35)" },
  streak:  { bg: "linear-gradient(160deg, #1a0e06 0%, #2d1a08 100%)",          accent: "#ffb86b", glow: "rgba(255,184,107,0.38)" },
  garden:  { bg: "linear-gradient(160deg, #071a0e 0%, #0d2a18 100%)",          accent: "#4ade80", glow: "rgba(74,222,128,0.32)"  },
  summary: { bg: "linear-gradient(160deg, #07111f 0%, #0d1b2d 100%)",          accent: "#71d4ff", glow: "rgba(113,212,255,0.3)"  },
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
    <SlideFrame bg={theme.bg}>
      <AmbientGlow accent={theme.accent} glow={theme.glow} />
      <SparkleEffect color={theme.accent} count={10} />
      <motion.div
        className="relative z-10 flex flex-col items-center gap-4"
        initial={reduced ? undefined : { opacity: 0, y: 28 }}
        animate={reduced ? undefined : { opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
      >
        {/* Logo mark */}
        <div
          className="mb-2 flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ background: theme.accent, boxShadow: `0 0 32px ${theme.glow}` }}
        >
          <Zap size={28} color="#07111f" strokeWidth={2.5} />
        </div>

        <p className="text-sm font-medium tracking-widest uppercase" style={{ color: "rgba(231,244,255,.4)" }}>
          Recap de
        </p>

        <motion.h2
          className="font-display text-5xl font-extrabold leading-none capitalize"
          style={{ background: "linear-gradient(135deg, #71d4ff 0%, #b69cff 50%, #ffb86b 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
          initial={reduced ? undefined : { opacity: 0, scale: 0.82 }}
          animate={reduced ? undefined : { opacity: 1, scale: 1 }}
          transition={{ delay: 0.18, duration: 0.55, ease: "easeOut" }}
        >
          {monthLabel}
        </motion.h2>

        <motion.div
          className="mt-2 flex items-center gap-2.5"
          initial={reduced ? undefined : { opacity: 0, y: 14 }}
          animate={reduced ? undefined : { opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.5 }}
        >
          {userPhotoUrl ? (
            <img src={userPhotoUrl} alt={userName} className="h-9 w-9 rounded-full object-cover ring-2 ring-[rgba(255,255,255,.18)]" />
          ) : (
            <div className="h-9 w-9 rounded-full" style={{ background: `linear-gradient(135deg, ${theme.accent}, #b69cff)` }} />
          )}
          <span className="text-base font-semibold" style={{ color: "rgba(231,244,255,.82)" }}>{userName}</span>
        </motion.div>

        <motion.p
          className="mt-4 text-[11px] tracking-[0.2em] uppercase"
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

function HeroStatSlide({ numericValue, valueSuffix, label, copy, theme, icon, animateNumber = true }: {
  numericValue: number;
  valueSuffix?: string;
  label: string;
  copy: string;
  theme: { bg: string; accent: string; glow: string };
  icon: React.ReactNode;
  animateNumber?: boolean;
}) {
  const reduced = useReducedMotion();
  return (
    <SlideFrame bg={theme.bg}>
      <AmbientGlow accent={theme.accent} glow={theme.glow} />
      <SparkleEffect color={theme.accent} count={7} />

      <motion.div
        className="relative z-10 flex flex-col items-center"
        initial={reduced ? undefined : { opacity: 0, y: 24 }}
        animate={reduced ? undefined : { opacity: 1, y: 0 }}
        transition={{ duration: 0.65, ease: "easeOut" }}
      >
        {/* Icon halo */}
        <motion.div
          className="relative mb-8 flex items-center justify-center"
          initial={reduced ? undefined : { scale: 0.55, opacity: 0 }}
          animate={reduced ? undefined : { scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 220, damping: 22 }}
        >
          <div
            className="absolute rounded-full"
            style={{ width: 120, height: 120, background: `radial-gradient(circle, ${theme.glow} 0%, transparent 70%)`, filter: "blur(18px)" }}
          />
          <div
            className="relative flex h-24 w-24 items-center justify-center rounded-full"
            style={{ background: `radial-gradient(circle at 35% 30%, ${theme.accent}30, ${theme.accent}08)`, border: `1px solid ${theme.accent}40`, boxShadow: `0 0 28px -6px ${theme.glow}` }}
          >
            {icon}
          </div>
        </motion.div>

        {/* Hero number */}
        <motion.div
          className="flex items-baseline gap-2"
          initial={reduced ? undefined : { opacity: 0, scale: 0.6 }}
          animate={reduced ? undefined : { opacity: 1, scale: 1 }}
          transition={{ delay: 0.18, duration: 0.55, ease: "easeOut" }}
        >
          {animateNumber ? (
            <AnimatedNumber
              value={numericValue}
              className="font-display font-extrabold leading-none"
              style={{ fontSize: 88, color: theme.accent, letterSpacing: "-0.04em" }}
              duration={1.1}
            />
          ) : (
            <span className="font-display font-extrabold leading-none" style={{ fontSize: 88, color: theme.accent, letterSpacing: "-0.04em" }}>
              {numericValue}
            </span>
          )}
          {valueSuffix && (
            <span className="font-display font-extrabold" style={{ fontSize: 36, color: theme.accent, opacity: 0.85 }}>
              {valueSuffix}
            </span>
          )}
        </motion.div>

        {/* Label */}
        <motion.p
          className="mt-3 text-sm font-bold uppercase tracking-[0.18em]"
          style={{ color: theme.accent }}
          initial={reduced ? undefined : { opacity: 0, y: 8 }}
          animate={reduced ? undefined : { opacity: 1, y: 0 }}
          transition={{ delay: 0.32 }}
        >
          {label}
        </motion.p>

        {/* Contextual copy */}
        <motion.p
          className="mt-5 max-w-[260px] text-sm leading-relaxed"
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
    <SlideFrame bg={theme.bg}>
      <AmbientGlow accent={theme.accent} glow={theme.glow} />
      <SparkleEffect color={theme.accent} count={8} />

      <motion.div
        className="relative z-10 flex flex-col items-center"
        initial={reduced ? undefined : { opacity: 0, y: 24 }}
        animate={reduced ? undefined : { opacity: 1, y: 0 }}
        transition={{ duration: 0.65, ease: "easeOut" }}
      >
        {/* League icon halo */}
        <motion.div
          className="relative mb-8 flex items-center justify-center"
          initial={reduced ? undefined : { scale: 0.55, opacity: 0 }}
          animate={reduced ? undefined : { scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 220, damping: 22 }}
        >
          <div
            className="absolute rounded-full"
            style={{ width: 130, height: 130, background: `radial-gradient(circle, ${theme.glow} 0%, transparent 70%)`, filter: "blur(20px)" }}
          />
          <div
            className="relative flex h-28 w-28 items-center justify-center rounded-full"
            style={{ background: `radial-gradient(circle at 35% 30%, ${theme.accent}28, ${theme.accent}06)`, border: `1px solid ${theme.accent}38`, boxShadow: `0 0 32px -8px ${theme.glow}` }}
          >
            {meta ? (
              <Image src={meta.iconPath} alt={meta.label} width={64} height={64} style={{ objectFit: "contain" }} unoptimized draggable={false} />
            ) : (
              <Award size={52} color={theme.accent} />
            )}
          </div>
        </motion.div>

        {/* Hero text */}
        <motion.p
          className="font-display font-extrabold leading-none uppercase"
          style={{ fontSize: 72, color: theme.accent, letterSpacing: "-0.03em" }}
          initial={reduced ? undefined : { opacity: 0, scale: 0.65 }}
          animate={reduced ? undefined : { opacity: 1, scale: 1 }}
          transition={{ delay: 0.18, duration: 0.55, ease: "easeOut" }}
        >
          {label}
        </motion.p>

        <motion.p
          className="mt-3 text-sm font-bold uppercase tracking-[0.18em]"
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
          className="mt-5 max-w-[260px] text-sm leading-relaxed"
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

function SummarySlide({ recap, userName, userPhotoUrl, monthLabel, onDownload, onShare, theme }: {
  recap: RecapData; userName: string; userPhotoUrl?: string; monthLabel: string;
  onDownload: () => void; onShare: () => void;
  theme: { bg: string; accent: string; glow: string };
}) {
  const reduced = useReducedMotion();
  const { meta, tier } = tierMeta(recap.leagueTier);
  const tierColor = meta ? meta.color : "#71d4ff";
  const garden = recap.gardenCount ?? 0;

  const stats = [
    { label: "Foco",      value: formatMinutes(recap.totalFocusMinutes), color: "#71d4ff" },
    { label: plural(recap.longestStreak, "dia", "dias"), value: String(recap.longestStreak), color: "#ffb86b" },
    { label: "Liga",      value: meta ? meta.label : "—",                color: tierColor  },
    { label: plural(garden, "energia", "energias"), value: String(garden), color: "#4ade80" },
  ];

  return (
    <SlideFrame bg={theme.bg}>
      <AmbientGlow accent={theme.accent} glow={theme.glow} />
      <motion.div
        className="relative z-10 flex w-full max-w-[300px] flex-col items-center"
        initial={reduced ? undefined : { opacity: 0, y: 24 }}
        animate={reduced ? undefined : { opacity: 1, y: 0 }}
        transition={{ duration: 0.65, ease: "easeOut" }}
      >
        <p className="text-xs font-medium tracking-widest uppercase" style={{ color: "rgba(231,244,255,.38)" }}>Recap de</p>
        <h2
          className="font-display mt-1 text-3xl font-extrabold capitalize"
          style={{ background: "linear-gradient(135deg, #71d4ff, #b69cff, #ffb86b)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
        >
          {monthLabel}
        </h2>

        {userPhotoUrl && (
          <div className="mt-3 flex items-center gap-2">
            <img src={userPhotoUrl} alt={userName} className="h-7 w-7 rounded-full object-cover ring-1 ring-[rgba(255,255,255,.15)]" />
            <span className="text-xs font-medium" style={{ color: "rgba(231,244,255,.7)" }}>{userName}</span>
          </div>
        )}

        {/* 2×2 summary grid */}
        <div className="mt-5 grid w-full grid-cols-2 gap-2.5">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              className="flex flex-col items-center justify-center rounded-2xl p-4"
              style={{ background: "rgba(255,255,255,.04)", border: `1px solid ${s.color}28`, boxShadow: `0 0 20px -8px ${s.color}44` }}
              initial={reduced ? undefined : { opacity: 0, y: 14 }}
              animate={reduced ? undefined : { opacity: 1, y: 0 }}
              transition={{ delay: 0.12 + i * 0.07 }}
            >
              <span className="font-display text-2xl font-extrabold" style={{ color: s.color }}>{s.value}</span>
              <span className="mt-0.5 text-[10px] uppercase tracking-wider" style={{ color: "rgba(231,244,255,.45)" }}>{s.label}</span>
            </motion.div>
          ))}
        </div>

        {/* Action buttons */}
        <motion.div
          className="mt-5 flex gap-2.5"
          initial={reduced ? undefined : { opacity: 0, y: 14 }}
          animate={reduced ? undefined : { opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <button onClick={onDownload} className="primary-button min-w-[110px] gap-1.5 text-xs">
            <Download size={14} /> Baixar
          </button>
          <button
            onClick={onShare}
            className="icon-button min-w-[110px] gap-1.5 text-xs"
            style={{ width: "auto", padding: "0 14px" }}
          >
            <Share2 size={14} /> Compartilhar
          </button>
        </motion.div>

        <motion.p
          className="mt-3 text-[10px] tracking-[0.18em] uppercase"
          style={{ color: "rgba(231,244,255,.2)" }}
          initial={reduced ? undefined : { opacity: 0 }}
          animate={reduced ? undefined : { opacity: 1 }}
          transition={{ delay: 0.65 }}
        >
          energyOS
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
  ctx.arcTo(x, y + h, x, y + h, r);
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

  const { meta, tier } = tierMeta(recap.leagueTier);
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
  let y = 110;
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(231,244,255,.38)";
  ctx.font = "500 32px 'Inter', -apple-system, sans-serif";
  ctx.fillText("Recap de", CX, y);
  y += 72;

  const titleGrad = ctx.createLinearGradient(CARD_W * 0.2, 0, CARD_W * 0.8, 0);
  titleGrad.addColorStop(0, "#71d4ff");
  titleGrad.addColorStop(0.5, "#b69cff");
  titleGrad.addColorStop(1, "#ffb86b");
  ctx.fillStyle = titleGrad;
  ctx.font = "800 80px 'Inter', -apple-system, sans-serif";
  ctx.fillText(monthLabel, CX, y);
  y += 56;

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
  y += 80;

  // Divider
  const div1 = ctx.createLinearGradient(CARD_W * 0.25, 0, CARD_W * 0.75, 0);
  div1.addColorStop(0, "rgba(113,212,255,0)");
  div1.addColorStop(0.5, "rgba(113,212,255,.28)");
  div1.addColorStop(1, "rgba(113,212,255,0)");
  ctx.fillStyle = div1;
  ctx.fillRect(CARD_W * 0.25, y, CARD_W * 0.5, 2);
  y += 60;

  // ── Four hero stat rows ──
  const statRows = [
    { label: "Foco total",  value: formatMinutes(recap.totalFocusMinutes), color: "#71d4ff", glow: "rgba(113,212,255,.32)", copy: focusCopy(recap.totalFocusMinutes) },
    { label: plural(recap.longestStreak, "dia de sequência", "dias de sequência"), value: String(recap.longestStreak), color: "#ffb86b", glow: "rgba(255,184,107,.32)", copy: streakCopy(recap.longestStreak) },
    { label: "Liga",        value: meta ? meta.label : "—",                color: tierColor, glow: `${tierColor}55`,       copy: leagueCopy(tier, recap.leaguePromoted ?? false) },
    { label: plural(garden, "energia plantada", "energias plantadas"), value: String(garden), color: "#4ade80", glow: "rgba(74,222,128,.32)", copy: gardenCopy(garden) },
  ];

  const rowH = 290;
  const cardR = 28;

  // Preload league icon
  const tierImg = tier && meta ? await loadImage(meta.iconPath).catch(() => null) : null;

  for (let i = 0; i < statRows.length; i++) {
    const s = statRows[i];
    const sx = pad;
    const sy = y;
    const cw = CARD_W - pad * 2;
    const ch = rowH - 18;

    // Card shadow
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,.45)";
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 10;
    roundRect(ctx, sx, sy, cw, ch, cardR);
    ctx.fillStyle = "rgba(10,18,32,.7)";
    ctx.fill();
    ctx.restore();

    // Card glow border
    ctx.save();
    ctx.shadowColor = s.glow;
    ctx.shadowBlur = 28;
    roundRect(ctx, sx, sy, cw, ch, cardR);
    ctx.fillStyle = "rgba(255,255,255,.03)";
    ctx.fill();
    ctx.strokeStyle = hexToRgba(s.color, 0.38);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // Inner glow
    const innerGlow = ctx.createRadialGradient(sx + cw * 0.5, sy + ch * 0.7, 0, sx + cw * 0.5, sy + ch * 0.7, cw * 0.55);
    innerGlow.addColorStop(0, s.glow);
    innerGlow.addColorStop(1, "transparent");
    ctx.fillStyle = innerGlow;
    ctx.fillRect(sx, sy, cw, ch);

    // Stat value — large, left-aligned
    ctx.fillStyle = s.color;
    ctx.font = "800 96px 'Inter', -apple-system, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(s.value, sx + 52, sy + 118);

    // Label
    ctx.fillStyle = hexToRgba(s.color, 0.75);
    ctx.font = "700 28px 'Inter', -apple-system, sans-serif";
    ctx.fillText(s.label.toUpperCase(), sx + 52, sy + 162);

    // Copy line
    ctx.fillStyle = "rgba(231,244,255,.45)";
    ctx.font = "400 24px 'Inter', -apple-system, sans-serif";
    // Wrap copy text
    const maxW = cw - 104;
    const words = s.copy.split(" ");
    let line = "";
    let lineY = sy + 210;
    for (const word of words) {
      const test = line ? line + " " + word : word;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, sx + 52, lineY);
        line = word;
        lineY += 34;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, sx + 52, lineY);

    // League icon on the right
    if (i === 2 && tierImg) {
      const iconS = 80;
      ctx.drawImage(tierImg, sx + cw - iconS - 44, sy + ch / 2 - iconS / 2, iconS, iconS);
    }

    // Promoted badge
    if (i === 2 && recap.leaguePromoted) {
      ctx.fillStyle = "rgba(74,222,128,.15)";
      roundRect(ctx, sx + cw - 220, sy + 28, 180, 44, 22);
      ctx.fill();
      ctx.fillStyle = "#4ade80";
      ctx.font = "700 22px 'Inter', -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("⬆ Promovido!", sx + cw - 130, sy + 56);
      ctx.textAlign = "left";
    }

    y += rowH;
  }

  // ── Footer ──
  const footY = CARD_H - 120;
  const footDiv = ctx.createLinearGradient(CARD_W * 0.25, 0, CARD_W * 0.75, 0);
  footDiv.addColorStop(0, "rgba(113,212,255,0)");
  footDiv.addColorStop(0.5, "rgba(113,212,255,.18)");
  footDiv.addColorStop(1, "rgba(113,212,255,0)");
  ctx.fillStyle = footDiv;
  ctx.fillRect(CARD_W * 0.25, footY, CARD_W * 0.5, 1);

  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(231,244,255,.2)";
  ctx.font = "800 38px 'Inter', -apple-system, sans-serif";
  ctx.fillText("energyOS", CX, footY + 68);

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob!), "image/png"));
}

// ─── Main component ───────────────────────────────────────────────────────────

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
  const [isDownloading, setIsDownloading] = useState(false);
  const [rewardToast, setRewardToast] = useState<{ amount: number; balance: number } | null>(null);
  const reduced = useReducedMotion();
  const { user } = useAuthRedirect({ ifGuest: "/" });

  const monthLabel = formatMonth(recap.recapMonth);
  const { meta, tier } = tierMeta(recap.leagueTier);
  const garden = recap.gardenCount ?? 0;

  const goNext = useCallback(() => setCurrentSlide((s) => Math.min(s + 1, SLIDE_COUNT - 1)), []);
  const goPrev = useCallback(() => setCurrentSlide((s) => Math.max(s - 1, 0)), []);

  const handleSlideTap = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < rect.width / 3) goPrev(); else goNext();
  }, [goPrev, goNext]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight" || e.key === " ") goNext();
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, goPrev, goNext]);

  useEffect(() => { if (open) setCurrentSlide(0); }, [open]);

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
            text: `${formatMinutes(recap.totalFocusMinutes)} de foco, ${recap.longestStreak} ${plural(recap.longestStreak, "dia", "dias")} de sequência!`,
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
            icon={<Zap size={52} color={THEMES.garden.accent} strokeWidth={1.5} />}
          />
        );
      case 5:
        return (
          <SummarySlide
            recap={recap}
            userName={userName}
            userPhotoUrl={userPhotoUrl}
            monthLabel={monthLabel}
            onDownload={handleDownload}
            onShare={handleShare}
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
        onClick={() => setOpen(true)}
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
          <p className="truncate text-xs text-[var(--text-muted)]">
            {formatMinutes(recap.totalFocusMinutes)} de foco · {recap.longestStreak} {plural(recap.longestStreak, "dia", "dias")} de sequência
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-[var(--accent-border)] bg-[var(--accent)]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">
          Recap
        </span>
      </motion.button>

      {/* Modal */}
      <AnimatePresence>
        {open && (
          <Modal onClose={() => setOpen(false)}>
            <div className="relative flex w-full max-w-[420px] flex-col items-center">
              <button
                onClick={() => setOpen(false)}
                className="absolute right-2 top-2 z-30 rounded-full bg-[rgba(0,0,0,0.45)] p-2 backdrop-blur-sm transition-colors hover:bg-[rgba(0,0,0,0.65)]"
                aria-label="Fechar"
              >
                <X size={18} className="text-white/80" />
              </button>

              <div
                className="relative w-full overflow-hidden rounded-2xl"
                style={{ aspectRatio: "9/16", maxHeight: "calc(100dvh - 80px)", boxShadow: "0 25px 60px -12px rgba(0,0,0,.65)" }}
                onClick={handleSlideTap}
              >
                <ProgressBar current={currentSlide} total={SLIDE_COUNT} />

                {!reduced && (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); goPrev(); }}
                      disabled={currentSlide === 0}
                      className="absolute left-2 top-1/2 -translate-y-1/2 z-20 rounded-full bg-[rgba(0,0,0,0.35)] p-1.5 backdrop-blur-sm transition-all hover:bg-[rgba(0,0,0,0.55)] disabled:opacity-0"
                      aria-label="Slide anterior"
                    >
                      <ChevronLeft size={18} className="text-white/70" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); goNext(); }}
                      disabled={currentSlide === SLIDE_COUNT - 1}
                      className="absolute right-2 top-1/2 -translate-y-1/2 z-20 rounded-full bg-[rgba(0,0,0,0.35)] p-1.5 backdrop-blur-sm transition-all hover:bg-[rgba(0,0,0,0.55)] disabled:opacity-0"
                      aria-label="Próximo slide"
                    >
                      <ChevronRight size={18} className="text-white/70" />
                    </button>
                  </>
                )}

                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={currentSlide}
                    className="absolute inset-0"
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.02 }}
                    transition={{ duration: reduced ? 0 : 0.22, ease: "easeInOut" }}
                  >
                    {renderSlide()}
                  </motion.div>
                </AnimatePresence>
              </div>

              <motion.p
                className="mt-3 text-[10px] tracking-[0.18em] uppercase"
                style={{ color: "rgba(231,244,255,.22)" }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.2 }}
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
