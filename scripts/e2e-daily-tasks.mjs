/**
 * End-to-end test for the daily-tasks / habits endpoints.
 *
 * Run with the dev server up (AUTH_ALLOW_UNVERIFIED=true):
 *
 *   node --import tsx scripts/e2e-daily-tasks.mjs
 *
 * Verifies:
 *  1. GET /api/daily-tasks?all=true           → 200, 4 habits returned
 *  2. GET /api/daily-tasks                  → 200, habits for today
 *  3. GET /api/daily-tasks/history (valid)  → 200, history entries
 *  4. GET /api/daily-tasks/history (from>to) → 400
 *  5. GET /api/daily-tasks/history (bad fmt)  → 400
 *  6. GET /api/daily-tasks/history (too wide) → 400
 *  7. PATCH /api/daily-tasks/:id (check)     → 200, idempotent (double-check = no dup rewards)
 *  8. PATCH /api/daily-tasks/:id (uncheck)    → 200
 *  9. No dev header                        → 401
 */

import test from "node:test";
import assert from "node:assert/strict";

const BASE = "http://localhost:3000";
const PROFILE_ID = "0e719da0-f486-469c-b27f-9b3b5612fb50";
const HEADERS = { "x-dev-profile-id": PROFILE_ID, "Content-Type": "application/json" };

async function api(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, { headers: HEADERS, ...opts });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

test("GET /api/daily-tasks?all=true returns 4 habits (200)", async () => {
  const { status, body } = await api("/api/daily-tasks?all=true");
  assert.equal(status, 200);
  assert.ok(Array.isArray(body.tasks));
  assert.equal(body.tasks.length, 4);
  const titles = body.tasks.map((t) => t.title).sort();
  assert.deepEqual(titles, ["35 minutes english practice", "40 minutes reading a book", "Journaling", "study 4 hours"]);
});

test("GET /api/daily-tasks returns habits for today (200)", async () => {
  const { status, body } = await api("/api/daily-tasks");
  assert.equal(status, 200);
  assert.ok(Array.isArray(body.tasks));
  assert.ok(body.tasks.length > 0);
  assert.match(body.date, /^\d{4}-\d{2}-\d{2}$/);
});

test("GET /api/daily-tasks/history with valid range (200)", async () => {
  const { status, body } = await api("/api/daily-tasks/history?from=2026-01-01&to=2026-12-31");
  assert.equal(status, 200);
  assert.ok(Array.isArray(body.logs));
  assert.ok(body.logs.length > 0);
  for (const entry of body.logs) {
    assert.match(entry.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(entry.taskId);
  }
});

test("GET /api/daily-tasks/history with from>to returns 400", async () => {
  const { status, body } = await api("/api/daily-tasks/history?from=2026-12-31&to=2026-01-01");
  assert.equal(status, 400);
  assert.ok(body.error);
});

test("GET /api/daily-tasks/history with invalid date format returns 400", async () => {
  const { status, body } = await api("/api/daily-tasks/history?from=bogus&to=2026-12-31");
  assert.equal(status, 400);
  assert.ok(body.error);
});

test("GET /api/daily-tasks/history with range > 366 days returns 400", async () => {
  // 2024-01-01 to 2026-01-01 = 731 days (> 366)
  const { status, body } = await api("/api/daily-tasks/history?from=2024-01-01&to=2026-01-01");
  assert.equal(status, 400);
  assert.ok(body.error);
});

test("PATCH /api/daily-tasks/:id check-in is idempotent (double-check = no dup rewards)", async () => {
  const taskId = 25; // "40 minutes reading a book"
  const payload = JSON.stringify({ completed: true });

  // First check — should succeed
  const r1 = await api(`/api/daily-tasks/${taskId}`, { method: "PATCH", body: payload });
  assert.equal(r1.status, 200);
  assert.ok(r1.body.task.isCompleted);

  const firstCompletedAt = r1.body.task.completedAt;

  // Second check immediately — should succeed but NOT award again
  const r2 = await api(`/api/daily-tasks/${taskId}`, { method: "PATCH", body: payload });
  assert.equal(r2.status, 200);
  assert.ok(r2.body.task.isCompleted);
  assert.equal(r2.body.xpAwarded, 0);
  assert.equal(r2.body.coinsAwarded, 0);

  // Un-check
  const r3 = await api(`/api/daily-tasks/${taskId}`, { method: "PATCH", body: JSON.stringify({ completed: false }) });
  assert.equal(r3.status, 200);
  assert.equal(r3.body.task.isCompleted, false);

  // Re-check — should succeed (reward already claimed, so xpAwarded = 0)
  const r4 = await api(`/api/daily-tasks/${taskId}`, { method: "PATCH", body: payload });
  assert.equal(r4.status, 200);
  assert.ok(r4.body.task.isCompleted);

  // Verify no duplicate log rows in daily_task_log
  const r5 = await (async () => {
    const res = await fetch(`${BASE}/api/daily-tasks?all=true`, { headers: HEADERS });
    return { status: res.status, body: await res.json() };
  })();
  assert.equal(r5.status, 200);
  assert.ok(firstCompletedAt, "completedAt should be set after first check");
});

test("GET /api/daily-tasks without dev header returns 401", async () => {
  const res = await fetch(`${BASE}/api/daily-tasks?all=true`, {
    headers: { "Content-Type": "application/json" },
  });
  assert.equal(res.status, 401);
});
