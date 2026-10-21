import type { NewLeagueTier, XpSourceBreakdown } from "@/types";
import { NEW_TIER_META, resolveNewTier } from "@/lib/league-new-meta";

/**
 * Tokens e helpers compartilhados entre o modal de recap (slides 9:16) e a
 * tela final de conquistas. Uma única fonte de verdade para paleta, artes 3D
 * e textos contextuais — evita que as duas superfícies fiquem dessincronizadas.
 */

/** Paleta do redesign (tokens do app + acentos do art direction). */
export const RECAP_PALETTE = {
  midnight: "#050B16",
  elevated: "#0B1627",
  cyan: "#5CC8FF",
  violet: "#A98BFF",
  amber: "#FFB067",
  green: "#3DDC84",
  text: "#E7F4FF",
} as const;

/** Cores de destaque por métrica. */
export const ACCENT = {
  focus: RECAP_PALETTE.cyan,
  streak: RECAP_PALETTE.amber,
  garden: RECAP_PALETTE.green,
  xp: RECAP_PALETTE.violet,
} as const;

/**
 * Artes 3D dos slides. Cada slot aceita VÁRIOS caminhos: o primeiro que
 * carregar é usado e, se nenhum existir, o ícone line original entra como
 * fallback (sem quebrar nada).
 *
 * - /recaps/*.png           → artes 3D já disponíveis no repositório
 * - /recap/icons/recap-*.png → nomes previstos para os novos assets
 */
export const RECAP_ART = {
  foco: ["/recaps/clock.png", "/recap/icons/recap-foco.png"],
  sequencia: ["/recaps/streak.png", "/recap/icons/recap-sequencia.png"],
  jardim: ["/recaps/energy.png", "/recap/icons/recap-jardim.png"],
  xp: ["/recaps/xp.png", "/recap/icons/recap-xp.png", "/xp/xp_double_thunder.png"],
  /** Cristal de XP usado como peça central do herói da tela final. */
  heroi: ["/recaps/xp.png", "/xp/xp_double_thunder.png"],
  /** Raio de XP usado no painel de progressão. */
  xpProgressao: ["/xp/xp_double_thunder.png", "/recaps/xp.png"],
} as const;

/** Dados consumidos pelo recap (mensal). */
export interface RecapData {
  id: number;
  recapMonth: string;
  totalFocusMinutes: number;
  longestStreak: number;
  leagueTier?: string;
  leaguePromoted?: boolean;
  productivityTag?: string;
  gardenCount?: number;
  totalXp: number;
  coinsGained?: number;
  coinsSpent?: number;
  missionsCompleted?: number;
  goalsCompleted?: number;
  achievementsUnlocked?: number;
  topFocusCategory?: string;
  hasBeenShared?: boolean;
  status?: "live" | "final";
  /* Campos extras (opcionais) usados pela tela final de conquistas. */
  profileId?: string;
  streakStartDate?: string;
  streakEndDate?: string;
  streakIsAlive?: boolean;
  leagueAtStart?: string;
  xpSources?: XpSourceBreakdown;
  generatedAt?: string;
  finalizedAt?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function plural(n: number, singular: string, pluralForm: string): string {
  return n === 1 ? singular : pluralForm;
}

export function formatMinutes(total: number): string {
  if (total < 60) return `${total}min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

export function formatMonth(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

/** Sobe apenas a primeira letra (títulos em pt-BR — "outubro de 2026" → "Outubro de 2026"). */
export function capitalizeFirst(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

/**
 * O contador de energias do recap (`garden_count`) soma as energias plantadas
 * no ANO CALENDÁRIO do mês (é o recorte do banco), não apenas naquele mês.
 * O rótulo deixa isso explícito para não confundir acumulado com mensal.
 */
export function gardenScopeLabel(iso: string): string {
  const year = /^\d{4}/.test(iso) ? iso.slice(0, 4) : "";
  return year ? `acumuladas em ${year}` : "acumuladas no ano";
}

/** "12 out" — data curta em pt-BR, ou null quando a data não existe. */
export function formatShortDate(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function tierMeta(tier?: string) {
  const resolved = resolveNewTier(tier);
  if (resolved) return { tier: resolved, meta: NEW_TIER_META[resolved] };
  return { tier: null as NewLeagueTier | null, meta: null };
}

// Contextual copy lines — the "rarity framing" that makes stats feel earned
export function focusCopy(minutes: number): string {
  if (minutes === 0) return "Cada minuto de foco conta. O próximo mês é seu.";
  if (minutes < 120) return "Você plantou as primeiras sementes. Continue.";
  if (minutes < 300) return "Mais de 2 horas de foco puro. Isso é consistência.";
  if (minutes < 600) return "Você está entre os mais dedicados da plataforma.";
  if (minutes < 1200) return "Nível de foco que menos de 20% dos usuários atingem.";
  return "Foco de elite. Você está no topo da plataforma.";
}

export function streakCopy(days: number): string {
  if (days === 0) return "Amanhã é um novo começo. Construa sua sequência.";
  if (days === 1) return "1 dia é o começo de tudo. Não pare agora.";
  if (days < 7) return `${days} ${plural(days, "dia", "dias")} seguidos. A sequência está ganhando força.`;
  if (days < 14) return "Uma semana inteira de consistência. Isso é raro.";
  if (days < 30) return "Menos de 15% dos usuários chegam aqui. Você chegou.";
  return "Sequência lendária. Você faz parte de um grupo seleto.";
}

export function leagueCopy(tier: NewLeagueTier | null, promoted: boolean): string {
  if (promoted) return "Você subiu de liga este mês. Trabalho duro recompensado.";
  if (!tier) return "Participe da liga e compete com os melhores.";
  const copies: Record<NewLeagueTier, string> = {
    BRONZE:   "Você está construindo sua base. A ascensão começa aqui.",
    PRATA:    "Consistência acima da média. A Prata é só o começo.",
    OURO:     "Liga Ouro — você está entre os 30% mais focados.",
    DIAMANTE: "Elite do foco. Menos de 10% chegam ao Diamante.",
    LENDAS:   "Liga Lendas. Você está entre os melhores da plataforma.",
  };
  return copies[tier];
}

export function gardenCopy(count: number): string {
  if (count === 0) return "Seu jardim aguarda. Cada sessão planta uma energia.";
  if (count === 1) return "1 energia plantada. Seu jardim está nascendo.";
  if (count < 5) return `${count} energias cultivadas. O jardim está crescendo.`;
  if (count < 15) return `${count} energias. Um jardim vibrante tomando forma.`;
  return `${count} energias. Jardim exuberante — dedicação visível.`;
}

export function xpCopy(xp: number): string {
  if (xp === 0) return "Cada sessão de foco gera XP. Sua jornada começa aqui.";
  if (xp < 1000) return `${xp.toLocaleString("pt-BR")} XP ganhos no mês. Todo ponto conta na sua evolução.`;
  if (xp < 5000) return "Mais de 1.000 XP só neste mês! Você já está evoluindo de verdade.";
  if (xp < 20000) return "Milhares de XP em um mês. Sua consistência está virando poder.";
  return "XP de elite em um único mês. Sua jornada impressiona até os veteranos.";
}

/**
 * Fontes de XP do mês — o breakdown vem do banco (`xp_sources`), então os
 * percentuais exibidos são sempre reais. Só entram segmentos com valor > 0.
 */
export const XP_SOURCE_META: ReadonlyArray<{ key: string; label: string; color: string }> = [
  { key: "focus", label: "Foco", color: RECAP_PALETTE.cyan },
  { key: "dailyTask", label: "Tarefas", color: RECAP_PALETTE.amber },
  { key: "checkin", label: "Check-in", color: RECAP_PALETTE.green },
  { key: "achievement", label: "Conquistas", color: RECAP_PALETTE.violet },
];

/** Segmentos de XP já filtrados (somente valores > 0). */
export function xpSegments(recap: RecapData) {
  const sources = recap.xpSources;
  if (!sources) return [];
  return XP_SOURCE_META.map((meta) => {
    const raw = (sources as Record<string, number | undefined>)[meta.key];
    const value = typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? raw : 0;
    return { ...meta, value };
  }).filter((segment) => segment.value > 0);
}
