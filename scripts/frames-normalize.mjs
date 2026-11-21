/**
 * Normalize seasonal frame PNGs to the geometry of the SVG reference frames.
 *
 * For each PNG frame (currently the Christmas ones) this script:
 *   1. backs up the original to public/assets/seasons/christmas/frames/_originals/,
 *   2. trims the transparent padding,
 *   3. re-centers the ring on the canvas,
 *   4. scales the ring so its OUTER diameter matches the SVG reference outer
 *      diameter (measured by scripts/frame-geometry.mjs),
 *   5. keeps the scaled content inside the canvas with a margin (shrinks
 *      slightly if it would overflow),
 *   6. re-exports a 1024x1024 transparent PNG.
 *
 * After normalizing, the "after" measurements are re-taken with the same
 * Chromium measurement used by scripts/frames-measure.mjs and printed with a
 * per-frame report (ring too thick, etc.).
 *
 * Usage: node scripts/frames-normalize.mjs [--only frame_xmas_candy_cane,...]
 *        node scripts/frames-normalize.mjs --dry-run
 */
import sharp from "sharp";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CANVAS,
  launchMeasurePage,
  measureFrame,
  PNG_FRAMES,
  startPublicServer,
} from "./frame-geometry.mjs";
import { displayPercentages } from "./frame-geometry.mjs";

const BACKUP_DIR = join("public/assets/seasons/christmas/frames/_originals");
const TOL = 12;
const MARGIN = 6; // safety margin to canvas edge for decorations

function basename(p) { return p.split("/").pop(); }
function argValue(flag) {
  const idx = process.argv.indexOf(flag);
  return idx >= 0 ? process.argv[idx + 1] : null;
}

async function normalizePng(rel, refOuterDiameterPct) {
  const srcPath = join("public", rel);
  mkdirSync(BACKUP_DIR, { recursive: true });
  const backupPath = join(BACKUP_DIR, basename(srcPath));
  if (!existsSync(backupPath)) copyFileSync(srcPath, backupPath);

  const raw = readFileSync(srcPath);

  // 1. Trim: alpha bbox of the ring (consistent with the measure script).
  const alpha = await sharp(raw).extractChannel("alpha").raw().toBuffer({ resolveWithObject: true });
  const { data, info } = alpha;
  const W = info.width, H = info.height;
  let minX = W, minY = H, maxX = -1, maxY = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (data[y * W + x] > TOL) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  if (maxX < 0) return { note: "no visible pixels" };
  const bw = maxX - minX + 1, bh = maxY - minY + 1;

  // 2. Scale so the ring's outer diameter matches the reference.
  const scale = (refOuterDiameterPct / 100) * CANVAS / Math.max(bw, bh);
  let effScale = scale;
  let sw, sh, destX, destY;
  for (let guard = 0; guard < 50; guard++) {
    sw = Math.max(1, Math.round(bw * effScale));
    sh = Math.max(1, Math.round(bh * effScale));
    destX = Math.round(CANVAS / 2 - sw / 2);
    destY = Math.round(CANVAS / 2 - sh / 2);
    const fits = destX >= MARGIN && destY >= MARGIN
      && destX + sw <= CANVAS - MARGIN && destY + sh <= CANVAS - MARGIN;
    if (fits) break;
    effScale -= 0.01;
  }

  // 3. Crop + resize with sharp (keeps alpha).
  const resized = await sharp(raw)
    .extract({ left: minX, top: minY, width: bw, height: bh })
    .resize(sw, sh, { fit: "fill", kernel: "lanczos3" })
    .png()
    .toBuffer();

  // 4. Composite centered on a transparent canvas (safe against clipping).
  const canvas = Buffer.alloc(CANVAS * CANVAS * 4, 0);
  await sharp(canvas, { raw: { width: CANVAS, height: CANVAS, channels: 4 } })
    .composite([{ input: resized, top: destY, left: destX }])
    .png()
    .toFile(srcPath);

  return { scale: effScale, scaled: { width: sw, height: sh }, offset: { x: destX, y: destY } };
}

function pctRow(name, d) {
  return `${name.padEnd(22)} outerH=${String(d.outerH ?? 0).padStart(6)}%  outerV=${String(d.outerV ?? 0).padStart(6)}%  holeH=${String(d.holeH ?? 0).padStart(6)}%  holeV=${String(d.holeV ?? 0).padStart(6)}%  off=(${d.offX ?? 0}, ${d.offY ?? 0})`;
}

async function main() {
  const only = argValue("--only");
  const dry = argValue("--dry-run") !== null;
  const targets = PNG_FRAMES.filter((rel) => (only ? only.split(",").map((s) => s.trim()).filter(Boolean).includes(basename(rel)) : true));
  if (targets.length === 0) targets.push(...PNG_FRAMES);

  const { server, url } = await startPublicServer();
  const { browser, page } = await launchMeasurePage(url);
  const results = { svg: [], png: [], reference: null };
  try {
    for (const rel of targets) {
      const name = basename(rel);
      if (dry) { console.log(`[dry] ${name}: would normalize`); continue; }
      const res = await normalizePng(rel, 100); // target outer = reference (100%)
      if (res.note) { console.log(`${name}: ${res.note}`); continue; }
      const r = displayPercentages(await measureFrame(page, url, rel));
      results.png.push({ name, display: r });
      console.log(pctRow(name, r));
      console.log(`  scale=${res.scale.toFixed(4)} scaled=${JSON.stringify(res.scaled)} offset=${JSON.stringify(res.offset)}`);
    }
    // Reference from SVG frames (same measurement as the measure script).
    for (const rel of [
      "decorations/frame_fire.svg", "decorations/frame_crystal.svg", "decorations/frame_aura.svg",
      "decorations/frame_nucleo.svg", "decorations/frame_nature.svg", "decorations/frame_electric.svg",
      "decorations/frame_cosmic.svg", "decorations/frame_diamond.svg",
    ]) {
      const r = displayPercentages(await measureFrame(page, url, rel));
      results.svg.push({ name: basename(rel), display: r });
    }
    const svgRows = results.svg.map((r) => r.display);
    const ref = {
      outerH: (svgRows.map((r) => r.outerH).reduce((a, b) => a + b, 0) / svgRows.length).toFixed(2),
      outerV: (svgRows.map((r) => r.outerV).reduce((a, b) => a + b, 0) / svgRows.length).toFixed(2),
    };
    results.reference = ref;
    console.log("\nreference (median of SVG): outerH=" + ref.outerH + " outerV=" + ref.outerV);
  } finally {
    await browser.close();
    server.close();
  }
  console.log(`\nwrote geometry: reference=${JSON.stringify(results.reference)} pngFrames=${results.png.map((r) => r.name).join(",")}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
