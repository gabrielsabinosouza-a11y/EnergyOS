"use client";

import { Zap, Sun, Moon, Calendar, Star, Users, Gem, Trophy, Lock } from "lucide-react";
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

const FlameImg = ({ size = 14, ...props }: { size?: number } & Record<string, unknown>) => (
  <Image src="/energies/flame/flame_start.png" alt="streak" width={size} height={size} style={{ objectFit: "contain" }} unoptimized {...props} />
);

export const ACHIEVEMENT_ICONS: Record<string, React.ElementType> = {
  streak_master: FlameImg,
  deep_focus: Zap,
  early_riser: Sun,
  sleep_champion: Moon,
  consistency_king: Calendar,
  xp_olympian: Star,
  social_spark: Users,
  rarest_aura: Gem,
};

export const DEFAULT_ICON = Trophy;

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
  const Icon = ACHIEVEMENT_ICONS[achievement.id] ?? DEFAULT_ICON;
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
      {isEarned ? (
        <Icon size={iconSize} style={{ color: isEarned ? colors.primary : undefined }} />
      ) : (
        <Lock size={iconSize * 0.72} className="text-[var(--text-faint)]" />
      )}
    </div>
  );
}
