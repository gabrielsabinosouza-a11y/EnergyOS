"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CoinIcon } from "@/components/coin-icon";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { api } from "@/lib/api-client";
import { SPRING } from "@/lib/design-tokens";

export const COIN_BALANCE_EVENT = "energyos:coin-balance";

/** Dispatch a new authoritative coin balance (e.g. after a coin flight). */
export function publishCoinBalance(balance: number): void {
  window.dispatchEvent(new CustomEvent(COIN_BALANCE_EVENT, { detail: { balance } }));
}

/**
 * Global coin balance chip — fixed top-right on every page, next to where the
 * XP pill lives on the dashboard. The celebration coin-flight targets it via
 * `#energyos-coin-chip`. Balance is server-authoritative: fetched on mount and
 * on `energyos:coin-balance` events (which carry the exact server value).
 */
export function CoinBalanceChip() {
  const [balance, setBalance] = useState<number | null>(null);
  const [pulse, setPulse] = useState(0);
  const pulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.getSettings()
      .then((s) => { if (!cancelled) setBalance(s.coins); })
      .catch(() => { /* chip stays hidden until a balance arrives */ });
    const onBalance = (e: Event) => {
      const next = (e as CustomEvent<{ balance?: number }>).detail?.balance;
      if (typeof next === "number") {
        setBalance(next);
        setPulse((p) => p + 1);
        if (pulseTimer.current) clearTimeout(pulseTimer.current);
        pulseTimer.current = setTimeout(() => setPulse(0), 700);
      }
    };
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      api.getSettings()
        .then((s) => { if (!cancelled) setBalance(s.coins); })
        .catch(() => {});
    };
    window.addEventListener(COIN_BALANCE_EVENT, onBalance);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.removeEventListener(COIN_BALANCE_EVENT, onBalance);
      document.removeEventListener("visibilitychange", onVisible);
      if (pulseTimer.current) clearTimeout(pulseTimer.current);
    };
  }, []);

  return (
    <AnimatePresence>
      {balance !== null && (
        <motion.div
          id="energyos-coin-chip"
          initial={{ opacity: 0, y: -8, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: pulse > 0 ? [1, 1.14, 1] : 1 }}
          exit={{ opacity: 0, y: -8 }}
          transition={SPRING.smooth}
          className="pointer-events-none fixed right-3 top-3 z-40 flex items-center gap-1.5 rounded-full border border-[#ffb86b]/30 bg-[color-mix(in_srgb,var(--bg-surface)_88%,transparent)] px-3 py-1.5 shadow-lg backdrop-blur-md lg:right-5 lg:top-5"
          style={{ boxShadow: pulse > 0 ? "0 0 24px -4px rgba(255,184,107,.55)" : undefined }}
          aria-label={`Saldo de moedas: ${Math.round(balance)}`}
          role="status"
        >
          <CoinIcon size={16} />
          <AnimatedNumber
            value={balance}
            className="font-mono text-sm font-bold tabular-nums text-[#ffb86b]"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
