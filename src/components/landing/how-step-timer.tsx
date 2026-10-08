"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { FOCUS_DURATION_MAX_MINUTES as MAX, FOCUS_DURATION_MIN_MINUTES as MIN, FOCUS_DURATION_SNAP_MINUTES as SNAP } from "@/lib/focus-duration";
import { StaticIcon } from "./landing-assets";

const R = 76;
const CIRC = 2 * Math.PI * R;

export function HowStepTimer() {
  const [minutes, setMinutes] = useState(45);
  const [progress, setProgress] = useState(1);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const value = Math.round((minutes - MIN) / SNAP) * SNAP + MIN;
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
  function setFromPointer(event: React.PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left - rect.width / 2;
    const y = event.clientY - rect.top - rect.height / 2;
    const angle = (Math.atan2(y, x) * 180 / Math.PI + 450) % 360;
    const raw = MIN + angle / 360 * (MAX - MIN);
    setMinutes(Math.max(MIN, Math.min(MAX, Math.round(raw / SNAP) * SNAP)));
  }
  const angle = -90 + progress * 360;
  const rad = angle * Math.PI / 180;
  const cx = 100 + Math.cos(rad) * R;
  const cy = 100 + Math.sin(rad) * R;
  return <div className="how-step how-step--timer">
    <div className="how-step__kicker">MEDIDA · Prévia ilustrativa</div><h3>Escolha seu tempo de foco</h3>
    <div className="timer-demo">
      <svg className="timer-demo-ring" viewBox="0 0 200 200" role="slider" tabIndex={0} aria-label="Duração do foco em minutos" aria-valuemin={MIN} aria-valuemax={MAX} aria-valuenow={value} onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setFromPointer(event); }} onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) setFromPointer(event); }} onKeyDown={(event) => { if (event.key === "ArrowRight" || event.key === "ArrowUp") setMinutes((n) => Math.min(MAX, n + SNAP)); if (event.key === "ArrowLeft" || event.key === "ArrowDown") setMinutes((n) => Math.max(MIN, n - SNAP)); if (event.key === "Home") setMinutes(MIN); if (event.key === "End") setMinutes(MAX); }}>
        <circle cx="100" cy="100" r={R} className="timer-demo-track" />
        <circle cx="100" cy="100" r={R} className="timer-demo-progress" strokeDasharray={`${CIRC * (running ? progress : (value - MIN) / (MAX - MIN))} ${CIRC}`} />
        <circle cx={cx} cy={cy} r="7" className="timer-demo-handle" />
      </svg>
      <div className="timer-demo-center"><Image src="/energies/flame/flame_full.png" alt="Energia de foco" width={46} height={46} unoptimized /><strong>{running ? Math.max(1, Math.ceil(progress * value)) : value}</strong><span>MINUTOS DE FOCO</span></div>
    </div>
    <div className="timer-demo-controls"><button type="button" onClick={() => { setFinished(false); setProgress(1); setRunning(true); }}>Iniciar demonstração</button><span>Arraste o anel ou use as setas</span></div>
    <div className={`timer-demo-result${finished ? " is-visible" : ""}`} aria-live="polite">{finished && <><StaticIcon name="xp" size={18} alt="XP" /> Energia plantada · +10 XP</>}</div>
  </div>;
}
