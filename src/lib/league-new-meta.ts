import type { NewLeagueTier } from "@/types";

/** Ordem canônica do sistema de ligas atual (BRONZE → LENDAS). */
export const NEW_TIER_ORDER: NewLeagueTier[] = ["BRONZE", "PRATA", "OURO", "DIAMANTE", "LENDAS"];

export interface NewTierMeta {
  label: string;
  shortLabel: string;
  color: string;
  glow: string;
  description: string;
  iconPath: string;
}

/** Config visual dos tiers atuais (fonte única usada pela página Liga e pelo recap). */
export const NEW_TIER_META: Record<NewLeagueTier, NewTierMeta> = {
  BRONZE:   { label: "Bronze",   shortLabel: "BR", color: "#cd7f32", glow: "rgba(205,127,50,0.4)",   description: "O início da jornada",           iconPath: "/leaderboard/bronze.png"   },
  PRATA:    { label: "Prata",    shortLabel: "PR", color: "#c0c0c0", glow: "rgba(192,192,192,0.4)", description: "Consistência crescendo",         iconPath: "/leaderboard/prata.png"    },
  OURO:     { label: "Ouro",     shortLabel: "OU", color: "#ffd700", glow: "rgba(255,215,0,0.4)",   description: "Domínio do foco",               iconPath: "/leaderboard/ouro.png"     },
  DIAMANTE: { label: "Diamante", shortLabel: "DI", color: "#00bfff", glow: "rgba(0,191,255,0.4)",   description: "Elite do foco",                 iconPath: "/leaderboard/diamante.png" },
  LENDAS:   { label: "Lendas",   shortLabel: "LE", color: "#ff69b4", glow: "rgba(255,105,180,0.4)", description: "Os melhores entre os melhores", iconPath: "/leaderboard/lendas.png"   },
};

const NEW_TIERS: NewLeagueTier[] = [...NEW_TIER_ORDER];

/** Normaliza qualquer valor de tier (novo ou legado) para o tipo atual; retorna null se inválido. */
export function resolveNewTier(tier?: string | null): NewLeagueTier | null {
  if (!tier) return null;
  const upper = tier.toUpperCase();
  if ((NEW_TIERS as string[]).includes(upper)) return upper as NewLeagueTier;
  return null;
}
