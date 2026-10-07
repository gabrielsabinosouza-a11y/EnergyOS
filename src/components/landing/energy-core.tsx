"use client";

import dynamic from "next/dynamic";
import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { useReducedMotion } from "framer-motion";
import { EnergyCoreFallback } from "./energy-core-fallback";

const EnergyCoreScene = dynamic(() => import("./energy-core-scene"), { ssr: false });

class SceneFallbackBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export function EnergyCore() {
  const hostRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const [visible, setVisible] = useState(false);
  const [hasBeenVisible, setHasBeenVisible] = useState(false);
  const [canRender3d, setCanRender3d] = useState(false);

  useEffect(() => {
    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
    const lowPowerDevice = (navigator.hardwareConcurrency || 8) < 4;
    setCanRender3d(!reducedMotion && !coarsePointer && !lowPowerDevice && supportsWebGL());
  }, [reducedMotion]);

  useEffect(() => {
    const element = hostRef.current;
    if (!element || !canRender3d) return;
    const observer = new IntersectionObserver(([entry]) => {
      setVisible(entry.isIntersecting);
      if (entry.isIntersecting) setHasBeenVisible(true);
    }, { rootMargin: "100px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, [canRender3d]);

  return (
    <div ref={hostRef} className={`energy-core-host${canRender3d && visible ? " is-3d" : ""}`}>
      {canRender3d && hasBeenVisible ? (
        <SceneFallbackBoundary fallback={<EnergyCoreFallback />}>
          <EnergyCoreScene active={visible} />
        </SceneFallbackBoundary>
      ) : <EnergyCoreFallback />}
      <span className="energy-core-demo-note">Prévia ilustrativa · seus dados acompanham sua rotina</span>
    </div>
  );
}
