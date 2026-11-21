import { chromium } from "playwright-core";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto("https://energyos-tan.vercel.app/dashboard", { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
await page.waitForTimeout(3500);

const report = await page.evaluate(() => {
  const lights = document.querySelectorAll(".season-lights i");
  const snow = document.querySelectorAll(".season-snow");
  const sampleAt = (x, y) => {
    const el = document.elementFromPoint(x, y);
    if (!el) return null;
    const cls = el.className && typeof el.className === "string" ? el.className : "";
    const tag = el.tagName;
    return { tag, classes: cls.split(" ").slice(0, 6).join(" "), id: el.id || null };
  };
  const l = lights[0];
  const s = snow[0];
  const lRect = l.getBoundingClientRect();
  const sRect = s.getBoundingClientRect();
  const topEl = sampleAt(lRect.x + lRect.width / 2, lRect.y + lRect.height / 2);
  const snowEl = sampleAt(sRect.x + sRect.width / 2, sRect.y + sRect.height / 2);
  return {
    lightsAtCenter: { bbox: { x: lRect.x, y: lRect.y, w: lRect.width, h: lRect.height }, elementAt: topEl, lightVisible: topEl && topEl.classes.includes("season-lights") },
    snowSample: { bbox: { x: sRect.x, y: sRect.y, w: sRect.width, h: sRect.height }, elementAt: snowEl, snowVisible: snowEl && snowEl.classes.includes("season-snow") },
    headerArea: (() => {
      const h = document.querySelector("header, .header, h1");
      return h ? { tag: h.tagName, classes: (h.className || "").split(" ").slice(0, 8).join(" "), bbox: h.getBoundingClientRect().toJSON() } : null;
    })(),
    santaHat: document.querySelector(".season-logo-accessory") ? "present" : null,
    pageTitle: document.title,
  };
});
console.log(JSON.stringify(report, null, 2));
await browser.close();
