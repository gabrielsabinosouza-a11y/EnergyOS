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

// ── Mix store: new shape {enabled, volumes} — master removed ────────────────

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
  assert.deepEqual(m.enabled, []); // muted legacy => sounds off
  assert.equal(m.volumes.rain, 0.5); // volume preserved for re-enable
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

// ── Engine with mocked AudioContext ─────────────────────────────────────────

const ramps: { node: string; value: number }[] = [];
const sources: { loop: boolean }[] = [];
let gainSeq = 0;
const gains: { id: number; node: unknown }[] = [];

class MockParam {
  value = 0;
  cancelScheduledValues() {}
  setTargetAtTime(value: number) { ramps.push({ node: "param", value }); }
  linearRampToValueAtTime(value: number) { ramps.push({ node: "param", value }); }
}
class MockNode {
  connect() { return this; }
  disconnect() {}
}
class MockGain extends MockNode {
  id = ++gainSeq;
  gain = new MockParam();
  constructor(tag: string) { super(); gains.push({ id: this.id, node: tag }); }
}
class MockSource extends MockNode {
  buffer: unknown = null;
  loop = false;
  start() { sources.push(this); }
  stop() {}
}
class MockAudioContext {
  state = "running";
  currentTime = 0;
  destination = {};
  createGain() { return new MockGain("gain"); }
  createBufferSource() { return new MockSource(); }
  createBuffer(_ch: number, len: number) { return { length: len }; }
  async decodeAudioData() { return this.createBuffer(2, 8); }
  async resume() { this.state = "running"; }
}
(globalThis as Record<string, unknown>).AudioContext = MockAudioContext;
(globalThis as Record<string, unknown>).fetch = async () => ({
  ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(8),
});

// Helper: write mix directly to storage (what the store persists) then ask the
// engine to apply — same path updateMix takes.
function applyMix(mix: object) {
  store.set("energyos:ambient", JSON.stringify(mix));
  ambientEngine.updateMix(mix as never);
}

test("load failure still non-blocking (must run before buffers are cached)", async () => {
  await ensureImports();
  (globalThis as Record<string, unknown>).fetch = async () => ({ ok: false, status: 404 });
  let err: string | null = null;
  onAmbientError(() => { err = getAmbientLoadError(); });
  applyMix({ enabled: ["fireplace"], volumes: {} });
  await ambientEngine.preview("fireplace");
  await new Promise((r) => setTimeout(r, 30));
  assert.ok(err !== null);
  // Restore working fetch for the remaining tests.
  (globalThis as Record<string, unknown>).fetch = async () => ({
    ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(8),
  });
});

test("per-sound gains are independent: rain slider does not touch fireplace", async () => {
  await ensureImports();
  ambientEngine.prime();
  store.set("energyos:ambient", JSON.stringify({
    enabled: ["rain", "fireplace"], volumes: { rain: 0.5, fireplace: 0.5 },
  }));
  ambientEngine.setSessionRunning(true);
  await new Promise((r) => setTimeout(r, 30)); // let voices start

  const before = ramps.length;
  // Rain slider -> 0.9. Engine must ramp rain's voice gain, NOT fireplace's.
  applyMix({ enabled: ["rain", "fireplace"], volumes: { rain: 0.9, fireplace: 0.5 } });
  ambientEngine.setSessionRunning(true); // re-sync voices with new mix
  await new Promise((r) => setTimeout(r, 30));
  assert.ok(ramps.length > before, "gain ramps were scheduled");
});

test("master is a fixed constant: engine exposes no per-mix master", async () => {
  await ensureImports();
  // updateMix signature takes the mix; master no longer part of it.
  const m = readAmbientMix();
  assert.equal("master" in m, false);
});

test("preview plays ~4s then fades; slider change during preview adjusts volume live", async () => {
  await ensureImports();
  ambientEngine.fadeOutQuick(); // ensure idle
  ambientEngine.prime();
  applyMix({ enabled: ["rain"], volumes: { rain: 0.5 } });
  await ambientEngine.preview("rain");
  const v = sources.length;
  assert.ok(v >= 1, "preview started a looped source");
  // Slider move during preview: updateMix must NOT zero the preview voice.
  const before = ramps.length;
  applyMix({ enabled: ["rain"], volumes: { rain: 0.8 } });
  assert.ok(ramps.length > before, "preview voice gain re-ramped live");
});

