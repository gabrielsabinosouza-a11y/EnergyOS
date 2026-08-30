"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CoinIcon } from "@/components/coin-icon";

export interface RewardToastData {
  amount: number;
  balance?: number;
}

const BURST_COUNT = 4;

/** Anima um número de `from` até `to` com easing, para o count-up do saldo. */
function useAnimatedNumber(to: number, durationMs = 900): number {
  const [display, setDisplay] = useState(to);
  const fromRef = useRef(to);
  useEffect(() => {
    if (to === fromRef.current) return;
    const from = fromRef.current;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, durationMs]);
  return display;
}

/**
 * Toast premium de recompensa em moedas — usado em TODO lugar onde o usuário
 * ganha moedas (missões diárias, tarefas diárias, bônus de sequência, Liga…)
 * para manter o "momento de ganhar moedas" sempre consistente.
 *
 * Exibe o asset real da moeda, em tamanho grande com brilho, entrada com
 * elasticidade (spring), explosão de mini-moedas partindo do centro, e
 * count-up do saldo no canto — reforçando que a moeda "vai para o saldo".
 */
export function RewardToast({ toast, onDone }: {
  toast: RewardToastData | null;
  onDone: () => void;
}) {
  const amount = toast?.amount ?? 0;
  const targetBalance = toast?.balance ?? 0;
  const shownBalance = useAnimatedNumber(amount > 0 && toast ? targetBalance : 0);
  const onDoneRef = useRef(onDone);
  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);

  // Auto-limpa depois de alguns segundos.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => onDoneRef.current(), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          key="reward"
          className="pointer-events-none fixed right-4 top-4 z-[70] flex items-center gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, y: -14 }}
          transition={{ duration: 0.3 }}
        >
          {/* Arco de moeda voando em direção ao canto (saldo) */}
          <motion.div
            className="absolute -left-16 -top-3"
            initial={{ x: -40, y: 30, opacity: 0, rotate: -120 }}
            animate={{ x: -8, y: 2, opacity: [0, 1, 0], rotate: 0 }}
            transition={{ duration: 0.9, delay: 0.15 }}
          >
            <CoinIcon size={20} />
          </motion.div>

          <motion.div
            initial={{ scale: 0, rotate: -12 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 15 }}
            className="relative flex items-center gap-3 rounded-2xl border border-amber-300/40 bg-[var(--bg-surface)] px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.4)]"
          >
            {/* Brilho/glow atrás da moeda */}
            <div
              className="absolute -left-1 top-1/2 h-16 w-16 -translate-y-1/2 rounded-full"
              style={{
                background: "radial-gradient(circle, rgba(255,180,80,0.5) 0%, transparent 70%)",
                filter: "blur(2px)",
              }}
            />
            <div className="relative">
              <motion.div
                animate={{ y: [0, -3, 0] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              >
                <CoinIcon size={40} />
              </motion.div>

              {/* Explosão de mini-moedas */}
              {Array.from({ length: BURST_COUNT }).map((_, i) => {
                const angle = (i / BURST_COUNT) * Math.PI * 2;
                const dist = 34;
                return (
                  <motion.div
                    key={i}
                    className="absolute left-1/2 top-1/2"
                    initial={{ x: 0, y: 0, opacity: 1, scale: 0.4 }}
                    animate={{
                      x: Math.cos(angle) * dist,
                      y: Math.sin(angle) * dist - 10,
                      opacity: 0,
                      scale: 0.7,
                    }}
                    transition={{ duration: 0.7, ease: "easeOut" }}
                  >
                    <CoinIcon size={12} />
                  </motion.div>
                );
              })}
            </div>

            <div className="relative flex flex-col">
              <motion.span
                initial={{ opacity: 0, scale: 0.7, x: -6 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 18, delay: 0.05 }}
                className="font-display text-lg leading-none font-bold text-amber-300"
              >
                +{amount} moedas
              </motion.span>
              {toast.balance !== undefined && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="mt-1 text-[11px] tabular-nums text-[var(--text-faint)]"
                >
                  saldo: {shownBalance}
                </motion.span>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
