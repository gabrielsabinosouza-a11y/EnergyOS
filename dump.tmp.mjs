import * as m from "./scripts/frame-geometry.mjs";

const { server, url } = await m.startPublicServer();
const { browser, page } = await m.launchMeasurePage(url);
try {
  for (const kind of ["svg", "png"]) {
    const paths = kind === "svg" ? m.SVG_FRAMES : m.PNG_FRAMES;
    console.log(`\n===== ${kind.toUpperCase()} FRAMES =====`);
    for (const rel of paths) {
      const raw = await m.measureFrame(page, url, rel);
      const d = m.displayPercentages(raw);
      console.log(JSON.stringify({
        name: m.frameNameFromPath(rel),
        natural: `${raw.naturalWidth}x${raw.naturalHeight}`,
        outerH: d.outerH, outerV: d.outerV,
        holeH: d.holeH, holeV: d.holeV,
        offX: d.offX, offY: d.offY,
        ringCenterX: d.ringCenterX, ringCenterY: d.ringCenterY,
        bbox: d.bbox ? { L: d.bbox.left, R: d.bbox.right, W: d.bbox.width, T: d.bbox.top, B: d.bbox.bottom, H: d.bbox.height } : null,
      }));
    }
  }
  const svgRows = (await Promise.all(m.SVG_FRAMES.map(async (rel) => m.displayPercentages(await m.measureFrame(page, url, rel)))));
  console.log("\nREFERENCE:", JSON.stringify(m.referencePercentages(svgRows), null, 2));
} finally {
  await browser.close();
  server.close();
}
