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
  frame_fire: { imageUrl: "/decorations/frame_fire.svg", rarity: "common", photoScale: 0.90, overscale: 1.18 },
  frame_crystal: { imageUrl: "/decorations/frame_crystal.svg", rarity: "rare", photoScale: 0.90, overscale: 1.18 },
  frame_aura: { imageUrl: "/decorations/frame_aura.svg", rarity: "epic", photoScale: 0.90, overscale: 1.1 },
  frame_nucleo: { imageUrl: "/decorations/frame_nucleo.svg", rarity: "legendary", photoScale:  0.90, overscale: 1.12 },
  frame_nature: { imageUrl: "/decorations/frame_nature.svg", rarity: "common", photoScale:  0.90, overscale: 1.18 },
  frame_electric: { imageUrl: "/decorations/frame_electric.svg", rarity: "common", photoScale:  0.90, overscale: 1.18 },
  frame_cosmic: { imageUrl: "/decorations/frame_cosmic.svg", rarity: "epic", photoScale:  0.90, overscale: 1.1 },
  frame_diamond: { imageUrl: "/decorations/frame_diamond.svg", rarity: "legendary", photoScale:  0.90, overscale: 1.18 },
};

const RARITY_BORDER: Record<DecorationRarity, string> = {
  common: "#71d4ff",
  rare: "#b69cff",
  epic: "#ffb86b",
  legendary: "#ffd76b",
};

const RARITY_GLOW: Record<DecorationRarity, string> = {
  common: "rgba(113,212,255,0.28)",
  rare: "rgba(182,156,255,0.30)",
  epic: "rgba(255,184,107,0.32)",
  legendary: "rgba(255,215,107,0.38)",
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
 * drawn `overscale` (default 1.38x) larger than the avatar box, centered
 * behind the photo, so the decorative borders extend around the profile photo.
 */
export function frameOverscan(size: number, frame?: FrameAsset) {
  const overscale = frame?.overscale ?? 1.38;
  const frameSize = Math.round(size * overscale);
  return { size: frameSize, offset: Math.round((frameSize - size) / 2) };
}

/**
 * Shared avatar: circular photo (or initials) with an optional equipped
 * decoration frame positioned behind it. The frame asset wraps the photo — the
 * photo sits in the center and the frame extends outward around it.
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

  // The frame canvas is drawn larger than the photo and centered behind it,
  // so the decorative borders extend around the photo while the photo
  // sits centered on top of it.
  const { size: frameSize, offset: frameOffset } = frameOverscan(size, frame);

  return (
    <div
      className={`relative shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Equipped frame background — sized larger than the photo, centered behind */}
      {frame && !frameErrored && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={frame.imageUrl}
          alt=""
          draggable={false}
          onError={() => setFrameErrored(true)}
          className="pointer-events-none absolute select-none z-0 max-w-none"
          style={{ width: frameSize, height: frameSize, left: -frameOffset, top: -frameOffset }}
        />
      )}

      {/* Circular photo/initials, on top of the frame */}
      <div
        className="relative rounded-full overflow-hidden flex items-center justify-center bg-[var(--accent-bg)] font-bold text-[var(--accent)] z-10"
        style={{
          width: size,
          height: size,
          fontSize: size * 0.38,
        }}
      >
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt={name} className="h-full w-full object-cover" />
        ) : (
          initials
        )}
      </div>

      {frame && frameErrored && <DecorationRing rarity={frame.rarity} size={size} />}
    </div>
  );
}

interface AvatarWithFrameProps {
  photoUrl?: string;
  name?: string;
  size?: number;
  equippedDecorationId?: string;
  className?: string;
  /** Additional glow color override (e.g. streak heat) when no frame is equipped. */
  glowColor?: string;
}

/**
 * Avatar wrapped with a soft ambient glow that matches the equipped frame's
 * rarity tier (ou raridade destacada). Used consistently across the profile
 * pages, league tables, and public profiles so the "premium" look is shared.
 */
export function AvatarWithFrame({
  photoUrl,
  name,
  size = 80,
  equippedDecorationId,
  className = "",
  glowColor,
}: AvatarWithFrameProps) {
  const frame = equippedDecorationId ? FRAME_ASSETS[equippedDecorationId] : undefined;
  const halo = glowColor ?? (frame ? RARITY_GLOW[frame.rarity] : undefined);

  return (
    <div
      className={`relative shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        transform: "translateZ(0)",
      }}
    >
      {halo && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full opacity-70"
          style={{
            transform: "scale(1.16)",
            background: `radial-gradient(circle at 50% 45%, ${halo} 0%, transparent 72%)`,
            filter: "blur(6px)",
          }}
        />
      )}
      <div className="relative z-[1] h-full w-full">
        <Avatar
          photoUrl={photoUrl}
          name={name}
          size={size}
          equippedDecorationId={equippedDecorationId}
        />
      </div>
    </div>
  );
}
