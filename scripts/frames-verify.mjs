/**
 * Dev-time geometry check for seasonal frames.
 *
 * Re-measures every PNG frame and the SVG reference frames and verifies that
 * each PNG frame is within the tolerance (default 3%) of the SVG reference
 * geometry. "Ring too thick" frames (hole below reference minus tolerance)
 * are warned about explicitly — the report from normalize-frames decides.
 *
 * Usage: node scripts/frames-verify.mjs [--tolerance 3]
 */
import { measureAll } from "./frames-measure.mjs";

const TOL = 3;

async function main() {
  const idx = process.argv.indexOf("--tolerance");
  const tol = idx >= 0 ? Number(process.argv[idx + 1]) : TOL;

  const { png, reference } = await measureAll();
  const refOuter = Math.max(reference.outerH, reference.outerV);
  const refHole = Math.min(reference.holeH, reference.holeV);
  let failures = 0;
  for (const { name, display: r } of png) {
    const outer = Math.max(r.outerH, r.outerV);
    const hole = Math.min(r.holeH, r.holeV);
    const outerDev = Math.abs(outer - refOuter);
    const holeDev = refHole - hole; // negative = hole too small
    console.log(`${name.padEnd(22)} outer=${outer.toFixed(2)}% hole=${hole.toFixed(2)}% offX=${r.offX.toFixed(2)} offY=${r.offY.toFixed(2)}`);
    if (outerDev > tol) {
      failures++;
      console.log(`  ✗ outer ${outer.toFixed(2)}% deviates from reference ${refOuter.toFixed(2)}% by ${outerDev.toFixed(2)}%`);
    }
    if (holeDev > tol) {
      failures++;
      console.log(`  ✗ inner hole ${hole.toFixed(2)}% is ${Math.abs(holeDev).toFixed(2)}% below reference ${refHole.toFixed(2)}%`);
    }
  }
  console.log(failures === 0
    ? `\nOK: all ${png.length} PNG frame(s) within ${tol}% of the SVG reference.`
    : `\nFAIL: ${failures} check(s) exceeded tolerance.`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
