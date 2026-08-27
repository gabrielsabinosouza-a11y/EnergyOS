"use client";

import { useRef, useState, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { X, Download, Share2, Trophy } from "lucide-react";
import { TIER_META } from "@/lib/league-meta";
import type { LeagueTier } from "@/types";

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

// ─── Canvas capture ────────────────────────────────────────────────────────────

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

function getTierColor(tier?: string): string {
  if (!tier || !(tier in TIER_META)) return "#71d4ff";
  return TIER_META[tier as LeagueTier].color;
}

function getTierLabel(tier?: string): string {
  if (!tier || !(tier in TIER_META)) return tier ?? "—";
  return TIER_META[tier as LeagueTier].label;
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

  // ── Background gradient ──
  const bg = ctx.createLinearGradient(0, 0, 0, CARD_H);
  bg.addColorStop(0, "#0a0e1a");
  bg.addColorStop(1, "#111827");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // ── Subtle grid noise ──
  ctx.strokeStyle = "rgba(113,212,255,.035)";
  ctx.lineWidth = 1;
  for (let x = 0; x < CARD_W; x += 44) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, CARD_H);
    ctx.stroke();
  }
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
  drawGlow(CARD_W * 0.75, 160, 280, "rgba(113,212,255,.06)");
  drawGlow(CARD_W * 0.25, CARD_H * 0.55, 260, "rgba(182,156,255,.05)");
  drawGlow(CARD_W * 0.85, CARD_H * 0.75, 220, "rgba(255,184,107,.04)");

  // ── Top accent line ──
  const accentGrad = ctx.createLinearGradient(0, 0, CARD_W, 0);
  accentGrad.addColorStop(0, "rgba(113,212,255,0)");
  accentGrad.addColorStop(0.5, "rgba(113,212,255,.6)");
  accentGrad.addColorStop(1, "rgba(113,212,255,0)");
  ctx.fillStyle = accentGrad;
  ctx.fillRect(0, 0, CARD_W, 3);

  let y = 110;

  // ── Title: "Recap de" ──
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(231,244,255,.42)";
  ctx.font = "500 34px 'Inter', -apple-system, sans-serif";
  ctx.fillText("Recap de", CARD_W / 2, y);
  y += 68;

  // ── Month + Year ──
  const monthLabel = formatMonth(recap.recapMonth);
  const titleGrad = ctx.createLinearGradient(CARD_W * 0.2, 0, CARD_W * 0.8, 0);
  titleGrad.addColorStop(0, "#71d4ff");
  titleGrad.addColorStop(0.5, "#b69cff");
  titleGrad.addColorStop(1, "#ffb86b");
  ctx.fillStyle = titleGrad;
  ctx.font = "800 72px 'Inter', -apple-system, sans-serif";
  ctx.fillText(monthLabel, CARD_W / 2, y);
  y += 72;

  // ── Decorative divider ──
  const divGrad = ctx.createLinearGradient(CARD_W * 0.3, 0, CARD_W * 0.7, 0);
  divGrad.addColorStop(0, "rgba(113,212,255,0)");
  divGrad.addColorStop(0.5, "rgba(113,212,255,.35)");
  divGrad.addColorStop(1, "rgba(113,212,255,0)");
  ctx.fillStyle = divGrad;
  ctx.fillRect(CARD_W * 0.3, y, CARD_W * 0.4, 2);
  y += 52;

  // ── User info ──
  if (userPhotoUrl) {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject();
        img.src = userPhotoUrl;
      });
      ctx.save();
      ctx.beginPath();
      ctx.arc(CARD_W / 2 - ctx.measureText(userName).width / 2 - 30, y - 16, 22, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, CARD_W / 2 - ctx.measureText(userName).width / 2 - 52, y - 38, 44, 44);
      ctx.restore();
    } catch {
      // fallback: no avatar
    }
  }
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(231,244,255,.7)";
  ctx.font = "600 30px 'Inter', -apple-system, sans-serif";
  ctx.fillText(userName, CARD_W / 2, y + 8);
  y += 80;

  // ── Stats grid (2×2) ──
  const colW = (CARD_W - pad * 2) / 2;
  const rowH = 260;
  const gridTop = y + 20;

  const stats: {
    icon: string;
    label: string;
    value: string;
    color: string;
    glow: string;
    col: number;
    row: number;
  }[] = [
    {
      icon: "⏱",
      label: "Foco total",
      value: formatMinutes(recap.totalFocusMinutes),
      color: "#71d4ff",
      glow: "rgba(113,212,255,.35)",
      col: 0,
      row: 0,
    },
    {
      icon: "🔥",
      label: "Sequência",
      value: `${recap.longestStreak} dias`,
      color: "#ffb86b",
      glow: "rgba(255,184,107,.35)",
      col: 1,
      row: 0,
    },
    {
      icon: "🏆",
      label: "Liga",
      value: getTierLabel(recap.leagueTier),
      color: getTierColor(recap.leagueTier),
      glow: `${getTierColor(recap.leagueTier)}55`,
      col: 0,
      row: 1,
    },
    {
      icon: "⚡",
      label: "Tag",
      value: recap.productivityTag ?? "—",
      color: "#b69cff",
      glow: "rgba(182,156,255,.35)",
      col: 1,
      row: 1,
    },
  ];

  for (const s of stats) {
    const sx = pad + s.col * colW;
    const sy = gridTop + s.row * rowH;
    const cw = colW - 16;
    const ch = rowH - 20;

    // Card background
    const cardR = 20;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(sx, sy, cw, ch, cardR);
    ctx.fillStyle = "rgba(255,255,255,.04)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.08)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // Glow behind number
    const glowGrad = ctx.createRadialGradient(
      sx + cw / 2,
      sy + ch * 0.62,
      0,
      sx + cw / 2,
      sy + ch * 0.62,
      100,
    );
    glowGrad.addColorStop(0, s.glow);
    glowGrad.addColorStop(1, "transparent");
    ctx.fillStyle = glowGrad;
    ctx.fillRect(sx, sy, cw, ch);

    // Icon
    ctx.font = "44px serif";
    ctx.textAlign = "center";
    ctx.fillText(s.icon, sx + 56, sy + 62);

    // Label
    ctx.fillStyle = "rgba(231,244,255,.42)";
    ctx.font = "500 24px 'Inter', -apple-system, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(s.label, sx + 100, sy + 58);

    // Value
    ctx.fillStyle = s.color;
    ctx.font = "800 52px 'Inter', -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(s.value, sx + cw / 2, sy + ch - 50);
  }

  y = gridTop + 2 * rowH + 40;

  // ── Promotion badge ──
  if (recap.leaguePromoted) {
    ctx.textAlign = "center";
    ctx.fillStyle = "#4ade80";
    ctx.font = "700 28px 'Inter', -apple-system, sans-serif";
    ctx.fillText("⬆ Promovido!", CARD_W / 2, y + 10);
    y += 56;
  }

  // ── Footer ──
  const footY = CARD_H - 110;

  // Footer line
  const footLine = ctx.createLinearGradient(CARD_W * 0.25, 0, CARD_W * 0.75, 0);
  footLine.addColorStop(0, "rgba(113,212,255,0)");
  footLine.addColorStop(0.5, "rgba(113,212,255,.18)");
  footLine.addColorStop(1, "rgba(113,212,255,0)");
  ctx.fillStyle = footLine;
  ctx.fillRect(CARD_W * 0.25, footY, CARD_W * 0.5, 1);

  // Brand glow
  const brandGlow = ctx.createRadialGradient(CARD_W / 2, footY + 55, 0, CARD_W / 2, footY + 55, 160);
  brandGlow.addColorStop(0, "rgba(113,212,255,.08)");
  brandGlow.addColorStop(1, "transparent");
  ctx.fillStyle = brandGlow;
  ctx.fillRect(CARD_W / 2 - 160, footY + 10, 320, 90);

  // energyOS text
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(231,244,255,.22)";
  ctx.font = "800 36px 'Inter', -apple-system, sans-serif";
  ctx.fillText("energyOS", CARD_W / 2, footY + 60);

  return new Promise((resolve) =>
    canvas.toBlob((blob) => resolve(blob!), "image/png"),
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
      const file = new File([blob], `recap-${recap.recapMonth.slice(0, 7)}.png`, {
        type: "image/png",
      });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text: `Meu recap de ${formatMonth(recap.recapMonth)} no energyOS` });
        return;
      }
    }
    // Fallback: download
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `recap-${recap.recapMonth.slice(0, 7)}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, [recap, userName, userPhotoUrl, onShare]);

  const tierColor = getTierColor(recap.leagueTier);

  return (
    <>
      {/* Trigger button */}
      <motion.button
        whileHover={reduced ? undefined : { scale: 1.03 }}
        whileTap={reduced ? undefined : { scale: 0.97 }}
        onClick={() => setOpen(true)}
        className="panel flex items-center gap-3 p-4 text-left w-full cursor-pointer"
      >
        <div
          className="grid place-items-center w-10 h-10 rounded-xl"
          style={{ background: "rgba(255,255,255,.05)" }}
        >
          <Trophy size={18} style={{ color: tierColor }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--text)]">
            Ver recap de {formatMonth(recap.recapMonth)}
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            {formatMinutes(recap.totalFocusMinutes)} de foco · {recap.longestStreak} dias de sequência
          </p>
        </div>
        <span className="eyebrow muted">NEW</span>
      </motion.button>

      {/* Overlay */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.25 }}
            className="fixed inset-0 z-[80] flex flex-col items-center justify-center gap-6 p-4"
            style={{ background: "rgba(0,0,0,.75)", backdropFilter: "blur(12px)" }}
            onClick={() => setOpen(false)}
          >
            {/* Close */}
            <button
              onClick={() => setOpen(false)}
              className="absolute top-4 right-4 icon-button"
              aria-label="Fechar"
            >
              <X size={18} />
            </button>

            {/* Card preview */}
            <motion.div
              ref={cardRef}
              initial={{ opacity: 0, scale: 0.92, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 24 }}
              transition={{ duration: reduced ? 0 : 0.35, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[360px] overflow-hidden rounded-2xl border border-[rgba(255,255,255,.1)]"
              style={{ aspectRatio: `${CARD_W}/${CARD_H}`, background: "#0a0e1a" }}
            >
              <div className="relative w-full h-full p-6 flex flex-col">
                {/* Mini grid noise */}
                <div
                  className="absolute inset-0 pointer-events-none grid-noise"
                  style={{ opacity: 0.5 }}
                />

                {/* Ambient glow blobs */}
                <div
                  className="absolute rounded-full pointer-events-none"
                  style={{
                    top: "-10%",
                    right: "-15%",
                    width: "55%",
                    height: "35%",
                    background: "radial-gradient(circle, rgba(113,212,255,.08), transparent 70%)",
                    filter: "blur(40px)",
                  }}
                />
                <div
                  className="absolute rounded-full pointer-events-none"
                  style={{
                    bottom: "25%",
                    left: "-10%",
                    width: "45%",
                    height: "30%",
                    background: "radial-gradient(circle, rgba(182,156,255,.06), transparent 70%)",
                    filter: "blur(40px)",
                  }}
                />

                {/* Accent top line */}
                <div
                  className="absolute top-0 left-0 right-0 h-[2px]"
                  style={{
                    background: "linear-gradient(90deg, transparent, rgba(113,212,255,.5), transparent)",
                  }}
                />

                {/* Title */}
                <p
                  className="text-center text-sm relative z-10"
                  style={{ color: "rgba(231,244,255,.42)" }}
                >
                  Recap de
                </p>
                <h2
                  className="font-display text-center text-3xl font-extrabold relative z-10 mt-1"
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
                  className="mx-auto mt-3 h-[1px] w-1/2 relative z-10"
                  style={{
                    background: "linear-gradient(90deg, transparent, rgba(113,212,255,.3), transparent)",
                  }}
                />

                {/* User */}
                <div className="flex items-center justify-center gap-2 mt-3 relative z-10">
                  {userPhotoUrl ? (
                    <img
                      src={userPhotoUrl}
                      alt={userName}
                      className="w-6 h-6 rounded-full object-cover ring-1 ring-[rgba(255,255,255,.15)]"
                    />
                  ) : null}
                  <span className="text-xs font-medium" style={{ color: "rgba(231,244,255,.7)" }}>
                    {userName}
                  </span>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-3 mt-5 relative z-10 flex-1">
                  {/* Focus */}
                  <div className="glass-card p-4 flex flex-col items-center justify-center text-center">
                    <span className="text-2xl mb-1">⏱</span>
                    <span className="text-[10px] uppercase tracking-wider" style={{ color: "rgba(231,244,255,.42)" }}>
                      Foco total
                    </span>
                    <span className="text-xl font-extrabold mt-1" style={{ color: "#71d4ff" }}>
                      {formatMinutes(recap.totalFocusMinutes)}
                    </span>
                  </div>

                  {/* Streak */}
                  <div className="glass-card p-4 flex flex-col items-center justify-center text-center">
                    <span className="text-2xl mb-1">🔥</span>
                    <span className="text-[10px] uppercase tracking-wider" style={{ color: "rgba(231,244,255,.42)" }}>
                      Sequência
                    </span>
                    <span className="text-xl font-extrabold mt-1" style={{ color: "#ffb86b" }}>
                      {recap.longestStreak} dias
                    </span>
                  </div>

                  {/* League */}
                  <div className="glass-card p-4 flex flex-col items-center justify-center text-center">
                    <span className="text-2xl mb-1">🏆</span>
                    <span className="text-[10px] uppercase tracking-wider" style={{ color: "rgba(231,244,255,.42)" }}>
                      Liga
                    </span>
                    <span className="text-xl font-extrabold mt-1" style={{ color: tierColor }}>
                      {getTierLabel(recap.leagueTier)}
                    </span>
                    {recap.leaguePromoted && (
                      <span className="text-[10px] font-semibold mt-1" style={{ color: "#4ade80" }}>
                        ⬆ Promovido!
                      </span>
                    )}
                  </div>

                  {/* Tag */}
                  <div className="glass-card p-4 flex flex-col items-center justify-center text-center">
                    <span className="text-2xl mb-1">⚡</span>
                    <span className="text-[10px] uppercase tracking-wider" style={{ color: "rgba(231,244,255,.42)" }}>
                      Tag
                    </span>
                    <span className="text-lg font-extrabold mt-1 truncate w-full" style={{ color: "#b69cff" }}>
                      {recap.productivityTag ?? "—"}
                    </span>
                  </div>
                </div>

                {/* Footer */}
                <div className="relative z-10 mt-4">
                  <div
                    className="mx-auto h-[1px] w-1/2 mb-3"
                    style={{
                      background: "linear-gradient(90deg, transparent, rgba(113,212,255,.18), transparent)",
                    }}
                  />
                  <p
                    className="text-center text-sm font-extrabold tracking-wide"
                    style={{ color: "rgba(231,244,255,.22)" }}
                  >
                    energyOS
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Action buttons */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduced ? 0 : 0.15 }}
              className="flex items-center gap-3 relative z-10"
              onClick={(e) => e.stopPropagation()}
            >
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
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
    const file = new File([blob], `recap-${recap.recapMonth.slice(0, 7)}.png`, {
      type: "image/png",
    });
    if (navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        text: `Meu recap de ${formatMonth(recap.recapMonth)} no energyOS`,
      });
      return;
    }
  }
  // Fallback
  await downloadRecapImage(recap, userName, userPhotoUrl);
}
