"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { XpIcon } from "@/components/xp-icon";

function remainingSeconds(expiresAt: string): number {
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

export function formatRemaining(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}min ${s.toString().padStart(2, "0")}s`;
}

export function XpBoostIndicator({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = useState(() => remainingSeconds(expiresAt));

  useEffect(() => {
    const interval = setInterval(() => {
      const next = remainingSeconds(expiresAt);
      setRemaining(next);
      if (next <= 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  if (remaining <= 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      title="Poção de XP Duplo ativa"
      className="flex items-center gap-2 rounded-full border border-[#b69cff]/40 bg-[#b69cff]/10 px-3 py-1.5"
    >
      <motion.span
        animate={{ opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="flex items-center gap-1 font-mono text-xs font-bold text-[#b69cff]"
      >
        <XpIcon size={13} variant="double" /> 2x XP
      </motion.span>
      <span className="text-[var(--text-faint)]">·</span>
      <span className="font-mono text-xs text-[var(--text-muted)]">{formatRemaining(remaining)}</span>
    </motion.div>
  );
}

export function XpBoostIndicatorFallback() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      title="Poção de XP Duplo ativa"
      className="flex items-center gap-2 rounded-full border border-[#b69cff]/40 bg-[#b69cff]/10 px-3 py-1.5"
    >
      <motion.span
        animate={{ opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="flex items-center gap-1 font-mono text-xs font-bold text-[#b69cff]"
      >
        <XpIcon size={13} variant="double" /> 2x XP
      </motion.span>
    </motion.div>
  );
}
