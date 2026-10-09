"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { X, Download, Share2, Trophy, Flame } from "lucide-react";
import Image from "next/image";
import { Modal } from "@/components/modal";
import type { MonthlyRecap, NewLeagueTier } from "@/types";
import { NEW_TIER_META } from "@/lib/league-new-meta";

interface FinalPageProps {
  recap: MonthlyRecap;
  userName: string;
  userPhotoUrl?: string;
  onClose: () => void;
}

// Format minutes to hours/min
function formatMinutes(total: number): string {
  if (total < 60) return `${total}min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

// Format number with pt-BR locale
function formatNumber(n: number): string {
  return n.toLocaleString("pt-BR");
}

export function FinalPage({ recap, userName, userPhotoUrl, onClose }: FinalPageProps) {
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const reduced = useReducedMotion();
  const modalRef = useRef<HTMLDivElement>(null);

  const tier = recap.leagueTier ? NEW_TIER_META[recap.leagueTier as NewLeagueTier] : NEW_TIER_META.BRONZE;
  const tierColor = tier.color;

  // Format month title
  const monthTitle = recap.recapMonth.slice(0, 7);
  const date = new Date(monthTitle + "-01");
  const monthLabel = date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  // Check if promoted
  const promoted = recap.leagueAtStart && recap.leagueAtStart !== recap.leagueTier;
  const promotionText = promoted 
    ? ` subiu de ${recap.leagueAtStart} para ${recap.leagueTier}`
    : ` fechou em ${recap.leagueTier}`;

  // Download handler
  const handleDownload = async () => {
    setDownloading(true);
    try {
      // Canvas capture for download
      const canvas = document.createElement("canvas");
      canvas.width = 1080;
      canvas.height = 1920;
      const ctx = canvas.getContext("2d")!;
      
      // Background gradient
      const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
      bg.addColorStop(0, "#0a0e1a");
      bg.addColorStop(1, "#111827");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Title
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(231,244,255,0.42)";
      ctx.font = "400 28px 'Inter', -apple-system, sans-serif";
      ctx.fillText("Recap de", canvas.width / 2, 80);

      ctx.fillStyle = `linear-gradient(135deg, #71d4ff, #b69cff, #ffb86b)`;
      ctx.clip();
      ctx.fillStyle = "transparent";
      ctx.fillText(monthLabel, canvas.width / 2, 140);
      ctx.clip();

      // User info
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(231,244,255,0.72)";
      ctx.font = "500 20px 'Inter', -apple-system, sans-serif";
      ctx.fillText(userName, canvas.width / 2, 200);

      // Hero league badge
      const badgeSize = 180;
      const badgeX = canvas.width / 2 - badgeSize / 2;
      const badgeY = 260;
      
      // Animated ring (LED effect)
      const gradient = ctx.createRadialGradient(
        badgeX + badgeSize/2, badgeY + badgeSize/2, 0,
        badgeX + badgeSize/2, badgeY + badgeSize/2, badgeSize/2
      );
      gradient.addColorStop(0, tierColor + "55");
      gradient.addColorStop(1, tierColor + "00");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(badgeX + badgeSize/2, badgeY + badgeSize/2, badgeSize/2, 0, Math.PI * 2);
      ctx.fill();

      // League badge
      ctx.fillStyle = tierColor;
      ctx.font = "700 32px 'Inter', -apple-system, sans-serif";
      ctx.fillText(recap.leagueTier ?? "BRONZE", canvas.width / 2, badgeY + badgeSize/2 + 12);

      // Stats grid
      const gridTop = 400;
      const cardW = (canvas.width - 60) / 2;
      const cardH = 140;
      
      const stats = [
        { label: "Foco", value: formatMinutes(recap.totalFocusMinutes), color: "#71d4ff" },
        { label: "Sequência", value: `${recap.longestStreak} dias`, color: "#ffb86b" },
        { label: "Liga", value: recap.leagueTier ?? "—", color: tierColor },
        { label: "Energias", value: formatNumber(recap.gardenCount ?? 0), color: "#4ade80" },
        { label: "XP", value: formatNumber(recap.totalXp), color: "#b69cff" },
      ];

      const deltaColors = {
        focus: recap.xpSources?.focus > 3000 ? "#22c55e" : "#f59e0b",
      };

      for (let i = 0; i < stats.length; i += 2) {
        const y = gridTop + (i / 2) * (cardH + 20);
        for (let j = 0; j < 2; j++) {
          const s = stats[i + j];
          if (!s) continue;
          
          const x = j === 0 ? 30 : cardW + 30;
          
          // Card bg
          ctx.fillStyle = "rgba(255,255,255,0.04)";
          ctx.beginPath();
          ctx.moveTo(x + 22, y);
          ctx.arcTo(x + cardW, y, x + cardW, y + cardH, 22);
          ctx.arcTo(x + cardW, y + cardH, x, y + cardH, 22);
          ctx.arcTo(x, y + cardH, x, y, 22);
          ctx.arcTo(x, y, x + cardW, y, 22);
          ctx.closePath();
          ctx.fill();

          // Border with glow
          ctx.strokeStyle = `${s.color}55`;
          ctx.shadowColor = `${s.color}40`;
          ctx.shadowBlur = 12;
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.shadowBlur = 0;

          // Value
          ctx.textAlign = "center";
          ctx.fillStyle = s.color;
          ctx.font = "800 48px 'Inter', -apple-system, sans-serif";
          ctx.fillText(s.value, x + cardW / 2, y + 90);

          // Label
          ctx.fillStyle = "rgba(231,244,255,0.45)";
          ctx.font = "500 16px 'Inter', -apple-system, sans-serif";
          ctx.fillText(s.label, x + cardW / 2, y + 125);
        }
      }

      // Footer
      const footerY = canvas.height - 100;
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(231,244,255,0.22)";
      ctx.font = "700 28px 'Inter', -apple-system, sans-serif";
      ctx.fillText("energyOS", canvas.width / 2, footerY + 30);
      
      ctx.fillStyle = "rgba(231,244,255,0.5)";
      ctx.font = "400 14px 'Inter', -apple-system, sans-serif";
      ctx.fillText(`Gerado em ${new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}`, canvas.width / 2, footerY + 55);

      // Convert to blob and download
      canvas.toBlob(blob => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `recap-${monthTitle}.png`;
        a.click();
        URL.revokeObjectURL(url);
      });
    } finally {
      setDownloading(false);
    }
  };

  // Share handler
  const handleShare = async () => {
    setSharing(true);
    try {
      if (navigator.share && navigator.canShare) {
        const blob = await new Promise<Blob>((resolve) => {
          const canvas = document.createElement("canvas");
          canvas.width = 1080;
          canvas.height = 1920;
          const ctx = canvas.getContext("2d")!;
          
          const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
          bg.addColorStop(0, "#0a0e1a");
          bg.addColorStop(1, "#111827");
          ctx.fillStyle = bg;
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          const file = new File([blob], "recap.png", {type: "image/png"})
          resolve(file);
        });
        
        await navigator.share({
          files: [blob],
          title: `Meu recap de ${monthLabel}`,
          text: `Confira meu recap de ${monthLabel} no energyOS!`,
        });
      }
    } catch {
      // Fallback to download
      await handleDownload();
    } finally {
      setSharing(false);
    }
  };

  return (
    <div ref={modalRef} className="relative z-[1000] mx-auto max-w-4xl">
      <motion.div
        className="flex flex-col items-center gap-8 rounded-2xl bg-[var(--bg-primary)] p-6 sm:p-8 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.65)]"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 360, damping: 28 }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-2 text-[var(--text-muted)] transition hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text)]"
          aria-label="Fechar"
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-4">
          {userPhotoUrl ? (
            <Image src={userPhotoUrl} alt={userName} width={64} height={64} className="rounded-full object-cover" unoptimized />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold" style={{ background: `linear-gradient(135deg, ${tierColor}, #b69cff)` }}>
              {userName.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h2 className="font-display text-2xl font-bold text-[var(--text)]">{userName}</h2>
            <p className="text-sm text-[var(--text-muted)]">{monthLabel} • Você {promotionText}</p>
          </div>
        </div>

        {/* League Medallion */}
        <div className="relative flex h-32 w-32 items-center justify-center rounded-full" style={{ background: `${tierColor}11` }}>
          <div 
            className="absolute rounded-full"
            style={{ 
              width: 110, 
              height: 110, 
              background: `radial-gradient(circle, ${tierColor}33, transparent 70%)`,
              filter: "blur(20px)"
            }}
          />
          <Image 
            src={tier.iconPath} 
            alt={tier.label} 
            width={64} 
            height={64} 
            className="rounded-full object-contain"
            unoptimized
          />
          <div 
            className="absolute -top-1 -right-1 h-6 w-6 rounded-full animate-pulse"
            style={{ background: tierColor }}
          />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard 
            icon={<Timer size={18} color="#71d4ff" />} 
            label="Foco" 
            value={formatMinutes(recap.totalFocusMinutes)} 
            color="#71d4ff" 
          />
          <StatCard 
            icon={<Flame size={18} color="#ffb86b" />} 
            label="Sequência" 
            value={`${recap.longestStreak} dias`} 
            color="#ffb86b" 
          />
          <StatCard 
            icon={<Award size={18} color={tierColor} />} 
            label="Liga" 
            value={recap.leagueTier ?? "—"} 
            color={tierColor} 
          />
          <StatCard 
            icon={<Image src="/icons_8bits/brain.png" alt="Energias" width={18} height={18} unoptimized />} 
            label="Energias" 
            value={formatNumber(recap.gardenCount ?? 0)} 
            color="#4ade80" 
          />
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleDownload}
            disabled={downloading || sharing}
            className="flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
          >
            <Download size={16} />
            {downloading ? "Salvando..." : "Baixar"}
          </button>
          <button
            onClick={handleShare}
            disabled={downloading || sharing}
            className="flex items-center gap-2 rounded-xl border border-[var(--accent-border)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--accent)] transition hover:bg-[var(--accent)]/10"
          >
            <Share2 size={16} />
            {sharing ? "Compartilhando..." : "Compartilhar"}
          </button>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-[var(--text-muted)]">
          <p className="font-bold text-[var(--text)]">energyOS</p>
          <p className="mt-1">Gerado em {new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}</p>
        </div>
      </motion.div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl bg-[var(--bg-surface-hover)] p-3">
      <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full" style={{ background: `${color}22` }}>
        <span style={{ color }}>{icon}</span>
      </div>
      <span className="text-xs uppercase tracking-wider text-[var(--text-muted)]">{label}</span>
      <span className="font-display text-lg font-bold" style={{ color }}>{value}</span>
    </div>
  );
}
