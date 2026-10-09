"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence, PanInfo, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, Timer, Award, Flame } from "lucide-react";
import Image from "next/image";
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
  return monthName;
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

export function StorySlides({ recap, userName, userPhotoUrl, onClose }: StorySlidesProps) {
  const [current, setCurrent] = useState(0);
  const reduced = useReducedMotion();

  const handleSwipe = (_: unknown, info: PanInfo) => {
    if (reduced) return;
    const { velocity } = info;
    const dragVelocityThreshold = 300;
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

  const monthLabel = recap.recapMonth.slice(0, 7);
  const date = new Date(monthLabel + "-01");
  const monthTitle = date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  // Modal without structured children
  if (typeof document === "undefined") return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center">
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
      />

      <motion.div
        className="relative mx-4 w-full max-w-2xl"
        initial={{ opacity: 0, scale: reduced ? 1 : 0.95, y: reduced ? 0 : 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 24 }}
        transition={{ type: "spring", stiffness: 360, damping: 28 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-primary)] px-5 py-4 sm:px-6">
          <h2 className="font-display text-lg text-[var(--text)]">{monthTitle}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-lg p-2 text-[var(--text-muted)] transition hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text)]"
          >
            ✕
          </button>
        </div>

        {/* Slides container */}
        <div className="relative h-[50vh] overflow-hidden">
          <AnimatePresence initial={false}>
            <motion.div
              key={current}
              className="absolute inset-0 px-5 py-6 sm:px-6"
              initial={{ opacity: 0, x: 320, rotateY: 15 }}
              animate={{ opacity: 1, x: 0, rotateY: 0 }}
              exit={{ opacity: 0, x: -320, rotateY: -15 }}
              transition={{ duration: reduced ? 0 : 0.46, type: "spring", stiffness: 360, damping: 28 }}
              drag={reduced ? false : "x"}
              dragConstraints={{ left: 0, right: 0 }}
              onDragEnd={handleSwipe}
            >
              {current === 0 && (
                <IntroSlide recap={recap} userName={userName} userPhotoUrl={userPhotoUrl} />
              )}
              {current === 1 && (
                <FocusSlide recap={recap} />
              )}
              {current === 2 && (
                <StreakSlide recap={recap} />
              )}
              {current === 3 && (
                <GardenSlide recap={recap} />
              )}
              {current === 4 && (
                <XpSlide recap={recap} />
              )}
              {current === 5 && (
                <LeagueSlide recap={recap} />
              )}
              {current === 6 && (
                <SummarySlide 
                  recap={recap} 
                  userName={userName} 
                  userPhotoUrl={userPhotoUrl}
                  onClose={onClose}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-[var(--border-subtle)]">
          <motion.div
            className="h-full"
            style={{ backgroundColor: "#71d4ff" }}
            initial={{ width: 0 }}
            animate={{ width: `${((current + 1) / SLIDE_COUNT) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => setCurrent(0)}
            className="rounded-lg px-3 py-1 text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            Início
          </button>
          <div className="flex items-center gap-2">
            <motion.button
              whileHover={!reduced ? { scale: 1.05 } : undefined}
              whileTap={!reduced ? { scale: 0.95 } : undefined}
              onClick={() => current > 0 && setCurrent(c => c - 1)}
              disabled={current === 0}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--bg-surface-hover)] text-[var(--text-muted)] transition hover:bg-[var(--bg-surface)] disabled:opacity-50"
            >
              <ChevronLeft size={16} />
            </motion.button>
            <span className="text-sm text-[var(--text-muted)]">
              {current + 1} / {SLIDE_COUNT}
            </span>
            <motion.button
              whileHover={!reduced ? { scale: 1.05 } : undefined}
              whileTap={!reduced ? { scale: 0.95 } : undefined}
              onClick={() => current < SLIDE_COUNT - 1 && setCurrent(c => c + 1)}
              disabled={current === SLIDE_COUNT - 1}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--bg-surface-hover)] text-[var(--text-muted)] transition hover:bg-[var(--bg-surface)] disabled:opacity-50"
            >
              <ChevronRight size={16} />
            </motion.button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// Individual slide components
function IntroSlide({ recap, userName, userPhotoUrl }: { recap: MonthlyRecap; userName: string; userPhotoUrl?: string }) {
  const monthLabel = recap.recapMonth.slice(0, 7);
  const date = new Date(monthLabel + "-01");
  const monthTitle = date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  
  return (
    <div className="flex flex-col items-center justify-center gap-6">
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
          <p className="text-sm text-[var(--text-muted)]">energyOS • {monthTitle}</p>
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
          {recap.leagueAtStart} → {recap.leagueTier}
        </p>
      )}
    </div>
  );
}

function SummarySlide({ recap, userName, userPhotoUrl, onClose }: { recap: MonthlyRecap; userName: string; userPhotoUrl?: string; onClose: () => void }) {
  const tier = recap.leagueTier ? NEW_TIER_META[recap.leagueTier as NewLeagueTier] : NEW_TIER_META.BRONZE;
  const promoted = recap.leagueAtStart && recap.leagueAtStart !== recap.leagueTier;
  const promotionText = promoted 
    ? ` subiu de ${recap.leagueAtStart} para ${recap.leagueTier}`
    : ` fechou em ${recap.leagueTier}`;
  
  const monthLabel = recap.recapMonth.slice(0, 7);
  const date = new Date(monthLabel + "-01");
  const monthTitle = date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

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
          <p className="text-sm text-[var(--text-muted)]">{monthTitle}</p>
          <p className="text-xs text-[var(--text-muted)]">Você {promotionText}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <StatCard 
          icon={<Timer size={16} color="#71d4ff" />} 
          label="Foco" 
          value={formatMinutes(recap.totalFocusMinutes)} 
          color="#71d4ff" 
        />
        <StatCard 
          icon={<FlameIcon size={16} color="#ffb86b" />} 
          label="Sequência" 
          value={`${recap.longestStreak} dias`} 
          color="#ffb86b" 
        />
        <StatCard 
          icon={<Award size={16} color={tierColor(recap.leagueTier)} />} 
          label="Liga" 
          value={recap.leagueTier ?? "—"} 
          color={tierColor(recap.leagueTier)}
        />
        <StatCard 
          icon={<Image src="/icons_8bits/brain.png" alt="Energias" width={16} height={16} unoptimized />} 
          label="Energias" 
          value={formatNumber(recap.gardenCount ?? 0)} 
          color="#4ade80" 
        />
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => {}}
          className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white"
        >
          Baixar
        </button>
        <button
          onClick={onClose}
          className="rounded-xl border border-[var(--accent-border)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--accent)]"
        >
          Compartilhar
        </button>
      </div>
    </div>
  );
}

function FlameIcon({ className, color }: { className?: string; color?: string }) {
  return (
    <svg 
      className={className} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke={color ?? "currentColor"}
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <path d="M12 2v14l-4-4H4a8 8 0 0 1 16 0h-4l-4 4V2" />
    </svg>
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