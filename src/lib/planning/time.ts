/**
 * Shared time helpers for the planner timeline views (Semana/Dia).
 * Pure functions only — no React — so Week/Day views and blocks share one source.
 */

/** Altura de uma hora na timeline (px). */
export const HOUR_HEIGHT = 56;

export const MINUTES_PER_HOUR = 60;

/** Converte "HH:MM" (ou "HH:MM:SS") em minutos desde meia-noite. Retorna null se inválido. */
export function toMinutes(time: string | null | undefined): number | null {
  if (!time) return null;
  const parts = time.split(":").map((p) => Number.parseInt(p, 10));
  const h = parts[0];
  const m = parts[1] ?? 0;
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (h < 0 || h > 24 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

/** Converte minutos desde meia-noite em "HH:MM". */
export function toTimeLabel(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.floor(minutes % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Normaliza a digitação de um horário em 24 horas (padrão pt-BR).
 *
 * Aceita só dígitos, insere ":" após as duas primeiras casas e limita o
 * campo a 4 dígitos ("HH:MM"). Assim o usuário pode digitar "0900" e o
 * campo mostra "09:00" — nunca AM/PM. Um ":" digitado é preservado.
 */
export function formatTimeInput(value: string): string {
  const raw = value.trim();
  const colon = raw.indexOf(":");
  if (colon >= 0) {
    const hours = raw.slice(0, colon).replace(/\D/g, "").slice(0, 2);
    const minutes = raw.slice(colon + 1).replace(/\D/g, "").slice(0, 2);
    if (!minutes) return hours;
    return `${hours.padStart(2, "0")}:${minutes}`;
  }
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

/** "HH:MM" válido (00:00 – 23:59). */
export function isValidTime24(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

/** Soma N minutos a um "HH:MM" e devolve "HH:MM". */
export function addMinutesToTime(time: string, minutes: number): string {
  const base = toMinutes(time) ?? 0;
  const total = ((base + minutes) % (24 * 60) + 24 * 60) % (24 * 60);
  return toTimeLabel(total);
}

/** Duração em minutos de um plano (endTime tem prioridade sobre start+duration). */
export function planDurationMinutes(plan: {
  startTime?: string | null;
  endTime?: string | null;
  durationMinutes?: number | null;
}): number | null {
  const end = toMinutes(plan.endTime ?? null);
  const start = toMinutes(plan.startTime ?? null);
  if (end != null && start != null) {
    const diff = end - start;
    if (diff > 0) return diff;
  }
  if (plan.durationMinutes && plan.durationMinutes > 0 && start != null) {
    return plan.durationMinutes;
  }
  return null;
}

/** Início em minutos desde meia-noite (null para eventos allday/sem horário). */
export function planStartMinutes(plan: {
  startTime?: string | null;
}): number | null {
  return toMinutes(plan.startTime ?? null);
}

export interface TimedEventInput {
  id: string;
  start: number;
  end: number;
}

export interface TimedLayout {
  id: string;
  top: number;
  height: number;
  /** Posição horizontal dentro do cluster (fração de 0..1). */
  leftPct: number;
  widthPct: number;
  /** Quantas "lanes" (colunas) o cluster ocupa. */
  lanes: number;
}

/**
 * Distribui eventos sobrepostos lado a lado (algoritmo guloso por lanes).
 * Recebe eventos já convertidos (id, start, end em minutos) e devolve o layout.
 */
export function layoutTimedEvents(events: TimedEventInput[]): Map<string, { top: number; height: number; leftPct: number; widthPct: number; lanes: number }> {
  const sorted = [...events].sort((a, b) => a.start - b.start || b.end - a.end);
  const laneEnd: number[] = [];
  const out = new Map<
    string,
    { top: number; height: number; leftPct: number; widthPct: number; lanes: number }
  >();

  for (const e of sorted) {
    let lane = laneEnd.findIndex((end) => end <= e.start);
    if (lane === -1) {
      lane = laneEnd.length;
      laneEnd.push(e.end);
    } else {
      laneEnd[lane] = e.end;
    }
    const lanes = lane + 1;
    const top = (e.start / 60) * HOUR_HEIGHT;
    const height = Math.max(18, ((e.end - e.start) / 60) * HOUR_HEIGHT - 2);
    out.set(e.id, {
      top,
      height,
      leftPct: lane / lanes,
      widthPct: 1 / lanes,
      lanes,
    });
  }
  return out;
}

/** Próximo evento do dia: primeiro plano não concluído com horário, ordenado por início. */
export function nextPlannedEvent<T extends { planDate: string; startTime?: string | null; completedAt?: unknown }>(
  plans: T[],
): T | null {
  const upcoming = plans
    .filter((p) => !p.completedAt)
    .filter((p) => {
      const s = toMinutes(p.startTime ?? null);
      return s != null;
    })
    .sort((a, b) => (toMinutes(a.startTime ?? null) ?? 0) - (toMinutes(b.startTime ?? null) ?? 0));
  return upcoming[0] ?? null;
}
