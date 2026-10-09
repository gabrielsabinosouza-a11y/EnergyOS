import assert from "node:assert/strict";
import test from "node:test";
import { finalizedFocusMinutes } from "./focus";

test("zero elapsed seconds stay a zero-reward give-up", () => {
  assert.equal(finalizedFocusMinutes(0), 0);
});

test("positive elapsed seconds still round to at least one minute", () => {
  assert.equal(finalizedFocusMinutes(1), 1);
  assert.equal(finalizedFocusMinutes(89), 1);
  assert.equal(finalizedFocusMinutes(90), 2);
});
