"use client";

import { useState } from "react";
import { useReducedMotion } from "framer-motion";

const habits = ["SONO", "FOCO", "ESTUDO", "MOVIMENTO", "PAUSAS", "HÁBITOS", "METAS", "CHECK-IN"];

export function HabitTicker() {
  const [paused, setPaused] = useState(false);
  const reducedMotion = useReducedMotion();
  return (
    <div className={`habit-ticker${paused ? " is-paused" : ""}${reducedMotion ? " is-static" : ""}`}>
      <div className="habit-ticker-track" aria-hidden="true">
        {[...habits, ...habits].map((habit, index) => <span key={`${habit}-${index}`}><i />{habit}</span>)}
      </div>
      {!reducedMotion && (
        <button type="button" className="ticker-toggle" onClick={() => setPaused((value) => !value)} aria-pressed={paused} aria-label={paused ? "Retomar faixa de hábitos" : "Pausar faixa de hábitos"}>{paused ? "Retomar" : "Pausar"}</button>
      )}
    </div>
  );
}
