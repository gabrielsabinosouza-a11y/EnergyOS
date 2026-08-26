"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Target, Moon, Timer, Heart, Zap } from "lucide-react";
import type { Goal, GoalCategory } from "@/types";
import Link from "next/link";

const CATEGORY_META: Record<GoalCategory, { label: string; color: string; icon: React.ElementType }> = {
  sono:   { label: "Sono",   color: "#71d4ff", icon: Moon },
  estudo: { label: "Estudo", color: "#b69cff", icon: Timer },
  treino: { label: "Treino", color: "#ffb86b", icon: Target },
  saude:  { label: "Saúde",  color: "#6bffb8", icon: Heart },
  foco:   { label: "Foco",   color: "#ff9f6b", icon: Zap },
};

export function GoalsCard({ goals }: { goals: Goal[] }) {
  const reduced = useReducedMotion();
  const activeGoals = goals.slice(0, 4);

  if (activeGoals.length === 0) {
    return (
      <div className="panel p-6 h-full flex flex-col items-center justify-center">
        <motion.div
          animate={reduced ? {} : { y: [0, -5, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          <Target size={24} className="text-[var(--text-faint)] mb-3" />
        </motion.div>
        <p className="text-sm text-[var(--text-muted)]">Nenhuma meta ativa</p>
        <Link href="/metas" className="mt-2 text-xs text-[var(--accent)] hover:underline">Criar meta</Link>
      </div>
    );
  }

  return (
    <div className="panel p-6">
      <div className="flex items-center justify-between mb-4">
        <span className="eyebrow muted">METAS ATIVAS</span>
        <Link href="/metas" className="text-xs text-[var(--accent)] hover:underline">Ver todas</Link>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {activeGoals.map((goal, i) => {
          const { color, icon: Icon, label } = CATEGORY_META[goal.category];
          const pct = Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100));
          const circ = 2 * Math.PI * 17;
          const arcLen = (pct / 100) * circ;
          return (
            <motion.div
              key={goal.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              whileHover={reduced ? undefined : { y: -2 }}
              className="flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] p-3"
            >
              <div className="relative flex-shrink-0">
                <svg width="40" height="40" viewBox="0 0 40 40">
                  <circle cx="20" cy="20" r="17" fill="none" stroke="var(--border-subtle)" strokeWidth="3" />
                  <motion.circle
                    cx="20" cy="20" r="17" fill="none"
                    stroke={color}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={`${arcLen} ${circ - arcLen}`}
                    transform="rotate(-90 20 20)"
                    initial={{ strokeDasharray: `0 ${circ}` }}
                    animate={{ strokeDasharray: `${arcLen} ${circ - arcLen}` }}
                    transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: i * 0.08 }}
                    style={{ filter: `drop-shadow(0 0 4px ${color}40)` }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Icon size={14} style={{ color }} />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-[var(--text)] truncate">{goal.title}</p>
                <p className="text-[10px] text-[var(--text-faint)]">{label} · {pct}%</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
