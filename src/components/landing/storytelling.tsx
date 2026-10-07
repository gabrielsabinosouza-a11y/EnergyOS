"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { useCallback, useId, useRef, useState, type KeyboardEvent } from "react";
import {
  LANDING_ICON_SIZE_ROW,
  LANDING_ICON_STROKE,
  landingIcons,
} from "./icons";
import { GlassCard } from "./primitives";

const steps = [
  {
    key: "checkin",
    number: "01",
    label: "CHECK-IN",
    title: "Comece pelo que você sente.",
    text: "Registre sono, energia, estudo e treino em um check-in rápido. Sem planilhas, sem complicação.",
    Icon: landingIcons.checkin,
  },
  {
    key: "clareza",
    number: "02",
    label: "CLAREZA",
    title: "Encontre seu próprio ritmo.",
    text: "Veja tendências e históricos para entender como seus hábitos se conectam aos seus dias.",
    Icon: landingIcons.clareza,
  },
  {
    key: "constancia",
    number: "03",
    label: "CONSTÂNCIA",
    title: "Transforme intenção em pequenas vitórias.",
    text: "Organize tarefas, acompanhe metas e celebre o progresso sem exigir perfeição.",
    Icon: landingIcons.constancia,
  },
] as const;

type EnergyLevel = "baixa" | "boa" | "alta";

const ENERGY_OPTIONS: { id: EnergyLevel; label: string }[] = [
  { id: "baixa", label: "Baixa" },
  { id: "boa", label: "Boa" },
  { id: "alta", label: "Alta" },
];

const CHART_BARS = [42, 68, 55, 82, 60, 74, 94];

const GOALS = [
  { id: "g1", label: "Dormir antes das 23h", done: true },
  { id: "g2", label: "25 minutos de foco", done: false },
  { id: "g3", label: "Caminhada leve", done: false },
];

const WEEK_DOTS = [true, true, true, true, false, true, true];

function CheckinPreview() {
  const [energy, setEnergy] = useState<EnergyLevel>("boa");
  const Sono = landingIcons.sono;
  const Estudo = landingIcons.estudo;
  const Treino = landingIcons.treino;

  return (
    <>
      <div className="story-preview-kicker">CHECK-IN DIÁRIO · Prévia ilustrativa</div>
      <h3>Como você está hoje?</h3>
      <div className="story-energy-choices" role="group" aria-label="Nível de energia">
        {ENERGY_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={energy === opt.id ? "is-selected" : ""}
            aria-pressed={energy === opt.id}
            onClick={() => setEnergy(opt.id)}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <div className="story-preview-row">
        <Sono size={LANDING_ICON_SIZE_ROW} strokeWidth={LANDING_ICON_STROKE} aria-hidden />
        Sono da noite passada <span>7h 30m</span>
      </div>
      <div className="story-preview-row">
        <Estudo size={LANDING_ICON_SIZE_ROW} strokeWidth={LANDING_ICON_STROKE} aria-hidden />
        Estudo e movimento
        <span className="story-preview-row-icons">
          <Treino size={LANDING_ICON_SIZE_ROW} strokeWidth={LANDING_ICON_STROKE} aria-hidden />
          Adicionar
        </span>
      </div>
    </>
  );
}

function ClarezaPreview() {
  const max = Math.max(...CHART_BARS);
  return (
    <>
      <div className="story-preview-kicker">TENDÊNCIAS · Prévia ilustrativa</div>
      <h3>Energia nos últimos 7 dias</h3>
      <svg
        className="story-chart"
        viewBox="0 0 280 110"
        role="img"
        aria-label="Gráfico ilustrativo de energia em 7 dias"
      >
        {CHART_BARS.map((value, i) => {
          const h = (value / max) * 88;
          const x = 18 + i * 38;
          const y = 100 - h;
          const last = i === CHART_BARS.length - 1;
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={22}
              height={h}
              rx={4}
              className={last ? "story-chart-bar is-last" : "story-chart-bar"}
            />
          );
        })}
      </svg>
      <p className="story-insight">
        Seus dias de energia alta costumam vir depois de 7h+ de sono.
      </p>
    </>
  );
}

function ConstanciaPreview() {
  const [goals, setGoals] = useState(GOALS);
  const Metas = landingIcons.metas;
  const Constancia = landingIcons.constancia;
  const streak = WEEK_DOTS.filter(Boolean).length;

  return (
    <>
      <div className="story-preview-kicker">METAS · Prévia ilustrativa</div>
      <h3>Um passo de cada vez</h3>
      <ul className="story-goals">
        {goals.map((goal) => (
          <li key={goal.id}>
            <label className={goal.done ? "is-done" : ""}>
              <input
                type="checkbox"
                checked={goal.done}
                onChange={() =>
                  setGoals((prev) =>
                    prev.map((g) => (g.id === goal.id ? { ...g, done: !g.done } : g)),
                  )
                }
              />
              <span className="story-goal-check" aria-hidden>
                {goal.done ? <Check size={12} strokeWidth={2.2} /> : null}
              </span>
              {goal.label}
            </label>
          </li>
        ))}
      </ul>
      <div className="story-week-row">
        <Metas size={LANDING_ICON_SIZE_ROW} strokeWidth={LANDING_ICON_STROKE} aria-hidden />
        <div className="story-week-dots" aria-label="Dias da semana com check-in">
          {WEEK_DOTS.map((filled, i) => (
            <i key={i} className={filled ? "is-filled" : ""} />
          ))}
        </div>
        <span className="story-streak">
          <Constancia size={14} strokeWidth={LANDING_ICON_STROKE} aria-hidden />
          {streak} dias
        </span>
      </div>
    </>
  );
}

function StepPreview({ active }: { active: number }) {
  const reducedMotion = useReducedMotion();
  const transition = reducedMotion
    ? { duration: 0 }
    : { duration: 0.25, ease: [0.22, 1, 0.36, 1] as const };

  return (
    <GlassCard className="story-preview">
      <div className="story-preview-top">
        <span className="story-live-dot" aria-hidden /> SUA VISÃO DE HOJE <span>energyOS</span>
      </div>
      <div className="story-preview-stage">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={active}
            className="story-preview-content"
            initial={reducedMotion ? false : { opacity: 0, y: 8, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={reducedMotion ? undefined : { opacity: 0, y: -6, filter: "blur(4px)" }}
            transition={transition}
          >
            {active === 0 && <CheckinPreview />}
            {active === 1 && <ClarezaPreview />}
            {active === 2 && <ConstanciaPreview />}
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="story-preview-footer">
        <span>PRÉVIA ILUSTRATIVA</span>
        <span>Seu painel, do seu jeito</span>
      </div>
    </GlassCard>
  );
}

export function Storytelling() {
  const [activeStep, setActiveStep] = useState(0);
  const reducedMotion = useReducedMotion();
  const baseId = useId();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const selectStep = useCallback((index: number) => {
    setActiveStep(index);
  }, []);

  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = index;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault();
      next = (index + 1) % steps.length;
    } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault();
      next = (index - 1 + steps.length) % steps.length;
    } else if (event.key === "Home") {
      event.preventDefault();
      next = 0;
    } else if (event.key === "End") {
      event.preventDefault();
      next = steps.length - 1;
    } else {
      return;
    }
    selectStep(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <div className="story-layout">
      <div className="story-copy">
        <span className="landing-eyebrow">UM DIA DE CADA VEZ</span>
        <h2 className="landing-gradient-heading">
          Mais clareza.
          <br />
          <em>Menos cobrança.</em>
        </h2>
        <p className="landing-section-lede">
          Um lugar para perceber como você está, organizar o que importa e construir constância no seu ritmo.
        </p>

        <div className="story-step-nav" role="tablist" aria-label="Etapas do energyOS" aria-orientation="vertical">
          {steps.map((step, index) => {
            const selected = activeStep === index;
            const panelId = `${baseId}-panel-${step.key}`;
            const tabId = `${baseId}-tab-${step.key}`;
            const Icon = step.Icon;
            return (
              <div key={step.key} className={`story-tab${selected ? " is-active" : ""}`}>
                <button
                  type="button"
                  id={tabId}
                  role="tab"
                  aria-selected={selected}
                  aria-controls={panelId}
                  tabIndex={selected ? 0 : -1}
                  ref={(el) => {
                    tabRefs.current[index] = el;
                  }}
                  className="story-tab-trigger"
                  onClick={() => selectStep(index)}
                  onKeyDown={(e) => onTabKeyDown(e, index)}
                >
                  <span className="story-tab-meta">
                    <Icon size={LANDING_ICON_SIZE_ROW} strokeWidth={LANDING_ICON_STROKE} aria-hidden />
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
                  {selected && (
                    <motion.div
                      key={step.key}
                      initial={reducedMotion ? false : { height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      transition={
                        reducedMotion
                          ? { duration: 0 }
                          : { duration: 0.28, ease: [0.22, 1, 0.36, 1] }
                      }
                      style={{ overflow: "hidden" }}
                    >
                      <p className="story-tab-desc">{step.text}</p>
                    </motion.div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="story-preview-col">
        <StepPreview active={activeStep} />
      </div>
    </div>
  );
}
