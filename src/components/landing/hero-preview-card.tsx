"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { StaticIcon, type LandingAssetKey } from "./landing-assets";
import { LedBorder, TiltCard } from "./primitives";

const TASKS = [
  { label: "Check-in de energia", icon: "xp" },
  { label: "Dormir 7h30", icon: "goodSleep" },
  { label: "Focar 25 min", icon: "focus" },
  { label: "Treino", icon: "energyFlame" },
  { label: "Ler 10 páginas", icon: "calendar" },
] as const;

export function HeroPreviewCard() {
  const [done, setDone] = useState([true, true, false, false, false]);
  const reduced = useReducedMotion();
  const completed = useMemo(() => done.filter(Boolean).length, [done]);

  return (
    <TiltCard className="hero-preview-tilt"><LedBorder className="hero-preview-border"><motion.div className="hero-preview-card" initial={reduced ? false : { opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .65 }} aria-label="Demonstração interativa: seu dia hoje">
      <header className="hero-preview-card__header">
        <div><span className="hero-preview-card__kicker">PRÉVIA ILUSTRATIVA · HOJE</span><h3 className="hero-preview-card__title">Seu dia hoje</h3></div>
        <strong className="hero-preview-card__total">{completed}/{TASKS.length} · {completed * 10} XP</strong>
      </header>
      <div className="hero-preview-card__rows">
        {TASKS.map((task, index) => (
          <motion.button type="button" key={task.label} className={`hero-preview-row${done[index] ? " is-done" : ""}`} aria-pressed={done[index]} onClick={() => setDone((items) => items.map((value, i) => i === index ? !value : value))} initial={reduced ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .07 }}>
            <span className="hero-preview-row__icon"><StaticIcon name={task.icon as LandingAssetKey} size={24} alt="" /></span>
            <span className="hero-preview-row__label">{task.label}</span>
            <span className="hero-preview-row__check" aria-hidden="true">{done[index] ? "✓" : ""}</span>
            <AnimatePresence>{done[index] && <motion.span key="xp" className="hero-preview-row__xp" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}><StaticIcon name="xp" size={15} alt="" /> +10 XP</motion.span>}</AnimatePresence>
          </motion.button>
        ))}
      </div>
      <div className="hero-preview-card__progress" role="progressbar" aria-label="Tarefas do dia" aria-valuenow={completed} aria-valuemin={0} aria-valuemax={TASKS.length}><span style={{ width: `${completed / TASKS.length * 100}%` }} /></div>
      <footer className="hero-preview-card__footer"><span><StaticIcon name="streakAlive" size={18} alt="Sequência ativa" /> Sequência</span><strong>{completed === TASKS.length ? 13 : 12} dias</strong></footer>
    </motion.div></LedBorder></TiltCard>
  );
}
