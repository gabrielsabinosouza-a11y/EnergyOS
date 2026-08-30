"use client";

import { useRef, useState, useCallback } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { X, Download, Share2, Trophy, Timer, Award } from "lucide-react";
import Image from "next/image";
import { Modal } from "@/components/modal";
import { NEW_TIER_META, resolveNewTier } from "@/lib/league-new-meta";
import type { NewLeagueTier } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MonthlyRecapProps {
  recap: {
    recapMonth: string;
    totalFocusMinutes: number;
    longestStreak: number;
    leagueTier?: string;
    leaguePromoted?: boolean;
    productivityTag?: string;
  };
  userName: string;
  userPhotoUrl?: string;
  onShare?: (blob: Blob) => void;
}

// ─── Tier helpers ─────────────────────────────────────────────────────────────

function tierMeta(tier?: string) {
  const resolved = resolveNewTier(tier);
  if (resolved) return { tier: resolved, meta: NEW_TIER_META[resolved] };
  return { tier: null as NewLeagueTier | null, meta: null };
}

// ─── Canvas capture ───────────────────────────────────────────────────────────

const CARD_W = 1080;
const CARD_H = 1350;

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

// Render lucide-style icons on canvas via inline SVG data URIs
function lucideSvg(paths: string, color: string, size = 48): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
  return "data:image/svg+xml," + encodeURIComponent(svg);
}

const TIMER_SVG = `<line x1="10" x2="14" y1="2" y2="2"/><line x1="12" x2="15" y1="14" y2="11"/><circle cx="12" cy="14" r="8"/>`;
const AWARD_SVG = `<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>`;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("img load failed"));
    img.src = src;
  });
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

interface TileSpec {
  label: string;
  value: string;
  color: string;
  glow: string;
  col: number;
  row: number;
  kind: "focus" | "streak" | "tier" | "tag";
  tier?: NewLeagueTier | null;
}

async function captureCard(
  recap: MonthlyRecapProps["recap"],
  userName: string,
  userPhotoUrl?: string,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d")!;
  const pad = 72;

  const { tier, meta } = tierMeta(recap.leagueTier);
  const tierColor = meta ? meta.color : "#71d4ff";

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

  const monthLabel = formatMonth(recap.recapMonth);
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

  // ── Preload images ──
  const tierImg = tier && meta ? await loadImage(meta.iconPath).catch(() => null) : null;
  const streakImg = await loadImage("/streak/streak_alive.png").catch(() => null);

  // ── Stats grid ──
  const tiles: TileSpec[] = [
    { label: "Foco total", value: formatMinutes(recap.totalFocusMinutes), color: "#71d4ff", glow: "rgba(113,212,255,.35)", col: 0, row: 0, kind: "focus" },
    { label: "Sequência", value: `${recap.longestStreak} dias`, color: "#ff8c42", glow: "rgba(255,140,66,.35)", col: 1, row: 0, kind: "streak" },
    { label: "Liga", value: meta ? meta.label : "—", color: tierColor, glow: `${tierColor}55`, col: 0, row: 1, kind: "tier", tier },
    { label: "Tag", value: recap.productivityTag ?? "—", color: "#b69cff", glow: "rgba(182,156,255,.35)", col: 1, row: 1, kind: "tag" },
  ];

  const colW = (CARD_W - pad * 2) / 2;
  const rowH = 272;
  const gridTop = y + 22;

  for (const s of tiles) {
    const sx = pad + s.col * colW;
    const sy = gridTop + s.row * rowH;
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
    if (s.kind === "focus") {
      const icon = await loadImage(lucideSvg(TIMER_SVG, s.color));
      const s2 = 26;
      ctx.drawImage(icon, chipX - s2 / 2, chipY - s2 / 2, s2, s2);
    } else if (s.kind === "tag") {
      const icon = await loadImage(lucideSvg(AWARD_SVG, s.color));
      const s2 = 26;
      ctx.drawImage(icon, chipX - s2 / 2, chipY - s2 / 2, s2, s2);
    } else if (s.kind === "streak" && streakImg) {
      const s2 = 40;
      ctx.drawImage(streakImg, chipX - s2 / 2, chipY - s2 / 2, s2, s2);
    } else if (s.kind === "tier" && tierImg) {
      const s2 = 40;
      ctx.drawImage(tierImg, chipX - s2 / 2, chipY - s2 / 2, s2, s2);
    } else if (s.kind === "tier") {
      const icon = await loadImage(lucideSvg(AWARD_SVG, s.color));
      const s2 = 26;
      ctx.drawImage(icon, chipX - s2 / 2, chipY - s2 / 2, s2, s2);
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

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ─── Stat tile (premium glass) ───────────────────────────────────────────────

function statSpec(recap: MonthlyRecapProps["recap"]): {
  focus: { color: string; glow: string };
  streak: { color: string; glow: string };
  lower: { color: string; glow: string };
  tierLabel?: string;
} {
  const { meta } = tierMeta(recap.leagueTier);
  const tierColor = meta ? meta.color : "#71d4ff";
  return {
    focus: { color: "#71d4ff", glow: "rgba(113,212,255,.35)" },
    streak: { color: "#ff8c42", glow: "rgba(255,140,66,.35)" },
    lower: { color: tierColor, glow: `${tierColor}55` },
    tierLabel: meta ? meta.label : "—",
  };
}

function Tile({
  children,
  color,
  glow,
  style,
}: {
  children: React.ReactNode;
  color: string;
  glow: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className="relative flex flex-col items-center justify-center overflow-hidden rounded-2xl p-3 text-center"
      style={{
        background: "rgba(255,255,255,.04)",
        border: `1px solid ${hexToRgba(color, 0.32)}`,
        boxShadow: `0 10px 30px -12px rgba(0,0,0,.6), 0 0 22px -8px ${glow}`,
        ...style,
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: `radial-gradient(ellipse at 50% 115%, ${glow}, transparent 62%)` }}
      />
      <div className="relative z-10 flex flex-col items-center">{children}</div>
    </div>
  );
}

function TileIconChip({ color, glow, children }: { color: string; glow: string; children: React.ReactNode }) {
  return (
    <div
      className="mb-1.5 flex h-11 w-11 items-center justify-center rounded-full"
      style={{
        background: `radial-gradient(circle at 50% 30%, ${hexToRgba(color, 0.25)}, ${hexToRgba(color, 0.05)})`,
        border: `1px solid ${hexToRgba(color, 0.4)}`,
        boxShadow: `0 0 16px -4px ${glow}`,
      }}
    >
      {children}
    </div>
  );
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function MonthlyRecap({
  recap,
  userName,
  userPhotoUrl,
  onShare,
}: MonthlyRecapProps) {
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const reduced = useReducedMotion();
  const cardRef = useRef<HTMLDivElement>(null);

  const handleDownload = useCallback(async () => {
    setDownloading(true);
    try {
      const blob = await captureCard(recap, userName, userPhotoUrl);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `recap-${recap.recapMonth.slice(0, 7)}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }, [recap, userName, userPhotoUrl]);

  const handleShare = useCallback(async () => {
    const blob = await captureCard(recap, userName, userPhotoUrl);
    if (onShare) {
      onShare(blob);
      return;
    }
    if (navigator.share && navigator.canShare) {
      const file = new File([blob], `recap-${recap.recapMonth.slice(0, 7)}.png`, { type: "image/png" });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text: `Meu recap de ${formatMonth(recap.recapMonth)} no energyOS` });
        return;
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `recap-${recap.recapMonth.slice(0, 7)}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, [recap, userName, userPhotoUrl, onShare]);

  const { meta, tier } = tierMeta(recap.leagueTier);
  const tierColor = meta ? meta.color : "#71d4ff";
  const specs = statSpec(recap);

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
          <Trophy size={18} style={{ color: tierColor }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[var(--text)]">
            Ver recap de {formatMonth(recap.recapMonth)}
          </p>
          <p className="truncate text-xs text-[var(--text-muted)]">
            {formatMinutes(recap.totalFocusMinutes)} de foco · {recap.longestStreak} dias de sequência
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-[var(--accent-border)] bg-[var(--accent)]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">
          New
        </span>
      </motion.button>

      {/* Overlay */}
      {open && (
        <Modal onClose={() => setOpen(false)}>
          <div className="flex w-full max-w-[380px] flex-col items-center gap-6">
            {/* Close */}
            <button
              onClick={() => setOpen(false)}
              className="icon-button self-end"
              aria-label="Fechar"
            >
              <X size={18} />
            </button>

            {/* Card preview — subtle static 3D tilt */}
            <div
              ref={cardRef}
              className="w-full overflow-hidden rounded-2xl border border-[rgba(255,255,255,.1)]"
              style={{
                aspectRatio: `${CARD_W}/${CARD_H}`,
                background: "#0a0e1a",
                transform: reduced ? "none" : "perspective(1600px) rotateX(3deg)",
                boxShadow: "0 30px 60px -20px rgba(0,0,0,.7), 0 0 40px -18px rgba(113,212,255,.25)",
              }}
            >
              <div className="relative flex h-full w-full flex-col p-5">
                {/* Mini grid noise */}
                <div
                  className="grid-noise pointer-events-none absolute inset-0"
                  style={{ opacity: 0.5 }}
                />

                {/* Ambient glow blobs */}
                <div
                  className="pointer-events-none absolute rounded-full"
                  style={{
                    top: "-10%",
                    right: "-15%",
                    width: "55%",
                    height: "35%",
                    background: "radial-gradient(circle, rgba(113,212,255,.1), transparent 70%)",
                    filter: "blur(40px)",
                  }}
                />
                <div
                  className="pointer-events-none absolute rounded-full"
                  style={{
                    bottom: "25%",
                    left: "-10%",
                    width: "45%",
                    height: "30%",
                    background: "radial-gradient(circle, rgba(182,156,255,.07), transparent 70%)",
                    filter: "blur(40px)",
                  }}
                />

                {/* Accent top line */}
                <div
                  className="absolute left-0 right-0 top-0 h-[2px]"
                  style={{
                    background: "linear-gradient(90deg, transparent, rgba(113,212,255,.5), transparent)",
                  }}
                />

                {/* Title */}
                <p className="relative z-10 text-center text-sm" style={{ color: "rgba(231,244,255,.42)" }}>
                  Recap de
                </p>
                <h2
                  className="font-display relative z-10 mt-1 text-center text-3xl font-extrabold"
                  style={{
                    background: "linear-gradient(135deg, #71d4ff, #b69cff, #ffb86b)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  {formatMonth(recap.recapMonth)}
                </h2>

                {/* Divider */}
                <div
                  className="relative z-10 mx-auto mt-2 h-[1px] w-1/2"
                  style={{
                    background: "linear-gradient(90deg, transparent, rgba(113,212,255,.3), transparent)",
                  }}
                />

                {/* User */}
                <div className="relative z-10 mt-2 flex items-center justify-center gap-2">
                  {userPhotoUrl ? (
                    <img
                      src={userPhotoUrl}
                      alt={userName}
                      className="h-6 w-6 rounded-full object-cover ring-1 ring-[rgba(255,255,255,.15)]"
                    />
                  ) : null}
                  <span className="text-xs font-medium" style={{ color: "rgba(231,244,255,.72)" }}>
                    {userName}
                  </span>
                </div>

                {/* Stats grid */}
                <div className="relative z-10 mt-4 grid flex-1 grid-cols-2 gap-2.5">
                  {/* Focus */}
                  <Tile color={specs.focus.color} glow={specs.focus.glow}>
                    <TileIconChip color={specs.focus.color} glow={specs.focus.glow}>
                      <Timer size={22} color={specs.focus.color} />
                    </TileIconChip>
                    <span className="text-[10px] uppercase tracking-wider" style={{ color: "rgba(231,244,255,.45)" }}>
                      Foco total
                    </span>
                    <span className="mt-0.5 font-display text-2xl font-extrabold" style={{ color: "#71d4ff" }}>
                      {formatMinutes(recap.totalFocusMinutes)}
                    </span>
                  </Tile>

                  {/* Streak */}
                  <Tile color={specs.streak.color} glow={specs.streak.glow}>
                    <TileIconChip color={specs.streak.color} glow={specs.streak.glow}>
                      <Image
                        src="/streak/streak_alive.png"
                        alt="Sequência"
                        width={30}
                        height={30}
                        style={{ objectFit: "contain" }}
                        unoptimized
                        draggable={false}
                      />
                    </TileIconChip>
                    <span className="text-[10px] uppercase tracking-wider" style={{ color: "rgba(231,244,255,.45)" }}>
                      Sequência
                    </span>
                    <span className="mt-0.5 font-display text-2xl font-extrabold" style={{ color: "#ff8c42" }}>
                      {recap.longestStreak} dias
                    </span>
                  </Tile>

                  {/* League */}
                  <Tile color={specs.lower.color} glow={specs.lower.glow}>
                    <TileIconChip color={specs.lower.color} glow={specs.lower.glow}>
                      {tier && meta ? (
                        <Image
                          src={meta.iconPath}
                          alt={meta.label}
                          width={32}
                          height={32}
                          style={{ objectFit: "contain" }}
                          unoptimized
                          draggable={false}
                        />
                      ) : (
                        <Award size={22} color={specs.lower.color} />
                      )}
                    </TileIconChip>
                    <span className="text-[10px] uppercase tracking-wider" style={{ color: "rgba(231,244,255,.45)" }}>
                      Liga
                    </span>
                    <span className="mt-0.5 font-display text-2xl font-extrabold" style={{ color: specs.lower.color }}>
                      {specs.tierLabel}
                    </span>
                    {recap.leaguePromoted && (
                      <span className="text-[10px] font-semibold" style={{ color: "#4ade80" }}>
                        ⬆ Promovido!
                      </span>
                    )}
                  </Tile>

                  {/* Tag */}
                  <Tile color="#b69cff" glow="rgba(182,156,255,.35)">
                    <TileIconChip color="#b69cff" glow="rgba(182,156,255,.35)">
                      <Award size={22} color="#b69cff" />
                    </TileIconChip>
                    <span className="text-[10px] uppercase tracking-wider" style={{ color: "rgba(231,244,255,.45)" }}>
                      Tag
                    </span>
                    <span className="mt-0.5 w-full truncate font-display text-xl font-extrabold" style={{ color: "#b69cff" }}>
                      {recap.productivityTag ?? "—"}
                    </span>
                  </Tile>
                </div>

                {/* Footer */}
                <div className="relative z-10 mt-3">
                  <div
                    className="mx-auto mb-2 h-[1px] w-1/2"
                    style={{
                      background: "linear-gradient(90deg, transparent, rgba(113,212,255,.18), transparent)",
                    }}
                  />
                  <p className="text-center text-sm font-extrabold tracking-wide" style={{ color: "rgba(231,244,255,.22)" }}>
                    energyOS
                  </p>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="primary-button"
              >
                <Download size={15} />
                {downloading ? "Salvando..." : "Baixar"}
              </button>
              <button
                onClick={handleShare}
                className="icon-button"
                style={{ width: "auto", padding: "0 14px", gap: "6px", fontSize: "12px", fontWeight: 700 }}
              >
                <Share2 size={15} />
                Compartilhar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

// ─── Standalone helper ─────────────────────────────────────────────────────────

export async function downloadRecapImage(
  recap: MonthlyRecapProps["recap"],
  userName: string,
  userPhotoUrl?: string,
) {
  const blob = await captureCard(recap, userName, userPhotoUrl);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `recap-${recap.recapMonth.slice(0, 7)}.png`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function shareRecapImage(
  recap: MonthlyRecapProps["recap"],
  userName: string,
  userPhotoUrl?: string,
) {
  const blob = await captureCard(recap, userName, userPhotoUrl);
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
