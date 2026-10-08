"use client";

import { useState } from "react";
import Image from "next/image";
import type { UserDailyTask } from "@/types";
import { DEFAULT_HABIT_ICON_ID, getHabitAsset } from "@/lib/habit-icons";

/** Tile sizes for each preset: sm=44px, md=48px, lg=56px. */
const TILE_SIZES = { sm: 44, md: 48, lg: 56 } as const;
type HabitIconSize = keyof typeof TILE_SIZES;

interface HabitIconProps {
  habit: Pick<UserDailyTask, "iconType" | "iconValue" | "color" | "title">;
  /** Preset tile size. Default "md" (48px). */
  size?: HabitIconSize;
  className?: string;
}

/**
 * Consistent habit icon tile across the dashboard, Consistência page, and edit modal.
 * - Fixed square tile with rounded-xl, overflow-hidden, flex centered.
 * - Subtle color tint background (12% opacity) with 1px border at low opacity.
 * - Uploaded images: object-fit: cover filling the whole tile.
 * - App icons: ~70% of tile, object-fit: contain, centered.
 * - Emoji: fixed font size scaled to tile, centered.
 */
export function HabitIcon({ habit, size = "md", className = "" }: HabitIconProps) {
  const [failedSource, setFailedSource] = useState("");
  const tilePx = TILE_SIZES[size];
  const isEmoji = habit.iconType === "emoji" && Boolean(habit.iconValue);
  const requestedSource = habit.iconType === "image" && Boolean(habit.iconValue)
    ? habit.iconValue
    : getHabitAsset(habit.iconValue).path;
  const src = failedSource === requestedSource
    ? getHabitAsset(DEFAULT_HABIT_ICON_ID).path
    : requestedSource;
  const color = habit.color || "#71d4ff";

  // Emoji font size scales with tile: ~50% of tile height
  const emojiFontSize = Math.round(tilePx * 0.5);
  // Asset image size: ~70% of tile
  const assetPx = Math.round(tilePx * 0.7);

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl ${className}`}
      style={{
        width: tilePx,
        height: tilePx,
        backgroundColor: hexAlpha(color, 0.14),
        border: `1px solid ${hexAlpha(color, 0.2)}`,
      }}
    >
      {isEmoji ? (
        <span className="leading-none" style={{ fontSize: emojiFontSize }}>{habit.iconValue}</span>
      ) : (
        <Image
          src={src}
          alt={`${habit.title} ícone`}
          width={assetPx}
          height={assetPx}
          unoptimized
          className={habit.iconType === "image" ? "h-full w-full object-cover" : "object-contain"}
          style={habit.iconType === "image" ? { width: "100%", height: "100%" } : undefined}
          onError={() => setFailedSource(requestedSource)}
        />
      )}
    </span>
  );
}

function hexAlpha(hex: string, alpha: number): string {
  const short = hex.replace("#", "");
  const full = short.length === 3 ? short.split("").map((c) => c + c).join("") : short;
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return `rgba(113, 212, 255, ${alpha})`;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
