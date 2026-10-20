"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  X,
  Download,
  Share2,
  ChevronLeft,
  Timer,
  Flame,
  Award,
  Zap,
  TrendingUp,
} from "lucide-react";
import Image from "next/image";
import type { MonthlyRecap, NewLeagueTier } from "@/types";
import { NEW_TIER_META, resolveNewTier } from "@/lib/league-new-meta";
import { useRecapSound } from "@/lib/recap-sound";
import { Recap3DIcon } from "./recap-fx";

// ─── Design Tokens ────────────────────────────────────────────────────────────────

const ACCENT = {
  focus: "#5CC8FF",
  streak: "#FFB067",
  garden: "#3DDC84",
  xp: "#A98BFF",
  tier: {
    BRONZE: "#cd7f32",
    PRATA: "#c0c0c0",
    OURO: "#ffd700",
    DIAMANTE: "#00bfff",
    LENDAS: "#ff69b4",
  },
} as const;

// 3D Art asset paths (fallback order)
const RECAP_ART = {
  foco: ["/recaps/clock.png", "/recap/icons/recap-foco.png"],
  sequencia: ["/recaps/streak.png", "/recap/icons/recap-sequencia.png"],
  jardim: ["/recaps/energy.png", "/recap/icons/recap-jardim.png"],
  xp: ["/recaps/xp.png", "/recap/icons/recap-xp.png", "/xp/xp_double_thunder.png"],
} as const;

// Canvas export dimensions
const EXPORT_W = 1080;
const EXPORT_H = 1920;

// ─── Helpers ─────────────────────────────────────────────────────────────────────

function formatMinutes(total: number): string {
  if (total < 60) return `${total}min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function formatNumber(n: number): string {
  return n.toLocaleString("pt-BR");
}

function formatMonth(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
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

// ─── Canvas Export ─────────────────────────────────────────────────────

async function exportToPng(
  recap: MonthlyRecap,
  userName: string,
  userPhotoUrl?: string,
  tier: NewLeagueTier | null = null,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = EXPORT_W;
  canvas.height = EXPORT_H;
  const ctx = canvas.getContext("2d")!;
  const pad = 120;

  const tierColor = tier ? (ACCENT.tier[tier] ?? "#71d4ff") : ACCENT.focus;

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, 0, EXPORT_H);
  bg.addColorStop(0, "#050B16");
  bg.addColorStop(1, "#0a101f");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, EXPORT_W, EXPORT_H);

  // Ambient glows
  const drawGlow = (x: number, y: number, r: number, color: string) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };
  drawGlow(EXPORT_W * 0.2, 200, 280, "rgba(113,212,255,.06)");
  drawGlow(EXPORT_W * 0.75, 400, 180, "rgba(182,156,255,.04)");
  drawGlow(EXPORT_W * 0.3, EXPORT_H * 0.55, 220, "rgba(255,184,107,.05)");
  drawGlow(EXPORT_W * 0.8, EXPORT_H * 0.8, 200, "rgba(74,222,128,.04)");

  // Title
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(231,244,255,.42)";
  ctx.font = "500 28px 'Inter', -apple-system, sans-serif";
  ctx.fillText("Recap de", EXPORT_W / 2, 100);

  const monthLabel = formatMonth(recap.recapMonth);
  const titleGrad = ctx.createLinearGradient(EXPORT_W * 0.25, 0, EXPORT_W * 0.75, 0);
  titleGrad.addColorStop(0, "#71d4ff");
  titleGrad.addColorStop(0.5, "#b69cff");
  titleGrad.addColorStop(1, "#ffb86b");
  ctx.fillStyle = titleGrad;
  ctx.font = "800 72px 'Inter', -apple-system, sans-serif";
  ctx.fillText(monthLabel, EXPORT_W / 2, 180);

  // User info
  ctx.fillStyle = "rgba(231,244,255,.72)";
  ctx.font = "600 26px 'Inter', -apple-system, sans-serif";
  ctx.fillText(userName, EXPORT_W / 2, 340);

  // Stats grid
  const gap = 28;
  const colW = (EXPORT_W - pad * 2 - gap) / 2;
  const cardH = 160;
  const gridTop = 450;

  const stats = [
    { label: "Foco", value: formatMinutes(recap.totalFocusMinutes), color: ACCENT.focus, wide: true },
    { label: "Sequência", value: `${recap.longestStreak} dias`, color: ACCENT.streak },
    { label: "Liga", value: tier ?? "—", color: tierColor },
    { label: "Energias", value: formatNumber(recap.gardenCount ?? 0), color: ACCENT.garden },
    { label: "XP", value: formatNumber(recap.totalXp), color: ACCENT.xp, wide: true },
  ];

  for (let i = 0; i < stats.length; i++) {
    const s = stats[i];
    const isWide = s.wide ?? false;

    let gridRow: number;
    let colOffset: number;
    if (isWide) {
      gridRow = i === 0 ? 0 : 2;
      colOffset = 0;
    } else {
      gridRow = 1;
      colOffset = i === 2 ? 0 : 1;
    }

    const x = pad + colOffset * (colW + gap);
    const y = gridTop + gridRow * (cardH + gap);
    const w = isWide ? (EXPORT_W - pad * 2) : colW;

    // Card bg
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    ctx.beginPath();
    ctx.moveTo(x + 20, y);
    ctx.arcTo(x + w, y, x + w, y + cardH, 20);
    ctx.arcTo(x + w, y + cardH, x, y + cardH, 20);
    ctx.arcTo(x, y + cardH, x, y, 20);
    ctx.arcTo(x, y, x + w, y, 20);
    ctx.closePath();
    ctx.fill();

    // Glowing border
    ctx.strokeStyle = hexToRgba(s.color, 0.5);
    ctx.shadowColor = hexToRgba(s.color, 0.35);
    ctx.shadowBlur = 16;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Value
    ctx.textAlign = "center";
    ctx.fillStyle = s.color;
    ctx.font = "800 48px 'Inter', -apple-system, sans-serif";
    ctx.fillText(s.value, x + w / 2, y + cardH * 0.55);

    // Label
    ctx.fillStyle = "rgba(231,244,255,.45)";
    ctx.font = "500 16px 'Inter', -apple-system, sans-serif";
    ctx.fillText(s.label, x + w / 2, y + cardH - 20);
  }

  // Footer
  const footY = EXPORT_H - 150;
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(231,244,255,.52)";
  ctx.font = "800 36px 'Inter', -apple-system, sans-serif";
  ctx.fillText("ENERGYOS", EXPORT_W / 2, footY + 60);

  ctx.fillStyle = "rgba(231,244,255,.3)";
  ctx.font = "400 20px 'Inter', -apple-system, sans-serif";
  ctx.fillText(`Gerado em ${new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}`, EXPORT_W / 2, footY + 90);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), "image/png");
  });
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function CategoryPill({ category, color }: { category: string; color: string }) {
  return (
    <div
      className="px-3 py-1.5 rounded-full text-xs font-semibold"
      style={{
        background: `${color}15`,
        color,
        border: `1px solid ${color}30`,
      }}
    >
      {category}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  color: string;
  iconSrc?: string | readonly string[];
  fallbackIcon: React.ReactNode;
  isWide?: boolean;
}

function StatCard({ label, value, color, iconSrc, fallbackIcon, isWide = false }: StatCardProps) {
  const [iconFailed, setIconFailed] = useState(false);
  const showFallback = !iconSrc || iconFailed;
  const displaySrc = Array.isArray(iconSrc)
    ? iconSrc.find((s) => !iconFailed) ?? iconSrc[0]
    : iconSrc;

  return (
    <motion.div
      className={`flex items-center justify-center gap-3 rounded-xl p-3 transition-all duration-200 ${isWide ? "flex-row" : "flex-col"} ${isWide ? "text-left" : "text-center"}`}
      style={{
        background: "rgba(255,255,255,0.04)",
        border: `1px solid ${hexToRgba(color, 0.3)}`,
        boxShadow: `0 8px 24px -8px rgba(0,0,0,0.4), 0 0 14px -4px ${color}`,
        minWidth: isWide ? "180px" : "90px",
      }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Icon */}
      <div
        className="flex items-center justify-center rounded-full"
        style={{
          background: `${color}22`,
          boxShadow: `0 0 12px -4px ${color}`,
        }}
      >
        {!showFallback && displaySrc ? (
          <Image
            src={displaySrc}
            alt={label}
            width={18}
            height={18}
            style={{ objectFit: "contain" }}
            unoptimized
            onError={() => setIconFailed(true)}
          />
        ) : (
          fallbackIcon
        )}
      </div>

      {/* Value and label */}
      <div className="flex flex-col">
        <span
          className="font-display text-sm font-bold tabular-nums"
          style={{ color }}
        >
          {value}
        </span>
        <span className="text-xs uppercase tracking-wider" style={{ color: "rgba(231,244,255,.45)" }}>
          {label}
        </span>
      </div>
    </motion.div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

interface FinalPageProps {
  recap: MonthlyRecap;
  userName: string;
  userPhotoUrl?: string;
  onClose: () => void;
}

export function FinalPage({ recap, userName, userPhotoUrl, onClose }: FinalPageProps) {
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const reduced = useReducedMotion();
  const { enabled: soundEnabled, play: playSound } = useRecapSound();

  const currentTier = useMemo(() => {
    return resolveNewTier(recap.leagueTier);
  }, [recap.leagueTier]);

  const tierMeta = currentTier ? NEW_TIER_META[currentTier] : NEW_TIER_META.BRONZE;
  const tierColor = tierMeta ? tierMeta.color : ACCENT.tier.BRONZE;

  const monthLabel = useMemo(() => formatMonth(recap.recapMonth), [recap.recapMonth]);

  // Play entrance sound once
  useEffect(() => {
    if (soundEnabled) {
      playSound("sparkle");
    }
  }, [soundEnabled, playSound]);

  const handleDownload = useCallback(async () => {
    setDownloading(true);
    try {
      const blob = await exportToPng(recap, userName, userPhotoUrl, currentTier);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `recap-energyos-${recap.recapMonth.slice(0, 7)}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }, [recap, userName, userPhotoUrl, currentTier]);

  const handleShare = useCallback(async () => {
    setSharing(true);
    try {
      const blob = await exportToPng(recap, userName, userPhotoUrl, currentTier);
      const file = new File([blob], `recap-energyos-${recap.recapMonth.slice(0, 7)}.png`, { type: "image/png" });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Meu recap de ${monthLabel} no EnergyOS`,
          text: `Meu recap de ${monthLabel} no EnergyOS`,
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `recap-energyos-${recap.recapMonth.slice(0, 7)}.png`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        return;
      }
    } finally {
      setSharing(false);
    }
  }, [recap, userName, userPhotoUrl, currentTier, monthLabel]);

  // Calculate progression indicator
  const hasProgression = recap.leagueAtStart && recap.leagueAtStart !== recap.leagueTier;

  return (
    <div className="relative z-[1000] w-full max-w-sm sm:max-w-md">
      <motion.div
        className="flex flex-col items-center gap-6 rounded-2xl bg-[var(--bg-primary)] p-5 sm:p-6 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.65)]"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 360, damping: 28 }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-50 rounded-lg p-2 text-[var(--text-muted)] transition hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text)]"
          aria-label="Fechar"
        >
          <X size={20} />
        </button>

        {/* Back button */}
        <button
          onClick={onClose}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-40 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--bg-surface-hover)] text-[var(--text-muted)] transition hover:bg-[var(--bg-surface)]"
          aria-label="Voltar"
        >
          <ChevronLeft size={16} />
        </button>

        {/* Hero Section */}
        <motion.div
          className="flex flex-col items-center gap-4 pt-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          {/* Year label */}
          <span className="text-xs uppercase tracking-wider" style={{ color: "rgba(231,244,255,.38)" }}>
            Recap de
          </span>

          {/* Month title */}
          <h2
            className="font-display text-2xl font-extrabold text-center"
            style={{
              background: "linear-gradient(135deg, #71d4ff, #b69cff, #ffb86b)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            {monthLabel}
          </h2>

          {/* User identity */}
          <div className="flex items-center gap-3">
            {userPhotoUrl ? (
              <Image
                src={userPhotoUrl}
                alt={userName}
                width={48}
                height={48}
                className="rounded-full object-cover ring-2 ring-[rgba(255,255,255,.12)]"
                unoptimized
                draggable={false}
              />
            ) : (
              <div
                className="flex h-12 w-12 items-center justify-center rounded-full text-xl font-bold"
                style={{ background: `linear-gradient(135deg, ${tierColor}, ${ACCENT.xp})` }}
              >
                {userName.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <p className="font-display text-base font-semibold text-[var(--text)]">{userName}</p>
              <p className="text-xs" style={{ color: "rgba(231,244,255,.52)" }}>energyOS</p>
            </div>
          </div>

          {/* Favorite category pill */}
          <motion.div
            className="mt-2"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15, duration: 0.3 }}
          >
            <CategoryPill
              category={recap.topFocusCategory ?? "Foco"}
              color={recap.topFocusCategory === "Foco" ? ACCENT.focus :
                     recap.topFocusCategory === "Sequência" ? ACCENT.streak :
                     recap.topFocusCategory === "Liga" ? tierColor :
                     ACCENT.garden}
            />
          </motion.div>
        </motion.div>

        {/* 3D Leaderboard Icon with glow */}
        <motion.div
          className="relative mb-2"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 280, damping: 26 }}
        >
          <Recap3DIcon
            src={tierMeta?.iconPath}
            fallback={<Award size={48} color={tierColor} strokeWidth={2} />}
            alt={tierMeta?.label ?? "Liga"}
            accent={tierColor}
            size={100}
            artSize={64}
          />
          {/* Ambient glow */}
          <div
            className="absolute -inset-3 rounded-full pointer-events-none"
            style={{
              background: `radial-gradient(circle, ${tierColor}33, transparent 70%)`,
              filter: "blur(16px)",
            }}
          />
        </motion.div>

        {/* Highlights Grid */}
        <div className="w-full">
          <div className="grid grid-cols-2 gap-3">
            {/* Foco - wide */}
            <StatCard
              label="Foco"
              value={formatMinutes(recap.totalFocusMinutes)}
              color={ACCENT.focus}
              iconSrc={RECAP_ART.foco}
              fallbackIcon={<Timer size={18} color={ACCENT.focus} strokeWidth={1.8} />}
              isWide
            />

            {/* Sequência */}
            <StatCard
              label="Sequência"
              value={`${recap.longestStreak} dias`}
              color={ACCENT.streak}
              iconSrc={RECAP_ART.sequencia}
              fallbackIcon={<Flame size={18} color={ACCENT.streak} strokeWidth={1.8} />}
            />

            {/* Liga */}
            <StatCard
              label="Liga"
              value={tierMeta?.label ?? "Bronze"}
              color={tierColor}
              iconSrc={tierMeta?.iconPath}
              fallbackIcon={<Award size={18} color={tierColor} strokeWidth={1.8} />}
            />

            {/* Energias */}
            <StatCard
              label="Energias"
              value={formatNumber(recap.gardenCount ?? 0)}
              color={ACCENT.garden}
              iconSrc={RECAP_ART.jardim}
              fallbackIcon={<Zap size={18} color={ACCENT.garden} strokeWidth={1.8} />}
            />

            {/* XP - wide */}
            <StatCard
              label="XP"
              value={formatNumber(recap.totalXp)}
              color={ACCENT.xp}
              iconSrc={RECAP_ART.xp}
              fallbackIcon={<Zap size={18} color={ACCENT.xp} strokeWidth={1.8} />}
              isWide
            />
          </div>
        </div>

        {/* Progression indicator */}
        {hasProgression && (
          <motion.div
            className="flex items-center gap-2 rounded-full bg-green-500/20 px-3 py-1.5"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ border: "1px solid rgba(74,222,128,.4)" }}
          >
            <TrendingUp size={14} color="#4ade80" />
            <span className="text-xs font-semibold text-green-400">Subiu de liga!</span>
          </motion.div>
        )}

        {/* Footer actions */}
        <div className="w-full pt-4">
          {/* Action buttons */}
          <div className="flex gap-3">
            <motion.button
              whileHover={!reduced ? { scale: 1.02 } : undefined}
              whileTap={!reduced ? { scale: 0.97 } : undefined}
              onClick={handleDownload}
              disabled={downloading}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-white font-semibold shadow-[0_4px_12px_rgba(113,212,255,0.3)] transition hover:shadow-[0_6px_18px_rgba(113,212,255,0.4)] disabled:opacity-50"
            >
              {downloading ? "Salvando..." : "Baixar"}
              <Download size={16} />
            </motion.button>

            <motion.button
              whileHover={!reduced ? { scale: 1.02 } : undefined}
              whileTap={!reduced ? { scale: 0.97 } : undefined}
              onClick={handleShare}
              disabled={downloading || sharing}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-[var(--accent-border)] bg-[var(--bg-surface-hover)] px-4 py-2.5 text-[var(--accent)] font-semibold transition hover:bg-[var(--bg-surface)] disabled:opacity-50"
            >
              {sharing ? "Compartilhando..." : "Compartilhar"}
              <Share2 size={16} />
            </motion.button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}