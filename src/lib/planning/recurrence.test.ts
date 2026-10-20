import { describe, it } from "node:test";
import assert from "node:assert";
import { expandWeeklyPlanSeries } from "../db/weekly-plans-series";
import { addDays, APP_TIMEZONE, monthRange, weekStart, weekdayOfIso } from "./dates";
import { buildMonthGrid } from "./month-grid";

/**
 * Regras de recorrência do Planejamento (sem banco):
 * - a regra vive no plano (repeat_type/repeat_days/end_*), não em cópias;
 * - as ocorrências são geradas para o intervalo visível;
 * - a conclusão é por ocorrência (id do plano + data).
 */

const mondaySeries = {
  repeatType: "weekly" as const,
  repeatDays: [1], // segunda-feira
  repeatInterval: null,
  startDate: "2026-10-19",
  endType: "never" as const,
  endDate: null,
  endCount: null,
  timezone: APP_TIMEZONE,
};

describe("dia da semana da data escolhida", () => {
  it("não desloca o dia por conversão UTC", () => {
    // 2026-10-19 é uma segunda-feira.
    assert.strictEqual(weekdayOfIso("2026-10-19"), 1);
    assert.strictEqual(weekdayOfIso("2026-10-18"), 0); // domingo
    assert.strictEqual(weekdayOfIso("2026-10-25"), 0); // domingo seguinte
    assert.strictEqual(weekdayOfIso("2026-10-26"), 1); // segunda seguinte
    assert.strictEqual(weekdayOfIso("2026-01-01"), 4); // quinta-feira
  });

  it("mantém o dia em datas de virada de mês/ano", () => {
    assert.strictEqual(weekdayOfIso("2026-03-01"), 0); // domingo
    assert.strictEqual(weekdayOfIso("2026-12-31"), 4); // quinta
    assert.strictEqual(weekdayOfIso("2027-01-01"), 5); // sexta
  });
});

describe("geração de ocorrências", () => {
  it("repetir toda segunda aparece em toda segunda de 3 meses à frente", () => {
    const visited = ["2026-11-01", "2026-12-01", "2027-01-01"];
    const visible = new Set<string>();

    for (const month of visited) {
      const [year, monthNumber] = month.split("-").map(Number);
      for (const week of new Set(buildMonthGrid(year!, monthNumber!).map(weekStart))) {
        for (const date of expandWeeklyPlanSeries(mondaySeries, week)) {
          if (date.slice(0, 7) === month.slice(0, 7)) visible.add(date);
        }
      }
    }

    const expected: string[] = [];
    for (let date = "2026-11-01"; date <= "2027-01-31"; date = addDays(date, 1)) {
      if (weekdayOfIso(date) === 1) expected.push(date);
    }

    assert.deepStrictEqual([...visible].sort(), expected);
    assert.ok(expected.length >= 12, "3 meses devem ter pelo menos 12 segundas");
  });

  it("gera ocorrências em todas as vistas (semana, mês e dia)", () => {
    const week = weekStart("2026-11-09"); // semana de 09/11 a 15/11
    assert.deepStrictEqual(expandWeeklyPlanSeries(mondaySeries, week), ["2026-11-09"]);

    const { start, end } = monthRange("2026-11-01");
    const inMonth = new Set<string>();
    for (let date = start; date <= end; date = addDays(date, 1)) {
      for (const occurrence of expandWeeklyPlanSeries(mondaySeries, weekStart(date))) {
        if (occurrence >= start && occurrence <= end) inMonth.add(occurrence);
      }
    }
    assert.deepStrictEqual([...inMonth].sort(), [
      "2026-11-02",
      "2026-11-09",
      "2026-11-16",
      "2026-11-23",
      "2026-11-30",
    ]);
  });

  it("respeita a data final (repetir até)", () => {
    const bounded = {
      ...mondaySeries,
      endType: "date" as const,
      endDate: "2026-11-16",
    };
    assert.deepStrictEqual(expandWeeklyPlanSeries(bounded, weekStart("2026-11-02")), ["2026-11-02"]);
    assert.deepStrictEqual(expandWeeklyPlanSeries(bounded, weekStart("2026-11-09")), ["2026-11-09"]);
    assert.deepStrictEqual(expandWeeklyPlanSeries(bounded, weekStart("2026-11-16")), ["2026-11-16"]);
    assert.deepStrictEqual(expandWeeklyPlanSeries(bounded, weekStart("2026-11-23")), []);
  });

  it("não repete antes da data inicial", () => {
    assert.deepStrictEqual(expandWeeklyPlanSeries(mondaySeries, weekStart("2026-10-12")), []);
  });

  it("permite vários dias da semana na mesma série", () => {
    const multi = { ...mondaySeries, repeatDays: [1, 3, 5] };
    assert.deepStrictEqual(
      expandWeeklyPlanSeries(multi, weekStart("2026-11-09")),
      ["2026-11-09", "2026-11-11", "2026-11-13"],
    );
  });
});

describe("chave da ocorrência (plano + data)", () => {
  /** Mesma chave usada pela UI e pela API (xp_ledger / estado por ocorrência). */
  const occurrenceKey = (seriesId: number, date: string) => `${seriesId}:${date}`;

  it("distingue semanas diferentes do mesmo plano", () => {
    assert.notStrictEqual(occurrenceKey(7, "2026-10-19"), occurrenceKey(7, "2026-10-26"));
  });

  it("distingue planos diferentes na mesma data", () => {
    assert.notStrictEqual(occurrenceKey(7, "2026-10-19"), occurrenceKey(8, "2026-10-19"));
  });

  it("é estável para a mesma ocorrência", () => {
    assert.strictEqual(occurrenceKey(7, "2026-10-19"), occurrenceKey(7, "2026-10-19"));
  });
});
