"use client";

import { useState } from "react";
import type { DecorationRarity } from "@/types";

// Known frame decorations (mirrors avatar_decorations seed in db-schema.sql).
// Used to resolve an equipped frame id into its asset + rarity for rendering;
// the persisted value on profiles is the decoration id, not the asset.
export interface FrameAsset {
  imageUrl: string;
  rarity: DecorationRarity;
  /** Fraction (0-1) of the frame canvas the profile photo should fill in the
   *  store preview modal. Only needed for frames whose ring leaves a large
   *  transparent center. */
  photoScale?: number;
  /** Overscale of the frame canvas relative to the avatar box when composited
   *  around a real avatar photo. Defaults to 1.15. */
  overscale?: number;
}

export const FRAME_ASSETS: Record<string, FrameAsset> = {
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
 * Size/centering for the frame canvas given an avatar box size. The frame is
 * drawn `overscale` (default 1.15x) larger than the avatar box, centered on
 * top, so the ring sits exactly around the profile photo circle and extends
 * slightly past it.
 */
export function frameOverscan(size: number, frame?: FrameAsset) {
  const overscale = frame?.overscale ?? 1.15;
  const frameSize = Math.round(size * overscale);
  return { size: frameSize, offset: Math.round((frameSize - size) / 2) };
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

  // Photo inset: the profile photo fills the avatar box (tiny 2% inset) so the
  // decoration ring — which sits near the frame canvas's outer edge — wraps
  // tightly around the photo at any avatar size.
  const photoInset = frame ? Math.max(1, Math.round(size * 0.02)) : 0;

  // The frame canvas is drawn larger than the photo and centered on top, so
  // the ring wraps exactly around the photo edge and extends slightly past it
  // — keeping the same relative prominence as the store preview, scaled to
  // whatever size this avatar instance renders at.
  const { size: frameSize, offset: frameOffset } = frameOverscan(size, frame);

  return (
    <div
      className={`relative shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Circular photo/initials, slightly inset so the frame reads around it */}
      <div
        className="absolute rounded-full overflow-hidden flex items-center justify-center bg-[var(--accent-bg)] font-bold text-[var(--accent)]"
        style={{
          inset: photoInset,
          fontSize: (frame ? size - photoInset * 2 : size) * 0.38,
        }}
      >
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt={name} className="h-full w-full object-cover" />
        ) : (
          initials
        )}
      </div>

      {/* Equipped frame overlay — sized larger than the photo, centered on top */}
      {frame && !frameErrored && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={frame.imageUrl}
          alt=""
          draggable={false}
          onError={() => setFrameErrored(true)}
          className="pointer-events-none absolute select-none"
          style={{ width: frameSize, height: frameSize, left: -frameOffset, top: -frameOffset }}
        />
      )}
      {frame && frameErrored && <DecorationRing rarity={frame.rarity} size={size} />}
    </div>
  );
}
