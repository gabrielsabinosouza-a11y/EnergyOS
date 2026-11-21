import { chromium } from "playwright-core";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto("https://energyos-tan.vercel.app/dashboard", { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
await page.waitForTimeout(3500);

const report = await page.evaluate(() => {
  const chainAt = (el) => {
    const out = [];
    for (let i = 0; i < 8; i++) {
      out.push(el ? `${el.tagName}#${el.id} .${(el.className || "").split(" ").slice(0, 4).join(".")}` : "null");
      el = el?.parentElement;
    }
    return out;
  };
  const lights = document.querySelectorAll(".season-lights i");
  const snow = document.querySelectorAll(".season-snow");
  const l = lights[0], s = snow[0];
  const lb = l ? l.getBoundingClientRect() : null;
  const sb = s ? s.getBoundingClientRect() : null;
  const atL = lb ? document.elementFromPoint(lb.x + lb.width / 2, lb.y + lb.height / 2) : null;
  const atS = sb ? document.elementFromPoint(sb.x + sb.width / 2, sb.y + sb.height / 2) : null;
  const topZ = document.querySelectorAll(".season-layer")[0];
  return {
    lightBbox: lb && { x: lb.x, y: lb.y, w: lb.width, h: lb.height },
    lightAt: chainAt(atL).slice(0, 6),
    snowBbox: sb && { x: sb.x, y: sb.y, w: sb.width, h: sb.height },
    snowAt: chainAt(atS).slice(0, 6),
    layerCss: (() => { const cs = getComputedStyle(topZ); return { zIndex: cs.zIndex, position: cs.position, display: cs.display }; })(),
    header: (() => { const h = document.querySelector("header, .header"); return h ? { tag: h.tagName, classes: (h.className || "").slice(0, 60), bbox: h.getBoundingClientRect().toJSON(), cs: (() => { const c = getComputedStyle(h); return { zIndex: c.zIndex, position: c.position }; })() } : null; })(),
    mainCs: (() => { const m = document.querySelector("main"); return m ? { classes: (m.className || "").slice(0, 80), cs: (() => { const c = getComputedStyle(m); return { zIndex: c.zIndex, position: c.position, display: c.display }; })() } : null; })(),
  };
});
console.log(JSON.stringify(report, null, 2));
await browser.close();
