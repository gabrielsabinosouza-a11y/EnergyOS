import sharp from "sharp";
import { readFileSync, writeFileSync } from "node:fs";

const CANVAS = 1024;
const TOL = 12;

async function normalizePng(path, outPath, refOuterDiameterPct) {
  const raw = readFileSync(path);
  // 1. alpha plane for bbox (trim padding)
  const alphaRes = await sharp(raw).extractChannel("alpha").raw().toBuffer({ resolveWithObject: true });
  const { data, info } = alphaRes;
  const W = info.width, H = info.height;
  let minX = W, minY = H, maxX = -1, maxY = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (data[y * W + x] > TOL) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  if (maxX < 0) return { note: "no visible pixels", src: path };
  const bw = maxX - minX + 1, bh = maxY - minY + 1;
  const scale = (refOuterDiameterPct / 100) * CANVAS / Math.max(bw, bh);
  let effScale = scale;
  let sw, sh, destX, destY;
  for (let guard = 0; guard < 50; guard++) {
    sw = Math.max(1, Math.round(bw * effScale));
    sh = Math.max(1, Math.round(bh * effScale));
    destX = Math.round(CANVAS / 2 - sw / 2);
    destY = Math.round(CANVAS / 2 - sh / 2);
    if (destX >= 6 && destY >= 6 && destX + sw <= CANVAS - 6 && destY + sh <= CANVAS - 6) break;
    effScale -= 0.01;
  }
  console.log("scale", effScale, "sw,sh", sw, sh, "dest", destX, destY);

  // 2. crop + resize with sharp
  const resized = await sharp(raw)
    .extract({ left: minX, top: minY, width: bw, height: bh })
    .resize(sw, sh, { fit: "fill", kernel: "lanczos3" })
    .png()
    .toBuffer();

  // 3. composite on transparent canvas, centered
  const canvas = Buffer.alloc(CANVAS * CANVAS * 4, 0);
  await sharp(canvas, { raw: { width: CANVAS, height: CANVAS, channels: 4 } })
    .composite([{ input: resized, top: destY, left: destX }])
    .png()
    .toFile(outPath);
  return { scale: effScale, sw, sh, destX, destY };
}

const res = await normalizePng("/home/gabriel/Documentos/EnergyOS/public/assets/seasons/christmas/frames/frame_xmas_candy_cane.png", "/tmp/cc-normalized.png", 100);
console.log("done", res);
