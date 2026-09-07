"use client";

import { useReducedMotion, AnimatePresence, motion } from "framer-motion";
import { Sparkles, X } from "lucide-react";
import { Modal } from "@/components/modal";
import { AchievementIcon, CATEGORY_COLORS } from "@/lib/achievement-ui";
import type { AchievementProgress } from "@/types";

export function AchievementUnlockModal({
  achievement,
  onClose,
}: {
  achievement: AchievementProgress | null;
  onClose: () => void;
}) {
  const reduced = useReducedMotion();
  const colors =
    CATEGORY_COLORS[achievement?.category ?? ""] ?? {
      primary: "#71d4ff",
      bg: "rgba(113,212,255,0.12)",
      glow: "rgba(113,212,255,0.4)",
    };
  // A tier that was already unlocked once and rose again is a level-up ("evolve"),
  // not a first unlock — reflect that in the celebratory copy.
  const isLevelUp = (achievement?.previousTier ?? 0) > 0;

  return (
    <Modal
      open={!!achievement}
      onClose={onClose}
      variant="center"
      zIndex={1000}
      panelClassName="max-w-sm"
    >
      <AnimatePresence>
        {achievement && (
          <div className="relative overflow-hidden rounded-3xl border border-[var(--border-strong)] bg-[var(--bg-surface)] px-8 pb-9 pt-8 text-center">
            {/* soft category glow behind the icon */}
            <div
              className="pointer-events-none absolute inset-x-0 -top-24 mx-auto h-60 w-60 rounded-full blur-3xl"
              style={{ background: colors.bg }}
            />

            {/* close button — top-right corner */}
            <button
              type="button"
              aria-label="Fechar"
              onClick={onClose}
              className="absolute right-3 top-3 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-tertiary)] text-[var(--text-muted)] transition hover:text-[var(--text)]"
            >
              <X size={16} />
            </button>

            {/* sparkle burst */}
            {!reduced &&
              Array.from({ length: 8 }).map((_, i) => (
                <motion.div
                  key={i}
                  className="pointer-events-none absolute left-1/2 top-32 text-amber-300"
                  initial={{ x: 0, y: 0, opacity: 1, scale: 0 }}
                  animate={{
                    x: Math.cos((i / 8) * Math.PI * 2) * 110,
                    y: Math.sin((i / 8) * Math.PI * 2) * 90,
                    opacity: 0,
                    scale: 1,
                  }}
                  transition={{ duration: 0.9, delay: 0.1 }}
                >
                  <Sparkles size={16} />
                </motion.div>
              ))}

            {/* square achievement image container */}
            <motion.div
              className="relative mx-auto mt-2 flex h-32 w-32 items-center justify-center rounded-2xl"
              style={{
                background: colors.bg,
                boxShadow: `0 0 60px -8px ${colors.glow}`,
              }}
              initial={reduced ? { opacity: 0 } : { scale: 0, rotate: -12 }}
              animate={{ opacity: 1, scale: [0, 1.12, 1], rotate: 0 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
            >
              <AchievementIcon
                id={achievement.id}
                tier={achievement.unlockedTier}
                size={96}
                color={colors.primary}
                fill
              />
            </motion.div>

            <p
              className="eyebrow mb-2 mt-4 justify-center"
              style={{ color: colors.primary }}
            >
              {isLevelUp ? "CONQUISTA EVOLUÍDA" : "CONQUISTA DESBLOQUEADA"}
            </p>
            <h2 className="text-lg font-bold text-[var(--text)]">
              {achievement.title}
            </h2>
            {achievement.unlockedTier > 1 && (
              <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                Nível {achievement.unlockedTier} alcançado
              </p>
            )}
            <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)]">
              {achievement.description}
            </p>

            <button
              type="button"
              className="primary-button mx-auto mt-7"
              onClick={onClose}
            >
              Continuar
            </button>
          </div>
        )}
      </AnimatePresence>
    </Modal>
  );
}
