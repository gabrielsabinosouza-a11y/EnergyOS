"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { FOCUS_DURATION_DEFAULT_MINUTES, FOCUS_DURATION_MAX_MINUTES, FOCUS_DURATION_MIN_MINUTES, FOCUS_DURATION_SNAP_MINUTES } from "@/lib/focus-duration";
import { CircularDurationPicker } from "@/components/dashboard/circular-duration-picker";
import { StaticIcon } from "./landing-assets";

export function HowStepTimer() {
  const [minutes, setMinutes] = useState(FOCUS_DURATION_DEFAULT_MINUTES);
  const [progress, setProgress] = useState(1);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  useEffect(() => {
    if (!running) return;
    const started = performance.now();
    const duration = 4200;
    const timer = window.setInterval(() => {
      const next = Math.max(0, 1 - (performance.now() - started) / duration);
      setProgress(next);
      if (next <= 0) {
        window.clearInterval(timer);
        setRunning(false);
        setFinished(true);
        window.setTimeout(() => { setFinished(false); setProgress(1); }, 1800);
      }
    }, 50);
    return () => window.clearInterval(timer);
  }, [running]);
  const displayMinutes = running ? Math.max(1, Math.ceil(progress * minutes)) : minutes;
  return <div className="how-step how-step--timer">
    <div className="how-step__kicker">MEDIDA · Prévia ilustrativa</div><h3>Escolha seu tempo de foco</h3>
    <div className="timer-demo">
      <CircularDurationPicker
        value={minutes}
        onChange={setMinutes}
        minMinutes={FOCUS_DURATION_MIN_MINUTES}
        maxDurationMinutes={FOCUS_DURATION_MAX_MINUTES}
        snapIncrement={FOCUS_DURATION_SNAP_MINUTES}
        size={200}
        accentColor="#6dd3ff"
        trackColor="rgba(184,214,232,.13)"
        disabled={running}
        progressOverride={running ? progress : undefined}
        showTicks={false}
        centerContent={<div className="timer-demo-center"><Image src="/energies/flame/flame_full.png" alt="Energia de foco" width={46} height={46} unoptimized /><strong>{displayMinutes}</strong><span>MINUTOS DE FOCO</span></div>}
      />
    </div>
    <div className="timer-demo-controls"><button type="button" onClick={() => { setFinished(false); setProgress(1); setRunning(true); }}>Iniciar demonstração</button><span>Arraste o anel ou use as setas</span></div>
    <div className={`timer-demo-result${finished ? " is-visible" : ""}`} aria-live="polite">{finished && <><StaticIcon name="xp" size={18} alt="XP" /> Energia plantada · +10 XP</>}</div>
  </div>;
}
