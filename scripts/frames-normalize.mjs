/**
 * Normalize seasonal frame PNGs to the geometry of the SVG reference frames.
 *
 * For each PNG frame (currently the Christmas ones) this script:
 *   1. backs up the original to public/assets/seasons/christmas/frames/_originals/,
 *   2. trims the transparent padding,
 *   3. re-centers the ring on the canvas,
 *   4. scales the ring so its OUTER diameter matches the SVG reference outer
 *      diameter (measured in scripts/frames-measure.mjs),
 *   5. keeps the scaled content inside the canvas with a margin (shrinks
 *      slightly if it would overflow),
 *   6. re-exports a 1024x1024 transparent PNG and re-measures it with the
 *      Chromium measurement used by scripts/frames-verify.mjs.
 *
 * Writes the updated "after" geometry into scripts/.frames-geometry.json and
 * prints a per-frame report. Rings whose inner hole ends up smaller than the
 * reference hole are REPORTED (the user decides — never shrunk silently).
 *
 * Usage: node scripts/frames-normalize.mjs [--only frame_xmas_candy_cane,...]
 *        node scripts/frames-normalize.mjs --dry-run
 */
import sharp from "sharp";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { measure, ROOT, CANVAS, FRAMES } from "./frames-measure.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const GEOMETRY_JSON = join(ROOT, "scripts/.frames-geometry.json");
const BACKUP_DIR = join(ROOT, "public/assets/seasons/christmas/frames/_originals");
const TOL = 12;
const MARGIN = 6; // safety margin to canvas edge for decorations

function basename(p) { return p.split("/").pop(); }
function argValue(flag) {
  const idx = process.argv.indexOf(flag);
  return idx >= 0 ? process.argv[idx + 1] : null;
}

async function normalizePng(rel, refOuterDiameterPct) {
  const srcPath = join(ROOT, "public", rel);
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

  return {
    scale: effScale,
    scaled: { width: sw, height: sh },
    offset: { x: destX, y: destY },
  };
}

async function main() {
  const only = argValue("--only");
  const dry = argValue("--dry-run") !== null;
  const geo = JSON.parse(readFileSync(GEOMETRY_JSON, "utf8"));
  const ref = geo.svg.reference;

  for (const [name, rel] of Object.entries(FRAMES.png)) {
    if (only && !only.split(",").map((s) => s.trim()).filter(Boolean).includes(name)) continue;
    const prev = geo.png.frames[name] ?? null;
    const before = prev?.before ?? prev;
    if (dry) {
      console.log(`[dry] ${name}: would normalize ${rel} to outer ${ref.outerDiameterPct}% (before: ${before?.outerDiameterPct ?? "?"}%)`);
      continue;
    }

    const res = await normalizePng(rel, ref.outerDiameterPct);

    const browser = await import("playwright-core").then((m) => m.chromium.launch({ headless: true }));
    const page = await browser.newPage({ viewport: { width: CANVAS, height: CANVAS } });
    const after = await measure(page, rel);
    await browser.close();

    const afterPct = {
      outerDiameterPct: Number(((after.outerDiameter / CANVAS) * 100).toFixed(2)),
      innerHoleDiameterPct: Number(((after.innerHoleDiameter / CANVAS) * 100).toFixed(2)),
      centerOffsetX: after.offX,
      centerOffsetY: after.offY,
    };
    const report = [];
    if (Math.abs(afterPct.outerDiameterPct - ref.outerDiameterPct) > 0.5) {
      report.push(`outer ${afterPct.outerDiameterPct}% != reference ${ref.outerDiameterPct}%`);
    }
    if (afterPct.innerHoleDiameterPct < ref.innerHoleDiameterPct - 0.5) {
      report.push(`ring too thick: inner hole after ${afterPct.innerHoleDiameterPct}% < reference ${ref.innerHoleDiameterPct}%`);
    }

    geo.png.frames[name] = {
      before,
      after: afterPct,
      report,
      normalized: res?.note ? null : res,
    };
    console.log(`\n${name} (${rel})`);
    console.log(`  before: outer=${before?.outerDiameterPct ?? "?"}% hole=${before?.innerHoleDiameterPct ?? "?"}% offset=(${before?.centerOffsetX ?? "?"},${before?.centerOffsetY ?? "?"})`);
    console.log(`  after : outer=${afterPct.outerDiameterPct}% hole=${afterPct.innerHoleDiameterPct}% offset=(${afterPct.centerOffsetX},${afterPct.centerOffsetY})`);
    console.log(`  scale=${(geo.png.frames[name].normalized?.scale ?? 0).toFixed(4)} scaled=${JSON.stringify(geo.png.frames[name].normalized?.scaled)} offset=${JSON.stringify(geo.png.frames[name].normalized?.offset)}`);
    if (report.length) console.log(`  REPORT: ${report.join("; ")}`);
  }
  writeFileSync(GEOMETRY_JSON, JSON.stringify(geo, null, 2));
  console.log(`\nwrote ${GEOMETRY_JSON}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
