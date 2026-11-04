/** Canonical league order and configuration shared by UI, ranking, and rewards. */
export const NEW_TIER_ORDER = [
  "BRONZE",
  "SILVER",
  "GOLD",
  "EMERALD",
  "DIAMOND",
  "OBSIDIAN",
  "LEGENDS",
] as const;

export type NewLeagueTier = typeof NEW_TIER_ORDER[number];

export const PROMOTION_TOP = 3;
export const DEMOTION_START_RANK = 11;
export const TOP1_GLOBAL_FIRST_UNLOCK_BONUS = 1_000;

export type LeagueZone = "promotion" | "reward" | "safe" | "demotion";
const LEGACY_TIER_ALIASES: Record<string, NewLeagueTier> = {
  PRATA: "SILVER",
  OURO: "GOLD",
  DIAMANTE: "DIAMOND",
  LENDAS: "LEGENDS",
};

export interface NewTierMeta {
  label: string;
  shortLabel: string;
  color: string;
  glow: string;
  description: string;
  iconPath: string;
}

export const NEW_TIER_META: Record<NewLeagueTier, NewTierMeta> = {
  BRONZE: {
    label: "Bronze",
    shortLabel: "BR",
    color: "#cd7f32",
    glow: "rgba(205,127,50,0.4)",
    description: "O início da jornada",
    iconPath: "/leaderboard/bronze.png",
  },
  SILVER: {
    label: "Prata",
    shortLabel: "PR",
    color: "#c0c0c0",
    glow: "rgba(192,192,192,0.4)",
    description: "Consistência crescendo",
    iconPath: "/leaderboard/prata.png",
  },
  GOLD: {
    label: "Ouro",
    shortLabel: "OU",
    color: "#ffd700",
    glow: "rgba(255,215,0,0.4)",
    description: "Domínio do foco",
    iconPath: "/leaderboard/ouro.png",
  },
  EMERALD: {
    label: "Esmeralda",
    shortLabel: "ES",
    color: "#22C55E",
    glow: "rgba(34,197,94,0.4)",
    description: "Energia rara, lapidada pela consistência",
    iconPath: "/leaderboard/esmerald.png",
  },
  DIAMOND: {
    label: "Diamante",
    shortLabel: "DI",
    color: "#00bfff",
    glow: "rgba(0,191,255,0.4)",
    description: "Precisão e excelência",
    iconPath: "/leaderboard/diamante.png",
  },
  OBSIDIAN: {
    label: "Obsidiana",
    shortLabel: "OB",
    color: "#A855F7",
    glow: "rgba(124,58,237,0.5)",
    description: "Cristal mítico à beira da elite",
    iconPath: "/leaderboard/obisidian.png",
  },
  LEGENDS: {
    label: "Lendas",
    shortLabel: "LE",
    color: "#f6c85f",
    glow: "rgba(186,104,200,0.55)",
    description: "Os melhores entre os melhores",
    iconPath: "/leaderboard/lendas.png",
  },
};

export const LEAGUE_PROMOTION_CUTOFFS: Record<NewLeagueTier, number> = {
  BRONZE: PROMOTION_TOP,
  SILVER: PROMOTION_TOP,
  GOLD: PROMOTION_TOP,
  EMERALD: PROMOTION_TOP,
  DIAMOND: PROMOTION_TOP,
  OBSIDIAN: PROMOTION_TOP,
  LEGENDS: 0,
};

export const LEGENDS_MAX_SIZE = 20;

export const LEAGUE_REWARDS: Record<NewLeagueTier, readonly [number, number, number]> = {
  BRONZE: [75, 50, 25],
  SILVER: [100, 75, 50],
  GOLD: [150, 100, 75],
  EMERALD: [200, 150, 100],
  DIAMOND: [275, 200, 125],
  OBSIDIAN: [375, 275, 175],
  LEGENDS: [600, 400, 250],
};

export const INITIAL_TIER_XP: Partial<Record<NewLeagueTier, number>> = {
  BRONZE: 0,
  SILVER: 1_500,
  GOLD: 3_000,
  EMERALD: 4_000,
  DIAMOND: 5_000,
  OBSIDIAN: 6_500,
};

/** Returns the next tier or null when the user has reached Legends. */
export function nextLeagueTier(tier: NewLeagueTier): NewLeagueTier | null {
  const index = NEW_TIER_ORDER.indexOf(tier);
  return NEW_TIER_ORDER[index + 1] ?? null;
}

/** Resolves the weekly zone for a rank; callers must not duplicate league thresholds. */
export function getLeagueZone(tier: NewLeagueTier, rank: number, groupSize: number): LeagueZone {
  if (
    !Number.isInteger(rank) ||
    !Number.isInteger(groupSize) ||
    rank < 1 ||
    groupSize < 1 ||
    rank > groupSize
  ) return "safe";
  if (rank <= PROMOTION_TOP) return tier === "LEGENDS" ? "reward" : "promotion";
  if (tier !== "BRONZE" && groupSize > 10 && rank >= DEMOTION_START_RANK) return "demotion";
  return "safe";
}

/** Applies the zone outcome for a final rank; inactive members cannot be promoted. */
export function tierAfterWeeklyRank(
  tier: NewLeagueTier,
  rank: number,
  groupSize: number,
  weeklyXP = 1,
): NewLeagueTier {
  const index = NEW_TIER_ORDER.indexOf(tier);
  const previous = index > 0 ? NEW_TIER_ORDER[index - 1] : null;
  const next = nextLeagueTier(tier);
  const zone = getLeagueZone(tier, rank, groupSize);

  if (zone === "promotion" && next && weeklyXP > 0) return next;
  if (zone === "demotion" && previous) return previous;
  return tier;
}

/** Normalizes a tier value; returns null when it is not part of the current system. */
export function resolveNewTier(tier?: string | null): NewLeagueTier | null {
  if (!tier) return null;
  const upper = tier.toUpperCase();
  if (LEGACY_TIER_ALIASES[upper]) return LEGACY_TIER_ALIASES[upper];
  return (NEW_TIER_ORDER as readonly string[]).includes(upper)
    ? upper as NewLeagueTier
    : null;
}
