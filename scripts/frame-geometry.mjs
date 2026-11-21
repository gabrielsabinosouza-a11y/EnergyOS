/**
 * Shared geometry measurement for avatar frames.
 *
 * Rasterizes each frame asset to a 1024x1024 canvas in headless Chromium and
 * measures, from the alpha channel along the horizontal and vertical center
 * lines:
 *   - the bounding box of the visible pixels,
 *   - the ring's outer diameter (span of visible pixels on each center line),
 *   - the inner hole diameter (transparent run around the canvas center),
 *   - the center offset of the visible span from the canvas center.
 *
 * A tiny in-process static file server serves `public/` so the images are
 * same-origin and canvas reads are not tainted (file:// images taint the
 * canvas and getImageData throws).
 */
import { chromium } from "playwright-core";
import { createServer } from "node:http";
import { createReadStream, statSync } from "node:fs";
import { extname, isAbsolute, join, normalize, relative, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(HERE, "..");
export const PUBLIC_DIR = join(ROOT, "public");
export const CANVAS = 1024;

export const SVG_FRAMES = [
  "decorations/frame_fire.svg",
  "decorations/frame_crystal.svg",
  "decorations/frame_aura.svg",
  "decorations/frame_nucleo.svg",
  "decorations/frame_nature.svg",
  "decorations/frame_electric.svg",
  "decorations/frame_cosmic.svg",
  "decorations/frame_diamond.svg",
];

export const PNG_FRAMES = [
  "assets/seasons/christmas/frames/frame_xmas_candy_cane.png",
  "assets/seasons/christmas/frames/frame_xmas_snowflake.png",
  "assets/seasons/christmas/frames/frame_xmas_holly.png",
  "assets/seasons/christmas/frames/frame_xmas_lights.png",
];

const MEASURE_PAGE = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>frame measure</title></head><body><img id="f" alt="" style="display:block"></body></html>`;

/**
 * In-page measurement function. Draws `src` (same-origin URL) into a
 * 1024x1024 canvas and reads the alpha channel along the two center lines.
 */
const MEASURE_FN = `(canvasSize, src) => new Promise((done, fail) => {
  const img = document.getElementById("f");
  img.onerror = () => fail(new Error("failed to load " + src));
  img.onload = () => {
    try {
      const c = document.createElement("canvas");
      c.width = canvasSize; c.height = canvasSize;
      const ctx = c.getContext("2d");
      ctx.clearRect(0, 0, canvasSize, canvasSize);
      ctx.drawImage(img, 0, 0, canvasSize, canvasSize);
      const data = ctx.getImageData(0, 0, canvasSize, canvasSize).data;
      const TOL = 12;
      const isVisible = (x, y) => data[(y * canvasSize + x) * 4 + 3] > TOL;
      const C = canvasSize / 2;
      const cx = Math.round(C), cy = Math.round(C);

      // Bounding box of visible pixels over the whole canvas.
      let gx0 = Infinity, gx1 = -Infinity, gy0 = Infinity, gy1 = -Infinity;
      for (let y = 0; y < canvasSize; y++) {
        for (let x = 0; x < canvasSize; x++) {
          if (isVisible(x, y)) {
            if (x < gx0) gx0 = x; if (x > gx1) gx1 = x;
            if (y < gy0) gy0 = y; if (y > gy1) gy1 = y;
          }
        }
      }
      const hasPixels = gx0 < Infinity;

      // Visible spans along the horizontal / vertical center lines.
      let minX = Infinity, maxX = -Infinity;
      for (let x = 0; x < canvasSize; x++) if (isVisible(x, cy)) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); }
      let minY = Infinity, maxY = -Infinity;
      for (let y = 0; y < canvasSize; y++) if (isVisible(cx, y)) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }

      // Inner hole: transparent run around the center on each center line.
      let holeH = 0, holeV = 0;
      if (!isVisible(cx, cy)) {
        holeH = 1; for (let x = cx - 1; x >= 0 && !isVisible(x, cy); x--) holeH++;
        for (let x = cx + 1; x < canvasSize && !isVisible(x, cy); x++) holeH++;
      }
      if (!isVisible(cx, cy)) {
        holeV = 1; for (let y = cy - 1; y >= 0 && !isVisible(cx, y); y--) holeV++;
        for (let y = cy + 1; y < canvasSize && !isVisible(cx, y); y++) holeV++;
      }

      const outerH = minX < Infinity ? maxX - minX + 1 : 0;
      const outerV = minY < Infinity ? maxY - minY + 1 : 0;

      // Ring center estimate: midpoint of the hole run on each line; if the
      // center pixel is visible, the midpoint of the visible span.
      let ringCx, ringCy;
      if (!isVisible(cx, cy)) {
        let left = 0, x = cx - 1; while (x >= 0 && !isVisible(x, cy)) { left++; x--; }
        let right = 0, x2 = cx + 1; while (x2 < canvasSize && !isVisible(x2, cy)) { right++; x2++; }
        ringCx = cx + (right - left) / 2;
        let up = 0, y = cy - 1; while (y >= 0 && !isVisible(cx, y)) { up++; y--; }
        let down = 0, y2 = cy + 1; while (y2 < canvasSize && !isVisible(cx, y2)) { down++; y2++; }
        ringCy = cy + (down - up) / 2;
      } else {
        ringCx = hasPixels ? (gx0 + gx1) / 2 : C;
        ringCy = hasPixels ? (gy0 + gy1) / 2 : C;
      }

      done({
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        hasPixels,
        bbox: hasPixels ? {
          left: gx0, top: gy0, right: gx1 + 1, bottom: gy1 + 1,
          width: gx1 - gx0 + 1, height: gy1 - gy0 + 1,
        } : null,
        outerH, outerV, holeH, holeV,
        offX: minX < Infinity ? (minX + maxX) / 2 - C : 0,
        offY: minY < Infinity ? (minY + maxY) / 2 - C : 0,
        ringCenterX: ringCx, ringCenterY: ringCy,
      });
    } catch (e) {
      fail(e);
    }
  };
})`;

const CONTENT_TYPES = { ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg" };

/**
 * Tiny static file server rooted at `public/`. Returns `{ server, url, close }`.
 */
export async function startPublicServer(dir = PUBLIC_DIR) {
  const dirAbs = resolve(dir);
  const server = createServer((req, res) => {
    try {
      const url = decodeURIComponent((req.url || "/").split("?")[0]);
      if (url === "/measure.html") {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(MEASURE_PAGE);
        return;
      }
      if (url === "/favicon.ico") {
        res.writeHead(204);
        res.end();
        return;
      }
      const path = normalize(join(dirAbs, url));
      const rel = relative(dirAbs, path);
      if (!rel || rel.startsWith("..") || isAbsolute(rel)) {
        res.writeHead(403);
        res.end();
        return;
      }
      let st;
      try {
        st = statSync(path);
      } catch {
        res.writeHead(404);
        res.end();
        return;
      }
      if (!st.isFile()) {
        res.writeHead(404);
        res.end();
        return;
      }
      res.writeHead(200, { "Content-Type": CONTENT_TYPES[extname(path)] ?? "application/octet-stream", "Content-Length": st.size });
      createReadStream(path).pipe(res);
    } catch {
      res.writeHead(500);
      res.end();
    }
  });
  await new Promise((resolveReady, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.removeListener("error", reject);
      resolveReady();
    });
  });
  return { server, url: `http://127.0.0.1:${server.address().port}/` };
}

let measureCounter = 0;

/** Rasterizes `relPath` (relative to `public/`) to a 1024x1024 canvas and returns raw px metrics. */
export async function measureFrame(page, baseUrl, relPath) {
  const src = `${baseUrl}${relPath}?m=${Date.now()}-${measureCounter++}`;
  return page.evaluate(MEASURE_FN, CANVAS, src);
}

export function pct(px) {
  return Number(((px / CANVAS) * 100).toFixed(2));
}

export function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/** Convert raw display-canvas metrics (px) to percentages of the canvas width. */
export function displayPercentages(r) {
  const b = r.bbox;
  return {
    natural: { width: r.naturalWidth, height: r.naturalHeight },
    hasPixels: r.hasPixels,
    bbox: b
      ? { left: pct(b.left), top: pct(b.top), right: pct(b.right), bottom: pct(b.bottom), width: pct(b.width), height: pct(b.height) }
      : null,
    outerDiameter: pct((r.outerH + r.outerV) / 2),
    outerH: pct(r.outerH),
    outerV: pct(r.outerV),
    innerHoleDiameter: pct((r.holeH + r.holeV) / 2),
    holeH: pct(r.holeH),
    holeV: pct(r.holeV),
    offX: pct(r.offX),
    offY: pct(r.offY),
    ringCenterX: pct(r.ringCenterX),
    ringCenterY: pct(r.ringCenterY),
  };
}

/**
 * Reference geometry from SVG-frame measurements (displayPercentages rows):
 * medians of outer diameter, inner hole diameter and center offsets.
 */
export function referencePercentages(svgRows) {
  const ref = {
    outerDiameter: median(svgRows.map((r) => r.outerDiameter)),
    innerHoleDiameter: median(svgRows.map((r) => r.innerHoleDiameter)),
    centerOffsetX: median(svgRows.map((r) => r.offX)),
    centerOffsetY: median(svgRows.map((r) => r.offY)),
    outerH: median(svgRows.map((r) => r.outerH)),
    outerV: median(svgRows.map((r) => r.outerV)),
    holeH: median(svgRows.map((r) => r.holeH)),
    holeV: median(svgRows.map((r) => r.holeV)),
  };
  if (svgRows.some((r) => r.bbox)) {
    ref.bbox = {
      left: median(svgRows.map((r) => r.bbox.left)),
      right: median(svgRows.map((r) => r.bbox.right)),
      width: median(svgRows.map((r) => r.bbox.width)),
      top: median(svgRows.map((r) => r.bbox.top)),
      bottom: median(svgRows.map((r) => r.bbox.bottom)),
      height: median(svgRows.map((r) => r.bbox.height)),
    };
  }
  return ref;
}

export function frameNameFromPath(relPath) {
  return relPath.split("/").pop().replace(/\.(svg|png)$/, "");
}

const COLUMNS = [
  { header: "frame", key: "name", get: (r) => r.name },
  { header: "natural", key: "natural", get: (r) => r.display.natural ? `${r.display.natural.width}x${r.display.natural.height}` : "—" },
  { header: "bboxL%", key: "bboxL", get: (r) => r.display.bbox?.left ?? "—" },
  { header: "bboxR%", key: "bboxR", get: (r) => r.display.bbox?.right ?? "—" },
  { header: "bboxW%", key: "bboxW", get: (r) => r.display.bbox?.width ?? "—" },
  { header: "bboxT%", key: "bboxT", get: (r) => r.display.bbox?.top ?? "—" },
  { header: "bboxB%", key: "bboxB", get: (r) => r.display.bbox?.bottom ?? "—" },
  { header: "bboxH%", key: "bboxH", get: (r) => r.display.bbox?.height ?? "—" },
  { header: "outerH%", key: "outerH", get: (r) => r.display.outerH },
  { header: "outerV%", key: "outerV", get: (r) => r.display.outerV },
  { header: "holeH%", key: "holeH", get: (r) => r.display.holeH },
  { header: "holeV%", key: "holeV", get: (r) => r.display.holeV },
  { header: "offX%", key: "offX", get: (r) => r.display.offX },
  { header: "offY%", key: "offY", get: (r) => r.display.offY },
];

function padRight(str, width) {
  const s = String(str);
  return s + " ".repeat(Math.max(0, width - s.length));
}

/** Render a table of `{ name, display }` rows; optionally append the reference row. */
export function printTable(rows, ref) {
  const widths = COLUMNS.map((col) => Math.max(col.header.length, ...rows.map((r) => String(col.get(r)).length)));
  const line = (values) => values.map((v, i) => padRight(String(v), widths[i])).join("  ");
  const header = line(COLUMNS.map((c) => c.header));
  console.log(header);
  console.log("-".repeat(header.length));
  for (const row of rows) console.log(line(COLUMNS.map((c) => c.get(row))));
  if (ref) {
    console.log("-".repeat(header.length));
    const refRow = COLUMNS.map((col) => {
      switch (col.key) {
        case "name": return "REFERENCE (median of SVG)";
        case "natural": return "—";
        case "bboxL": return ref.bbox?.left ?? "—";
        case "bboxR": return ref.bbox?.right ?? "—";
        case "bboxW": return ref.bbox?.width ?? "—";
        case "bboxT": return ref.bbox?.top ?? "—";
        case "bboxB": return ref.bbox?.bottom ?? "—";
        case "bboxH": return ref.bbox?.height ?? "—";
        case "outerH": return ref.outerH;
        case "outerV": return ref.outerV;
        case "holeH": return ref.holeH;
        case "holeV": return ref.holeV;
        case "offX": return ref.centerOffsetX;
        case "offY": return ref.centerOffsetY;
        default: return "";
      }
    });
    console.log(line(refRow));
  }
}

/** Launch Chromium and return `{ browser, page }` bound to the static server. */
export async function launchMeasurePage(baseUrl) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: CANVAS, height: CANVAS } });
  await page.goto(baseUrl + "/measure.html", { waitUntil: "load" });
  return { browser, page };
}
