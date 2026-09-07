// ── Níveis de XP ────────────────────────────────────────────────────────────
// O nível é derivado puramente do total de XP acumulado ("Olympian"). Sempre
// calcule a partir de totalXP em vez de confiar em uma coluna persistida, pois a
// coluna legada `user_xp.level` carregava sempre 1.

export interface XPLevel {
  level: number;
  /** Nome exibido do nível (ex.: "MAX" para o último). */
  label: string;
  /** Próximo limite de XP para avançar de nível, ou null no nível máximo. */
  nextThreshold: number | null;
  /** XP necessário no nível atual para alcançar o próximo (0 no máximo). */
  thresholdStart: number;
}

/** Limites de XP para cada nível, em ordem crescente. */
export const XP_LEVELS: { threshold: number; label: string }[] = [
  // Nível 1 começa em 0 XP.
  { threshold: 1000, label: "2" },
  { threshold: 10000, label: "3" },
  { threshold: 50000, label: "MAX" },
];

/**
 * Retorna o nível (1-4) de um usuário com base em seu total de XP:
 *  - XP < 1000                  -> Nível 1
 *  - 1000 <= XP < 10000         -> Nível 2
 *  - 10000 <= XP < 50000        -> Nível 3
 *  - XP >= 50000                -> Nível 4 (MAX)
 */
export function levelFromXP(totalXP: number): XPLevel {
  const xp = Number.isFinite(totalXP) ? Math.max(0, Math.floor(totalXP)) : 0;

  const reached = XP_LEVELS.filter((l) => xp >= l.threshold);

  // Nível é o índice do limite atingido + 1 (nível 1 quando nenhum limite é atingido).
  const currentLevel = reached.length + 1;
  const isMax = currentLevel > XP_LEVELS.length;

  if (isMax) {
    return {
      level: XP_LEVELS.length + 1,
      label: "MAX",
      nextThreshold: null,
      thresholdStart: XP_LEVELS[XP_LEVELS.length - 1].threshold,
    };
  }

  const next = XP_LEVELS[currentLevel - 1];
  const thresholdStart = currentLevel === 1 ? 0 : XP_LEVELS[currentLevel - 2].threshold;

  return {
    level: currentLevel,
    label: String(currentLevel),
    nextThreshold: next.threshold,
    thresholdStart,
  };
}
