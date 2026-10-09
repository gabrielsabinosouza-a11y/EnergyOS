"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, Trophy, Calendar } from "lucide-react";
import Image from "next/image";
import { useAuthRedirect } from "@/lib/auth-context";
import { api } from "@/lib/api-client";
import type { MonthlyRecap, NewLeagueTier } from "@/types";
import { NEW_TIER_META, resolveNewTier } from "@/lib/league-new-meta";
import { Modal } from "@/components/modal";
import { StorySlides } from "./story-slides";
import { FinalPage } from "./final-page";

// Portuguese month names (lowercase "de" rules)
const MONTH_NAMES_PT = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"
];

interface MonthCard {
  month: number;  // 0-11
  year: number;
  recap?: MonthlyRecap;
  state: "generated" | "in-progress" | "available" | "locked";
}

interface RecapSectionProps {
  userName: string;
  userPhotoUrl?: string;
}

export function RecapSection({ userName, userPhotoUrl }: RecapSectionProps) {
  const { user, loading } = useAuthRedirect({ ifGuest: "/" });
  const [recaps, setRecaps] = useState<Record<string, MonthlyRecap>>({});
  const [loadingRecaps, setLoadingRecaps] = useState(true);
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [generatingRecap, setGeneratingRecap] = useState(false);
  const [recapError, setRecapError] = useState("");
  const [openStory, setOpenStory] = useState<MonthlyRecap | null>(null);
  const [openFinal, setOpenFinal] = useState<MonthlyRecap | null>(null);
  const reduced = useReducedMotion();

  // Load recaps
  useEffect(() => {
    if (!user) return;
    let active = true;

    (async () => {
      try {
        const { recaps } = await api.getRecaps();
        if (active) {
          const map: Record<string, MonthlyRecap> = {};
          for (const r of recaps) {
            const key = `${r.recapMonth}`;
            map[key] = r;
          }
          setRecaps(map);
        }
      } catch (e) {
        console.error("[recap] failed to load:", e);
      } finally {
        if (active) setLoadingRecaps(false);
      }
    })();

    return () => { active = false; };
  }, [user]);

  // Check if there's a recap for a given month
  const getRecapForMonth = useCallback((year: number, month: number): MonthlyRecap | undefined => {
    const key = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    return recaps[key];
  }, [recaps]);

  // Check if recap generation is in progress (double-click safety via cooldown)
  const [lastGeneration, setLastGeneration] = useState<Record<string, number>>({});

  const handleGenerateRecap = useCallback(async (year: number, month: number) => {
    const key = `${year}-${String(month + 1).padStart(2, "0")}`;
    const now = Date.now();
    
    // Check cooldown (15 seconds)
    if (lastGeneration[key] && now - lastGeneration[key] < 15_000) {
      return;
    }

    setGeneratingRecap(true);
    setRecapError("");
    setLastGeneration(prev => ({ ...prev, [key]: now }));

    try {
      const result = await api.generateRecap(year, month);
      if (result?.recap) {
        setRecaps(prev => ({ ...prev, [result.recap.recapMonth]: result.recap }));
      }
    } catch (e) {
      setRecapError(e instanceof Error ? e.message : "Erro ao gerar recap.");
    } finally {
      setGeneratingRecap(false);
    }
  }, [lastGeneration]);

  // Generate current month if requested
  const currentMonth = useMemo(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  }, []);

  // Check if current month recap exists or is being generated
  const currentMonthRecap = useMemo(() => {
    return getRecapForMonth(currentMonth.year, currentMonth.month);
  }, [getRecapForMonth, currentMonth.year, currentMonth.month]);

  // Build month cards for the grid
  const monthCards = useMemo((): MonthCard[] => {
    const cards: MonthCard[] = [];
    
    for (let i = 0; i < 12; i++) {
      const month = (i + 11) % 12; // Start from current month going back
      let year = selectedYear;
      
      // Calculate year for each card
      if (i >= 12 - (new Date().getMonth() + 1)) {
        year = selectedYear - 1;
      } else {
        year = selectedYear;
      }
      
      // Actually, let's build it correctly - 12 cards from selected year
      // Month order: selectedYear-11, selectedYear-10, ..., selectedYear-6, selectedYear-5 (current)
      // Wait, let's do 12 months in the selected year, starting from January
    }
    
    // Let me redo this - 12 months in the selected year
    for (let i = 0; i < 12; i++) {
      const month = i; // 0 = January, 11 = December
      let year = selectedYear;
      
      const recap = getRecapForMonth(year, month);
      const date = new Date(year, month, 1);
      const today = new Date();
      const isPast = date < new Date(today.getFullYear(), today.getMonth(), 1);
      const isFuture = date > new Date(today.getFullYear(), today.getMonth(), 1);
      
      let state: MonthCard["state"] = "available";
      if (isPast && recap) state = "generated";
      else if (isPast && !recap) state = "available"; // Can generate past months
      else if (isFuture) state = "locked";
      
      // Current month (in progress)
      if (!isPast && !isFuture && !recap) state = "in-progress";
      if (!isPast && !isFuture && recap) state = "generated";
      
      cards.push({ month, year, recap, state });
    }
    
    return cards.reverse(); // January first
  }, [selectedYear, getRecapForMonth]);

  // Generate current month
  const handleGenerateCurrentMonth = useCallback(async () => {
    const key = `${currentMonth.year}-${String(currentMonth.month + 1).padStart(2, "0")}`;
    const now = Date.now();
    
    if (lastGeneration[key] && now - lastGeneration[key] < 15_000) {
      return;
    }
    
    setGeneratingRecap(true);
    setRecapError("");
    setLastGeneration(prev => ({ ...prev, [key]: now }));

    try {
      const result = await api.generateRecap(currentMonth.year, currentMonth.month);
      if (result?.recap) {
        setRecaps(prev => ({ ...prev, [result.recap.recapMonth]: result.recap }));
      }
    } catch (e) {
      setRecapError(e instanceof Error ? e.message : "Erro ao gerar recap.");
    } finally {
      setGeneratingRecap(false);
    }
  }, [currentMonth.year, currentMonth.month, lastGeneration]);

  if (loading || loadingRecaps) {
    return (
      <div className="flex items-center justify-center py-8">
        <Trophy size={24} className="animate-pulse text-[var(--accent)]" />
      </div>
    );
  }

  return (
    <>
      {/* Year Selector */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display text-lg text-[var(--text)]">Recap de {selectedYear}</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedYear(y => y - 1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--bg-surface-hover)] text-[var(--text-muted)] transition hover:bg-[var(--bg-surface)]"
            aria-label="Ano anterior"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => setSelectedYear(y => y + 1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--bg-surface-hover)] text-[var(--text-muted)] transition hover:bg-[var(--bg-surface)]"
            aria-label="Ano seguinte"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Generate Current Month Button */}
      <div className="mb-4">
        <motion.button
          whileHover={!reduced ? { scale: 1.01 } : undefined}
          whileTap={!reduced ? { scale: 0.98 } : undefined}
          onClick={handleGenerateCurrentMonth}
          disabled={generatingRecap || !!currentMonthRecap}
          className="flex w-full items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-white font-semibold shadow-[0_4px_12px_rgba(113,212,255,0.3)] transition hover:opacity-90 disabled:opacity-50"
        >
          <Calendar size={18} />
          {generatingRecap 
            ? "Gerando..." 
            : currentMonthRecap 
              ? "Atualizar Recap" 
              : "Gerar Recap do Mês Atual"}
        </motion.button>
      </div>

      {/* Error State */}
      {recapError && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-400">
          {recapError}
        </div>
      )}

      {/* 12-Month Grid */}
      <div className="grid grid-cols-12 gap-2">
        {monthCards.map((card) => {
          const isCurrentMonth = card.month === new Date().getMonth() && card.year === selectedYear;
          
          return (
            <motion.div
              key={`${card.year}-${card.month}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <button
                onClick={() => {
                  if (card.state === "generated") {
                    setOpenStory(card.recap!);
                  } else if (card.state === "available") {
                    handleGenerateRecap(card.year, card.month);
                  }
                }}
                disabled={card.state === "locked" || card.state === "in-progress"}
                className={`flex flex-col items-center gap-1 rounded-lg p-2 transition ${
                  card.state === "generated"
                    ? "cursor-pointer hover:bg-[var(--bg-surface-hover)]"
                    : card.state === "locked"
                      ? "cursor-not-allowed opacity-50"
                      : "cursor-pointer hover:bg-[var(--bg-surface-hover)]"
                }`}
                style={{
                  background: card.state === "generated" ? "rgba(255,255,255,0.02)" : "transparent",
                }}
              >
                <span className="text-xs font-bold text-[var(--text-muted)]">{MONTH_NAMES_PT[card.month].slice(0, 3)}</span>
                {card.state === "generated" && card.recap ? (
                  // Mini stats for generated months
                  <div className="flex flex-col items-center gap-0.5">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-bold text-[var(--accent)]">{card.recap.totalFocusMinutes > 60 ? `${Math.floor(card.recap.totalFocusMinutes/60)}h` : card.recap.totalFocusMinutes}min</span>
                      <span className="text-[10px] text-[var(--text-muted)]">•</span>
                      <span className="text-[10px] font-bold text-[#ffb86b]">{card.recap.longestStreak}d</span>
                    </div>
                    {card.recap.leagueTier && (
                      <span className="text-[8px] font-medium" style={{ color: NEW_TIER_META[card.recap.leagueTier as NewLeagueTier]?.color ?? "#71d4ff" }}>
                        {NEW_TIER_META[card.recap.leagueTier as NewLeagueTier]?.shortLabel ?? card.recap.leagueTier.slice(0, 2)}
                      </span>
                    )}
                  </div>
                ) : card.state === "locked" ? (
                  <LockIcon className="mt-1" />
                ) : null}
              </button>
            </motion.div>
          );
        })}
      </div>

      {/* Story Slides Modal */}
      <AnimatePresence>
        {openStory && (
          <StorySlides
            recap={openStory}
            userName={userName}
            userPhotoUrl={userPhotoUrl}
            onClose={() => setOpenStory(null)}
          />
        )}
      </AnimatePresence>

      {/* Final Page Modal */}
      <AnimatePresence>
        {openFinal && (
          <FinalPage
            recap={openFinal}
            userName={userName}
            userPhotoUrl={userPhotoUrl}
            onClose={() => setOpenFinal(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function LockIcon({ className = "" }: { className?: string }) {
  return (
    <svg 
      className={`h-3 w-3 text-[var(--text-faint)] ${className}`} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="22" width="18" height="4" rx="2" />
      <path d="M12 11v-4a4 4 0 0 1 8 0v4" />
    </svg>
  );
}