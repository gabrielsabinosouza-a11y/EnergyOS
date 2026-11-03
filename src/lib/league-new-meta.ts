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
    iconPath: "/leaderboard/emerald.svg",
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
    iconPath: "/leaderboard/obsidian.svg",
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
  BRONZE: 10,
  SILVER: 10,
  GOLD: 7,
  EMERALD: 7,
  DIAMOND: 5,
  OBSIDIAN: 5,
  LEGENDS: 0,
};

export const LEAGUE_DEMOTION_COUNT = 3;
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

/** Applies the promotion/demotion boundaries for one member's final rank. */
export function tierAfterWeeklyRank(tier: NewLeagueTier, rank: number, groupSize: number): NewLeagueTier {
  const index = NEW_TIER_ORDER.indexOf(tier);
  const previous = index > 0 ? NEW_TIER_ORDER[index - 1] : null;
  const next = nextLeagueTier(tier);

  if (next && rank <= LEAGUE_PROMOTION_CUTOFFS[tier]) return next;
  if (previous && rank > groupSize - LEAGUE_DEMOTION_COUNT) return previous;
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
