/**
 * Normalize seasonal frame PNGs to the geometry of the SVG reference frames.
 *
 * For each PNG frame (currently the Christmas ones) this script:
 *   1. backs up the original to public/assets/seasons/christmas/frames/_originals/,
 *   2. trims the transparent padding,
 *   3. re-centers the ring on the canvas,
 *   4. scales the ring so its OUTER diameter matches the SVG reference outer
 *      diameter (measured in scripts/frames-measure.mjs),
 *   5. keeps decorations inside the canvas with a margin (shrinks slightly if
 *      they would overflow),
 *   6. re-exports a 1024x1024 transparent PNG and re-measures it with the
 *      Chromium measurement used by scripts/frames-verify.mjs.
 *
 * Writes the updated "after" geometry into scripts/.frames-geometry.json and
 * prints a per-frame report (e.g. when a ring ends up too thick for its hole
 * — those are left as-is for manual decision, never shrunk).
 *
 * Usage: node scripts/frames-normalize.mjs [--only frame_xmas_candy_cane,...]
 *        node scripts/frames-normalize.mjs --dry-run
 */
import sharp from "sharp";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { measure, ROOT, CANVAS, FRAMES } from "./frames-measure.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const GEOMETRY_JSON = join(ROOT, "scripts/.frames-geometry.json");
const BACKUP_DIR = "public/assets/seasons/christmas/frames/_originals";
const TOL = 12;
const MARGIN = 6; // safety margin to canvas edge for decorations

function argValues(flag) {
  const idx = process.argv.indexOf(flag);
  return idx >= 0 ? process.argv[idx + 1] : null;
}

function parseOnly() {
  const v = argValues("--only");
  return v ? v.split(",").map((s) => s.trim()).filter(Boolean) : null;
}

async function normalizePng(rel, refOuterDiameterPct) {
  const srcPath = join(ROOT, "public", rel);
  const backupPath = join(ROOT, BACKUP_DIR, rel);
  mkdirSync(dirname(backupPath), { recursive: true });
  copyFileSync(srcPath, backupPath);

  const raw = readFileSync(srcPath);
  const { data, info } = await sharp(raw)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;

  let minX = W, minY = H, maxX = -1, maxY = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (data[y * W + x] > TOL) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return { note: "no visible pixels", bbox: null };

  const bw = maxX - minX + 1, bh = maxY - minY + 1;
  const targetOuterPx = (refOuterDiameterPct / 100) * CANVAS;
  const scale = targetOuterPx / Math.max(bw, bh);

  // Recenter the scaled content: its bbox center must sit at canvas center.
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

  const cropped = await sharp(raw)
    .extract({ left: minX, top: minY, width: bw, height: bh })
    .resize(sw, sh, { fit: "fill", kernel: "lanczos3" })
    .raw()
    .toBuffer();

  const canvasBuf = Buffer.alloc(CANVAS * CANVAS * 4, 0);
  const rowBytes = sw * 4;
  for (let y = 0; y < sh; y++) {
    cropped.copy(canvasBuf, ((destY + y) * CANVAS + destX) * 4, y * rowBytes, y * rowBytes + rowBytes);
  }
  await sharp(canvasBuf, { raw: { width: CANVAS, height: CANVAS, channels: 4 } })
    .png()
    .toFile(srcPath);

  return {
    bbox: { left: minX, top: minY, width: bw, height: bh },
    scale,
    scaled: { width: sw, height: sh },
    offset: { x: destX, y: destY },
  };
}

async function main() {
  const only = parseOnly();
  const dry = argValues("--dry-run") !== null;
  const geo = JSON.parse(readFileSync(GEOMETRY_JSON, "utf8"));
  const ref = geo.svg.reference;

  for (const [name, rel] of Object.entries(FRAMES.png)) {
    if (only && !only.includes(name)) continue;
    const before = geo.png.frames[name]?.before ?? geo.png.frames[name] ?? null;
    if (dry) {
      console.log(`[dry] ${name}: would normalize ${rel} to outer ${ref.outerDiameterPct}% (before: ${before?.outerDiameterPct}%)`);
      continue;
    }
    const res = await normalizePng(rel, ref.outerDiameterPct);
    const entry = geo.png.frames[name] ??= {};
    if (before) entry.before = before;
    const browser = await import("playwright-core").then((m) => m.chromium.launch({ headless: true }));
    const page = await browser.newPage({ viewport: { width: CANVAS, height: CANVAS } });
    const after = await measure(page, rel);
    await browser.close();
    entry.after = {
      outerDiameterPct: Number(((after.outerDiameter / CANVAS) * 100).toFixed(2)),
      innerHoleDiameterPct: Number(((after.innerHoleDiameter / CANVAS) * 100).toFixed(2)),
      centerOffsetX: after.offX,
      centerOffsetY: after.offY,
    };
    entry.report = [];
    if (Math.abs(entry.after.outerDiameterPct - ref.outerDiameterPct) > 0.5) {
      entry.report.push(`outer ${entry.after.outerDiameterPct}% != reference ${ref.outerDiameterPct}%`);
    }
    const holeAfter = entry.after.innerHoleDiameterPct;
    const holeRef = ref.innerHoleDiameterPct;
    if (holeAfter < holeRef - 0.5) {
      entry.report.push(`ring too thick: inner hole after ${holeAfter}% < reference ${holeRef}%`);
    }
    entry.normalized = { scale: res.scale, scaled: res.scaled, offset: res.offset };

    console.log(`\n${name} (${rel})`);
    console.log(`  before: outer=${entry.before?.outerDiameterPct ?? "?"}% hole=${entry.before?.innerHoleDiameterPct ?? "?"}% offset=(${entry.before?.centerOffsetX ?? "?"},${entry.before?.centerOffsetY ?? "?"})`);
    console.log(`  after : outer=${entry.after.outerDiameterPct}% hole=${entry.after.innerHoleDiameterPct}% offset=(${entry.after.centerOffsetX},${entry.after.centerOffsetY})`);
    console.log(`  scale=${res.scale.toFixed(4)} scaled=${JSON.stringify(res.scaled)} offset=${JSON.stringify(res.offset)}`);
  }
  writeFileSync(GEOMETRY_JSON, JSON.stringify(geo, null, 2));
  console.log(`\nwrote ${GEOMETRY_JSON}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
