/* ------------------------------------------------------------------ */
/*  EnergyOS — Seasonal events engine (single source of truth)        */
/*                                                                     */
/*  Isomorphic module: imported by client components AND server       */
/*  routes/db modules. Pure date logic — no React, no Node APIs.      */
/* ------------------------------------------------------------------ */

export type SeasonId = "halloween" | "christmas" | "newyear" | "easter";
export type SeasonThemeKey = SeasonId;

export interface SeasonDef {
  id: SeasonId;
  /** pt-BR display name */
  name: string;
  startMonth: number; // 1-12
  startDay: number;
  endMonth: number;
  endDay: number;
  theme: SeasonThemeKey;
  /** CSS accent used by countdown/badges */
  accent: string;
  /** Greeting prefix for the dashboard, e.g. "Feliz Natal" */
  greeting: string;
}

export const SEASONS: readonly SeasonDef[] = [
  {
    id: "halloween",
    name: "Halloween",
    startMonth: 10,
    startDay: 1,
    endMonth: 10,
    endDay: 31,
    theme: "halloween",
    accent: "#ff8a3d",
    greeting: "Boo! Bom dia",
  },
  {
    id: "christmas",
    name: "Natal",
    startMonth: 11,
    startDay: 1,
    endMonth: 12,
    endDay: 31,
    theme: "christmas",
    accent: "#ff5a5a",
    greeting: "Feliz Natal",
  },
  {
    id: "newyear",
    name: "Ano Novo",
    startMonth: 1,
    startDay: 1,
    endMonth: 1,
    endDay: 31,
    theme: "newyear",
    accent: "#ffd76b",
    greeting: "Feliz Ano Novo",
  },
  {
    id: "easter",
    name: "Páscoa",
    startMonth: 3,
    startDay: 1,
    endMonth: 4,
    endDay: 30,
    theme: "easter",
    accent: "#f0a6c8",
    greeting: "Feliz Páscoa",
  },
] as const;

/* ------------------------------------------------------------------ */
/*  Date helpers — all season windows are evaluated in                */
/*  America/Sao_Paulo. Brazil has no DST: SP is permanently UTC-3.    */
/* ------------------------------------------------------------------ */

const SP_OFFSET_MS = -3 * 60 * 60 * 1000;

const spDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** "YYYY-MM-DD" of `date` in America/Sao_Paulo. */
export function spDateKey(date: Date = new Date()): string {
  return spDateFormatter.format(date);
}

/** UTC instant of 00:00:00.000 in America/Sao_Paulo for a calendar date. */
function spMidnightUtc(year: number, month: number, day: number): number {
  return Date.UTC(year, month - 1, day) - SP_OFFSET_MS;
}

export interface SeasonWindow {
  start: Date;
  /** Inclusive end: 23:59:59.999 SP of endMonth/endDay. */
  end: Date;
}

/** The season's window inside a given calendar year (SP dates). */
export function seasonWindowForYear(season: SeasonDef, year: number): SeasonWindow {
  const start = new Date(spMidnightUtc(year, season.startMonth, season.startDay));
  const end = new Date(spMidnightUtc(year, season.endMonth, season.endDay) + 24 * 60 * 60 * 1000 - 1);
  return { start, end };
}

function parseSeasonOverride(raw: string | null | undefined): SeasonId | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  return (SEASONS.some((s) => s.id === key) ? key : null) as SeasonId | null;
}

/**
 * Dev-only override. Client: `?season=<id>` query param or
 * NEXT_PUBLIC_FORCE_SEASON. Server: SEASON_OVERRIDE or
 * NEXT_PUBLIC_FORCE_SEASON. In production builds the override is ignored so
 * purchases can never be forced outside a real season window.
 */
export function getSeasonOverride(
  env: Record<string, string | undefined> = {},
  search?: string,
): SeasonId | null {
  if (env.NODE_ENV === "production") return null;
  const fromQuery = search
    ? new URLSearchParams(search).get("season")
    : typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("season")
      : null;
  return (
    parseSeasonOverride(fromQuery) ??
    parseSeasonOverride(env.SEASON_OVERRIDE) ??
    parseSeasonOverride(env.NEXT_PUBLIC_FORCE_SEASON)
  );
}

/** Season active at `now`, evaluated in America/Sao_Paulo. */
export function getActiveSeason(now: Date = new Date(), override?: SeasonId | null): SeasonDef | null {
  if (override) return SEASONS.find((s) => s.id === override) ?? null;
  const [year] = spDateKey(now).split("-").map(Number);
  for (const season of SEASONS) {
    const { start, end } = seasonWindowForYear(season, year);
    if (now.getTime() >= start.getTime() && now.getTime() <= end.getTime()) return season;
  }
  return null;
}

/**
 * End instant of the season's window relevant to `now`: the window that
 * contains `now` when active, otherwise the next upcoming window.
 */
export function getSeasonEndDate(season: SeasonDef, now: Date = new Date()): Date {
  const [year] = spDateKey(now).split("-").map(Number);
  const current = seasonWindowForYear(season, year);
  if (now.getTime() <= current.end.getTime()) return current.end;
  return seasonWindowForYear(season, year + 1).end;
}

/** Start instant of the season's next window (for "Volta em …" labels). */
export function getNextSeasonStart(season: SeasonDef, now: Date = new Date()): Date {
  const [year] = spDateKey(now).split("-").map(Number);
  const current = seasonWindowForYear(season, year);
  return now.getTime() < current.start.getTime() ? current.start : seasonWindowForYear(season, year + 1).start;
}

/** Milliseconds until the active season ends (0 when inactive/ended). */
export function getTimeRemaining(season: SeasonDef | null, now: Date = new Date()): number {
  if (!season) return 0;
  const { end } = seasonWindowForYear(season, Number(spDateKey(now).split("-")[0]));
  const activeEnd = now.getTime() <= end.getTime() ? end : getSeasonEndDate(season, now);
  return Math.max(0, activeEnd.getTime() - now.getTime());
}

/** Whether seasonal items of `season` may be purchased at `now` (server clock). */
export function isSeasonPurchasable(season: SeasonDef | null, now: Date = new Date()): boolean {
  if (!season) return false;
  const t = now.getTime();
  const [year] = spDateKey(now).split("-").map(Number);
  const { start, end } = seasonWindowForYear(season, year);
  return t >= start.getTime() && t <= end.getTime();
}

/**
 * Server-side purchase gate for seasonal items. `seasonId` null/undefined
 * means the item is not seasonal and is always purchasable. A dev override
 * (outside production) bypasses the real window for the overridden season.
 */
export function isSeasonPurchasableNow(
  seasonId: string | null | undefined,
  now: Date = new Date(),
  env: Record<string, string | undefined> = {},
): boolean {
  if (!seasonId) return true;
  const season = SEASONS.find((s) => s.id === seasonId);
  if (!season) return false;
  const override = getSeasonOverride(env);
  if (override) return override === seasonId;
  return isSeasonPurchasable(season, now);
}

/* ------------------------------------------------------------------ */
/*  Seasonal item catalog (shared by store UI and purchase validation) */
/* ------------------------------------------------------------------ */

export interface SeasonalAuraDef {
  id: string;
  seasonId: SeasonId;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
}

export interface SeasonalFrameDef {
  id: string;
  seasonId: SeasonId;
  name: string;
  description: string;
  price: number;
  rarity: "epic" | "legendary";
  imageUrl: string;
}

const aura = (seasonId: SeasonId, id: string, name: string, description: string, price: number): SeasonalAuraDef => ({
  id,
  seasonId,
  name,
  description,
  price,
  imageUrl: `/assets/seasons/${seasonId}/auras/${id}.png`,
});

const frame = (
  seasonId: SeasonId,
  id: string,
  name: string,
  description: string,
  price: number,
  rarity: "epic" | "legendary" = "legendary",
): SeasonalFrameDef => ({
  id,
  seasonId,
  name,
  description,
  price,
  rarity,
  imageUrl: `/assets/seasons/${seasonId}/frames/${id}.png`,
});

export const SEASONAL_AURAS: readonly SeasonalAuraDef[] = [
  // Halloween
  aura("halloween", "jack_o_lantern", "Abóbora", "Uma abóbora de Halloween com luz quente por dentro", 2000),
  aura("halloween", "ghost", "Fantasma", "Um fantasma amistoso que flutua ao seu redor", 2200),
  aura("halloween", "witch_hat", "Chapéu de Bruxa", "Chapéu de bruxa com brilho roxo misterioso", 2500),
  // Christmas
  aura("christmas", "santa_hat", "Gorro de Natal", "O clássico gorro do Papai Noel na sua energia", 2000),
  aura("christmas", "xmas_wreath", "Coroa de Natal", "Guirlanda verde com laços e enfeites dourados", 2200),
  aura("christmas", "xmas_tree", "Árvore de Natal", "Árvore de Natal com pisca-pisca e enfeites", 2500),
  // New Year
  aura("newyear", "fireworks", "Fogos de Artifício", "Explosões douradas de fogos de ano novo", 2000),
  aura("newyear", "champagne", "Champanhe", "Tampa de champanhe estourando em comemoração", 2200),
  aura("newyear", "midnight_clock", "Relógio da Meia-Noite", "Relógio marcando a virada do ano", 2500),
  // Easter
  aura("easter", "easter_egg", "Ovo de Páscoa", "Ovo decorado com cores de páscoa", 2000),
  aura("easter", "bunny", "Coelhinho", "Um coelhinho fofo de orelhas longas", 2200),
  aura("easter", "easter_basket", "Cesta de Páscoa", "Cesta com ovos e flores de primavera", 2500),
] as const;

export const SEASONAL_FRAMES: readonly SeasonalFrameDef[] = [
  // Halloween
  frame("halloween", "frame_halloween_cobweb", "Teia de Aranha", "Teias de aranha nos cantos do anel", 3000),
  frame("halloween", "frame_halloween_moon", "Lua Assombrada", "Lua cheia com brilho espectral", 3200),
  frame("halloween", "frame_halloween_bones", "Ossos", "Anel feito de ossinhos cruzados", 3300),
  frame("halloween", "frame_halloween_flame", "Chama Roxa", "Chamas roxas animadas ao redor do avatar", 3500),
  // Christmas
  frame("christmas", "frame_xmas_candy_cane", "Bengala Doce", "Anel de bengalas doces vermelho e branco", 3000),
  frame("christmas", "frame_xmas_snowflake", "Flocos de Neve", "Flocos de neve crystalline no anel", 3200),
  frame("christmas", "frame_xmas_holly", "Azevinho", "Folhas de azevinho com bagas vermelhas", 3300),
  frame("christmas", "frame_xmas_lights", "Pisca-Pisca", "Luzes douradas de Natal piscando no anel", 3500),
  // New Year
  frame("newyear", "frame_newyear_confetti", "Confete Dourado", "Confetes dourados caindo no anel", 3000),
  frame("newyear", "frame_newyear_neon", "Neon Ano Novo", "Anel neon estilo festa de ano novo", 3200),
  frame("newyear", "frame_newyear_sparkler", "Estrelinha", "Vela de estrelinha brilhando", 3300),
  frame("newyear", "frame_newyear_countdown", "Contagem Regressiva", "Números regressivos marcando a virada", 3500),
  // Easter
  frame("easter", "frame_easter_flowers", "Coroa de Flores", "Coroa de flores primaveris", 3000),
  frame("easter", "frame_easter_eggs", "Ovos Pastel", "Ovos de páscoa em tons pastel", 3200),
  frame("easter", "frame_easter_ears", "Orelhas de Coelho", "Orelhas de coelho sobre o avatar", 3300),
  frame("easter", "frame_easter_butterflies", "Borboletas", "Borboletas e vinhas primaveris animadas", 3500),
] as const;

const SEASONAL_AURA_BY_ID = new Map(SEASONAL_AURAS.map((a) => [a.id, a]));
const SEASONAL_FRAME_BY_ID = new Map(SEASONAL_FRAMES.map((f) => [f.id, f]));

export function getSeasonalAura(id: string): SeasonalAuraDef | undefined {
  return SEASONAL_AURA_BY_ID.get(id);
}

export function getSeasonalFrame(id: string): SeasonalFrameDef | undefined {
  return SEASONAL_FRAME_BY_ID.get(id);
}

export function getSeasonalItems(seasonId: SeasonId): { auras: SeasonalAuraDef[]; frames: SeasonalFrameDef[] } {
  return {
    auras: SEASONAL_AURAS.filter((a) => a.seasonId === seasonId),
    frames: SEASONAL_FRAMES.filter((f) => f.seasonId === seasonId),
  };
}

/** All seasonal aura ids — used to extend the energy/aura type system. */
export const SEASONAL_AURA_IDS = SEASONAL_AURAS.map((a) => a.id) as string[];

export function isSeasonalAuraId(id: string): boolean {
  return SEASONAL_AURA_BY_ID.has(id);
}

/* ------------------------------------------------------------------ */
/*  Seasonal item visibility                                           */
/* ------------------------------------------------------------------ */

/**
 * When true, seasonal items the user already owns stay visible/equippable
 * forever, even outside their season window. Flip to false to hide owned
 * seasonal items too when the season is over.
 */
export const KEEP_OWNED_SEASONAL_VISIBLE = true;

/**
 * Whether a seasonal item may be shown to the user right now:
 * - its season is ACTIVE → visible to everyone (purchasable);
 * - otherwise → visible only to owners (when KEEP_OWNED_SEASONAL_VISIBLE).
 * Out-of-season unowned items must be hidden completely — never rendered as
 * locked, greyed out, or with a "volta em" hint.
 */
export function isSeasonalItemVisible(
  seasonId: SeasonId | null | undefined,
  owned: boolean,
  now: Date = new Date(),
  override?: SeasonId | null,
): boolean {
  if (!seasonId) return true; // not seasonal
  const active = getActiveSeason(now, override ?? undefined);
  if (active?.id === seasonId) return true;
  return KEEP_OWNED_SEASONAL_VISIBLE && owned;
}

/** Milliseconds until the next season boundary (window start or end). */
export function nextSeasonBoundaryMs(now: Date = new Date()): number {
  const year = Number(spDateKey(now).split("-")[0]);
  let next = Number.POSITIVE_INFINITY;
  for (const s of SEASONS) {
    for (const y of [year, year + 1]) {
      const w = seasonWindowForYear(s, y);
      if (w.end.getTime() >= now.getTime()) {
        next = Math.min(next, w.end.getTime() + 1 - now.getTime());
      }
      if (w.start.getTime() > now.getTime()) {
        next = Math.min(next, w.start.getTime() - now.getTime());
      }
    }
  }
  return Number.isFinite(next) ? next : 24 * 60 * 60 * 1000;
}

/**
 * Dev-only simulated "now" for testing season switches live:
 * `?now=2026-12-31T23:59:50` (ISO date/datetime). Ignored in production.
 * Affects client-side season resolution only — server enforcement and the
 * store countdown keep using the real clock.
 */
export function getDevNow(
  env: Record<string, string | undefined> = {},
  search?: string,
): Date | null {
  if (env.NODE_ENV === "production") return null;
  const raw = search
    ? new URLSearchParams(search).get("now")
    : typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("now")
      : null;
  if (!raw) return null;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? new Date(t) : null;
}
