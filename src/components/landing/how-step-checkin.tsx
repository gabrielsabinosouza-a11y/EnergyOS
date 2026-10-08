"use client";

import { useState } from "react";
import { Check, Plus, BookOpen, Dumbbell } from "lucide-react";
import { StaticIcon } from "./landing-assets";
import { LANDING_ICON_SIZE_ROW } from "./icons";

type EnergyLevel = "baixa" | "boa" | "alta";

const ENERGY_OPTIONS: { id: EnergyLevel; label: string }[] = [
  { id: "baixa", label: "Baixa" },
  { id: "boa", label: "Boa" },
  { id: "alta", label: "Alta" },
];

export function HowStepCheckin() {
  const [energy, setEnergy] = useState<EnergyLevel | null>(null);
  const [sonoDone, setSonoDone] = useState(false);
  const [estudoDone, setEstudoDone] = useState(false);

  return (
    <div className="how-step how-step--checkin">
      <div className="how-step__kicker">CHECK-IN DIÁRIO · Prévia ilustrativa</div>
      <h3>Como você está hoje?</h3>

      <div className="how-step__energy" role="group" aria-label="Nível de energia">
        {ENERGY_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={`how-step__energy-btn${energy === opt.id ? " is-selected" : ""}`}
            aria-pressed={energy === opt.id}
            onClick={() => setEnergy(opt.id)}
          >
            {opt.label}
            {energy === opt.id && (
              <span className="how-step__energy-indicator" aria-hidden="true">
                <Check size={12} strokeWidth={2.5} />
              </span>
            )}
          </button>
        ))}
      </div>

      {energy && (
        <div
          className="how-step__feedback is-registered"
          role="status"
          aria-live="polite"
        >
          <span className="how-step__feedback-icon" aria-hidden="true">
            <Check size={14} strokeWidth={2.5} />
          </span>
          <span className="how-step__feedback-text">Energia registrada</span>
        </div>
      )}

      <div className="how-step__row">
        <StaticIcon name="goodSleep" size={LANDING_ICON_SIZE_ROW} />
        <div className="how-step__row-meta">
          <span className="how-step__row-label">Sono da noite passada</span>
          <span className="how-step__row-value">7h 30m</span>
        </div>
        <button
          type="button"
          className={`how-step__row-add${sonoDone ? " is-done" : ""}`}
          aria-pressed={sonoDone}
          onClick={() => setSonoDone((v) => !v)}
        >
          {sonoDone ? (
            <>
              <StaticIcon name="xp" size={14} />
              <span>+XP</span>
            </>
          ) : (
            <>
              <Plus size={14} />
              <span>Adicionar</span>
            </>
          )}
        </button>
      </div>

      <div className="how-step__row">
        <div className="how-step__row-icons">
          <BookOpen size={LANDING_ICON_SIZE_ROW} strokeWidth={1.75} aria-hidden />
          <Dumbbell size={LANDING_ICON_SIZE_ROW} strokeWidth={1.75} aria-hidden />
        </div>
        <div className="how-step__row-meta">
          <span className="how-step__row-label">Estudo e movimento</span>
          <span className="how-step__row-value">25 min</span>
        </div>
        <button
          type="button"
          className={`how-step__row-add${estudoDone ? " is-done" : ""}`}
          aria-pressed={estudoDone}
          onClick={() => setEstudoDone((v) => !v)}
        >
          {estudoDone ? (
            <>
              <StaticIcon name="xp" size={14} />
              <span>+XP</span>
            </>
          ) : (
            <>
              <Plus size={14} />
              <span>Adicionar</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
