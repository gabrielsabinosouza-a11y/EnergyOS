/**
 * Extend the rings of the Christmas PNG frames so they match the SVG
 * reference ring (the ring then overrides the profile photo, like the SVG
 * frames do).
 *
 * The candy cane, snowflake, holly and lights rings are re-sampled onto the
 * reference ring [436, 512] of the 1024x1024 display canvas:
 *   - stripes at the artwork's inner edge move out to the reference inner edge (436),
 *   - stripes at the artwork's outer edge move out to the reference outer edge (512).
 *
 * After extending, the "after" measurements are re-taken with the same
 * Chromium measurement used by scripts/frames-measure.mjs and printed with a
 * per-frame report (deviation from the reference).
 *
 * Usage: node scripts/frames-extend-rings.mjs [--only frame_xmas_candy_cane,...]
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  CANVAS,
  launchMeasurePage,
  measureFrame,
  displayPercentages,
  PNG_FRAMES,
  startPublicServer,
} from "./frame-geometry.mjs";

// The SVG reference ring of the 1024 display canvas (see frames-measure.mjs):
const TARGET_INNER = 436;
const TARGET_OUTER = 512;

// In-page function: re-samples the loaded image so its ring is the reference
// ring [inner, outer]; returns a data URL of the extended PNG.
function extendRingFn([canvasSize, src, ring]) {
  return new Promise((done, fail) => {
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = canvasSize; c.height = canvasSize;
        const ctx = c.getContext("2d");
        ctx.drawImage(img, 0, 0, canvasSize, canvasSize);
        const art = ctx.getImageData(0, 0, canvasSize, canvasSize).data;
        const out = new Uint8ClampedArray(canvasSize * canvasSize * 4);
        const C = canvasSize / 2;
        for (let y = 0; y < canvasSize; y++) {
          for (let x = 0; x < canvasSize; x++) {
            const r = Math.hypot(x - C, y - C);
            if (r >= ring.inner && r <= ring.outer) {
              const a = Math.atan2(y - C, x - C);
              // Map the target ring onto the artwork ring: stripes at the
              // artwork's inner edge appear at the target's inner edge, and
              // stripes at the artwork's outer edge at the target's outer edge.
              const r_a = ring.artInner + (r - ring.inner) * (ring.artOuter - ring.artInner)/(ring.outer - ring.inner);
              const ax = Math.round(C + r_a * Math.cos(a));
              const ay = Math.round(C + r_a * Math.sin(a));
              if (ax >= 0 && ax < canvasSize && ay >= 0 && ay < canvasSize) {
                const i = (ay * canvasSize + ax) * 4;
                const j = (y * canvasSize + x) * 4;
                out[j] = art[i]; out[j+1] = art[i+1]; out[j+2] = art[i+2]; out[j+3] = art[i+3];
              }
            }
          }
        }
        const d = document.createElement("canvas");
        d.width = canvasSize; d.height = canvasSize;
        d.getContext("2d").putImageData(new ImageData(out, canvasSize, canvasSize), 0, 0);
        done(d.toDataURL("image/png"));
      } catch (e) { fail(e); }
    };
    img.onerror = () => fail(new Error("failed to load " + src));
    img.src = src;
  });
}

function basename(p) { return p.split("/").pop(); }

function argValue(flag) {
  const idx = process.argv.indexOf(flag);
  return idx >= 0 ? process.argv[idx + 1] : null;
}

function fmt(n) { return String(Number(n.toFixed(2))).padStart(6); }

async function main() {
  const only = argValue("--only");
  const targets = PNG_FRAMES.filter((rel) => (only ? only.split(",").map((s) => s.trim()).filter(Boolean).includes(basename(rel)) : true));
  if (targets.length === 0) targets.push(...PNG_FRAMES);

  const { server, url } = await startPublicServer();
  const { browser, page } = await launchMeasurePage(url);
  try {
    for (const rel of targets) {
      const before = displayPercentages(await measureFrame(page, url, rel));
      const artInner = (before.holeH / 100) * CANVAS / 2;
      const artOuter = (before.outerH / 100) * CANVAS / 2;
      const ring = { inner: TARGET_INNER, outer: TARGET_OUTER, artInner, artOuter };
      const dataUrl = await page.evaluate(extendRingFn, [CANVAS, `${url}/${rel}`, ring]);
      writeFileSync(join("public", rel), Buffer.from(dataUrl.split(",")[1], "base64"));
      const after = displayPercentages(await measureFrame(page, url, `${rel}?t=${Date.now()}`));
      console.log(`${basename(rel).padEnd(26)} before: outerH=${fmt(before.outerH)} holeH=${fmt(before.holeH)} off=(${fmt(before.offX)},${fmt(before.offY)})`);
      console.log(`${"".padEnd(26)} after:  outerH=${fmt(after.outerH)} holeH=${fmt(after.holeH)} off=(${fmt(after.offX)},${fmt(after.offY)})  artwork ring=[${fmt(artInner)},${fmt(artOuter)}] -> target [${TARGET_INNER},${TARGET_OUTER}]`);
      const outerDev = Math.abs(after.outerH - 100);
      const holeDev = Math.abs(after.holeH - 85.25);
      if (outerDev > 3 || holeDev > 3) console.log(`  ⚠ deviations from reference: outer ${outerDev.toFixed(2)}% hole ${holeDev.toFixed(2)}%`);
    }
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
