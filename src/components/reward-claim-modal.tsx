"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Sparkles, Zap } from "lucide-react";
import { CoinIcon } from "@/components/coin-icon";

export interface RewardClaimModalData {
  coins?: number;
  xp?: number;
  baseXp?: number;
  balance?: number;
}

export function RewardClaimModal({
  reward,
  onClose,
}: {
  reward: RewardClaimModalData | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!reward) return;
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [reward, onClose]);

  const xp = reward?.xp ?? 0;
  const baseXp = reward?.baseXp ?? xp;

  return (
    <AnimatePresence>
      {reward && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Recompensa recebida"
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-amber-300/30 bg-[var(--bg-surface)] p-8 text-center shadow-[0_20px_80px_rgba(0,0,0,0.55)]"
            initial={{ opacity: 0, scale: 0.7, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 360, damping: 20 }}
            onClick={(event) => event.stopPropagation()}
          >
            {Array.from({ length: 8 }).map((_, index) => (
              <motion.div
                key={index}
                className="absolute left-1/2 top-1/2 text-amber-300"
                initial={{ x: 0, y: 0, opacity: 1, scale: 0 }}
                animate={{
                  x: Math.cos((index / 8) * Math.PI * 2) * 120,
                  y: Math.sin((index / 8) * Math.PI * 2) * 100,
                  opacity: 0,
                  scale: 1,
                }}
                transition={{ duration: 0.9, delay: 0.1 }}
              >
                <Sparkles size={16} />
              </motion.div>
            ))}

            <motion.div
              className="relative mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-amber-400/15 text-amber-300 shadow-[0_0_45px_rgba(251,191,36,0.35)]"
              initial={{ scale: 0, rotate: -15 }}
              animate={{ scale: [0, 1.15, 1], rotate: 0 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
            >
              {reward.coins ? <CoinIcon size={56} /> : <Zap size={56} fill="currentColor" />}
            </motion.div>
            <p className="eyebrow mb-2 justify-center text-amber-300">RECOMPENSA RECEBIDA</p>
            <div className="space-y-1 text-lg font-bold text-[var(--text)]">
              {reward.coins ? <p>+{reward.coins} moedas</p> : null}
              {xp ? (
                <p>
                  +{xp} XP
                  {xp !== baseXp ? <span className="ml-1 text-sm text-[#b69cff]">({baseXp} XP ×2)</span> : null}
                </p>
              ) : null}
            </div>
            {reward.balance !== undefined && (
              <p className="mt-2 text-xs text-[var(--text-faint)]">saldo: {reward.balance}</p>
            )}
            <button type="button" className="primary-button mx-auto mt-7" onClick={onClose}>
              <Check size={15} /> Continuar
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
