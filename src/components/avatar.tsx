"use client";

import { useState } from "react";
import type { DecorationRarity } from "@/types";

// Known frame decorations (mirrors avatar_decorations seed in db-schema.sql).
// Used to resolve an equipped frame id into its asset + rarity for rendering;
// the persisted value on profiles is the decoration id, not the asset.
export const FRAME_ASSETS: Record<string, { imageUrl: string; rarity: DecorationRarity }> = {
  frame_fire: { imageUrl: "/decorations/frame_fire.svg", rarity: "common" },
  frame_crystal: { imageUrl: "/decorations/frame_crystal.svg", rarity: "rare" },
  frame_aura: { imageUrl: "/decorations/frame_aura.svg", rarity: "epic" },
  frame_nucleo: { imageUrl: "/decorations/frame_nucleo.svg", rarity: "legendary" },
  frame_nature: { imageUrl: "/decorations/frame_nature.svg", rarity: "common" },
  frame_electric: { imageUrl: "/decorations/frame_electric.svg", rarity: "common" },
  frame_cosmic: { imageUrl: "/decorations/frame_cosmic.svg", rarity: "epic" },
  frame_diamond: { imageUrl: "/decorations/frame_diamond.svg", rarity: "legendary" },
};

const RARITY_BORDER: Record<DecorationRarity, string> = {
  common: "#71d4ff",
  rare: "#b69cff",
  epic: "#ffb86b",
  legendary: "#ffd76b",
};

function DecorationRing({ rarity, size }: { rarity: DecorationRarity; size: number }) {
  const r = size / 2 - 3;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="pointer-events-none">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={RARITY_BORDER[rarity]} strokeWidth={3} opacity={0.85} />
      {rarity === "legendary" && (
        <circle cx={size / 2} cy={size / 2} r={r - 6} fill="none" stroke={RARITY_BORDER[rarity]} strokeWidth={1.5} opacity={0.5} />
      )}
    </svg>
  );
}

interface AvatarProps {
  photoUrl?: string;
  name?: string;
  size?: number;
  equippedDecorationId?: string;
  className?: string;
}

/**
 * Shared avatar: circular photo (or initials) with an optional equipped
 * decoration frame overlaid on top. The frame asset wraps the photo — the
 * photo sits slightly inset and the frame extends a few px past it.
 */
export function Avatar({
  photoUrl,
  name,
  size = 48,
  equippedDecorationId,
  className = "",
}: AvatarProps) {
  const initials = (name ?? "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const frame = equippedDecorationId ? FRAME_ASSETS[equippedDecorationId] : undefined;
  const [frameErrored, setFrameErrored] = useState(false);

  return (
    <div
      className={`relative shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Circular photo/initials, slightly inset so the frame reads around it */}
      <div
        className="absolute rounded-full overflow-hidden flex items-center justify-center bg-[var(--accent-bg)] font-bold text-[var(--accent)]"
        style={{
          inset: frame ? 4 : 0,
          fontSize: (frame ? size - 8 : size) * 0.38,
        }}
      >
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt={name} className="h-full w-full object-cover" />
        ) : (
          initials
        )}
      </div>

      {/* Equipped frame overlay */}
      {frame && !frameErrored && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={frame.imageUrl}
          alt=""
          draggable={false}
          onError={() => setFrameErrored(true)}
          className="pointer-events-none absolute inset-0 h-full w-full select-none"
        />
      )}
      {frame && frameErrored && <DecorationRing rarity={frame.rarity} size={size} />}
    </div>
  );
}
