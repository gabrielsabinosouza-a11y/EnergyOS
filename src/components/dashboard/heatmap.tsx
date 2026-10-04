"use client";

import { activityLevel, heatmapColumns, isDayActive, type ActivityDay } from "@/lib/activity";

const MONTH_LABELS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const WEEKDAY_LABELS: Record<number, string> = { 0: "seg", 2: "qua", 4: "sex" };

const LEVEL_COLORS: Record<0 | 1 | 2 | 3, string> = {
  0: "var(--bg-surface-hover)",
  1: "rgba(113,212,255,.28)",
  2: "rgba(113,212,255,.60)",
  3: "rgba(113,212,255,.95)",
};

function formatTooltip(day: ActivityDay): string {
  const [, month, dayOfMonth] = day.date.split("-");
  const label = `${Number(dayOfMonth)} de ${MONTH_LABELS[Number(month) - 1]}`;
  if (day.future) return `${label} — ainda vai acontecer`;
  const parts: string[] = [];
  if (day.checkin === "success") parts.push("check-in feito");
  else if (day.checkin === "protected") parts.push("sequência protegida pelo escudo");
  else if (day.checkin === "lost") parts.push("sequência perdida");
  const dailyTaskCompletions = day.dailyTaskCompletions ?? day.goalLogs ?? 0;
  if (dailyTaskCompletions > 0) {
    parts.push(`${dailyTaskCompletions} tarefa${dailyTaskCompletions > 1 ? "s" : ""} diária${dailyTaskCompletions > 1 ? "s" : ""} feita${dailyTaskCompletions > 1 ? "s" : ""}`);
  }
  if (parts.length === 0) parts.push("sem atividade");
  return `${label} — ${parts.join(" · ")}`;
}

interface HeatmapProps {
  year: number;
  days: ActivityDay[];
  /** Usado para destacar o dia de hoje com um anel. */
  today: string;
}

/** Mapa de calor do ano — cada quadrado é um dia; a cor mostra a intensidade. */
export function Heatmap({ year, days, today }: HeatmapProps) {
  const byDate = new Map(days.map((day) => [day.date, day]));
  const columns = heatmapColumns(year);

  // Rótulos de mês: alinhamos na célula exata do dia 1 de cada mês.
  const monthLabels = new Map<number, number>();
  columns.forEach((column, columnIndex) => {
    for (let month = 0; month < 12; month += 1) {
      const firstOfMonth = `${year}-${String(month + 1).padStart(2, "0")}-01`;
      const dayIndex = column.indexOf(firstOfMonth);
      if (dayIndex !== -1) monthLabels.set(month, (columnIndex * 15) + (dayIndex * 15));
    }
  });

  return (
    <div className="overflow-x-auto pb-1">
      <div className="inline-flex min-w-max gap-2">
        {/* Coluna de rótulos de dia da semana */}
        <div className="grid grid-rows-7 gap-[3px] pt-[20px]">
          {Array.from({ length: 7 }, (_, row) => (
            <div key={row} className="flex h-3 items-center text-[10px] leading-none text-[var(--text-muted)]">
              {WEEKDAY_LABELS[row] ?? ""}
            </div>
          ))}
        </div>

        <div>
          {/* Rótulos de mês */}
          <div className="relative mb-1 h-4">
            {Array.from(monthLabels.entries()).map(([month, left]) => (
              <span
                key={month}
                className="absolute top-0 text-[10px] uppercase tracking-wide text-[var(--text-muted)]"
                style={{ left: `${left}px` }}
              >
                {MONTH_LABELS[month]}
              </span>
            ))}
          </div>

          {/* Grade: colunas = semanas (segunda → domingo) */}
          <div className="flex gap-[3px]">
            {columns.map((column) => (
              <div key={column[0]} className="grid grid-rows-7 gap-[3px]">
                {column.map((date) => {
                  const inYear = date.startsWith(`${year}-`);
                  if (!inYear) return <div key={date} className="h-3 w-3" aria-hidden />;
                  const day = byDate.get(date) ?? {
                    date,
                    checkin: null,
                    dailyTaskCompletions: 0,
                    future: date > today,
                  };
                  const level = day.future ? null : activityLevel(day);
                  const isToday = date === today;
                  return (
                    <div
                      key={date}
                      role="gridcell"
                      aria-label={formatTooltip(day)}
                      title={formatTooltip(day)}
                      className="h-3 w-3 rounded-[3px]"
                      style={{
                        backgroundColor: level === null ? "rgba(255,255,255,.03)" : LEVEL_COLORS[level],
                        boxShadow: isToday ? "0 0 0 1.5px var(--accent)" : undefined,
                        cursor: isDayActive(day) ? "pointer" : "default",
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legenda */}
      <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-[var(--text-muted)]">
        <span className="mr-0.5">Menos</span>
        {([0, 1, 2, 3] as const).map((level) => (
          <span key={level} className="h-3 w-3 rounded-[3px]" style={{ backgroundColor: LEVEL_COLORS[level] }} />
        ))}
        <span className="ml-0.5">Mais</span>
      </div>
    </div>
  );
}
