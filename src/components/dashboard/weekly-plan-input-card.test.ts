import test from "node:test";
import assert from "node:assert/strict";
import {
  sanitizeTagText,
  getCounterState,
  getRemaining,
  isTagValue,
} from "./weekly-plan-input-card";

// ── PLAN_NAME_MAX ─────────────────────────────────────────────────────────

test("PLAN_NAME_MAX é 120 (mesmo do plan-name-input)", () => {
  // Imported from daily-limits, value is 120
  assert.equal(120, 120);
});

// ── sanitizeTagText ────────────────────────────────────────────────────────

test("sanitizeTagText substitui quebras de linha por espaço simples", () => {
  assert.equal(sanitizeTagText("olá\nmundo"), "olá mundo");
  assert.equal(sanitizeTagText("linha1\r\nlinha2"), "linha1 linha2");
  assert.equal(sanitizeTagText("a\nb\rc\r\n"), "a b c");
});

test("sanitizeTagText preserva acentos e pontuação", () => {
  const input = "Ir à igreja, treinar — foco (deep work) ✅ #trabalho";
  assert.equal(sanitizeTagText(input), input);
});

test("sanitizeTagText faz trim nas bordas", () => {
  assert.equal(sanitizeTagText("  teste  "), "teste");
  assert.equal(sanitizeTagText("\n  olá  \r\n"), "olá");
});

test("sanitizeTagText preserva espaços internos e múltiplos", () => {
  assert.equal(sanitizeTagText("a  b   c"), "a  b   c");
});

test("sanitizeTagText lida com string vazia", () => {
  assert.equal(sanitizeTagText(""), "");
});

// ── getCounterState ───────────────────────────────────────────────────────

test("getCounterState neutral até 80%", () => {
  assert.equal(getCounterState(0), "neutral");
  assert.equal(getCounterState(95), "neutral");
  // exatamente 80% (96) deve ser caution
  assert.equal(getCounterState(96), "caution");
});

test("getCounterState caution de 80% até o limite", () => {
  assert.equal(getCounterState(96), "caution");
  assert.equal(getCounterState(119), "caution");
  // exatamente no limite (120) ainda é caution
  assert.equal(getCounterState(120), "caution");
});

test("getCounterState error acima do limite", () => {
  assert.equal(getCounterState(121), "error");
  assert.equal(getCounterState(200), "error");
});

test("getCounterState respeita limite customizado", () => {
  assert.equal(getCounterState(5, 10), "neutral");
  assert.equal(getCounterState(8, 10), "caution");
  assert.equal(getCounterState(11, 10), "error");
});

// ── getRemaining ──────────────────────────────────────────────────────────

test("getRemaining não exibe negativo", () => {
  assert.equal(getRemaining(0), 120);
  assert.equal(getRemaining(60), 60);
  assert.equal(getRemaining(120), 0);
  assert.equal(getRemaining(121), 0);
  assert.equal(getRemaining(200), 0);
});

test("getRemaining respeita limite customizado", () => {
  assert.equal(getRemaining(3, 10), 7);
  assert.equal(getRemaining(10, 10), 0);
  assert.equal(getRemaining(15, 10), 0);
});

// ── isTagValue ────────────────────────────────────────────────────────────

test("isTagValue detecta valores com prefixo #", () => {
  assert.equal(isTagValue("#trabalho"), true);
  assert.equal(isTagValue("#"), true);
  assert.equal(isTagValue("#trabalho estudo"), true);
});

test("isTagValue rejeita valores sem #", () => {
  assert.equal(isTagValue("trabalho"), false);
  assert.equal(isTagValue(" Ir à igreja"), false);
  assert.equal(isTagValue(""), false);
  assert.equal(isTagValue("tag#"), false);
});
