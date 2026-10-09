import { addDaysIso } from "@/lib/db/dates";

/**
 * Melhor sequência DENTRO de um mês.
 *
 * Regras (espelham `calculateStreak`, mas recortando a janela no mês):
 * - Apenas dias vivos contam (sessão qualificada ou dia protegido por escudo).
 * - Runs que cruzam a fronteira do mês são RECORTADOS: só os dias dentro de
 *   [monthStart, monthEnd) entram na contagem — por isso agosto e setembro
 *   nunca mais mostram a mesma sequência por causa de um run continuo.
 * - "Hoje" ainda em aberto não quebra a sequência de ontem (mês corrente).
 * - `isAliveAtEnd` diz se a sequência chegou ao fim observável do mês
 *   (último dia do mês em meses fechados; hoje ou ontem no mês corrente).
 */
export interface MonthStreakResult {
  best: number;
  startDate?: string;
  endDate?: string;
  isAliveAtEnd: boolean;
}

export function longestRunInMonth(
  aliveDays: ReadonlySet<string>,
  monthStart: string,
  monthEnd: string,
  today: string,
): MonthStreakResult {
  let best = 0;
  let bestStart: string | undefined;
  let bestEnd: string | undefined;
  let run = 0;
  let runStart: string | undefined;
  let lastAliveDay: string | undefined;

  for (let day = monthStart; day < monthEnd; day = addDaysIso(day, 1)) {
    if (aliveDays.has(day)) {
      if (run === 0) runStart = day;
      run += 1;
      lastAliveDay = day;
      if (run > best) {
        best = run;
        bestStart = runStart;
        bestEnd = day;
      }
    } else {
      run = 0;
      runStart = undefined;
    }
  }

  let isAliveAtEnd = false;
  if (lastAliveDay) {
    if (today < monthStart) {
      // Mês no futuro não deveria acontecer (validado a montante).
      isAliveAtEnd = false;
    } else if (today < monthEnd) {
      // Mês corrente: chegou a hoje, ou ontem (hoje ainda em aberto).
      isAliveAtEnd =
        lastAliveDay === today || lastAliveDay === addDaysIso(today, -1);
    } else {
      // Mês fechado: o run alcançou o último dia do mês.
      isAliveAtEnd = lastAliveDay === addDaysIso(monthEnd, -1);
    }
  }

  return { best, startDate: bestStart, endDate: bestEnd, isAliveAtEnd };
}
