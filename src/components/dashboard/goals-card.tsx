"use client";

import { useState } from "react";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { ArrowUpRight, Check, Plus, Target } from "lucide-react";
import type { Goal } from "@/types";
import Link from "next/link";
import { categoryIcon } from "@/lib/categories";

/** Máximo de metas exibidas no card antes de delegar o restante ao link "Ver todas". */
const MAX_VISIBLE_GOALS = 12;

function isComplete(goal: Goal): boolean {
  return goal.targetValue > 0 && goal.currentValue >= goal.targetValue;
}

export function GoalsCard({ goals, onAdjust }: {
  goals: Goal[];
  onAdjust: (goalId: number, delta: number) => void;
}) {
  const reduced = useReducedMotion();
  const activeGoals = goals.slice(0, MAX_VISIBLE_GOALS);
  const overflowCount = goals.length - activeGoals.length;
  // ids em celebração (acabaram de completar) — controla a animação de parabenização
  const [celebrating, setCelebrating] = useState<Set<number>>(new Set());

  const celebrate = (goalId: number) => {
    setCelebrating((prev) => {
      const next = new Set(prev);
      next.add(goalId);
      return next;
    });
    window.setTimeout(() => {
      setCelebrating((prev) => {
        if (!prev.has(goalId)) return prev;
        const next = new Set(prev);
        next.delete(goalId);
        return next;
      });
    }, 1400);
  };

  if (goals.length === 0) {
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
    <div className="panel p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <span className="eyebrow muted">METAS ATIVAS</span>
        <div className="flex items-center gap-2">
          <Link
            href="/metas"
            aria-label="Ir para Metas e hábitos"
            title="Ir para Metas e hábitos"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] text-[var(--text-muted)] transition hover:border-[var(--accent)]/40 hover:text-[var(--accent)]"
          >
            <ArrowUpRight size={14} />
          </Link>
          <Link href="/metas" className="text-xs text-[var(--accent)] hover:underline">
            Ver todas{overflowCount > 0 ? ` (+${overflowCount})` : ""}
          </Link>
        </div>
      </div>

      <div className="grid grow grid-cols-1 sm:grid-cols-2 gap-3 content-start">
        {activeGoals.map((goal, i) => {
          const { color, icon, name: label } = goal.category;
          const Icon = categoryIcon(icon);
          const done = isComplete(goal);
          const pct = Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100));
          const isCelebrating = celebrating.has(goal.id);

          const handleTap = () => {
            if (done) return;
            const next = goal.currentValue + 1;
            if (next >= goal.targetValue) celebrate(goal.id);
            onAdjust(goal.id, 1);
          };

          return (
            <motion.div
              key={goal.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i, 8) * 0.05 }}
              whileHover={reduced ? undefined : { y: -2 }}
              whileTap={reduced ? undefined : { scale: 0.97 }}
              className="relative flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-hover)] p-3 overflow-hidden"
              style={{
                borderColor: done ? `${color}33` : "var(--border-subtle)",
                background: done
                  ? "var(--bg-surface-hover)"
                  : `linear-gradient(135deg, ${color}0d, transparent 55%)`,
              }}
            >
              {/* Ícone da categoria com tint/glow na cor da categoria */}
              <motion.div
                animate={isCelebrating ? { scale: [1, 1.15, 1] } : undefined}
                transition={{ duration: 0.5 }}
                className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                style={{
                  background: `${color}1a`,
                  boxShadow: isCelebrating ? `0 0 14px ${color}80` : `0 0 0px transparent`,
                }}
              >
                <Icon size={18} style={{ color }} />
              </motion.div>

              <div className="min-w-0 flex-1">
                <p
                  className="text-xs font-medium text-[var(--text)] truncate"
                  style={done ? { textDecoration: "line-through", color: "var(--text-faint)" } : undefined}
                >
                  {goal.title}
                </p>
                <p className="text-[10px] text-[var(--text-faint)]">
                  {done ? (
                    <span style={{ color }}>Concluída</span>
                  ) : (
                    <>{label} · {goal.currentValue}/{goal.targetValue} · {pct}%</>
                  )}
                </p>

                {/* Barra de progresso com fill em spring */}
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-surface-active)]">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: color, boxShadow: `0 0 6px ${color}66` }}
                    initial={false}
                    animate={{ width: `${done ? 100 : pct}%` }}
                    transition={{ type: "spring", stiffness: 120, damping: 20 }}
                  />
                </div>
              </div>

              {/* Ação: check (meta unitária) ou +1 (meta quantitativa).
                  Botão visível compacto (32px), com padding invisível para
                  manter o alvo de toque acessível (~44px) no mobile. */}
              <div className="flex shrink-0 items-center">
                {done ? (
                  <motion.div
                    initial={{ scale: 0.4 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 320, damping: 14 }}
                    className="flex h-8 w-8 items-center justify-center rounded-full"
                    style={{ background: `${color}1a`, color }}
                  >
                    <Check size={16} strokeWidth={3} />
                  </motion.div>
                ) : (
                  <div className="flex items-center justify-center p-1">
                    <motion.button
                      whileTap={reduced ? undefined : { scale: 0.92 }}
                      onClick={handleTap}
                      aria-label={goal.targetValue <= 1 ? `Concluir ${goal.title}` : `Adicionar progresso a ${goal.title}`}
                      title={goal.targetValue <= 1 ? "Marcar como concluída" : "Adicionar +1"}
                      className="flex h-8 w-8 items-center justify-center rounded-full border text-[var(--text)] transition-colors"
                      style={{
                        borderColor: `${color}55`,
                        background: `${color}14`,
                        color,
                      }}
                    >
                      {goal.targetValue <= 1 ? <Check size={16} strokeWidth={3} /> : <Plus size={16} strokeWidth={3} />}
                    </motion.button>
                  </div>
                )}
              </div>

              {/* Explosão de celebração */}
              <AnimatePresence>
                {isCelebrating && (
                  <motion.div
                    key="pop"
                    className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <motion.div
                      initial={{ scale: 0.3, rotate: -8 }}
                      animate={{ scale: [0.3, 1.5, 1], rotate: [0, 6, 0] }}
                      exit={{ scale: 0.5, opacity: 0 }}
                      transition={{ type: "spring", stiffness: 380, damping: 14 }}
                      style={{
                        background: color,
                        color: "var(--bg-primary)",
                        boxShadow: `0 0 24px ${color}`,
                      }}
                      className="flex h-12 w-12 items-center justify-center rounded-full"
                    >
                      <Check size={26} strokeWidth={3.5} />
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}

        {/* Ghost placeholder — preenche espaço vazio e convida a criar uma nova meta */}
        {activeGoals.length < MAX_VISIBLE_GOALS && (
          <Link
            href="/metas"
            aria-label="Criar nova meta"
            title="Criar nova meta"
            className="group flex min-h-[72px] items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-hover)]/40 text-[var(--text-muted)] transition hover:border-[var(--accent)]/50 hover:text-[var(--accent)] hover:bg-[var(--bg-surface-hover)]"
          >
            <motion.span
              whileHover={reduced ? undefined : { scale: 1.1, rotate: 90 }}
              whileTap={reduced ? undefined : { scale: 0.94 }}
              transition={{ type: "spring", stiffness: 320, damping: 18 }}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-current/30 bg-[var(--bg-surface-hover)]"
              style={{ background: "var(--bg-surface-hover)" }}
            >
              <Plus size={16} strokeWidth={2.5} />
            </motion.span>
            <span className="text-xs font-medium">Criar nova meta</span>
          </Link>
        )}
      </div>
    </div>
  );
}
