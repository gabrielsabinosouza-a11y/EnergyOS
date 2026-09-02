"use client";

import { Gem, Trophy, Lock, Star, X, Plus } from "lucide-react";
import { motion } from "framer-motion";
import Image from "next/image";
import type { AchievementProgress } from "@/types";

export const CATEGORY_COLORS: Record<string, { primary: string; bg: string; glow: string }> = {
  streak: { primary: "#ff8c42", bg: "rgba(255,140,66,0.12)", glow: "rgba(255,140,66,0.4)" },
  focus: { primary: "#b69cff", bg: "rgba(182,156,255,0.12)", glow: "rgba(182,156,255,0.4)" },
  checkin: { primary: "#4ade80", bg: "rgba(74,222,128,0.12)", glow: "rgba(74,222,128,0.4)" },
  sleep: { primary: "#71d4ff", bg: "rgba(113,212,255,0.12)", glow: "rgba(113,212,255,0.4)" },
  social: { primary: "#f472b6", bg: "rgba(244,114,182,0.12)", glow: "rgba(244,114,182,0.4)" },
  league: { primary: "#ffd76b", bg: "rgba(255,215,107,0.12)", glow: "rgba(255,215,107,0.4)" },
};

/**
 * Tier-based icon assets (one image per unlock tier, 1-indexed), keyed by
 * achievement id. The icon shown for an achievement reflects its unlockedTier.
 * Some achievements have fewer images than tiers; the last image is reused for
 * higher tiers. `rarest_aura` has no asset yet and falls back to a lucide icon.
 */
export const ACHIEVEMENT_IMAGES: Record<string, string[]> = {
  streak_master: [
    "/achievements/streaks/streak_1.png",
    "/achievements/streaks/streak_2.png",
    "/achievements/streaks/streak_3.png",
    "/achievements/streaks/streak_4.png",
  ],
  deep_focus: [
    "/achievements/deep_focus/deep_focus1.png",
    "/achievements/deep_focus/deep_focus2.png",
    "/achievements/deep_focus/deep_focus3.png",
    "/achievements/deep_focus/deep_focus4.png",
  ],
  early_riser: [
    "/achievements/Early_riser/early_riser1.png",
    "/achievements/Early_riser/early_riser2.png",
    "/achievements/Early_riser/early_riser3.png",
  ],
  sleep_champion: [
    "/achievements/sleep_champion/sleep_champion1.png",
    "/achievements/sleep_champion/sleep_champion2.png",
    "/achievements/sleep_champion/sleep_champion3.png",
  ],
  consistency_king: [
    "/achievements/Consistency_King/consistency_king1.png",
    "/achievements/Consistency_King/consistency_king2.png",
  ],
  xp_olympian: ["/achievements/XP_Olympian/xp_olympian1.png"],
  social_spark: [
    "/achievements/social_spark/social_spark1.png",
    "/achievements/social_spark/social_spark2.png",
  ],
};

/** Lucide fallbacks used for achievements without a PNG asset. */
export const ACHIEVEMENT_BADGE_ICONS: Record<string, React.ElementType> = {
  rarest_aura: Gem,
};

export const DEFAULT_ICON = Trophy;

/**
 * Renders an achievement's tier-matched icon: the PNG for the current
 * unlockedTier when an asset exists, otherwise the fallback lucide icon.
 * When locked (tier 0), renders a lock glyph.
 *
 * By default renders at a fixed `size`. Pass `fill` to instead stretch to
 * fill its parent container (`w-full h-full object-contain`), which keeps the
 * icon proportional inside a sized halo / tile no matter the container.
 */
export function AchievementIcon({
  id,
  tier,
  size,
  color,
  style,
  locked = false,
  fill = false,
}: {
  id: string;
  tier: number;
  size: number;
  color?: string;
  style?: React.CSSProperties;
  locked?: boolean;
  fill?: boolean;
}) {
  if (locked || tier <= 0) {
    const lockSize = fill ? undefined : Math.round(size);
    return fill ? (
      <Lock className="text-[var(--text-faint)]" style={{ width: "100%", height: "100%", ...style }} />
    ) : (
      <Lock size={lockSize} className="text-[var(--text-faint)]" style={style} />
    );
  }

  const images = ACHIEVEMENT_IMAGES[id];
  const src = images && images.length ? images[Math.min(tier, images.length) - 1] : null;
  if (src) {
    if (fill) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          draggable={false}
          className="pointer-events-none h-full w-full object-contain select-none"
          style={style}
        />
      );
    }
    return (
      <Image src={src} alt="" width={size} height={size} style={{ objectFit: "contain", ...style }} unoptimized />
    );
  }

  const Icon = ACHIEVEMENT_BADGE_ICONS[id] ?? DEFAULT_ICON;
  if (fill) {
    return (
      <Icon style={{ width: "72%", height: "72%", color, ...style }} strokeWidth={2} className="mx-auto" />
    );
  }
  return <Icon size={size} style={{ color, ...style }} />;
}

export function AchievementBadge({
  achievement,
  size = 40,
  iconSize = 38,
}: {
  achievement: AchievementProgress;
  size?: number;
  iconSize?: number;
}) {
  const colors = CATEGORY_COLORS[achievement.category] ?? { primary: "#71d4ff", bg: "rgba(113,212,255,0.12)", glow: "rgba(113,212,255,0.4)" };
  const isEarned = achievement.unlockedTier > 0;

  return (
    <div
      className="flex items-center justify-center overflow-hidden rounded-full"
      style={{
        width: size,
        height: size,
        background: isEarned ? colors.bg : "rgba(255,255,255,0.05)",
        boxShadow: isEarned ? `0 0 14px ${colors.glow}` : "none",
        border: isEarned ? `1px solid ${colors.primary}44` : "1px solid rgba(255,255,255,0.08)",
        color: isEarned ? colors.primary : undefined,
      }}
    >
      <AchievementIcon
        id={achievement.id}
        tier={achievement.unlockedTier}
        size={iconSize}
        locked={!isEarned}
        color={isEarned ? colors.primary : undefined}
        fill
      />
    </div>
  );
}

/**
 * Shared achievement tile used across the profile pages (own + public) and the
 * featured "Destaques" rows. Encapsulates the three visual states:
 *  - unlocked: full-color radial halo + rarity glow, icon fills the halo
 *  - locked: greyscale ring, dashed border, lock glyph (optional progress hint)
 *  - in-progress (locked but has progress): small progress ring around the halo
 * It also renders tier dots and, when `feature` is set, a star indicator and an
 * optional remove affordance used by the own profile.
 */
export function AchievementTile({
  achievement,
  size = 72,
  onClick,
  showRemove,
  onRemove,
  showAdd,
  reduced,
  showProgress = true,
  feature = false,
}: {
  achievement: AchievementProgress;
  size?: number;
  onClick?: () => void;
  showRemove?: boolean;
  onRemove?: (e: React.MouseEvent) => void;
  showAdd?: boolean;
  reduced?: boolean;
  showProgress?: boolean;
  feature?: boolean;
}) {
  const colors = CATEGORY_COLORS[achievement.category] ?? { primary: "#71d4ff", bg: "rgba(113,212,255,0.12)", glow: "rgba(113,212,255,0.4)" };
  const isEarned = achievement.unlockedTier > 0;
  // inner halo is ~88% of the cell so the glow + progress ring breathe inside
  const inner = Math.round(size * 0.86);
  const radius = inner / 2;
  const firstThreshold = achievement.thresholds[0] ?? 1;
  const progress = Math.min((achievement.currentValue ?? 0) / firstThreshold, 1);
  const pct = Math.round(progress * 100);
  const circumference = 2 * Math.PI * radius;
  const dash = isEarned || !showProgress ? circumference : circumference * progress;

  const body = (
    <>
      {/* icon halo */}
      <span
        className="relative flex items-center justify-center overflow-hidden rounded-full"
        style={{
          width: inner,
          height: inner,
          background: isEarned
            ? `radial-gradient(circle at 30% 30%, ${colors.primary}, ${colors.bg})`
            : "rgba(255,255,255,0.03)",
          boxShadow: isEarned ? `0 0 ${Math.round(size * 0.25)}px 2px ${colors.glow}` : "none",
          border: isEarned ? `1px solid ${colors.primary}33` : "1px dashed rgba(255,255,255,0.14)",
          filter: !isEarned ? "grayscale(1) opacity(0.5)" : undefined,
        }}
      >
        {isEarned ? (
          <AchievementIcon id={achievement.id} tier={achievement.unlockedTier} size={inner} color="#000" fill />
        ) : (
          <AchievementIcon id={achievement.id} tier={0} size={inner} locked fill />
        )}
        {/* progress ring */}
        {!isEarned && showProgress && progress > 0 && (
          <svg
            width={inner + 6}
            height={inner + 6}
            viewBox={`0 0 ${inner + 6} ${inner + 6}`}
            className="pointer-events-none absolute"
            style={{ transform: "rotate(-90deg)" }}
          >
            <circle
              cx={(inner + 6) / 2}
              cy={(inner + 6) / 2}
              r={radius + 1}
              fill="none"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth={2}
            />
            <circle
              cx={(inner + 6) / 2}
              cy={(inner + 6) / 2}
              r={radius + 1}
              fill="none"
              stroke={colors.primary}
              strokeWidth={2}
              strokeDasharray={`${dash} ${circumference}`}
              strokeLinecap="round"
              style={{ opacity: 0.9 }}
            />
          </svg>
        )}
      </span>

      {/* tier dots */}
      {isEarned && achievement.thresholds.length > 1 && (
        <span className="mt-1.5 flex justify-center gap-1">
          {achievement.thresholds.map((_, i) => (
            <span
              key={i}
              className="block h-1.5 w-1.5 rounded-full"
              style={{ background: i < achievement.unlockedTier ? colors.primary : "rgba(255,255,255,0.15)" }}
            />
          ))}
        </span>
      )}
      {!isEarned && showProgress && progress > 0 && (
        <span className="mt-1 text-[10px] font-medium" style={{ color: "var(--text-faint)" }}>
          {pct}%
        </span>
      )}
    </>
  );

  const shell = (children: React.ReactNode) => (
    <div className="group relative block shrink-0" style={{ width: size }}>
      <motion.button
        type="button"
        onClick={onClick}
        whileHover={reduced ? undefined : { scale: 1.06 }}
        whileTap={reduced ? undefined : { scale: 0.95 }}
        className="flex w-full cursor-pointer flex-col items-center"
      >
        {children}
      </motion.button>
      {feature && isEarned && (
        <span
          className="pointer-events-none absolute -left-1 -top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full"
          style={{ background: colors.primary, color: "#000" }}
        >
          <Star size={11} strokeWidth={2.5} fill="currentColor" />
        </span>
      )}
      {feature && showAdd && isEarned && showRemove && onRemove && (
        <button
          type="button"
          aria-label="Remover destaque"
          onClick={onRemove}
          className="absolute -right-1 -top-1 z-10 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-[var(--red)] text-black opacity-90 shadow-md transition sm:opacity-0 sm:group-hover:opacity-100"
        >
          <X size={11} />
        </button>
      )}
    </div>
  );

  if (showAdd && !isEarned) {
    return null; // picker list handles adding earned ones elsewhere
  }

  return shell(body);
}

/**
 * Empty ("add") slot for the featured row on the own profile.
 */
export function AchievementAddSlot({
  size = 72,
  onClick,
  reduced,
}: {
  size?: number;
  onClick?: () => void;
  reduced?: boolean;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={reduced ? undefined : { scale: 1.06 }}
      whileTap={reduced ? undefined : { scale: 0.95 }}
      className="group flex shrink-0 cursor-pointer flex-col items-center gap-2"
      style={{ width: size }}
    >
      <span
        className="flex items-center justify-center rounded-full border-2 border-dashed border-white/10 transition-colors group-hover:border-[var(--accent)]/30"
        style={{ width: size, height: size }}
      >
        <span className="flex flex-col items-center gap-1 px-1 text-center text-[var(--text-faint)] transition group-hover:text-[var(--accent)]">
          <Plus size={18} />
          <span className="text-[9px] leading-tight">Destacar conquista</span>
        </span>
      </span>
    </motion.button>
  );
}
