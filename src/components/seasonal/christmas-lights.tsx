"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";

/*
 * Christmas light strings rendered along the top edge of every card.
 *
 * ChristmasLightsInjector scans the document for card surfaces and portals a
 * ChristmasLights strip into each one, so every .panel/.glass-card/
 * .metric-card/.insight-panel/.question-panel gets lights automatically.
 * It only mounts while the Christmas season is active (see
 * SeasonalDecorations), and all animation is CSS-keyframe + transform/opacity
 * so it stays cheap even with a dozen cards on screen.
 */

const CARD_SELECTOR =
  ".panel, .glass-card, .metric-card, .insight-panel, .question-panel";
const STRIP_CLASS = "xmas-strip";

const BULB_SPACING = 30; // target px between bulbs
const MIN_BULBS = 4;
const MAX_BULBS = 26;
const EDGE_PAD = 16;
const WIRE_Y = 3;
const WIRE_SAG = 5;

function ChristmasLights() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);

  // Measure the host card (the portal container's parent) and re-measure on
  // resize so the bulb count adapts to the card width.
  useEffect(() => {
    const card = wrapRef.current?.parentElement;
    if (!card) return;
    const update = () => setWidth(card.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(card);
    return () => ro.disconnect();
  }, []);

  const count = Math.max(
    MIN_BULBS,
    Math.min(MAX_BULBS, Math.round(width / BULB_SPACING) || MIN_BULBS),
  );
  const span = Math.max(width - EDGE_PAD * 2, 40);
  const xs = Array.from(
    { length: count },
    (_, i) => EDGE_PAD + (count === 1 ? span / 2 : (span * i) / (count - 1)),
  );

  // Wire path: straight at each bulb, sagging quadratics in between.
  let wire = `M ${xs[0]} ${WIRE_Y}`;
  for (let i = 0; i < xs.length - 1; i++) {
    const midX = (xs[i] + xs[i + 1]) / 2;
    wire += ` Q ${midX} ${WIRE_Y + WIRE_SAG} ${xs[i + 1]} ${WIRE_Y}`;
  }

  return (
    <div ref={wrapRef} className={STRIP_CLASS} aria-hidden>
      <svg
        className="xmas-wire"
        width={Math.max(width, 1)}
        height={14}
        viewBox={`0 0 ${Math.max(width, 1)} 14`}
        preserveAspectRatio="none"
      >
        <path
          d={wire}
          fill="none"
          stroke="var(--border-strong)"
          strokeOpacity="0.55"
          strokeWidth="1.2"
        />
      </svg>
      {width > 0 &&
        xs.map((x, i) => {
          const twDur = 0.8 + (i % 5) * 0.1; // 0.8s–1.2s
          const swayDur = 3.2 + (i % 4) * 0.45;
          return (
            <motion.div
              key={i}
              className="xmas-bulb"
              style={{ left: x, transformOrigin: "50% 0" }}
              initial={reduced ? false : { opacity: 0, scale: 0.3, y: -3 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{
                delay: 0.15 + i * 0.04,
                type: "spring",
                stiffness: 260,
                damping: 20,
              }}
              whileHover={reduced ? undefined : { rotate: [0, 15, -9, 4, 0] }}
            >
              <div
                className="xmas-sway"
                style={
                  {
                    "--sway-dur": `${swayDur}s`,
                    "--sway-delay": `${-(i * 0.61) % swayDur}s`,
                  } as CSSProperties
                }
              >
                <div className="xmas-socket" />
                <div
                  className="xmas-glass"
                  style={
                    {
                      "--c": `var(--xmas-${(i % 4) + 1})`,
                      "--tw-dur": `${twDur}s`,
                      // Stepped ripple (one bulb after another) + per-bulb
                      // duration so the string never blinks in sync.
                      "--tw-delay": `${-(((i % 9) * 0.12) % twDur)}s`,
                    } as CSSProperties
                  }
                />
              </div>
            </motion.div>
          );
        })}
    </div>
  );
}

export function ChristmasLightsInjector() {
  const [cards, setCards] = useState<HTMLElement[]>([]);

  // Find every card surface and portal a light strip into it. Re-scans on DOM
  // mutations (debounced) so dynamically added/removed cards are picked up.
  useEffect(() => {
    let timer = 0;
    const scan = () => {
      const found = Array.from(
        document.querySelectorAll<HTMLElement>(CARD_SELECTOR),
      ).filter((el) => el.isConnected);
      setCards((prev) =>
        prev.length === found.length && prev.every((el, i) => el === found[i])
          ? prev
          : found,
      );
    };
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(scan, 120);
    };
    scan();
    const mo = new MutationObserver(schedule);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      mo.disconnect();
      window.clearTimeout(timer);
    };
  }, []);

  // Pause bulb animations while the tab is hidden.
  useEffect(() => {
    const onVis = () =>
      document.documentElement.classList.toggle("xmas-paused", document.hidden);
    onVis();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      document.documentElement.classList.remove("xmas-paused");
    };
  }, []);

  return (
    <>{cards.map((el, i) => createPortal(<ChristmasLights key={i} />, el))}</>
  );
}
