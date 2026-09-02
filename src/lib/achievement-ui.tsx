"use client";

import { Sun, Moon, Calendar, Users, Gem, Trophy, Lock } from "lucide-react";
import type { ReactElement } from "react";
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
 */
export function AchievementIcon({
  id,
  tier,
  size,
  color,
  style,
  locked = false,
}: {
  id: string;
  tier: number;
  size: number;
  color?: string;
  style?: React.CSSProperties;
  locked?: boolean;
}) {
  if (locked || tier <= 0) {
    return <Lock size={Math.round(size * 0.72)} className="text-[var(--text-faint)]" style={style} />;
  }

  const images = ACHIEVEMENT_IMAGES[id];
  const src = images && images.length ? images[Math.min(tier, images.length) - 1] : null;
  if (src) {
    return (
      <Image src={src} alt="" width={size} height={size} style={{ objectFit: "contain", ...style }} unoptimized />
    );
  }

  const Icon = ACHIEVEMENT_BADGE_ICONS[id] ?? DEFAULT_ICON;
  return <Icon size={size} style={{ color, ...style }} />;
}

export function AchievementBadge({
  achievement,
  size = 40,
  iconSize = 18,
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
      />
    </div>
  );
}
