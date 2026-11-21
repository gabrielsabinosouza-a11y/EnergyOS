"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { useSeason } from "./season-provider";
import type { SeasonId } from "@/config/seasons";
import { ChristmasLightsInjector } from "./christmas-lights";

/* Deterministic pseudo-random so flakes/floaters don't reshuffle each render. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const SNOW_COUNT = 34; // extras beyond the first 14 are hidden <640px via CSS
const FLUSH_COUNT = 14;
const CONFETTI_COUNT = 90;
const BAT_COUNT = 3;

const CONFETTI_COLORS = ["#ffd76b", "#ff5a5a", "#71d4ff", "#b69cff", "#4ade80", "#ff8a3d"];

function Snowfall() {
  const flakes = useMemo(() => {
    const rand = seeded(7);
    return Array.from({ length: SNOW_COUNT }, (_, i) => ({
      id: i,
      left: rand() * 100,
      size: 2 + rand() * 4,
      duration: 9 + rand() * 14,
      delay: -rand() * 20,
      sway: (rand() - 0.5) * 120,
      opacity: 0.35 + rand() * 0.55,
    }));
  }, []);
  return (
    <>
      {flakes.map((f) => (
        <span
          key={f.id}
          className={`season-particle season-snow rounded-full bg-white${f.id >= 14 ? " max-sm:hidden" : ""}`}
          style={{
            left: `${f.left}%`,
            top: 0,
            width: f.size,
            height: f.size,
            opacity: f.opacity,
            animationDuration: `${f.duration}s`,
            animationDelay: `${f.delay}s`,
            ["--sway" as string]: `${f.sway}px`,
          }}
        />
      ))}
    </>
  );
}

function LightString() {
  const colors = ["#ff5a5a", "#ffd76b", "#4ade80", "#71d4ff", "#b69cff"];
  return (
    <div className="season-lights" aria-hidden>
      {Array.from({ length: 28 }, (_, i) => (
        <i
          key={i}
          style={{
            background: colors[i % colors.length],
            color: colors[i % colors.length],
            animationDelay: `${(i % 7) * 0.35}s`,
          }}
        />
      ))}
    </div>
  );
}

function Bat({ index }: { index: number }) {
  return (
    <span
      className="season-particle season-bat"
      style={{
        top: `${6 + index * 7}%`,
        animationDuration: `${9 + index * 3}s`,
        animationDelay: `${index * 4.5}s`,
        opacity: 0.75,
      }}
      aria-hidden
    >
      <svg width="34" height="18" viewBox="0 0 34 18" fill="#c084fc">
        <path d="M2 10 Q8 2 15 8 Q19 3 22 8 Q27 4 32 10 Q27 12 24 10 Q20 14 17 10 Q14 14 10 10 Q7 12 2 10 Z" />
      </svg>
    </span>
  );
}

function Bats() {
  return (
    <>
      {Array.from({ length: BAT_COUNT }, (_, i) => (
        <Bat key={i} index={i} />
      ))}
    </>
  );
}

/* Lightweight fireworks: a single canvas, capped particle count, paused when
   the tab is hidden. Skipped entirely under prefers-reduced-motion. */
function Fireworks({ reduced }: { reduced: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (reduced) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let hidden = document.hidden;
    const particles: { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number }[] = [];
    const COLORS = ["#ffd76b", "#ff5a5a", "#71d4ff", "#b69cff", "#ffffff"];
    const rand = seeded(42);

    function resize() {
      canvas!.width = window.innerWidth;
      canvas!.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    function spawn() {
      const x = canvas!.width * (0.15 + rand() * 0.7);
      const y = canvas!.height * (0.12 + rand() * 0.3);
      const color = COLORS[Math.floor(rand() * COLORS.length)];
      const count = 26 + Math.floor(rand() * 18);
      for (let i = 0; i < count && particles.length < 220; i++) {
        const angle = (i / count) * Math.PI * 2 + rand() * 0.3;
        const speed = 1.4 + rand() * 2.6;
        particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          color,
          size: 1.4 + rand() * 1.8,
        });
      }
    }

    let last = 0;
    let nextBurst = performance.now() + 600;
    function frame(t: number) {
      raf = requestAnimationFrame(frame);
      if (hidden) return;
      if (t - last < 33) return; // ~30fps is plenty for ambient bursts
      last = t;
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
      if (t >= nextBurst) {
        spawn();
        nextBurst = t + 1400 + rand() * 2200;
      }
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.035;
        p.vx *= 0.985;
        p.life -= 0.011;
        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }
        ctx!.globalAlpha = Math.max(0, p.life);
        ctx!.fillStyle = p.color;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx!.fill();
      }
      ctx!.globalAlpha = 1;
    }
    raf = requestAnimationFrame(frame);

    const onVisibility = () => { hidden = document.hidden; };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [reduced]);

  if (reduced) return null;
  return <canvas ref={canvasRef} className="season-particle" aria-hidden />;
}

function ConfettiBurst() {
  const [pieces, setPieces] = useState<{ id: number; left: number; color: string; delay: number; drift: number; spin: number; w: number; h: number }[]>([]);
  const idRef = useRef(0);

  useEffect(() => {
    function burst() {
      const rand = seeded(Date.now() % 100000);
      const batch = Array.from({ length: CONFETTI_COUNT }, () => {
        idRef.current += 1;
        return {
          id: idRef.current,
          left: rand() * 100,
          color: CONFETTI_COLORS[Math.floor(rand() * CONFETTI_COLORS.length)],
          delay: rand() * 0.5,
          drift: (rand() - 0.5) * 220,
          spin: 360 + rand() * 720,
          w: 5 + rand() * 6,
          h: 8 + rand() * 8,
        };
      });
      setPieces(batch);
      window.setTimeout(() => setPieces([]), 3600);
    }
    window.addEventListener("energyos:seasonal-celebration", burst);
    return () => window.removeEventListener("energyos:seasonal-celebration", burst);
  }, []);

  if (!pieces.length) return null;
  return (
    <>
      {pieces.map((p) => (
        <span
          key={p.id}
          className="season-particle season-confetti-piece"
          style={{
            left: `${p.left}%`,
            width: p.w,
            height: p.h,
            background: p.color,
            borderRadius: p.w > p.h ? "50%" : "2px",
            animationDelay: `${p.delay}s`,
            ["--drift" as string]: `${p.drift}px`,
            ["--spin" as string]: `${p.spin}deg`,
          }}
        />
      ))}
    </>
  );
}

const PASTELS = ["#f0a6c8", "#b79ced", "#b7e4c7", "#ffd166", "#f5c6d6", "#a8d8ea"];

function Floaters() {
  const items = useMemo(() => {
    const rand = seeded(21);
    return Array.from({ length: FLUSH_COUNT }, (_, i) => ({
      id: i,
      left: rand() * 100,
      size: 8 + rand() * 12,
      duration: 12 + rand() * 16,
      delay: -rand() * 25,
      sway: (rand() - 0.5) * 140,
      color: PASTELS[i % PASTELS.length],
      round: rand() > 0.5,
    }));
  }, []);
  return (
    <>
      {items.map((f) => (
        <span
          key={f.id}
          className="season-particle season-floater"
          style={{
            left: `${f.left}%`,
            bottom: 0,
            width: f.size,
            height: f.round ? f.size : f.size * 1.35,
            background: f.color,
            borderRadius: f.round ? "50% 50% 50% 50% / 60% 60% 40% 40%" : "50%",
            opacity: 0.5,
            animationDuration: `${f.duration}s`,
            animationDelay: `${f.delay}s`,
            ["--sway" as string]: `${f.sway}px`,
          }}
          aria-hidden
        />
      ))}
    </>
  );
}

function Pumpkin({ style }: { style: React.CSSProperties }) {
  return (
    <svg width="30" height="26" viewBox="0 0 30 26" style={style} aria-hidden>
      <path d="M15 4 Q13 1 15 0 Q17 1 15 4" stroke="#4ade80" strokeWidth="1.6" fill="none" />
      <ellipse cx="10" cy="15" rx="7" ry="9" fill="#ff8a3d" />
      <ellipse cx="20" cy="15" rx="7" ry="9" fill="#ff8a3d" />
      <ellipse cx="15" cy="15" rx="5" ry="10" fill="#ff8a3d" />
      <path d="M8 8 Q15 5 22 8" stroke="#e06f1f" strokeWidth="1.2" fill="none" opacity=".6" />
      <path d="M7 18 Q15 21 23 18" stroke="#e06f1f" strokeWidth="1.2" fill="none" opacity=".6" />
      <path d="M11 11 l2 2 M17 10 l-2 2 M13 16 l2 2" stroke="#3a1c00" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M11 19 Q15 22 19 19" stroke="#3a1c00" strokeWidth="1.4" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function HalloweenAccents() {
  return (
    <>
      <Pumpkin style={{ position: "absolute", left: "4vw", bottom: "6vh", opacity: 0.5 }} />
      <Pumpkin style={{ position: "absolute", right: "6vw", bottom: "10vh", opacity: 0.35, transform: "scale(.8)" }} />
    </>
  );
}

export function SeasonalDecorations() {
  const { season, isActive, themesEnabled } = useSeason();
  const reduced = useReducedMotion();
  const [tabHidden, setTabHidden] = useState(false);

  // Pause all particle animations while the tab is hidden.
  useEffect(() => {
    const onVis = () => setTabHidden(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  if (!isActive || !themesEnabled || !season) return null;
  const id: SeasonId = season.id;

  return (
    <div className={`season-layer${tabHidden ? " season-paused" : ""}`} aria-hidden>
      {id === "christmas" && (
        <>
          <LightString />
          <Snowfall />
          <ChristmasLightsInjector />
        </>
      )}
      {id === "halloween" && (
        <>
          <Bats />
          <HalloweenAccents />
        </>
      )}
      {id === "newyear" && <Fireworks reduced={!!reduced} />}
      {id === "newyear" && <ConfettiBurst />}
      {id === "easter" && <Floaters />}
    </div>
  );
}

/* Santa hat / bunny ears perched on the energyOS logo. */
export function SeasonalLogoAccessory() {
  const { season, isActive, themesEnabled } = useSeason();
  if (!isActive || !themesEnabled || !season) return null;

  if (season.id === "christmas") {
    return (
      <svg className="season-logo-accessory" width="22" height="16" viewBox="0 0 22 16" aria-hidden>
        <path d="M3 9 L11 1 L19 9 Q11 12 3 9 Z" fill="#e63946" />
        <rect x="1" y="8" width="20" height="4" rx="2" fill="#fff" />
        <circle cx="11" cy="2" r="2.6" fill="#fff" />
      </svg>
    );
  }
  if (season.id === "easter") {
    return (
      <svg className="season-logo-accessory" width="24" height="18" viewBox="0 0 24 18" aria-hidden>
        <ellipse cx="7" cy="5" rx="3" ry="5" fill="#f5c6d6" transform="rotate(-14 7 5)" />
        <ellipse cx="17" cy="5" rx="3" ry="5" fill="#f5c6d6" transform="rotate(14 17 5)" />
        <ellipse cx="7" cy="5" rx="1.4" ry="3" fill="#fff" transform="rotate(-14 7 5)" />
        <ellipse cx="17" cy="5" rx="1.4" ry="3" fill="#fff" transform="rotate(14 17 5)" />
      </svg>
    );
  }
  return null;
}
