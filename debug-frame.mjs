import sharp from "sharp";
import { readFileSync } from "node:fs";

const path = process.argv[2];
const { data, info } = await sharp(path).extractChannel("alpha").raw().toBuffer({ resolveWithObject: true });
const { width, height } = info;
console.log("size:", width, "x", height);

function asciiRow(y, n = 40) {
  const xs = Array.from({ length: n }, (_, i) => Math.round(i * width / n));
  return xs.map((x) => (data[y * width + x] > 12 ? "#" : data[y * width + x] > 4 ? "." : " ")).join("");
}

const mid = Math.round(height / 2);
for (const y of [Math.round(height / 8), Math.round(height / 4), Math.round(height / 2), Math.round(height * 3 / 4), Math.round(height * 7 / 8)]) {
  console.log(`y=${y}: ` + asciiRow(y));
}

let minX = width, minY = height, maxX = -1, maxY = -1;
for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (data[y * width + x] > 12) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
console.log("bbox:", minX, minY, maxX, maxY, "span:", maxX - minX + 1, maxY - minY + 1);
