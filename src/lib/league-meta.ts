import type { LeagueTier } from "@/types";

export const LEAGUE_TIERS: LeagueTier[] = ["faisca", "chama", "aura", "nucleo"];

export interface TierMeta {
  label: string;
  color: string;
  glow: string;
  next?: LeagueTier;
  prev?: LeagueTier;
}

export const TIER_META: Record<LeagueTier, TierMeta> = {
  faisca: { label: "Faísca", color: "#c47a4a", glow: "rgba(196,122,74,.45)", next: "chama" },
  chama: { label: "Chama", color: "#ffb86b", glow: "rgba(255,184,107,.45)", next: "aura", prev: "faisca" },
  aura: { label: "Aura", color: "#ffd76b", glow: "rgba(255,215,107,.5)", next: "nucleo", prev: "chama" },
  nucleo: { label: "Núcleo", color: "#71d4ff", glow: "rgba(113,212,255,.55)", prev: "aura" },
};