"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence, PanInfo, useReducedMotion } from "framer-motion";
import { X, ChevronLeft, ChevronRight, Check, Award, Timer, Flame } from "lucide-react";
import Image from "next/image";
import { Modal } from "@/components/modal";
import type { MonthlyRecap, NewLeagueTier } from "@/types";
import { NEW_TIER_META } from "@/lib/league-new-meta";

const SLIDE_COUNT = 7;

interface StorySlidesProps {
  recap: MonthlyRecap;
  userName: string;
  userPhotoUrl?: string;
  onClose: () => void;
}

// Month name formatter (pt-BR, capitalized only first letter)
function formatMonthTitle(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  const monthName = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  // Capitalize first letter only
  return monthName.charAt(0).toUpperCase() + monthName.slice(1);
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

// Tier colors
function tierColor(tier: NewLeagueTier | undefined): string {
  return tier ? (NEW_TIER_META[tier]?.color ?? "#71d4ff") : "#71d4ff";
}

// Slide themes
const THEMES = {
  intro:   { bg: "linear-gradient(160deg, #07111f 0%, #0d1b2d 100%)",          accent: "#71d4ff", glow: "rgba(113,212,255,0.3)"  },
  focus:   { bg: "linear-gradient(160deg, #071828 0%, #0a2540 100%)",          accent: "#71d4ff", glow: "rgba(113,212,255,0.35)" },
  streak:  { bg: "linear-gradient(160deg, #1a0e06 0%, #2d1a08 100%)",          accent: "#ffb86b", glow: "rgba(255,184,107,0.38)" },
  garden:  { bg: "linear-gradient(160deg, #071a0e 0%, #0d2a18 100%)",          accent: "#4ade80", glow: "rgba(74,222,128,0.32)"  },
  xp:      { bg: "linear-gradient(160deg, #12061f 0%, #26103f 100%)",          accent: "#b69cff", glow: "rgba(182,156,255,0.38)" },
  league:  { bg: "linear-gradient(160deg, #07111f 0%, #0d1b2d 100%)",          accent: "#71d4ff", glow: "rgba(113,212,255,0.3)"  },
  summary: { bg: "linear-gradient(160deg, #0a0e1a 0%, #111827 100%)",          accent: "#71d4ff", glow: "rgba(113,212,255,0.3)"  },
};

export function StorySlides({ recap, userName, userPhotoUrl, onClose }: StorySlidesProps) {
  const [current, setCurrent] = useState(0);
  const reduced = useReducedMotion();
  const dragSnapToOffset = 0;
  const dragVelocityThreshold = 300;

  const handleSwipe = (_, info: PanInfo) => {
    if (reduced) return;
    const { velocity, offset } = info;
    const isThreshHold = Math.abs(velocity.x) > dragVelocityThreshold;
    if (isThreshHold) {
      const direction = velocity.x > 0 ? -1 : 1;
      if (direction === 1 && current < SLIDE_COUNT - 1) {
        setCurrent(c => c + 1);
      } else if (direction === -1 && current > 0) {
        setCurrent(c => c - 1);
      }
    }
  };

  const slideComponents = [
    <IntroSlide key="intro" recap={recap} userName={userName} userPhotoUrl={userPhotoUrl} />,
    <FocusSlide key="focus" recap={recap} />,
    <StreakSlide key="streak" recap={recap} />,
    <GardenSlide key="garden" recap={recap} />,
    <XpSlide key="xp" recap={recap} />,
    <LeagueSlide key="league" recap={recap} />,
    <SummarySlide key="summary" recap={recap} userName={userName} userPhotoUrl={userPhotoUrl} />,
  ];

  return (
    <Modal onClose={onClose} title={formatMonthTitle(recap.recapMonth)} />
  );
}

// Individual slide components
function IntroSlide({ recap, userName, userPhotoUrl }: { recap: MonthlyRecap; userName: string; userPhotoUrl?: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6">
      <div className="flex items-center gap-3">
        {userPhotoUrl ? (
          <Image 
            src={userPhotoUrl} 
            alt={userName} 
            width={64} 
            height={64} 
            className="rounded-full object-cover"
            unoptimized
          />
        ) : (
          <div 
            className="flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold"
            style={{ background: "linear-gradient(135deg, #71d4ff, #b69cff)" }}
          >
            {userName.charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <h2 className="font-display text-2xl font-bold text-[var(--text)]">{userName}</h2>
          <p className="text-sm text-[var(--text-muted)]">energyOS • {formatMonthTitle(recap.recapMonth)}</p>
        </div>
      </div>
      <p className="max-w-md text-center text-sm text-[var(--text-muted)]">
        Seu resumo do mês. Toque nas setas ou deslize para navegar.
      </p>
    </div>
  );
}

function FocusSlide({ recap }: { recap: MonthlyRecap }) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex h-20 w-20 items-center justify-center rounded-full" style={{ background: "rgba(113,212,255,0.2)" }}>
        <Timer size={32} color="#71d4ff" />
      </div>
      <div>
        <h3 className="font-display text-xl font-bold text-[var(--text)]">{formatMinutes(recap.totalFocusMinutes)}</h3>
        <p className="text-sm text-[var(--text-muted)]">Foco do Mês</p>
      </div>
      {recap.xpSources?.focus && (
        <p className="text-xs text-[var(--text-muted)]">{formatNumber(recap.xpSources.focus)} XP do foco</p>
      )}
    </div>
  );
}

function StreakSlide({ recap }: { recap: MonthlyRecap }) {
  const meta = resolveNewTier(recap.leagueTier);
  const streakIcon = "/streak/streak_alive.png";
  
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex h-20 w-20 items-center justify-center rounded-full" style={{ background: "rgba(255,140,66,0.2)" }}>
        <Image 
          src={streakIcon} 
          alt="Sequência" 
          width={32} 
          height={32} 
          className="object-contain"
          unoptimized
        />
      </div>
      <div>
        <h3 className="font-display text-3xl font-bold text-[#ffb86b]">{recap.longestStreak}</h3>
        <p className="text-sm text-[var(--text-muted)]">Melhor Sequência</p>
      </div>
      {recap.streakIsAlive && (
        <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-xs font-semibold text-green-400">
          Ativa
        </span>
      )}
    </div>
  );
}

function GardenSlide({ recap }: { recap: MonthlyRecap }) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex h-20 w-20 items-center justify-center rounded-full" style={{ background: "rgba(74,222,128,0.2)" }}>
        <Image 
          src="/icons_8bits/brain.png" 
          alt="Energias" 
          width={32} 
          height={32} 
          className="object-contain"
          unoptimized
        />
      </div>
      <div>
        <h3 className="font-display text-3xl font-bold text-[#4ade80]">{formatNumber(recap.gardenCount ?? 0)}</h3>
        <p className="text-sm text-[var(--text-muted)]">Energias do Mês</p>
      </div>
    </div>
  );
}

function XpSlide({ recap }: { recap: MonthlyRecap }) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex h-20 w-20 items-center justify-center rounded-full" style={{ background: "rgba(182,156,255,0.2)" }}>
        <Image 
          src="/xp/xp_double_thunder.png" 
          alt="XP" 
          width={32} 
          height={32} 
          className="object-contain"
          unoptimized
        />
      </div>
      <div>
        <h3 className="font-display text-3xl font-bold text-[#b69cff]">{formatNumber(recap.totalXp)}</h3>
        <p className="text-sm text-[var(--text-muted)]">XP do Mês</p>
      </div>
    </div>
  );
}

function LeagueSlide({ recap }: { recap: MonthlyRecap }) {
  const meta = NEW_TIER_META[recap.leagueTier as NewLeagueTier] ?? NEW_TIER_META.BRONZE;
  
  return (
    <div className="flex flex-col items-center gap-4">
      <div 
        className="flex h-20 w-20 items-center justify-center rounded-full"
        style={{ 
          background: `radial-gradient(circle, ${meta.color}33, transparent 70%)`,
          border: `1px solid ${meta.color}55`,
        }}
      >
        <Image 
          src={meta.iconPath} 
          alt={meta.label} 
          width={32} 
          height={32} 
          className="object-contain"
          unoptimized
        />
      </div>
      <div>
        <h3 className="font-display text-xl font-bold" style={{ color: meta.color }}>
          {meta.label}
        </h3>
        <p className="text-sm text-[var(--text-muted)]">Liga do Mês</p>
      </div>
      {recap.leagueAtStart && recap.leagueAtStart !== recap.leagueTier && (
        <p className="text-xs text-[var(--text-muted)]">
          {formatMonthTitle(recap.recapMonth)}: {recap.leagueAtStart} → {recap.leagueTier}
        </p>
      )}
    </div>
  );
}

function SummarySlide({ recap, userName, userPhotoUrl }: { recap: MonthlyRecap; userName: string; userPhotoUrl?: string }) {
  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex items-center gap-3">
        {userPhotoUrl ? (
          <Image 
            src={userPhotoUrl} 
            alt={userName} 
            width={48} 
            height={48} 
            className="rounded-full object-cover"
            unoptimized
          />
        ) : (
          <div 
            className="flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold"
            style={{ background: "linear-gradient(135deg, #71d4ff, #b69cff)" }}
          >
            {userName.charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <h2 className="font-display text-xl font-bold text-[var(--text)]">{userName}</h2>
          <p className="text-sm text-[var(--text-muted)]">{formatMonthTitle(recap.recapMonth)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <StatCard 
          icon={<Timer size={20} color="#71d4ff" />} 
          label="Foco" 
          value={formatMinutes(recap.totalFocusMinutes)} 
          color="#71d4ff" 
        />
        <StatCard 
          icon={<Flame size={20} color="#ffb86b" />} 
          label="Sequência" 
          value={`${recap.longestStreak} dias`} 
          color="#ffb86b" 
        />
        <StatCard 
          icon={<Award size={20} color={(recap.leagueTier ? NEW_TIER_META[recap.leagueTier as NewLeagueTier]?.color ?? "#71d4ff" : "#71d4ff")} />} 
          label="Liga" 
          value={recap.leagueTier ?? "—"} 
          color={recap.leagueTier ? tierColor(recap.leagueTier) : "#71d4ff"}
        />
        <StatCard 
          icon={<Image src="/icons_8bits/brain.png" alt="Energias" width={20} height={20} unoptimized />} 
          label="Energias" 
          value={formatNumber(recap.gardenCount ?? 0)} 
          color="#4ade80" 
        />
      </div>

      <button
        onClick={() => {
          // Generate downloadable image
        }}
        className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white"
      >
        Baixar Recap
      </button>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl bg-[var(--bg-surface-hover)] p-3">
      <div className="mb-1 flex h-8 w-8 items-center justify-center rounded-full" style={{ background: `${color}22` }}>
        <span style={{ color }}>{icon}</span>
      </div>
      <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">{label}</span>
      <span className="font-display text-sm font-bold" style={{ color }}>{value}</span>
    </div>
  );
}