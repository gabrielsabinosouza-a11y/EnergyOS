import test from "node:test";
import assert from "node:assert/strict";
import { getMonthWeeks, getMonthWeeksFor, daysInMonth, addDays, addMonths, dayInTz, formatLocalDate, monthRange, weekRange, viewLabel } from "./dates";

test("getMonthWeeks sempre retorna no máximo 4 semanas", () => {
  for (let year = 2024; year <= 2028; year++) {
    for (let month = 1; month <= 12; month++) {
      const weeks = getMonthWeeks(year, month);
      assert.equal(weeks.length, 4, `ano ${year} mês ${month} deve ter 4 semanas`);
    }
  }
});

test("getMonthWeeks: Semana 1 = dias 1–7, Semana 2 = 8–14, Semana 3 = 15–21", () => {
  const weeks = getMonthWeeks(2026, 10); // outubro (31 dias)
  assert.deepEqual(weeks[0], { index: 1, start: "2026-10-01", end: "2026-10-07", days: ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07"] });
  assert.deepEqual(weeks[1], { index: 2, start: "2026-10-08", end: "2026-10-14", days: ["2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11", "2026-10-12", "2026-10-13", "2026-10-14"] });
  assert.deepEqual(weeks[2], { index: 3, start: "2026-10-15", end: "2026-10-21", days: ["2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18", "2026-10-19", "2026-10-20", "2026-10-21"] });
});

test("getMonthWeeks: Semana 4 absorve o fim do mês (até 10 dias)", () => {
  const weeks31 = getMonthWeeks(2026, 10);
  assert.deepEqual(weeks31[3], { index: 4, start: "2026-10-22", end: "2026-10-31", days: ["2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25", "2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31"] });

  const weeks30 = getMonthWeeks(2026, 4); // abril (30 dias)
  assert.equal(weeks30[3].days.length, 9);
  assert.equal(weeks30[3].end, "2026-04-30");

  const weeks29 = getMonthWeeks(2028, 2); // fevereiro bissexto (29 dias)
  assert.deepEqual(weeks29[3], { index: 4, start: "2028-02-22", end: "2028-02-29", days: ["2028-02-22", "2028-02-23", "2028-02-24", "2028-02-25", "2028-02-26", "2028-02-27", "2028-02-28", "2028-02-29"] });
});

test("getMonthWeeks: fevereiro comum tem semana 4 com 7 dias (22–28)", () => {
  const weeks = getMonthWeeks(2026, 2); // fevereiro comum (28 dias)
  assert.deepEqual(weeks[3], { index: 4, start: "2026-02-22", end: "2026-02-28", days: ["2026-02-22", "2026-02-23", "2026-02-24", "2026-02-25", "2026-02-26", "2026-02-27", "2026-02-28"] });
});

test("getMonthWeeks: cada dia do mês aparece exatamente uma vez, sem dias de outros meses", () => {
  const cases: Array<[number, number]> = [
    [2026, 1], // janeiro (31)
    [2026, 2], // fevereiro (28)
    [2026, 4], // abril (30)
    [2026, 12], // dezembro (31)
    [2028, 2], // fevereiro bissexto (29)
    [2026, 7], // julho (31)
  ];
  for (const [year, month] of cases) {
    const weeks = getMonthWeeks(year, month);
    const allDays: string[] = [];
    for (const w of weeks) for (const d of w.days) allDays.push(d);
    const expected: string[] = [];
    for (let i = 1; i <= daysInMonth(`${year}-${String(month).padStart(2, "0")}-01`); i++) {
      expected.push(`${year}-${String(month).padStart(2, "0")}-${String(i).padStart(2, "0")}`);
    }
    assert.deepEqual(allDays, expected, `ano ${year} mês ${month}: dias devem cobrir o mês sem repetir/ faltar`);
    assert.equal(new Set(allDays).size, allDays.length, `ano ${year} mês ${month}: sem dias repetidos`);
  }
});

test("getMonthWeeksFor agrupa pelo mês da data informada", () => {
  const weeks = getMonthWeeksFor("2026-10-31");
  assert.equal(weeks[0].start, "2026-10-01");
  assert.equal(weeks[3].end, "2026-10-31");
  const weeksNov = getMonthWeeksFor("2026-11-02");
  assert.equal(weeksNov[0].start, "2026-11-01");
  assert.equal(weeksNov[3].end, "2026-11-30");
});

test("getMonthWeeks: dias de outros meses não aparecem nas semanas", () => {
  const weeks = getMonthWeeks(2026, 2); // fevereiro 2026 (28 dias) — semana 1 começa no dia 1
  assert.equal(weeks[0].start, "2026-02-01");
  assert.equal(weeks[0].end, "2026-02-07");
  // Nenhum dia de janeiro ou março escapou.
  const allDays = weeks.flatMap((w) => w.days);
  for (const d of allDays) {
    const m = Number(d.slice(5, 7));
    assert.equal(m, 2, `dia ${d} não deve pertencer ao mês 2`);
    assert.ok(d >= "2026-02-01" && d <= "2026-02-28");
  }
  // Dias seguem em ordem crescente dentro de cada semana.
  for (const w of weeks) {
    for (let i = 1; i < w.days.length; i++) {
      assert.ok(addDays(w.days[i - 1], 1) === w.days[i], `semana ${w.index} deve estar contígua e ordenada`);
    }
  }
});

test("planner dates use Monday-first week ranges and preserve local calendar dates", () => {
  assert.equal(viewLabel("2026-10-15", "week"), "12–18 de outubro de 2026");
  assert.equal(viewLabel("2026-12-31", "week"), "28 de dez. – 3 de jan. de 2027");
  assert.equal(formatLocalDate("2026-10-01", { weekday: "long" }), "quinta-feira");
  assert.equal(formatLocalDate("2028-02-29", { day: "numeric", month: "numeric" }), "29/02");
  assert.deepEqual(weekRange("2026-10-01"), { start: "2026-09-28", end: "2026-10-04" });
  assert.deepEqual(monthRange("2028-02-05"), { start: "2028-02-01", end: "2028-02-29" });
  assert.equal(addMonths("2026-03-31", -1), "2026-02-28");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
});

test("date-only values passed to dayInTz stay on their written calendar day", () => {
  assert.equal(dayInTz("2026-10-01"), "2026-10-01");
});
