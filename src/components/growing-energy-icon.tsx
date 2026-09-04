"use client";

import { EnergyRingCenter } from "@/components/energy-ring-center";
import type { EnergyStage } from "@/lib/energy-assets";

// Growth thresholds shared by every timer that renders a growing energy.
// Mirrors the dashboard timer: first 25% → spark, 25–70% → forming, then full.
const SPARK_THRESHOLD_PCT = 25;
const FORMING_THRESHOLD_PCT = 70;

/** Resolve the visual growth stage from elapsed/total time (0–100% progress). */
export function resolveGrowthStage(elapsedSeconds: number, totalSeconds: number): EnergyStage {
  if (totalSeconds <= 0) return "full";
  const progressPct = Math.max(0, Math.min(100, (elapsedSeconds / totalSeconds) * 100));
  if (progressPct < SPARK_THRESHOLD_PCT) return "spark";
  if (progressPct < FORMING_THRESHOLD_PCT) return "forming";
  return "full";
}

export interface GrowingEnergyIconProps {
  energyType: string;
  /** Diameter of the wrapping ring/circle, in px. */
  ringSize: number;
  /** Seconds already focused (drives spark → forming → full progression). */
  elapsedSeconds: number;
  /** Total session length in seconds. */
  totalSeconds: number;
  /** Show the completed form while the timer is idle/unstarted (preview). */
  previewFullStage?: boolean;
  /** Render the extinguished (gave-up) asset instead of a growth stage. */
  extinguished?: boolean;
  dimmed?: boolean;
  onPick?: () => void;
  showCluster?: boolean;
  clusterCount?: number;
}

export function GrowingEnergyIcon({
  energyType,
  ringSize,
  elapsedSeconds,
  totalSeconds,
  previewFullStage = true,
  extinguished = false,
  dimmed = false,
  onPick,
  showCluster = false,
  clusterCount = 1,
}: GrowingEnergyIconProps) {
  const stage: EnergyStage = extinguished
    ? "extinguished"
    : previewFullStage
      ? "full"
      : resolveGrowthStage(elapsedSeconds, totalSeconds);

  return (
    <EnergyRingCenter
      energyType={energyType}
      ringSize={ringSize}
      stage={stage}
      dimmed={dimmed}
      onPick={onPick}
      showCluster={showCluster}
      clusterCount={clusterCount}
    />
  );
}