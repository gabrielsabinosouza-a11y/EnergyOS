"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Sparkles, Loader2, AlertTriangle } from "lucide-react";
import type { QuestProgressWithQuest } from "@/types";
import { api } from "@/lib/api-client";
import { useDailyQuests } from "@/lib/quest-store";
import { DAILY_MISSION_LIMIT } from "@/lib/daily-limits";
import { RewardToast } from "@/components/reward-toast";
import { CoinIcon } from "@/components/coin-icon";

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
  coins?: number;
  onCoinsChange?: (coins: number) => void;
}

export function DailyQuestsWidget({ coins = 0, onCoinsChange }: DailyQuestsWidgetProps) {
  // Quest state lives in the shared DailyQuestsProvider so ANY quest-relevant
  // action (daily task checked, focus session completed, kanban "Feito", ...)
  // updates this widget instantly — no refetch needed.
  const { quests, ready, markClaimed, refresh } = useDailyQuests();
  const [claimingId, setClaimingId] = useState<number | null>(null);
  const [showClaimAnimation, setShowClaimAnimation] = useState<{ coins: number; balance: number } | null>(null);
  const [claimError, setClaimError] = useState<{ message: string; questId: number | null } | null>(null);

  useEffect(() => {
    if (claimError) {
      const t = setTimeout(() => setClaimError(null), 4000);
      return () => clearTimeout(t);
    }
  }, [claimError]);

  const handleClaim = useCallback(async (progressId: number, index: number) => {
    const quest = quests[index];
    if (!quest || quest.isClaimed) return;

    setClaimingId(progressId);
    // Optimistic: flip to claimed immediately; reconciled by refresh() below.
    markClaimed(progressId);

    try {
      const result = await api.claimQuestReward(progressId);

      // Update coins
      const newCoins = coins + result.coinsAwarded;
      if (onCoinsChange) {
        onCoinsChange(newCoins);
      }

      // Trigger premium reward animation
      setShowClaimAnimation({ coins: result.coinsAwarded, balance: newCoins });

      // Reconcile with server truth
      void refresh();
    } catch (error) {
      console.error("Failed to claim quest reward:", error);
      setClaimError({ message: error instanceof Error ? error.message : "Não foi possível resgatar a recompensa.", questId: progressId });
      // Roll back the optimistic claim to server truth
      void refresh();
    } finally {
      setClaimingId(null);
    }
  }, [quests, coins, onCoinsChange, markClaimed, refresh]);

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
          <span className="rounded-full bg-[var(--bg-surface-hover)] px-2 py-0.5 text-[9px] text-[var(--text-faint)]">
            {DAILY_MISSION_LIMIT} por dia
          </span>
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
                          <CoinIcon size={20} />
                          <span className="text-[10px] font-bold text-amber-400">+{quest.quest.coinReward}</span>
                        </motion.div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-[var(--text-faint)]">
                          <CoinIcon size={20} />
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
            <p className="text-sm text-[var(--text-muted)]">{ready ? "Nenhuma missão para hoje" : "Carregando missões diárias..."}</p>
          </div>
        )}
      </div>

      <RewardToast
        toast={showClaimAnimation ? { amount: showClaimAnimation.coins, balance: showClaimAnimation.balance } : null}
        onDone={() => setShowClaimAnimation(null)}
      />

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
