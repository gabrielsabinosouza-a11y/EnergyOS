"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Zap } from "lucide-react";
import Image from "next/image";
import { XP_BOOST_ITEM, XP_BOOST_DURATION_MS } from "@/lib/xp-boost";

function minutesUntil(expiresAt: string): number {
  const diff = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.round(diff / 60000));
}

export function XpBoostCelebration({
  expiresAt,
  extended,
  durationMs = XP_BOOST_DURATION_MS,
  onClose,
  reduced,
}: {
  expiresAt: string;
  extended: boolean;
  durationMs?: number;
  onClose: () => void;
  reduced: boolean;
}) {
  const [shownMinutes, setShownMinutes] = useState(() => Math.round(durationMs / 60000));

  useEffect(() => {
    // A fresh boost always grants the full duration, so the non-extended case
    // just shows the constant. Extending an active boost counts up toward the
    // new remaining time instead of starting two parallel boosts.
    if (!extended) return;
    const target = minutesUntil(expiresAt);
    if (target <= 0) return;
    const stepMs = Math.max(50, (durationMs / target) * 16);
    const timer = setInterval(() => {
      setShownMinutes((prev) => {
        const next = prev + 1;
        if (next >= target) {
          clearInterval(timer);
          return target;
        }
        return next;
      });
    }, stepMs);
    return () => clearInterval(timer);
  }, [extended, expiresAt, durationMs]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm">
      <motion.div
        role="dialog"
        aria-modal="true"
        initial={{ scale: reduced ? 1 : 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-[var(--accent)]/30 bg-[var(--bg-surface)] p-8 text-center shadow-2xl"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-3xl"
          style={{ background: `radial-gradient(circle at 50% 0%, ${XP_BOOST_ITEM.glow}, transparent 70%)` }}
        />
        <motion.div
          aria-hidden
          className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full"
          style={{ background: "rgba(182,156,255,0.12)", boxShadow: `0 0 40px ${XP_BOOST_ITEM.glow}` }}
          animate={{ scale: [1, 1.06, 1], rotate: [0, -4, 4, 0] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl">
            <Image
              src={XP_BOOST_ITEM.iconPath}
              alt="Poção de XP Duplo"
              width={64}
              height={64}
              className="object-contain"
              unoptimized
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
            <Zap size={40} className="absolute text-[#b69cff]" style={{ display: "none" }} />
          </div>
          <Zap size={22} className="absolute -right-1 -top-1 text-[#ffb86b]" fill="currentColor" />
        </motion.div>

        <h3 className="relative font-display text-xl text-[var(--text)]">
          Você ganhou XP em Dobro!
        </h3>
        <p className="relative mt-2 text-sm text-[var(--text-muted)]">
          {extended ? (
            <>
              Estendido para <strong className="text-[#b69cff]">{shownMinutes} minutos</strong>
            </>
          ) : (
            <>
              <strong className="text-[#b69cff]">{shownMinutes} minutos</strong> de XP
              duplicado
            </>
          )}
        </p>

        <motion.button
          whileTap={reduced ? undefined : { scale: 0.97 }}
          onClick={onClose}
          className="relative mt-6 w-full rounded-xl bg-[var(--accent)] py-3 text-xs font-semibold text-black transition hover:opacity-90"
        >
          Continuar
        </motion.button>
      </motion.div>
    </div>
  );
}
