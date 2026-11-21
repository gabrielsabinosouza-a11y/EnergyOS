"use client";

import { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "framer-motion";
import { CoinIcon } from "@/components/coin-icon";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { api } from "@/lib/api-client";
import { SPRING } from "@/lib/design-tokens";
import { usePathname, useRouter } from "next/navigation";

export const COIN_BALANCE_EVENT = "energyos:coin-balance";

/** Dispatch a new authoritative coin balance (e.g. after a coin flight). */
export function publishCoinBalance(balance: number): void {
  window.dispatchEvent(new CustomEvent(COIN_BALANCE_EVENT, { detail: { balance } }));
}

/** Route da loja (reutilizado do sidebar da navegação). */
const STORE_ROUTE = "/loja";

/** Global coin balance chip — fixed top-right on every page, next to where the
 * XP pill lives on the dashboard. The celebration coin-flight targets it via
 * `#energyos-coin-chip`. Balance is server-authoritative: fetched on mount and
 * on `energyos:coin-balance` events (which carry the exact server value).
 */
export function CoinBalanceChip() {
  const pathname = usePathname();
  const navigate = useRouter();
  const reduced = useReducedMotion();

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

  // Don't navigate if already on the store page
  const isOnStorePage = pathname === STORE_ROUTE;

  function handleClick() {
    if (!isOnStorePage) {
      navigate.push(STORE_ROUTE);
    }
  }

  return (
    <AnimatePresence>
      {balance !== null && (
        <motion.button
          id="energyos-coin-chip"
          initial={{ opacity: 0, y: -8, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: pulse > 0 ? [1, 1.14, 1] : 1 }}
          exit={{ opacity: 0, y: -8 }}
          transition={SPRING.smooth}
          whileHover={{
            scale: 1.04,
            boxShadow: "0 0 24px -4px rgba(255,184,107,.55)",
            borderColor: "rgba(255,184,107,.4)",
          }}
          whileTap={{ scale: 0.97 }}
          whileFocus={{
            outline: "2px solid rgba(255,184,107,.5)",
            outlineOffset: "2px",
          }}
          className="fixed right-3 top-3 z-40 flex items-center gap-1.5 rounded-full border border-[#ffb86b]/30 bg-[color-mix(in_srgb,var(--bg-surface)_88%,transparent)] px-3 py-1.5 shadow-lg backdrop-blur-md lg:right-5 lg:top-5 pointer-events-auto"
          style={{ boxShadow: pulse > 0 ? "0 0 24px -4px rgba(255,184,107,.55)" : undefined }}
          aria-label="Ir para a loja"
          title="Abrir loja"
          onClick={handleClick}
          role="button"
          tabIndex={0}
          disabled={!!reduced}
        >
          <CoinIcon
            size={16}
            className="transition-transform duration-200 hover:rotate-6 disabled:pointer-events-none"
          />
          <AnimatedNumber
            value={balance}
            className="font-mono text-sm font-bold tabular-nums text-[#ffb86b]"
          />
          {/* Ícone que indica ação opcional - não afeta largura */}
          {reduced ? null : (
            <motion.span
              className="absolute right-1 top-1/2 -translate-y-1/2 hidden hover:block size-3.5 flex items-center justify-center text-xs text-[#ffb86b]/80"
              layoutId="coin-chip-shopping-bag"
            >
              <svg
                width={12}
                height={12}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="3" y1="9" x2="21" y2="9" />
                <line x1="9" y1="3" x2="9" y2="21" />
              </svg>
            </motion.span>
          )}
        </motion.button>
      )}
    </AnimatePresence>
  );
}
