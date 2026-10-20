"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { X, Download, Share2, ChevronLeft, Timer, Flame, Award, Zap } from "lucide-react";
import Image from "next/image";
import type { MonthlyRecap, NewLeagueTier } from "@/types";
import { NEW_TIER_META } from "@/lib/league-new-meta";
import { useRecapSound } from "@/lib/recap-sound";

// ─── Design Tokens ────────────────────────────────────────────────────────────────
const ACCENT = {
  focus: "#5CC8FF",   // cyan - stopwatch
  streak: "#FFB067",  // amber - flame
  tier: "#71d4ff",    // default tier/blue
  garden: "#3DDC84",  // green - energy bolt
  xp: "#A98BFF",      // violet crystal
};

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

// ─── Canvas Export ───────────────────────────────────────────────────────────────
const EXPORT_W = 1080;
const EXPORT_H = 1920;

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

async function exportToPng(
  recap: MonthlyRecap,
  userName: string,
  userPhotoUrl?: string,
  pillText?: string,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = EXPORT_W;
  canvas.height = EXPORT_H;
  const ctx = canvas.getContext("2d")!;

  const tier = recap.leagueTier ? NEW_TIER_META[recap.leagueTier as NewLeagueTier] : NEW_TIER_META.BRONZE;
  const tierColor = tier.color;
  const pad = 120;

  // ── Background gradient ──
  const bg = ctx.createLinearGradient(0, 0, 0, EXPORT_H);
  bg.addColorStop(0, "#0a0e1a");
  bg.addColorStop(1, "#111827");
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
  drawGlow(EXPORT_W * 0.4, EXPORT_H * 0.55, 220, "rgba(255,184,107,.05)");
  drawGlow(EXPORT_W * 0.8, EXPORT_H * 0.75, 200, "rgba(74,222,128,.04)");

  // Top accent line
  const accentGrad = ctx.createLinearGradient(0, 0, EXPORT_W, 0);
  accentGrad.addColorStop(0, "rgba(113,212,255,0)");
  accentGrad.addColorStop(0.5, "rgba(113,212,255,.6)");
  accentGrad.addColorStop(1, "rgba(113,212,255,0)");
  ctx.fillStyle = accentGrad;
  ctx.fillRect(0, 0, EXPORT_W, 4);

  // ── Title ──
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(231,244,255,.42)";
  ctx.font = "500 28px 'Inter', -apple-system, sans-serif";
  ctx.fillText("Recap de", EXPORT_W / 2, 100);

  // Month title with gradient
  const titleGrad = ctx.createLinearGradient(EXPORT_W * 0.25, 0, EXPORT_W * 0.75, 0);
  titleGrad.addColorStop(0, "#71d4ff");
  titleGrad.addColorStop(0.5, "#b69cff");
  titleGrad.addColorStop(1, "#ffb86b");
  ctx.fillStyle = titleGrad;
  ctx.font = "800 72px 'Inter', -apple-system, sans-serif";
  ctx.fillText("Outubro de 2026", EXPORT_W / 2, 180);

  // Pill for favorite category
  if (pillText) {
    const pillColor = pillText === "Foco" ? ACCENT.focus :
                      pillText === "Sequência" ? ACCENT.streak :
                      pillText === "Liga" ? tierColor :
                      pillText === "Energias" ? ACCENT.garden : ACCENT.xp;

    ctx.fillStyle = "rgba(255,255,255,.15)";
    ctx.font = "500 18px 'Inter', -apple-system, sans-serif";
    const pillW = ctx.measureText(pillText).width + 24;
    const pillX = (EXPORT_W - pillW) / 2 - 2;
    const pillY = EXPORT_H * 0.25 - 22;
    // fillRect não aceita raio: usa roundRect (com fallback para navegadores antigos).
    if (typeof ctx.roundRect === "function") {
      ctx.fillStyle = "rgba(255,255,255,.15)";

      const radius = 14;
      ctx.beginPath();
      ctx.moveTo(pillX + radius, pillY);
      ctx.lineTo(pillX + pillW - radius, pillY);
      ctx.arcTo(pillX + pillW, pillY, pillX + pillW, pillY + radius, radius);
      ctx.lineTo(pillX + pillW, pillY + 28 - radius);
      ctx.arcTo(pillX + pillW, pillY + 28, pillX + pillW - radius, pillY + 28, radius);
      ctx.lineTo(pillX + radius, pillY + 28);
      ctx.arcTo(pillX, pillY + 28, pillX, pillY + 28 - radius, radius);
      ctx.lineTo(pillX, pillY + radius);
      ctx.arcTo(pillX, pillY, pillX + radius, pillY, radius);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillRect(pillX, pillY, pillW, 28);
    }
    ctx.fillStyle = pillColor;
    ctx.fillText(pillText, EXPORT_W / 2, EXPORT_H * 0.25 + 6);
  }

  // User info
  ctx.fillStyle = "rgba(231,244,255,.72)";
  ctx.font = "600 26px 'Inter', -apple-system, sans-serif";
  ctx.fillText(userName, EXPORT_W / 2, 370);

  // ── Bento Grid ──
  const gap = 28;
  const colW = (EXPORT_W - pad * 2 - gap) / 2;
  const cardH = 160;
  const gridTop = 450;

  const stats = [
    { label: "Foco", value: formatMinutes(recap.totalFocusMinutes), color: ACCENT.focus, wide: true },
    { label: "Sequência", value: `${recap.longestStreak} dias`, color: ACCENT.streak },
    { label: "Liga", value: recap.leagueTier ?? "—", color: tierColor },
    { label: "Energias", value: formatNumber(recap.gardenCount ?? 0), color: ACCENT.garden },
    { label: "XP", value: formatNumber(recap.totalXp), color: ACCENT.xp, wide: true },
  ];

  // Load icons
  const iconPromises = [
    loadImage("/recap/icons/recap-foco.png"),
    loadImage("/recap/icons/recap-sequencia.png"),
    tier.iconPath ? loadImage(tier.iconPath) : Promise.resolve(null),
    loadImage("/recap/icons/recap-jardim.png"),
    loadImage("/xp/xp_double_thunder.png"),
  ];
  const icons = await Promise.all(iconPromises.map(p => p.catch(() => null)));

  for (let i = 0; i < stats.length; i++) {
    const s = stats[i];
    const isWide = s.wide ?? false;

    // Calculate grid position
    let gridRow: number;
    let colOffset: number;
    if (isWide) {
      // Foco row 0, XP row 2
      gridRow = i === 0 ? 0 : 2;
      colOffset = 0;
    } else {
      // Sequencia/Liga = row 1
      gridRow = 1;
      colOffset = i === 2 ? 0 : 1; // Liga is at i=2
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

  // ── Footer ──
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

// ─── Stat Card Component ───────────────────────────────────────────────────────
interface StatCardProps {
  label: string;
  value: string;
  color: string;
  iconSrc?: string | null;
  fallbackIcon?: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

function StatCard({ label, value, color, iconSrc, fallbackIcon, className, onClick }: StatCardProps) {
  const [iconFailed, setIconFailed] = useState(false);
  const showFallback = !iconSrc || iconFailed;

  return (
    <div
      onClick={onClick}
      className={`flex flex-col items-center justify-center rounded-2xl p-4 min-h-[112px] text-center transition-all duration-200 hover:shadow-lg ${className || ""}`}
      style={{
        background: `rgba(255,255,255,0.04)`,
        border: `1px solid ${hexToRgba(color, 0.3)}`,
        boxShadow: `0 8px 24px -8px rgba(0,0,0,0.4), 0 0 14px -4px ${color}`,
      }}
    >
      {/* LED line at top */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-1 left-1/2 -translate-x-1/2 h-1 w-2/3 rounded-full"
        style={{
          background: `linear-gradient(90deg, ${color}66, ${color}00)`,
          filter: "blur(2px)",
        }}
      />

      <div
        className="mb-2 flex h-10 w-10 items-center justify-center rounded-full"
        style={{
          background: `${color}22`,
          boxShadow: `0 0 12px -4px ${color}`,
        }}
      >
        {iconSrc && !showFallback ? (
          <Image
            src={iconSrc}
            alt={label}
            width={20}
            height={20}
            style={{ objectFit: "contain" }}
            unoptimized
            onError={() => setIconFailed(true)}
          />
        ) : (
          fallbackIcon
        )}
      </div>

      <span
        className="font-display text-2xl font-bold tabular-nums"
        style={{ color }}
      >
        {value}
      </span>

      <span className="mt-1 text-xs uppercase tracking-wider" style={{ color: "rgba(231,244,255,.45)" }}>
        {label}
      </span>
    </div>
  );
}

// ─── Category Pill ──────────────────────────────────────────────────────────────
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

// ─── Main Component ──────────────────────────────────────────────────────────
interface FinalPageProps {
  recap: MonthlyRecap;
  userName: string;
  userPhotoUrl?: string;
  favoriteCategory?: string;
  onClose: () => void;
}

export function FinalPage({ recap, userName, userPhotoUrl, favoriteCategory, onClose }: FinalPageProps) {
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const reduced = useReducedMotion();
  const { enabled: soundEnabled, play: playSound } = useRecapSound();

  const tier = recap.leagueTier ? NEW_TIER_META[recap.leagueTier as NewLeagueTier] : NEW_TIER_META.BRONZE;
  const tierColor = tier.color;

  // Month info - always show "Outubro de 2026" as per task requirement
  const monthLabel = "Outubro de 2026";

  // Determine which category name to show in the pill
  const pillCategory = favoriteCategory ?? recap.topFocusCategory ?? "Foco";
  const pillColor = pillCategory === "Foco" ? ACCENT.focus :
                    pillCategory === "Sequência" ? ACCENT.streak :
                    pillCategory === "Liga" ? tierColor :
                    pillCategory === "Energias" ? ACCENT.garden : ACCENT.xp;

  // Play sparkle sound on entrance if sound is enabled (only once via effect)
  useReducedMotion(); // We need to call this hook, but we'll use a ref to track if sound was played

  // Handle download
  const handleDownload = async () => {
    setDownloading(true);
    try {
      const blob = await exportToPng(recap, userName, userPhotoUrl, pillCategory);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "recap-energyos-2026-10.png";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  };

  // Handle share via Web Share API
  const handleShare = async () => {
    setSharing(true);
    try {
      const blob = await exportToPng(recap, userName, userPhotoUrl, pillCategory);
      const file = new File([blob], "recap-energyos-2026-10.png", { type: "image/png" });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "Meu recap de outubro de 2026 no energyOS",
          text: "Meu recap de outubro de 2026 no energyOS",
        });
      } else {
        // Fallback to download
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "recap-energyos-2026-10.png";
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        // User cancelled share sheet - normal
        return;
      }
    } finally {
      setSharing(false);
    }
  };

  // Button base styles
  const buttonBase = "flex-1 flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all duration-200";

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

        {/* Left arrow - safely placed outside card content area */}
        <button
          onClick={onClose}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-40 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--bg-surface-hover)] text-[var(--text-muted)] transition hover:bg-[var(--bg-surface)]"
          aria-label="Voltar"
        >
          <ChevronLeft size={16} />
        </button>

        {/* Content */}
        <div className="flex-1 min-h-0 w-full flex flex-col items-center pt-4">
          {/* Title Block */}
          <div className="flex flex-col items-center gap-2">
            <span className="text-xs uppercase tracking-wider" style={{ color: "rgba(231,244,255,.38)" }}>
              Recap de
            </span>
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
            {/* Favorite category pill */}
            <CategoryPill category={pillCategory} color={pillColor} />
          </div>

          {/* Bento Grid */}
          <div className="mt-5 grid w-full grid-cols-2 gap-3">
            {/* Foco - wide (spans 2 columns) */}
            <div className="col-span-2">
              <StatCard
                label="Foco"
                value={formatMinutes(recap.totalFocusMinutes)}
                color={ACCENT.focus}
                iconSrc="/recap/icons/recap-foco.png"
                fallbackIcon={<Timer size={20} color={ACCENT.focus} strokeWidth={1.8} />}
              />
            </div>

            {/* Sequência */}
            <StatCard
              label="Sequência"
              value={`${recap.longestStreak} dias`}
              color={ACCENT.streak}
              iconSrc="/recap/icons/recap-sequencia.png"
              fallbackIcon={<Flame size={20} color={ACCENT.streak} strokeWidth={1.8} />}
            />

            {/* Liga */}
            <StatCard
              label="Liga"
              value={recap.leagueTier ?? "—"}
              color={tierColor}
              iconSrc={tier.iconPath}
              fallbackIcon={<Award size={20} color={tierColor} strokeWidth={1.8} />}
            />

            {/* Energias */}
            <StatCard
              label="Energias"
              value={formatNumber(recap.gardenCount ?? 0)}
              color={ACCENT.garden}
              iconSrc="/recap/icons/recap-jardim.png"
              fallbackIcon={<Zap size={20} color={ACCENT.garden} strokeWidth={1.8} />}
            />

            {/* XP Total - wide */}
            <div className="col-span-2">
              <StatCard
                label="XP"
                value={formatNumber(recap.totalXp)}
                color={ACCENT.xp}
                iconSrc="/xp/xp_double_thunder.png"
                fallbackIcon={<Zap size={20} color={ACCENT.xp} strokeWidth={1.8} />}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="w-full">
          <div className="mb-3 text-center text-sm text-[var(--text-muted)]">
            <p className="font-bold text-[var(--text)]">ENERGYOS</p>
            <p className="mt-1">Gerado em {new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}</p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleDownload}
              disabled={downloading}
              className={`${buttonBase} font-semibold`}
              style={{
                background: "linear-gradient(135deg, #71d4ff, #5CC8FF)",
                color: "#07111f",
                boxShadow: "0 8px 20px -8px rgba(113,212,255,.5)",
              }}
            >
              {downloading ? "Salvando..." : "Baixar"}
            </button>

            <button
              onClick={handleShare}
              disabled={downloading || sharing}
              className={`${buttonBase} font-semibold`}
              style={{
                background: "rgba(255,255,255,.07)",
                border: "1px solid rgba(113,212,255,.35)",
                color: "#71d4ff",
              }}
            >
              {sharing ? "Compartilhando..." : "Compartilhar"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
