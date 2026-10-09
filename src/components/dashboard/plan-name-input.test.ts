import test from "node:test";
import assert from "node:assert/strict";
import {
  PLAN_NAME_MAX,
  sanitizePastedText,
  getCounterState,
  getRemaining,
} from "./plan-name-input";

// ── PLAN_NAME_MAX ─────────────────────────────────────────────────────────

test("PLAN_NAME_MAX é 120", () => {
  assert.equal(PLAN_NAME_MAX, 120);
});

// ── sanitizePastedText ────────────────────────────────────────────────────

test("sanitizePastedText substitui quebras de linha por espaço simples", () => {
  assert.equal(sanitizePastedText("olá\nmundo"), "olá mundo");
  assert.equal(sanitizePastedText("linha1\r\nlinha2"), "linha1 linha2");
  assert.equal(sanitizePastedText("a\nb\rc\r\n"), "a b c");
});

test("sanitizePastedText preserva acentos e pontuação", () => {
  const input = "Ir à igreja, treinar — foco (deep work) ✅";
  assert.equal(sanitizePastedText(input), input);
});

test("sanitizePastedText faz trim nas bordas", () => {
  assert.equal(sanitizePastedText("  teste  "), "teste");
  assert.equal(sanitizePastedText("\n  olá  \r\n"), "olá");
});

test("sanitizePastedText preserva espaços internos e múltiplos", () => {
  assert.equal(sanitizePastedText("a  b   c"), "a  b   c");
});

test("sanitizePastedText lida com string vazia", () => {
  assert.equal(sanitizePastedText(""), "");
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
