"use client"
import { useEffect, useState } from "react";
import { STEPS } from "./how-it-works-data";
import { HowItWorksStepper } from "./how-it-works-stepper";
import { HowItWorksPreview } from "./how-it-works-preview";

/**
 * The "Como funciona" section. The left stepper is a keyboard-accessible
 * tablist; the right card shows the active step with a smooth cross-fade.
 *
 * Auto-advance runs every ~5s while the visitor has not interacted. The moment
 * the user clicks a step (or uses the keyboard), the loop stops so the demo
 * never overrides an intentional choice.
 */
export function HowItWorksSection() {
  const [activeStep, setActiveStep] = useState(0);
  const [hasInteracted, setHasInteracted] = useState(false);

  useEffect(() => {
    if (hasInteracted) return;
    const id = window.setInterval(() => {
      setActiveStep((i) => (i + 1) % STEPS.length);
    }, 5000);
    return () => window.clearInterval(id);
  }, [hasInteracted]);

  const selectStep = (index: number) => {
    setActiveStep(index);
    setHasInteracted(true);
  };

  return (
    <section className="landing-story-section">
      <div className="landing-section-heading">
        <span className="landing-eyebrow">COMO FUNCIONA</span>
        <p>Do check-in à próxima pequena vitória.</p>
      </div>
      <div className="story-layout">
        <HowItWorksStepper activeStep={activeStep} onSelect={selectStep} />
        <HowItWorksPreview activeStep={activeStep} />
      </div>
    </section>
  );
}
