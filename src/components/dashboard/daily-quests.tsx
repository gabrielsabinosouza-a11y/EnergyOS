"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronRight, Clock, Sparkles, CircleDollarSign, Package, Loader2, AlertTriangle } from "lucide-react";
import type { QuestProgressWithQuest } from "@/types";
import { api } from "@/lib/api-client";
import { todayIso } from "@/lib/db/dates";

const QUEST_TITLES: Record<string, string> = {
  SESSIONS_COUNT: "Complete 2 sessões hoje",
  TOTAL_MINUTES: "Foque 90 minutos hoje",
  ROOM_SESSION: "Foque em uma sala com amigos",
};

const QUEST_DESCRIPTIONS: Record<string, string> = {
  SESSIONS_COUNT: "Conclua 2 sessões de foco",
  TOTAL_MINUTES: "Acumule 90 minutos de foco",
  ROOM_SESSION: "Participe de uma sessão em sala",
};

export interface DailyQuestsWidgetProps {
  initialQuests?: QuestProgressWithQuest[];
  coins?: number;
  onCoinsChange?: (coins: number) => void;
}

export function DailyQuestsWidget({ initialQuests = [], coins = 0, onCoinsChange }: DailyQuestsWidgetProps) {
  const [quests, setQuests] = useState<QuestProgressWithQuest[]>(initialQuests);
  const [claimingId, setClaimingId] = useState<number | null>(null);
  const [showClaimAnimation, setShowClaimAnimation] = useState<{ coins: number; x: number; y: number } | null>(null);
  const [claimError, setClaimError] = useState<{ message: string; questId: number | null } | null>(null);
  const [lastClaimTime, setLastClaimTime] = useState<string>("");

  useEffect(() => {
    if (claimError) {
      const t = setTimeout(() => setClaimError(null), 4000);
      return () => clearTimeout(t);
    }
  }, [claimError]);

  useEffect(() => {
    if (initialQuests.length > 0) {
      setQuests(initialQuests);
    } else {
      fetchQuests();
    }
  }, [initialQuests]);

  const fetchQuests = useCallback(async () => {
    try {
      const data = await api.getDailyQuests();
      setQuests(data.quests);
    } catch (error) {
      console.error("Failed to fetch daily quests:", error);
    }
  }, []);

  const handleClaim = useCallback(async (progressId: number, index: number) => {
    const quest = quests[index];
    if (!quest || quest.isClaimed) return;

    setClaimingId(progressId);

    try {
      const result = await api.claimQuestReward(progressId);
      
      // Update local state
      setQuests((prev) =>
        prev.map((q, i) =>
          i === index ? { ...q, isClaimed: true, claimedAt: new Date().toISOString() } : q
        )
      );
      
      setLastClaimTime(new Date().toISOString());
      
      // Update coins
      const newCoins = coins + result.coinsAwarded;
      if (onCoinsChange) {
        onCoinsChange(newCoins);
      }

      // Trigger claim animation
      setShowClaimAnimation({ coins: result.coinsAwarded, x: 100, y: 50 });

      // Refresh quests after a short delay
      setTimeout(() => {
        fetchQuests();
      }, 1000);
    } catch (error) {
      console.error("Failed to claim quest reward:", error);
      setClaimError({ message: error instanceof Error ? error.message : "Não foi possível resgatar a recompensa.", questId: progressId });
    } finally {
      setClaimingId(null);
    }
  }, [quests, coins, onCoinsChange, fetchQuests]);

  const getProgressPercentage = (quest: QuestProgressWithQuest) => {
    return Math.min((quest.currentValue / quest.quest.targetValue) * 100, 100);
  };

  const isQuestCompletable = (quest: QuestProgressWithQuest) => {
    return quest.currentValue >= quest.quest.targetValue && !quest.isClaimed;
  };

  const formatQuestTitle = (quest: QuestProgressWithQuest) => {
    const type = quest.quest.type;
    const fallback = type && QUEST_TITLES[type];
    return quest.quest.title || fallback || quest.quest.type || "";
  };

  const formatQuestDescription = (quest: QuestProgressWithQuest) => {
    const type = quest.quest.type;
    const fallback = type && QUEST_DESCRIPTIONS[type];
    return quest.quest.description || fallback || "";
  };

  const timeUntilReset = () => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const diff = tomorrow.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return { hours, minutes };
  };

  const { hours, minutes } = timeUntilReset();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="panel p-6"
    >
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-[var(--accent)]" />
          <span className="eyebrow muted">MISSÕES DIÁRIAS</span>
        </div>
        <span className="text-[10px] text-[var(--text-faint)]">
          Novas em {hours}h {minutes}min
        </span>
      </div>

      <div className="space-y-3">
        {quests.map((quest, index) => {
          const progress = getProgressPercentage(quest);
          const isCompletable = isQuestCompletable(quest);
          const isClaimed = quest.isClaimed;
          const isCompleted = quest.isCompleted;

          return (
            <motion.div
              key={quest.id}
              layout
              className={`rounded-xl border transition-all duration-200 ${
                isCompletable && !isClaimed
                  ? "border-amber-400/50 bg-amber-400/5" 
                  : "border-[var(--border-subtle)] bg-[var(--bg-surface-hover)]"
              }`}
              whileHover={{ scale: 1.01 }}
            >
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-[var(--text)] truncate">
                      {formatQuestTitle(quest)}
                    </h3>
                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                      {formatQuestDescription(quest)}
                    </p>
                    
                    <div className="mt-3 flex items-center gap-2">
                      <div className="relative flex-1">
                        <div className="h-1.5 w-full rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
                          <motion.div
                            className="h-full rounded-full bg-[var(--accent)]"
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 0.5, ease: "easeOut" }}
                          />
                          {isCompleted && (
                            <motion.div
                              className="absolute inset-0 bg-gradient-to-r from-[#71d4ff] to-[#ffb86b]"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                            />
                          )}
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-[var(--text-faint)] whitespace-nowrap">
                        {quest.currentValue}/{quest.quest.targetValue}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-center gap-2">
                    <motion.div
                      className="relative"
                      whileTap={{ scale: 0.9 }}
                      onClick={() => isCompletable && !isClaimed && handleClaim(quest.id, index)}
                    >
                      {isClaimed ? (
                        <div className="flex items-center gap-1.5 text-[var(--text-faint)]">
                          <Check size={16} className="text-green-400" />
                          <span className="text-[10px]">Recompensado</span>
                        </div>
                      ) : isCompletable ? (
                        <motion.div
                          className="flex items-center gap-1 cursor-pointer"
                          animate={{ scale: [1, 1.05, 1] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                        >
                          <Package size={20} className="text-amber-400" />
                          <span className="text-[10px] font-bold text-amber-400">+{quest.quest.coinReward}</span>
                        </motion.div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-[var(--text-faint)]">
                          <Package size={20} />
                          <span className="text-[10px]">+{quest.quest.coinReward}</span>
                        </div>
                      )}
                      
                      {claimingId === quest.id && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.5 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.5 }}
                          className="absolute -right-2 -top-2"
                        >
                          <Loader2 size={14} className="animate-spin text-amber-400" />
                        </motion.div>
                      )}
                    </motion.div>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}

        {quests.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Sparkles size={24} className="text-[var(--text-faint)] mb-2" />
            <p className="text-sm text-[var(--text-muted)]">Carregando missões diárias...</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showClaimAnimation && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.5, y: -20 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50"
          >
            <div className="flex items-center gap-3 rounded-2xl border border-amber-400/30 bg-[var(--bg-surface)] px-6 py-4 shadow-2xl">
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 0.3, repeat: 2 }}
              >
                <CircleDollarSign size={24} className="text-amber-400" />
              </motion.div>
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="font-display text-xl text-amber-400"
              >
                +{showClaimAnimation.coins} moedas
              </motion.span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {claimError && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="toast error"
          >
            <AlertTriangle size={16} />
            <span>{claimError.message}</span>
            <button className="toast-action" onClick={() => setClaimError(null)}>OK</button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
