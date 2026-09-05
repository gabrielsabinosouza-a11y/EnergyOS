"use client";

import { motion } from "framer-motion";
import { XpIcon } from "@/components/xp-icon";

export function XPBadge({ xp, level }: { xp: number; level: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] px-3 py-1.5"
    >
      <XpIcon size={14} />
      <span className="font-mono text-xs font-medium text-[#ffb86b]">{xp} XP</span>
      <span className="text-[var(--text-faint)]">·</span>
      <span className="text-xs text-[var(--text-muted)]">Nv. {level}</span>
    </motion.div>
  );
}
