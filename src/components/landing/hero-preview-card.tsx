import { motion, useReducedMotion } from "framer-motion";
import { StaticIcon, type LandingAssetKey } from "./landing-assets";

/**
 * "Seu dia hoje" preview rows. Each row renders one of the landing's image
 * assets instead of a generic line icon, so the preview immediately reads as
 * energyOS instead of a stock dark-SaaS card.
 */
const ROWS = [
  { asset: "goodSleep" as LandingAssetKey, label: "Sono", value: "7h 30m" },
  { asset: "streakAlive" as LandingAssetKey, label: "Constância", value: "12 dias" },
  { asset: "xp" as LandingAssetKey, label: "XP", value: "+40 XP hoje" },
  { asset: "focus" as LandingAssetKey, label: "Foco", value: "1h 12m" },
] as const;

const ROW_DELAY_MS = 160;

export function HeroPreviewCard() {
  const reducedMotion = useReducedMotion();

  return (
    <div className="hero-preview-card" aria-label="Prévia ilustrativa do seu dia hoje">
      <div className="hero-preview-card__header">
        <span className="hero-preview-card__kicker">✦ Prévia ilustrativa</span>
        <span className="hero-preview-card__checkbox" aria-hidden="true" />
      </div>
      <h3 className="hero-preview-card__title">Seu dia hoje</h3>
      <div className="hero-preview-card__rows">
        {ROWS.map((row, index) => (
          <motion.div
            key={row.asset}
            className="hero-preview-row"
            initial={reducedMotion ? false : { opacity: 0, y: 12, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{
              duration: 0.45,
              delay: ROW_DELAY_MS * index / 1000,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <div className="hero-preview-row__icon">
              <StaticIcon name={row.asset} size={30} />
            </div>
            <div className="hero-preview-row__meta">
              <span className="hero-preview-row__label">{row.label}</span>
              <span className="hero-preview-row__value">
                <strong>{row.value}</strong>
              </span>
              {row.asset === "xp" && <XpProgress />}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function XpProgress() {
  return (
    <div
      className="hero-preview-row__progress"
      role="progressbar"
      aria-valuenow={60}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="hero-preview-row__progress-fill"
        style={{ width: "60%" }}
        aria-hidden="true"
      />
      <span className="hero-preview-row__progress-cap" aria-hidden="true">
        +40 XP hoje
      </span>
    </div>
  );
}
