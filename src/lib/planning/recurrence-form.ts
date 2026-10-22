import { addDays, formatLocalDate, weekdayOfIso } from "./dates";

export type RecurrenceFormErrors = Partial<Record<"planDate" | "repeatDays" | "repeatUntil", string>>;

/** Pick an explicit planner date, otherwise the selected day, otherwise today. */
export function recurrenceInitialDate(explicitDate: string | null | undefined, selectedDate: string | null | undefined, today: string): string {
  return explicitDate || selectedDate || today;
}

/** A fresh weekly rule starts on its anchor weekday. */
export function syncInitialWeekday(date: string): number[] {
  return [weekdayOfIso(date)];
}

/** Find the first selected weekday on or after the anchor date. */
export function firstWeeklyOccurrence(startDate: string, days: number[]): string | null {
  if (days.length === 0) return null;
  for (let offset = 0; offset < 7; offset += 1) {
    const candidate = addDays(startDate, offset);
    if (days.includes(weekdayOfIso(candidate))) return candidate;
  }
  return null;
}

export function validateWeeklyRecurrence(input: {
  startDate: string | null;
  days: number[];
  hasEndDate: boolean;
  endDate: string | null;
}): RecurrenceFormErrors {
  const errors: RecurrenceFormErrors = {};
  if (!input.startDate) errors.planDate = "Selecione a data inicial.";
  if (input.days.length === 0) errors.repeatDays = "Selecione pelo menos um dia da semana.";
  if (input.hasEndDate) {
    if (!input.endDate) errors.repeatUntil = "Selecione a data final.";
    else if (input.startDate && input.endDate < input.startDate) {
      errors.repeatUntil = "A data final deve ser igual ou posterior à data inicial.";
    }
  }
  return errors;
}

export function weeklyRecurrenceSummary(startDate: string, days: number[], endDate: string | null, hasEndDate = Boolean(endDate)): string {
  const names = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  const first = firstWeeklyOccurrence(startDate, days);
  const orderedNames = [...days].sort((a, b) => (a + 6) % 7 - (b + 6) % 7).map((day) => names[day]).join(", ");
  const firstLabel = first
    ? formatLocalDate(first, { weekday: "short", day: "numeric", month: "short" }).replace(/\.$/, "")
    : formatLocalDate(startDate, { day: "numeric", month: "short" });
  const endLabel = hasEndDate
    ? endDate ? `até ${formatLocalDate(endDate, { day: "numeric", month: "short", year: "numeric" })}` : "até escolher a data final"
    : "sem data final";
  return `Repete toda ${orderedNames || "…"}, a partir de ${firstLabel}, ${endLabel}.`;
}
