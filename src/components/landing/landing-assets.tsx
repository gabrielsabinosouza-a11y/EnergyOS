import Image from "next/image";
import { type LucideIcon } from "lucide-react";

/**
 * One place for every "game-mechanic" image asset used on the landing page.
 * Swap a path here and every icon that renders it updates automatically —
 * no new npm packages, no engine redesign, just a one-line change.
 */
export const LANDING_ASSETS = {
  xp: "/xp/xp.png",
  streakAlive: "/streak/streak_alive.png",
  goodSleep: "/sleep/good_sleep.png",
  focus: "/Onboard/focus.png",
  energyFlame: "/energies/flame/flame_full.png",
  calendar: "/icons_8bits/calendar.png",
  target: "/icons_8bits/target.png",
  graph: "/icons_8bits/graph.png",
  friends: "/sidebar_menu/friends.png",
  store: "/sidebar_menu/store.png",
  firstPlace: "/places/first_place.png",
} as const;

export type LandingAssetKey = keyof typeof LANDING_ASSETS;

/**
 * Low-level image-icon component. `unoptimized` is kept to match the existing
 * asset pipeline (self-hosted assets on the project, no external CDN domains).
 * Size is square; the src is cropped with `objectFit: contain` so the aspect
 * ratio of each asset never distorts the tile it sits in.
 */
export function StaticIcon({
  name,
  size = 16,
  className,
  alt,
}: {
  name: LandingAssetKey;
  size?: number;
  className?: string;
  alt?: string;
}) {
  return (
    <Image
      src={LANDING_ASSETS[name]}
      alt={alt ?? `energyOS ${name} icon`}
      width={size}
      height={size}
      unoptimized
      className={className}
      style={{
        width: size,
        height: size,
        objectFit: "contain",
        display: "inline-block",
      }}
    />
  );
}

/** Union used for any place that can accept either a lucide icon or an asset. */
export type LandingIcon = LucideIcon | LandingAssetKey;

export function isLandingAssetIcon(icon: LandingIcon): icon is LandingAssetKey {
  return typeof icon === "string";
}
