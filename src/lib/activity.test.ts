import test from "node:test";
import assert from "node:assert/strict";
import type { StreakDayStatus } from "@/types";
import {
  activityLevel,
  activityStats,
  activityStreaks,
  buildActivityYear,
  heatmapColumns,
  isDayActive,
  type ActivityDay,
} from "./activity";

function day(date: string, checkin: StreakDayStatus | null = null, goalLogs = 0): ActivityDay {
  return { date, checkin, goalLogs, future: false };
}

test("buildActivityYear gera a grade completa (ano bissexto = 366 dias)", () => {
  const days = buildActivityYear(2024, {
    checkins: { "2024-06-15": "success" },
    goalLogCounts: { "2024-06-16": 2 },
    today: "2024-06-15",
  });

  assert.equal(days.length, 366);
  assert.equal(days[0].date, "2024-01-01");
  assert.equal(days[365].date, "2024-12-31");

  const jun15 = days.find((d) => d.date === "2024-06-15")!;
  assert.equal(jun15.checkin, "success");
  assert.equal(jun15.future, false);

  const jun16 = days.find((d) => d.date === "2024-06-16")!;
  assert.equal(jun16.goalLogs, 2);
  assert.equal(jun16.future, true);

  const jun17 = days.find((d) => d.date === "2024-06-17")!;
  assert.equal(jun17.checkin, null);
  assert.equal(jun17.goalLogs, 0);
});

test("activityLevel soma os sinais do dia (0–3)", () => {
  assert.equal(activityLevel(day("2026-01-10")), 0);
  assert.equal(activityLevel(day("2026-01-10", "success")), 2);
  assert.equal(activityLevel(day("2026-01-10", "protected")), 2);
  assert.equal(activityLevel(day("2026-01-10", null, 1)), 1);
  assert.equal(activityLevel(day("2026-01-10", "success", 1)), 3);
  assert.equal(activityLevel(day("2026-01-10", null, 5)), 2); // goalLogs faz cap em 2
  assert.equal(activityLevel(day("2026-01-10", "lost")), 0);
  assert.equal(activityLevel(day("2026-01-10", "lost", 1)), 1);
});

test("isDayActive: check-in válido/escudo ou qualquer meta registrada", () => {
  assert.equal(isDayActive(day("2026-01-10", "success")), true);
  assert.equal(isDayActive(day("2026-01-10", "protected")), true);
  assert.equal(isDayActive(day("2026-01-10", "lost")), false);
  assert.equal(isDayActive(day("2026-01-10", "lost", 1)), true);
  assert.equal(isDayActive(day("2026-01-10")), false);
});

test("activityStreaks: hoje pendente não quebra; dia perdido quebra", () => {
  const days = [
    day("2026-01-04", "success"),
    day("2026-01-05", "success"),
    day("2026-01-06", "success"),
    day("2026-01-07", "success"),
    day("2026-01-08", "success"),
    day("2026-01-09", "success"),
    // 10/01 = hoje, ainda sem atividade → pulado, não quebra.
  ];
  const { current, best } = activityStreaks(days, "2026-01-10");
  assert.equal(current, 6);
  assert.equal(best, 6);

  // Com o mesmo cenário mas 09/01 "lost", a sequência quebra antes de hoje.
  const lost = [...days];
  lost[5] = day("2026-01-09", "lost");
  assert.equal(activityStreaks(lost, "2026-01-10").current, 0);
  assert.equal(activityStreaks(lost, "2026-01-10").best, 5);
});

test("activityStreaks: escudo protege e hoje qualificado conta", () => {
  const days = [
    day("2026-01-08", "protected"),
    day("2026-01-09", "success"),
    day("2026-01-10", "success"), // hoje já feito
  ];
  assert.equal(activityStreaks(days, "2026-01-10").current, 3);

  // Melhor sequência fica no passado, mesmo com quebra recente.
  const run = [
    day("2026-01-01", "success"),
    day("2026-01-02", "success"),
    day("2026-01-03"),
    day("2026-01-04", "success"),
    day("2026-01-05", "success"),
    day("2026-01-06", "success"),
    day("2026-01-07", "success"),
    day("2026-01-08", "success"),
  ];
  const stats = activityStreaks(run, "2026-01-10");
  assert.equal(stats.current, 0); // 09/10 não existem → quebra antes
  assert.equal(stats.best, 5);
});

test("activityStats calcula dias ativos, logs, janela e taxa", () => {
  const days = buildActivityYear(2026, {
    checkins: {
      "2026-01-05": "success",
      "2026-01-06": "success",
      "2026-01-07": "success",
      "2026-01-08": "protected",
      "2026-01-09": "success",
      "2026-01-10": "success",
    },
    goalLogCounts: { "2026-01-01": 2, "2026-01-10": 1 },
    today: "2026-01-10",
  });

  const stats = activityStats(days, "2026-01-10");
  assert.equal(stats.activeDays, 7); // 01/01 (metas) + 05→10 (check-ins)
  assert.equal(stats.goalLogEntries, 3);
  assert.equal(stats.elapsedDays, 10); // 01/01 → 10/01
  assert.equal(stats.rate, 70);
  assert.equal(stats.current, 6);
  assert.equal(stats.best, 6);
});

test("heatmapColumns cobre o ano com semanas de segunda a domingo", () => {
  for (const year of [2025, 2026, 2024]) {
    const columns = heatmapColumns(year);
    assert.ok(columns.every((column) => column.length === 7));

    const first = columns[0];
    const last = columns[columns.length - 1];
    // Segunda da semana que contém 01/01 (ou antes).
    assert.ok(first[0] <= `${year}-01-01`);
    // Domingo da semana que contém 31/12 (ou depois).
    assert.ok(last[6] >= `${year}-12-31`);

    // Todos os dias do ano aparecem exatamente uma vez.
    const inYear = columns.flat().filter((date) => date.startsWith(`${year}-`));
    const expected = year % 4 === 0 ? 366 : 365;
    assert.equal(inYear.length, expected);
    assert.equal(new Set(inYear).size, expected);
  }
});

test("heatmapColumns: primeira/última semana de 2026", () => {
  const columns = heatmapColumns(2026);
  // 01/01/2026 é quinta → segunda da semana é 29/12/2025.
  assert.equal(columns[0][0], "2025-12-29");
  // 31/12/2026 é quinta → domingo da semana é 03/01/2027.
  assert.equal(columns[columns.length - 1][6], "2027-01-03");
});
