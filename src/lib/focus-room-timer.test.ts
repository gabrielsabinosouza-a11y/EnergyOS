import assert from "node:assert/strict";
import test from "node:test";
import { focusRoomRemainingMs } from "./focus-room-timer";

test("uses endsAt minus server-adjusted now while active", () => {
  const room = { status: "active", durationMinutes: 30, endsAt: "2026-01-01T00:00:30.000Z" };
  const nowMs = new Date("2026-01-01T00:00:00.000Z").getTime();
  assert.equal(focusRoomRemainingMs(room, nowMs, 0), 30000);
});

test("server offset corrects client clock skew", () => {
  const room = { status: "active", durationMinutes: 30, endsAt: "2026-01-01T00:00:30.000Z" };
  // client clock is 5 seconds ahead
  const nowMs = new Date("2026-01-01T00:00:05.000Z").getTime();
  const serverOffsetMs = new Date("2026-01-01T00:00:00.000Z").getTime() - nowMs; // -5000
  assert.equal(focusRoomRemainingMs(room, nowMs, serverOffsetMs), 30000);
});

test("paused returns remainingSeconds", () => {
  const room = { status: "paused", durationMinutes: 30, remainingSeconds: 120 };
  assert.equal(focusRoomRemainingMs(room, Date.now(), 0), 120000);
});

test("returns null when not running", () => {
  const room = { status: "waiting", durationMinutes: 30 };
  assert.equal(focusRoomRemainingMs(room, Date.now(), 0), null);
});

test("clamps negative to zero", () => {
  const room = { status: "active", durationMinutes: 30, endsAt: "2026-01-01T00:00:00.000Z" };
  const nowMs = new Date("2026-01-01T00:00:10.000Z").getTime();
  assert.equal(focusRoomRemainingMs(room, nowMs, 0), 0);
});
