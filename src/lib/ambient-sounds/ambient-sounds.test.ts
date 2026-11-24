import test from "node:test";
import assert from "node:assert/strict";

// Browser global stubs (tsx emits CJS: imports happen lazily inside tests,
// AFTER these stubs are in place).

const store = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};
(globalThis as Record<string, unknown>).window = globalThis;
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

const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms));

// ── Mix store: shape {enabled, volumes} — master removed ────────────────────

test("default mix: both sounds OFF, empty volumes", async () => {
  await ensureImports();
  store.clear();
  const m = readAmbientMix();
  assert.deepEqual(m.enabled, []);
  assert.deepEqual(m.volumes, {});
});

test("old stored shape migrates: master ignored, muted treated as OFF", async () => {
  await ensureImports();
  store.set("energyos:ambient", JSON.stringify({
    enabled: ["rain"], volumes: { rain: 0.5 }, master: 0.9, muted: true,
  }));
  const m = readAmbientMix();
  assert.deepEqual(m.enabled, []);
  assert.equal(m.volumes.rain, 0.5);
});

test("old stored shape without muted keeps enabled sounds + volumes", async () => {
  await ensureImports();
  store.set("energyos:ambient", JSON.stringify({
    enabled: ["rain", "fireplace"], volumes: { rain: 0.4, fireplace: 0.8 }, master: 0.3,
  }));
  const m = readAmbientMix();
  assert.deepEqual(m.enabled.sort(), ["fireplace", "rain"]);
  assert.equal(m.volumes.rain, 0.4);
  assert.equal(m.volumes.fireplace, 0.8);
});

test("corrupted localStorage falls back to defaults", async () => {
  await ensureImports();
  store.set("energyos:ambient", "{broken");
  const m = readAmbientMix();
  assert.deepEqual(m.enabled, []);
  assert.deepEqual(m.volumes, {});
});

// ── Engine with lifecycle-tracking AudioContext mock ────────────────────────
// Every created node is recorded with its REAL lifecycle state so tests can
// assert what is actually PLAYING, not just what gains were scheduled.

interface MockSourceRec {
  started: boolean;
  stopped: boolean;
  disconnected: boolean;
  loop: boolean;
  onended: (() => void) | null;
}
const allSources: MockSourceRec[] = [];
const allGains: { id: number; lastTarget: number; disconnected: boolean }[] = [];
let gainSeq = 0;
let ctxSeq = 0;

class MockParam {
  value = 0;
  lastTarget = 0;
  cancelScheduledValues() {}
  setTargetAtTime(v: number) { this.lastTarget = v; this.value = v; }
  linearRampToValueAtTime(v: number) { this.lastTarget = v; this.value = v; }
}
class MockNode {
  connect() { return this; }
  disconnect() {}
}
class MockGain extends MockNode {
  id = ++gainSeq;
  gain = new MockParam();
  constructor() {
    super();
    allGains.push({ id: this.id, lastTarget: 0, disconnected: false });
  }
  disconnect() {
    const rec = allGains.find((g) => g.id === this.id);
    if (rec) rec.disconnected = true;
  }
}
class MockSource extends MockNode {
  buffer: unknown = null;
  loop = false;
  started = false;
  stopped = false;
  disconnected = false;
  onended: (() => void) | null = null;
  constructor() {
    super();
    allSources.push(this as unknown as MockSourceRec);
  }
  start() { this.started = true; }
  stop() {
    this.stopped = true;
    this.onended?.();
  }
  disconnect() { this.disconnected = true; }
}
class MockAudioContext {
  id = ++ctxSeq;
  state = "running";
  currentTime = 0;
  destination = {};
  closed = false;
  createGain() { return new MockGain(); }
  createBufferSource() { return new MockSource(); }
  createBuffer(_ch: number, len: number) { return { length: len }; }
  async decodeAudioData() { return this.createBuffer(2, 8); }
  async resume() { this.state = "running"; }
  async close() { this.closed = true; this.state = "closed"; }
}

function resetEngine() {
  ambientEngine.resetForTests();
  allSources.length = 0;
  allGains.length = 0;
  store.clear();
}

function liveSources() {
  return allSources.filter((s) => s.started && !s.stopped);
}

function writeMix(mix: object) {
  store.set("energyos:ambient", JSON.stringify(mix));
  ambientEngine.updateMix(mix as never);
}

test("load failure still non-blocking (must run before buffers are cached)", async () => {
  await ensureImports();
  resetEngine();
  (globalThis as Record<string, unknown>).fetch = async () => ({ ok: false, status: 404 });
  let err: string | null = null;
  onAmbientError(() => { err = getAmbientLoadError(); });
  writeMix({ enabled: ["fireplace"], volumes: {} });
  await ambientEngine.preview("fireplace");
  await tick(30);
  assert.ok(err !== null);
  (globalThis as Record<string, unknown>).fetch = async () => ({
    ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(8),
  });
});

// ── Playing-state tests: these FAIL if a sound leaks or double-plays ────────

test("only rain enabled + session start: rain plays, fireplace has ZERO sources", async () => {
  await ensureImports();
  resetEngine();
  ambientEngine.prime();
  store.set("energyos:ambient", JSON.stringify({ enabled: ["rain"], volumes: { rain: 0.6 } }));
  ambientEngine.setSessionRunning(true);
  await tick(50);

  const counts = ambientEngine.debugActiveSources();
  assert.equal(counts.rain, 1, "rain must have exactly one live source");
  assert.ok(!counts.fireplace, "fireplace must have NO source when not enabled");
  assert.equal(liveSources().length, 1, "exactly one source playing total");
});

test("both enabled: two independent sources; rain slider moves only rain's gain", async () => {
  await ensureImports();
  resetEngine();
  ambientEngine.prime();
  store.set("energyos:ambient", JSON.stringify({
    enabled: ["rain", "fireplace"], volumes: { rain: 0.5, fireplace: 0.7 },
  }));
  ambientEngine.setSessionRunning(true);
  await tick(50);

  const counts = ambientEngine.debugActiveSources();
  assert.equal(counts.rain, 1);
  assert.equal(counts.fireplace, 1);
  assert.equal(liveSources().length, 2);

  // Rain slider -> 0.9. Fireplace gain must be untouched.
  writeMix({ enabled: ["rain", "fireplace"], volumes: { rain: 0.9, fireplace: 0.7 } });
  await tick(20);
  const gains = ambientEngine.debugGainValues();
  assert.ok(gains.rain > 0.8, `rain gain should follow slider, got ${gains.rain}`);
  assert.ok(gains.fireplace > 0.6 && gains.fireplace < 0.8,
    `fireplace gain must stay ~0.7, got ${gains.fireplace}`);
});

test("toggle fireplace OFF mid-session: its source stops+disconnects, count -> 0", async () => {
  await ensureImports();
  resetEngine();
  ambientEngine.prime();
  store.set("energyos:ambient", JSON.stringify({
    enabled: ["rain", "fireplace"], volumes: {},
  }));
  ambientEngine.setSessionRunning(true);
  await tick(50);
  assert.equal(liveSources().length, 2);

  writeMix({ enabled: ["rain"], volumes: {} });
  await tick(900); // fade 500ms + stop delay

  const counts = ambientEngine.debugActiveSources();
  assert.equal(counts.rain, 1, "rain keeps playing");
  assert.ok(!counts.fireplace, "fireplace source must be stopped and cleared");
  assert.equal(liveSources().length, 1);
});

test("slider at 0 keeps sound enabled but gain is ~0 (truly silent)", async () => {
  await ensureImports();
  resetEngine();
  ambientEngine.prime();
  store.set("energyos:ambient", JSON.stringify({
    enabled: ["rain"], volumes: { rain: 0.5 },
  }));
  ambientEngine.setSessionRunning(true);
  await tick(50);

  writeMix({ enabled: ["rain"], volumes: { rain: 0 } });
  await tick(50);
  const gains = ambientEngine.debugGainValues();
  assert.ok(gains.rain <= 0.001, `rain gain must be ~0, got ${gains.rain}`);
  assert.equal(ambientEngine.debugActiveSources().rain, 1, "source stays alive while enabled");
});

test("silence(): all sources stopped, previews cleared, volumes preserved", async () => {
  await ensureImports();
  resetEngine();
  ambientEngine.prime();
  store.set("energyos:ambient", JSON.stringify({
    enabled: ["rain", "fireplace"], volumes: { rain: 0.4, fireplace: 0.9 },
  }));
  ambientEngine.setSessionRunning(true);
  await tick(50);
  assert.equal(liveSources().length, 2);

  // Same sequence store.silence() performs: enabled -> [] then engine.silence().
  store.set("energyos:ambient", JSON.stringify({ enabled: [], volumes: { rain: 0.4, fireplace: 0.9 } }));
  ambientEngine.silence();
  await tick(900);

  const counts = ambientEngine.debugActiveSources();
  assert.equal(counts.rain ?? 0, 0);
  assert.equal(counts.fireplace ?? 0, 0);
  assert.equal(liveSources().length, 0, "no source may remain playing after Silenciar");
  // Volumes preserved in the persisted mix.
  const m = readAmbientMix();
  assert.deepEqual(m.enabled, []);
  assert.equal(m.volumes.rain, 0.4);
  assert.equal(m.volumes.fireplace, 0.9);
});

test("re-enable during fade-out cancels the pending stop (no dead voice)", async () => {
  await ensureImports();
  resetEngine();
  ambientEngine.prime();
  store.set("energyos:ambient", JSON.stringify({ enabled: ["rain"], volumes: {} }));
  ambientEngine.setSessionRunning(true);
  await tick(50);

  // Toggle OFF -> fade+stop scheduled (~700ms). Re-enable at ~200ms.
  writeMix({ enabled: [], volumes: {} });
  await tick(200);
  writeMix({ enabled: ["rain"], volumes: {} });
  await tick(800); // past the original stop deadline

  assert.equal(ambientEngine.debugActiveSources().rain, 1,
    "re-enabled sound must still have a live source");
  assert.equal(liveSources().length, 1);
  const src = allSources[allSources.length - 1];
  assert.ok(!src.stopped, "source must not have been stopped by the cancelled fade");
});

test("preview: only the previewed sound plays; slider move live, no restart", async () => {
  await ensureImports();
  resetEngine();
  ambientEngine.prime();
  store.set("energyos:ambient", JSON.stringify({ enabled: [], volumes: {} }));
  await ambientEngine.preview("rain");
  await tick(30);

  const counts = ambientEngine.debugActiveSources();
  assert.equal(counts.rain, 1, "preview creates exactly one rain source");
  assert.ok(!counts.fireplace, "fireplace must not play");
  assert.equal(liveSources().length, 1);

  // Slider move during preview: same source, gain re-ramped, NOT restarted.
  const srcBefore = allSources.length;
  writeMix({ enabled: ["rain"], volumes: { rain: 0.8 } });
  await tick(30);
  assert.equal(allSources.length, srcBefore, "preview must not spawn a second source");
  assert.equal(ambientEngine.debugActiveSources().rain, 1);
});

test("preview ends after ~4s: source stopped and cleared", async () => {
  await ensureImports();
  resetEngine();
  ambientEngine.prime();
  store.set("energyos:ambient", JSON.stringify({ enabled: ["rain"], volumes: {} }));
  await ambientEngine.preview("rain");
  await tick(4600);
  assert.ok(!ambientEngine.debugActiveSources().rain,
    "preview source must be gone after the ~4s window");
  assert.equal(liveSources().length, 0);
});

test("singleton: engine lives on globalThis — HMR cannot duplicate it", async () => {
  await ensureImports();
  assert.equal(
    (globalThis as Record<string, unknown>).__energyosAmbientEngine,
    ambientEngine,
    "engine must be the globalThis singleton",
  );
});
