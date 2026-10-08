"use client";

import { AnimatePresence, motion } from "framer-motion";
import { GlassCard } from "./primitives";
import { HowStepCheckin } from "./how-step-checkin";
import { HowStepClareza } from "./how-step-clareza";
import { HowStepConstancia } from "./how-step-constancia";

const STEP_COMPONENTS = {
  checkin: HowStepCheckin,
  clareza: HowStepClareza,
  constancia: HowStepConstancia,
} as const;

export function HowItWorksPreview({ activeStep }: { activeStep: number }) {
  const stepKeys = ["checkin", "clareza", "constancia"] as const;
  const Component = STEP_COMPONENTS[stepKeys[activeStep] ?? "checkin"];

  return (
    <GlassCard className="how-it-works-preview">
      <div className="how-it-works-preview__content">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeStep}
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            exit={{
              opacity: 0,
              y: -8,
              filter: "blur(6px)",
              transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] },
            }}
            transition={{
              duration: 0.35,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <Component />
          </motion.div>
        </AnimatePresence>
      </div>
    </GlassCard>
  );
}
