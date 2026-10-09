import test from "node:test";
import assert from "node:assert/strict";
import {
  getLocalDateKey,
  getWeekRange,
  getMonthRange,
  goalPeriodRange,
  goalPeriodKey,
  addDaysIso,
  todayIso,
  dayInTz,
  APP_TIMEZONE,
  diffDaysIso,
} from "./dates";

// Fuso do produto é America/Sao_Paulo (UTC−3 sem DST desde 2019).
// A janela crítica é 21:00–23:59 locais: o dia UTC ainda é o dia seguinte.

test("getLocalDateKey usa o dia de São Paulo, não o dia UTC", () => {
  // 23:59:59 de 14/01 em SP = 02:59:59Z de 15/01 (dia UTC errado).
  assert.equal(getLocalDateKey("2026-01-15T02:59:59Z"), "2026-01-14");
  // Meia-noite exata em SP = 03:00:00Z.
  assert.equal(getLocalDateKey("2026-01-15T03:00:00Z"), "2026-01-15");
  // Aceita Date também (21:30 de 30/06 em SP = 00:30Z de 01/07).
  assert.equal(getLocalDateKey(new Date("2026-07-01T00:30:00Z")), "2026-06-30");
});

test("getWeekRange vai de segunda a domingo", () => {
  // 04/10/2026 é domingo → semana começa na segunda 28/09.
  assert.deepEqual(getWeekRange("2026-10-04"), { start: "2026-09-28", end: "2026-10-04" });
  // 05/10/2026 é segunda → começa nela mesma.
  assert.deepEqual(getWeekRange("2026-10-05"), { start: "2026-10-05", end: "2026-10-11" });
});

test("getMonthRange cobre o mês inteiro (ano bissexto inclusive)", () => {
  assert.deepEqual(getMonthRange("2024-02-10"), { start: "2024-02-01", end: "2024-02-29" });
  assert.deepEqual(getMonthRange("2026-02-10"), { start: "2026-02-01", end: "2026-02-28" });
  assert.deepEqual(getMonthRange("2026-12-05"), { start: "2026-12-01", end: "2026-12-31" });
});

test("goalPeriodRange devolve a janela do período corrente", () => {
  assert.deepEqual(goalPeriodRange("daily", "2026-04-10"), { start: "2026-04-10", end: "2026-04-10" });
  assert.deepEqual(goalPeriodRange("weekly", "2026-04-10"), { start: "2026-04-06", end: "2026-04-12" });
  assert.deepEqual(goalPeriodRange("monthly", "2026-04-10"), { start: "2026-04-01", end: "2026-04-30" });
  assert.equal(goalPeriodRange("unique", "2026-04-10"), null);
});

test("goalPeriodKey gera chaves determinísticas por período", () => {
  assert.equal(goalPeriodKey("daily", "2026-04-10"), "d:2026-04-10");
  assert.equal(goalPeriodKey("weekly", "2026-04-10"), "w:2026-04-06");
  assert.equal(goalPeriodKey("monthly", "2026-04-10"), "m:2026-04");
  assert.equal(goalPeriodKey("unique", "2026-04-10"), "u:once");
});

test("addDaysIso atravessa meses e anos", () => {
  assert.equal(addDaysIso("2026-12-31", 1), "2027-01-01");
  assert.equal(addDaysIso("2024-02-28", 1), "2024-02-29");
  assert.equal(addDaysIso("2026-01-01", -1), "2025-12-31");
});

test("todayIso usa o fuso America/Sao_Paulo", () => {
  assert.equal(APP_TIMEZONE, "America/Sao_Paulo");
  // Formato YYYY-MM-DD
  const today = todayIso();
  assert.match(today, /^\d{4}-\d{2}-\d{2}$/);
});

test("dayInTz converte instantes UTC para o dia correto em São Paulo", () => {
  // São Paulo é UTC-3 (sem DST desde 2019). O dia muda em SP às 03:00 UTC.
  // 23:59 UTC de 14/01 = 20:59 em SP → 14/01.
  assert.equal(dayInTz("2026-01-14T23:59:59Z"), "2026-01-14");
  // 00:01 UTC de 15/01 = 21:01 em SP → 14/01 (o dia ainda não mudou em SP).
  assert.equal(dayInTz("2026-01-15T00:01:00Z"), "2026-01-14");
  // 02:59 UTC de 15/01 = 23:59 em SP → 14/01 (último minuto do dia em SP).
  assert.equal(dayInTz("2026-01-15T02:59:59Z"), "2026-01-14");
  // 03:00 UTC de 15/01 = 00:00 em SP → 15/01 (meia-noite em SP).
  assert.equal(dayInTz("2026-01-15T03:00:00Z"), "2026-01-15");
  // 21:30 UTC de 09/10 = 18:30 em SP → 09/10.
  assert.equal(dayInTz("2026-10-09T21:30:00Z"), "2026-10-09");
  // 22:00 UTC de 09/10 = 19:00 em SP → 09/10.
  assert.equal(dayInTz("2026-10-09T22:00:00Z"), "2026-10-09");
  // 02:59 UTC de 10/10 = 23:59 em SP → 09/10 (última hora do dia em SP).
  assert.equal(dayInTz("2026-10-10T02:59:59Z"), "2026-10-09");
});

test("diffDaysIso não depende de fuso horário — compara datas puras", () => {
  assert.equal(diffDaysIso("2026-10-09", "2026-10-08"), 1);
  assert.equal(diffDaysIso("2026-10-08", "2026-10-09"), -1);
  assert.equal(diffDaysIso("2026-10-09", "2026-10-09"), 0);
  assert.equal(diffDaysIso("2026-12-31", "2026-01-01"), 364);
});

test("dia de São Paulo não antecipa com new Date().toISOString()", () => {
  // Regression guard: a regra do produto proíbe usar
  // `new Date().toISOString().slice(0,10)` para "hoje" fora de SP.
  // dayInTz deve sempre alinhar com getLocalDateKey.
  const instant = "2026-10-09T21:30:00Z"; // 18:30 em SP → ainda 09/10
  assert.equal(getLocalDateKey(instant), dayInTz(instant));
});
