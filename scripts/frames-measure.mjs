/**
 * Measure the geometry of avatar frames: the bounding box of visible pixels
 * and the ring's outer diameter / inner hole diameter, sampled along the
 * horizontal and vertical center lines. Percentages are of the canvas width.
 *
 * Renders each frame to 1024x1024 (SVG sources rasterized by Chromium) and
 * compares SVG frames against the seasonal PNG frames.
 *
 * Usage: node scripts/frames-measure.mjs [--out path/to/geometry.json]
 */
import { chromium } from "playwright-core";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const CANVAS = 1024;

const FRAMES = {
  svg: {
    frame_fire: "decorations/frame_fire.svg",
    frame_crystal: "decorations/frame_crystal.svg",
    frame_aura: "decorations/frame_aura.svg",
    frame_nucleo: "decorations/frame_nucleo.svg",
    frame_nature: "decorations/frame_nature.svg",
    frame_electric: "decorations/frame_electric.svg",
    frame_cosmic: "decorations/frame_cosmic.svg",
    frame_diamond: "decorations/frame_diamond.svg",
  },
  png: {
    frame_xmas_candy_cane: "assets/seasons/christmas/frames/frame_xmas_candy_cane.png",
    frame_xmas_snowflake: "assets/seasons/christmas/frames/frame_xmas_snowflake.png",
    frame_xmas_holly: "assets/seasons/christmas/frames/frame_xmas_holly.png",
    frame_xmas_lights: "assets/seasons/christmas/frames/frame_xmas_lights.png",
  },
};

const MEASURE_FN = (canvas) => {
  const img = document.getElementById("f");
  const c = document.createElement("canvas");
  c.width = canvas; c.height = canvas;
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, canvas, canvas);
  ctx.drawImage(img, 0, 0, canvas, canvas);
  const data = ctx.getImageData(0, 0, canvas, canvas).data;
  const TOL = 12;
  const isVisible = (x, y) => data[(y * canvas + x) * 4 + 3] > TOL;
  const C = canvas / 2;

  // Horizontal center line (y = C): outer span + hole diameter.
  const hVals = [];
  for (let x = 0; x < canvas; x++) if (isVisible(x, C)) hVals.push(x);
  const hOuter = hVals.length ? Math.max(...hVals) - Math.min(...hVals) + 1 : 0;
  const scanH = (dir) => {
    for (let r = 0; r <= C; r++) {
      const x = Math.round(C + dir * r);
      if (x >= 0 && x < canvas && isVisible(x, C)) return r;
    }
    return C;
  };
  const hHole = scanH(-1) + scanH(1) + 2;

  // Vertical center line (x = C): outer span + hole diameter.
  const vVals = [];
  for (let y = 0; y < canvas; y++) if (isVisible(C, y)) vVals.push(y);
  const vOuter = vVals.length ? Math.max(...vVals) - Math.min(...vVals) + 1 : 0;
  const scanV = (dir) => {
    for (let r = 0; r <= C; r++) {
      const y = Math.round(C + dir * r);
      if (y >= 0 && y < canvas && isVisible(C, y)) return r;
    }
    return C;
  };
  const vHole = scanV(-1) + scanV(1) + 2;

  const outerDiameter = Math.max(hOuter, vOuter);
  const innerHoleDiameter = Math.min(hHole, vHole);

  // Visible-pixel bbox center offset from canvas center.
  let bx0 = Infinity, bx1 = -Infinity, by0 = Infinity, by1 = -Infinity;
  for (let x = 0; x < canvas; x++) if (isVisible(x, C)) { bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); }
  for (let y = 0; y < canvas; y++) if (isVisible(C, y)) { by0 = Math.min(by0, y); by1 = Math.max(by1, y); }
  const offX = Number.isFinite(bx0) ? (bx0 + bx1) / 2 - C : 0;
  const offY = Number.isFinite(by0) ? (by0 + by1) / 2 - C : 0;
  return { outerDiameter, innerHoleDiameter, offX, offY };
};

function dataUrl(rel) {
  const raw = readFileSync(join(ROOT, "public", rel));
  const mime = rel.endsWith(".svg") ? "svg+xml" : "png";
  return `data:image/${mime};base64,${raw.toString("base64")}`;
}

function median(vals) {
  const sorted = [...vals].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

async function measure(page, rel) {
  const url = dataUrl(rel);
  await page.setContent(
    `<!DOCTYPE html><html><body style="margin:0"><img id="f" src="${url}" width="${CANVAS}" height="${CANVAS}"></body></html>`,
    { waitUntil: "load" },
  );
  await page.waitForFunction(`document.getElementById("f") && document.getElementById("f").complete && document.getElementById("f").naturalWidth > 0`);
  return page.evaluate(MEASURE_FN, CANVAS);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: CANVAS, height: CANVAS } });

  const results = { svg: { frames: {} }, png: { frames: {} } };
  for (const [kind, frames] of Object.entries(FRAMES)) {
    const outerVals = [], innerVals = [], offXs = [], offYs = [];
    for (const [name, rel] of Object.entries(frames)) {
      const r = await measure(page, rel);
      results[kind].frames[name] = {
        outerDiameterPct: Number(((r.outerDiameter / CANVAS) * 100).toFixed(2)),
        innerHoleDiameterPct: Number(((r.innerHoleDiameter / CANVAS) * 100).toFixed(2)),
        centerOffsetX: r.offX,
        centerOffsetY: r.offY,
      };
      outerVals.push(r.outerDiameter);
      innerVals.push(r.innerHoleDiameter);
      offXs.push(r.offX);
      offYs.push(r.offY);
    }
    results[kind].reference = {
      outerDiameterPct: Number(((median(outerVals) / CANVAS) * 100).toFixed(2)),
      innerHoleDiameterPct: Number(((median(innerVals) / CANVAS) * 100).toFixed(2)),
      centerOffsetX: median(offXs),
      centerOffsetY: median(offYs),
    };
  }

  await browser.close();
  const outIdx = process.argv.indexOf("--out");
  const out = resolve(outIdx >= 0 ? process.argv[outIdx + 1] : join(ROOT, "scripts/.frames-geometry.json"));
  writeFileSync(out, JSON.stringify(results, null, 2));
  console.log(`wrote ${out}`);
  return results;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => { console.error(e); process.exit(1); });
}

// Exported for normalize/verify scripts.
export { measure, main, ROOT, CANVAS, FRAMES };
