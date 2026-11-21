import sharp from "sharp";
import { readFileSync } from "node:fs";

const path = "/home/gabriel/Documentos/EnergyOS/public/assets/seasons/christmas/frames/frame_xmas_candy_cane.png";
const raw = readFileSync(path);
const CANVAS = 1024;
const TOL = 12;

const { data, info } = await sharp(raw).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H } = info;
console.log("img", W, "x", H, "dataLen", data.length, "expected", W * H * 4);

let minX = W, minY = H, maxX = -1, maxY = -1;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (data[y * W + x] > TOL) {
  if (x < minX) minX = x; if (x > maxX) maxX = x;
  if (y < minY) minY = y; if (y > maxY) maxY = y;
}
const bw = maxX - minX + 1, bh = maxY - minY + 1;
console.log("bbox", minX, minY, maxX, maxY, "bw/bh", bw, bh);

const sc = (CANVAS / 100) / Math.max(bw, bh) * 100; // placeholder, real:
const targetOuterPx = (100 / 100) * CANVAS;
const scale = targetOuterPx / Math.max(bw, bh);
console.log("scale", scale);

const sw = Math.max(1, Math.round(bw * scale));
const sh = Math.max(1, Math.round(bh * scale));
const destX = Math.round(CANVAS / 2 - sw / 2);
const destY = Math.round(CANVAS / 2 - sh / 2);
console.log("sw,sh,destX,destY", sw, sh, destX, destY);

const cropped = await sharp(raw)
  .extract({ left: minX, top: minY, width: bw, height: bh })
  .resize(sw, sh, { fit: "fill", kernel: "lanczos3" })
  .raw()
  .toBuffer();
console.log("cropped.length", cropped.length, "expected", sw * sh * 4);

const canvasBuf = Buffer.alloc(CANVAS * CANVAS * 4, 0);
const rowBytes = sw * 4;
for (let y = 0; y < sh; y++) {
  cropped.copy(canvasBuf, ((destY + y) * CANVAS + destX) * 4, y * rowBytes, y * rowBytes + rowBytes);
}

let cMinX = CANVAS, cMinY = CANVAS, cMaxX = -1, cMaxY = -1;
for (let y = 0; y < CANVAS; y++) for (let x = 0; x < CANVAS; x++) if (canvasBuf[(y * CANVAS + x) * 4 + 3] > TOL) {
  cMinX = Math.min(cMinX, x); cMaxX = Math.max(cMaxX, x);
  cMinY = Math.min(cMinY, y); cMaxY = Math.max(cMaxY, y);
}
console.log("canvas bbox", cMinX, cMinY, cMaxX, cMaxY);
