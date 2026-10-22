import type { WeeklyPlanItem } from "@/types";
import { addDays, formatLocalDate } from "@/lib/planning/dates";

export interface WeekDayStats {
  date: string;
  shortLabel: string;
  total: number;
  completed: number;
  pending: number;
}

export interface WeekStats {
  total: number;
  completed: number;
  pending: number;
  percentage: number;
  plannedMinutes: number;
  busiestDay: WeekDayStats | null;
  freeDaysLeft: WeekDayStats[];
  days: WeekDayStats[];
}

function planMinutes(plan: WeeklyPlanItem): number {
  const focusRelated = `${plan.category?.name ?? ""} ${plan.title}`.toLocaleLowerCase("pt-BR").includes("foco");
  if (!focusRelated) return 0;
  if (plan.durationMinutes && plan.durationMinutes > 0) return plan.durationMinutes;
  if (!plan.startTime || !plan.endTime) return 0;
  const [startHours, startMinutes] = plan.startTime.split(":").map(Number);
  const [endHours, endMinutes] = plan.endTime.split(":").map(Number);
  const duration = endHours * 60 + endMinutes - (startHours * 60 + startMinutes);
  return duration > 0 ? duration : 0;
}

export function buildWeekStats(plans: WeeklyPlanItem[], weekStart: string, today: string | null): WeekStats {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(weekStart, index);
    const dayPlans = plans.filter((plan) => plan.planDate === date);
    const completed = dayPlans.filter((plan) => Boolean(plan.completedAt)).length;
    return {
      date,
      shortLabel: formatLocalDate(date, { weekday: "short" }).replace(".", ""),
      total: dayPlans.length,
      completed,
      pending: dayPlans.length - completed,
    };
  });
  const total = days.reduce((sum, day) => sum + day.total, 0);
  const completed = days.reduce((sum, day) => sum + day.completed, 0);
  return {
    total,
    completed,
    pending: total - completed,
    percentage: total ? Math.round((completed / total) * 100) : 0,
    plannedMinutes: plans.reduce((sum, plan) => sum + planMinutes(plan), 0),
    busiestDay: days.reduce<WeekDayStats | null>((best, day) => day.total > (best?.total ?? 0) ? day : best, null),
    freeDaysLeft: today ? days.filter((day) => day.date >= today && day.total === 0) : [],
    days,
  };
}

export function weekProgressCopy(percentage: number, total: number): string {
  if (total === 0) return "Sua semana está aberta para novos planos.";
  if (percentage === 100) return "Semana concluída. Que consistência boa.";
  if (percentage >= 50) return "Você já avançou bastante nesta semana.";
  if (percentage > 0) return "Cada passo conta. Seu ritmo está se formando.";
  return "Seus planos estão prontos quando você estiver.";
}

export function localPlanTimestamp(date: string, time: string | null): number {
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = (time ?? "12:00").split(":").map(Number);
  // America/Sao_Paulo is UTC−03:00; use numeric date parts instead of parsing an ISO date string.
  return Date.UTC(year, month - 1, day, hours + 3, minutes, 0, 0);
}

export function countdownLabel(plan: WeeklyPlanItem, now: Date): string {
  if (!plan.startTime) return "Sem horário definido";
  const remaining = localPlanTimestamp(plan.planDate ?? "", plan.startTime) - now.getTime();
  if (Math.abs(remaining) < 60_000) return "agora";
  if (remaining < 0) return "atrasado";
  const minutes = Math.floor(remaining / 60_000);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `começa em ${hours}h ${String(rest).padStart(2, "0")}min` : `começa em ${rest}min`;
}
