"use client";

import { AnimatePresence, motion } from "framer-motion";
import { GlassCard, LedBorder, TiltCard } from "./primitives";
import { HowStepConsistency } from "./how-step-consistency";
import { HowStepGarden } from "./how-step-garden";
import { HowStepTimer } from "./how-step-timer";

const STEP_COMPONENTS = {
  checkin: HowStepConsistency,
  clareza: HowStepGarden,
  constancia: HowStepTimer,
} as const;

export function HowItWorksPreview({ activeStep, onInteract, onHoverChange }: { activeStep: number; onInteract: () => void; onHoverChange: (hovered: boolean) => void }) {
  const stepKeys = ["checkin", "clareza", "constancia"] as const;
  const key = stepKeys[activeStep] ?? "checkin";
  const Component = STEP_COMPONENTS[key];

  return (
    <TiltCard className="how-preview-tilt"><LedBorder className="how-preview-border"><GlassCard className="how-it-works-preview" onPointerDownCapture={onInteract} onMouseEnter={() => onHoverChange(true)} onMouseLeave={() => onHoverChange(false)} onFocusCapture={onInteract}>
      <div id={`how-step-panel-${key}`} role="tabpanel" aria-labelledby={`how-step-tab-${key}`} className="how-it-works-preview__content">
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
    </GlassCard></LedBorder></TiltCard>
  );
}
