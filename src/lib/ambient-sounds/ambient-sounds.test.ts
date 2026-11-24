import test from "node:test";
import assert from "node:assert/strict";

// ── Browser global stubs (node:test has no DOM) ──────────────────────────────
// Modules are imported lazily inside tests (tsx emits CJS: no top-level await,
// and imports must come AFTER the stubs below).

const store = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};
(globalThis as Record<string, unknown>).window = globalThis;
// Node has a native BroadcastChannel that would keep the test process alive;
// the engine's single-tab guard is a browser concern, not under test here.
delete (globalThis as Record<string, unknown>).BroadcastChannel;

let readAmbientMix: typeof import("./store").readAmbientMix;
let ambientEngine: typeof import("./engine").ambientEngine;
let onAmbientError: typeof import("./engine").onAmbientError;
let getAmbientLoadError: typeof import("./engine").getAmbientLoadError;

async function ensureImports() {
  if (!readAmbientMix) {
    ({ readAmbientMix } = await import("./store"));
    ({ ambientEngine, onAmbientError, getAmbientLoadError } = await import("./engine"));
  }
}

// ── Mix store tests (behavior table: persistence, defaults, corrupted data) ──

test("default mix: sound OFF, master ~0.4, empty selection", async () => {
  await ensureImports();
  store.clear();
  const m = readAmbientMix();
  assert.deepEqual(m.enabled, []);
  assert.equal(m.master, 0.4);
  assert.equal(m.muted, false);
});

test("localStorage restore: enabled ids, per-sound volumes, master, mute", async () => {
  await ensureImports();
  store.set("energyos:ambient", JSON.stringify({
    enabled: ["rain", "fireplace"],
    volumes: { rain: 0.5, fireplace: 0.9, bogus: 1 },
    master: 0.6,
    muted: true,
  }));
  const m = readAmbientMix();
  assert.deepEqual(m.enabled, ["rain", "fireplace"]);
  assert.equal(m.volumes.rain, 0.5);
  assert.equal(m.volumes.fireplace, 0.9);
  assert.equal(m.volumes.bogus, undefined); // unknown ids dropped
  assert.equal(m.master, 0.6);
  assert.equal(m.muted, true);
});

test("layering: unknown sound ids filtered, master clamped to 0..1", async () => {
  await ensureImports();
  store.set("energyos:ambient", JSON.stringify({ enabled: ["rain", "nope", 42], master: 2 }));
  const m = readAmbientMix();
  assert.deepEqual(m.enabled, ["rain"]);
  assert.equal(m.master, 1);
});

test("corrupted localStorage falls back to defaults (session continues)", async () => {
  await ensureImports();
  store.set("energyos:ambient", "{not json!!");
  const m = readAmbientMix();
  assert.deepEqual(m.enabled, []);
  assert.equal(m.master, 0.4);
});

// ── Engine tests with a mocked AudioContext ──────────────────────────────────

const rampLog: { param: string; value: number }[] = [];
const startedSources: unknown[] = [];

class MockParam {
  value = 0;
  cancelScheduledValues() {}
  setTargetAtTime(value: number) {
    rampLog.push({ param: "setTargetAtTime", value });
  }
  linearRampToValueAtTime(_t: number) {
    rampLog.push({ param: "linearRamp", value: _t });
  }
}
class MockNode {
  connect() { return this; }
  disconnect() {}
}
class MockGain extends MockNode {
  gain = new MockParam();
}
class MockSource extends MockNode {
  buffer: unknown = null;
  loop = false;
  start() { startedSources.push(this); }
  stop() {}
}
class MockAudioContext {
  state = "running";
  currentTime = 0;
  destination = {};
  createGain() { return new MockGain(); }
  createBufferSource() { return new MockSource(); }
  createBuffer(_ch: number, len: number) { return { length: len }; }
  async decodeAudioData() { return this.createBuffer(2, 8); }
  async resume() { this.state = "running"; }
}
(globalThis as Record<string, unknown>).AudioContext = MockAudioContext;

// fetch fails for every sound → exercises the non-blocking load-error path.
(globalThis as Record<string, unknown>).fetch = async () => ({ ok: false, status: 404 });

test("no sound before a user gesture: setSessionRunning alone plays nothing", async () => {
  await ensureImports();
  ambientEngine.setSessionRunning(true);
  assert.equal(startedSources.length, 0);
});

test("prime() inside a gesture creates the context; session start ramps gains", async () => {
  await ensureImports();
  ambientEngine.prime();
  store.set("energyos:ambient", JSON.stringify({ enabled: ["rain"], master: 0.4 }));
  ambientEngine.setSessionRunning(true);
  assert.ok(rampLog.length > 0, "gain ramps scheduled on session start");
});

test("sound file load failure → non-blocking error, session unaffected", async () => {
  await ensureImports();
  let err: string | null = null;
  onAmbientError(() => { err = getAmbientLoadError(); });
  ambientEngine.setSessionRunning(true);
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(err, 'Não foi possível carregar "Som de chuva".');
  // Grace-cancel path: quick fade, no chime — engine must not throw.
  ambientEngine.fadeOutQuick();
  assert.ok(rampLog.length > 0);
});

test("fadeOutFinish (completion ~3s) and fadeOutQuick (cancel/give-up ~0.4s) both ramp to silence", async () => {
  await ensureImports();
  const before = rampLog.length;
  ambientEngine.fadeOutFinish();
  ambientEngine.fadeOutQuick();
  assert.ok(rampLog.length > before);
});
