import { Check } from "lucide-react";
import { StaticIcon } from "./landing-assets";
import { LANDING_ICON_SIZE_ROW } from "./icons";
import { WEEK_DOTS, STREAK_DAYS } from "./how-step-constants";

export function HowStepConstancia() {
  return (
    <div className="how-step how-step--constancia">
      <div className="how-step__kicker">METAS · Prévia ilustrativa</div>
      <h3>Um passo de cada vez</h3>

      <div className="how-step__streak">
        <div className="how-step__streak-icon" aria-hidden="true">
          <StaticIcon name="streakAlive" size={LANDING_ICON_SIZE_ROW * 5} />
        </div>
        <span className="how-step__streak-count">
          {STREAK_DAYS} <strong>dias</strong>
        </span>
      </div>

      <div className="how-step__week-row">
        <span className="how-step__week-label">Semana</span>
        <div className="how-step__week-checks" aria-label="Dias da semana com check-in">
          {WEEK_DOTS.map((filled, i) => (
            <span
              key={i}
              className={`how-step__week-check${filled ? " is-done" : ""}`}
              aria-label={`Dia ${i + 1}${filled ? ", concluído" : ", pendente"}`}
            >
              {filled ? (
                <Check size={14} strokeWidth={2.5} />
              ) : (
                <span className="how-step__week-check-placeholder" aria-hidden="true" />
              )}
            </span>
          ))}
        </div>
      </div>

      <div className="how-step__xp-chip">
        <StaticIcon name="xp" size={16} />
        <span>+40 XP hoje</span>
      </div>
    </div>
  );
}
