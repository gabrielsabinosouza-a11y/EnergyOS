/**
 * Measures the geometry of avatar frames: the bounding box of visible pixels,
 * the ring's outer diameter and inner hole diameter, sampled along the
 * horizontal and vertical center lines. All metrics are percentages of the
 * canvas width (1024x1024).
 *
 * Renders each frame to 1024x1024 (SVG sources rasterized by Chromium) and
 * prints the measured values for the seasonal PNG frames plus the reference
 * geometry (median across the SVG frames).
 *
 * Usage: node scripts/frames-measure.mjs [--json path/to/results.json]
 *        npm run frames:measure
 */
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  PUBLIC_DIR,
  ROOT,
  SVG_FRAMES,
  PNG_FRAMES,
  displayPercentages,
  frameNameFromPath,
  launchMeasurePage,
  measureFrame,
  printTable,
  referencePercentages,
  startPublicServer,
} from "./frame-geometry.mjs";

async function main() {
  const args = process.argv.slice(2);
  const jsonIndex = args.indexOf("--json");
  const jsonPath = jsonIndex >= 0 ? args[jsonIndex + 1] : null;

  const { server, url } = await startPublicServer();
  const { browser, page } = await launchMeasurePage(url);
  const results = { svg: [], png: [], reference: null };
  try {
    const svgRows = [];
    for (const rel of SVG_FRAMES) {
      const display = displayPercentages(await measureFrame(page, url, rel));
      const row = { name: frameNameFromPath(rel), path: rel, display };
      svgRows.push(row);
      results.svg.push(row);
    }
    const ref = referencePercentages(svgRows.map((r) => r.display));
    results.reference = ref;

    const pngRows = [];
    for (const rel of PNG_FRAMES) {
      if (!existsSync(join(PUBLIC_DIR, rel))) {
        console.log(`# ${rel}: MISSING (no such file)`);
        continue;
      }
      const display = displayPercentages(await measureFrame(page, url, rel));
      const row = { name: frameNameFromPath(rel), path: rel, display };
      pngRows.push(row);
      results.png.push(row);
    }

    printTable(pngRows, ref);

    if (jsonPath) {
      const target = join(ROOT, jsonPath);
      writeFileSync(target, JSON.stringify(results, null, 2));
      console.log(`\nwrote ${target}`);
    }
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
