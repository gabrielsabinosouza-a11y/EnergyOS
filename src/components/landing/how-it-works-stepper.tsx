"use client";

import { type KeyboardEvent } from "react";
import { LANDING_ICON_SIZE_ROW, LANDING_ICON_STROKE } from "./icons";
import { isLandingAssetIcon, StaticIcon, type LandingAssetKey } from "./landing-assets";
import { STEPS, type Step } from "./how-it-works-data";

/**
 * Left-hand stepper. Each step is a real <button> with role="tab"/aria-selected/
 * aria-controls so it is keyboard-operable, and the active tab is visually
 * highlighted. Hover and focus states use the landing's cyan identity.
 *
 * Auto-advance lives in the parent (HowItWorksSection), which also resets it
 * when the user makes the first interaction, so the demo doesn't run over an
 * intentional choice.
 */
export function HowItWorksStepper({
  activeStep,
  onSelect,
}: {
  activeStep: number;
  onSelect: (index: number) => void;
}) {
  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      onSelect((index + 1) % STEPS.length);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      onSelect((index - 1 + STEPS.length) % STEPS.length);
    } else if (event.key === "Home") {
      event.preventDefault();
      onSelect(0);
    } else if (event.key === "End") {
      event.preventDefault();
      onSelect(STEPS.length - 1);
    }
  }

  return (
    <div
      className="story-step-nav"
      role="tablist"
      aria-label="Etapas do energyOS"
      aria-orientation="vertical"
    >
      {STEPS.map((step, index) => {
        const selected = activeStep === index;
        const tabId = `how-step-tab-${step.key}`;
        const panelId = `how-step-panel-${step.key}`;
        return (
          <div key={step.key} className={`story-tab${selected ? " is-active" : ""}`}>
            <button
              type="button"
              id={tabId}
              role="tab"
              aria-selected={selected}
              aria-controls={panelId}
              tabIndex={selected ? 0 : -1}
              className="story-tab-trigger"
              onClick={() => onSelect(index)}
              onKeyDown={(event) => handleKeyDown(event, index)}
            >
              <span className="story-tab-meta">
                <IconRender step={step} size={LANDING_ICON_SIZE_ROW} />
                {step.number} / {step.label}
              </span>
              <span className="story-tab-title">{step.title}</span>
            </button>
            <div
              id={panelId}
              role="tabpanel"
              aria-labelledby={tabId}
              hidden={!selected}
              className="story-tab-panel"
            >
              {selected && <p className="story-tab-desc">{step.text}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function IconRender({ step, size }: { step: Step; size: number }) {
  if (isLandingAssetIcon(step.Icon)) {
    return (
      <span className="story-step-icon" aria-hidden="true">
        <StaticIcon name={step.Icon as LandingAssetKey} size={size} />
      </span>
    );
  }
  return <step.Icon size={size} strokeWidth={LANDING_ICON_STROKE} aria-hidden />;
}
