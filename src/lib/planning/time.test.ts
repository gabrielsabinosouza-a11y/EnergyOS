import { describe, it } from "node:test";
import assert from "node:assert";
import { formatTimeInput, isValidTime24, toMinutes, toTimeLabel } from "./time";

describe("formatTimeInput (horário 24h)", () => {
  it("insere os dois-pontos ao digitar 4 dígitos", () => {
    assert.strictEqual(formatTimeInput("0900"), "09:00");
    assert.strictEqual(formatTimeInput("2359"), "23:59");
    assert.strictEqual(formatTimeInput("0000"), "00:00");
  });

  it("mantém os dígitos enquanto o horário está incompleto", () => {
    assert.strictEqual(formatTimeInput("0"), "0");
    assert.strictEqual(formatTimeInput("09"), "09");
    assert.strictEqual(formatTimeInput("09:"), "09");
  });

  it("ignora caracteres não numéricos (inclusive AM/PM)", () => {
    assert.strictEqual(formatTimeInput("09:30"), "09:30");
    assert.strictEqual(formatTimeInput("09h30"), "09:30");
    assert.strictEqual(formatTimeInput("9:30 AM"), "09:30");
    assert.strictEqual(formatTimeInput("9:30 PM"), "09:30");
  });

  it("limita a 4 dígitos", () => {
    assert.strictEqual(formatTimeInput("09:301"), "09:30");
    assert.strictEqual(formatTimeInput("123456"), "12:34");
  });
});

describe("isValidTime24", () => {
  it("aceita horários válidos", () => {
    assert.ok(isValidTime24("00:00"));
    assert.ok(isValidTime24("09:00"));
    assert.ok(isValidTime24("23:59"));
  });

  it("rejeita horários inválidos", () => {
    assert.ok(!isValidTime24("24:00"));
    assert.ok(!isValidTime24("09:60"));
    assert.ok(!isValidTime24("9:00"));
    assert.ok(!isValidTime24("09:0"));
    assert.ok(!isValidTime24(""));
  });
});

describe("conversões de horário", () => {
  it("converte HH:MM em minutos e vice-versa", () => {
    assert.strictEqual(toMinutes("09:00"), 540);
    assert.strictEqual(toMinutes("00:00"), 0);
    assert.strictEqual(toTimeLabel(540), "09:00");
    assert.strictEqual(toTimeLabel(0), "00:00");
  });
});
