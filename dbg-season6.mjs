import { chromium } from "playwright-core";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto("http://localhost:3000/dashboard", { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
await page.waitForTimeout(3500);
const report = await page.evaluate(() => {
  const lights = document.querySelectorAll(".season-lights i");
  const snow = document.querySelectorAll(".season-snow");
  const at = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const t = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return { tag: t?.tagName, classes: (t?.className || "").toString().slice(0, 40), coveredByLights: !!t?.className?.toString().includes("season-lights") };
  };
  const ls = lights[0], ss = snow[0];
  const lb = ls.getBoundingClientRect();
  const sb = ss.getBoundingClientRect();
  const lightAt = at(ls), snowAt = at(ss);
  const htmlClasses = document.documentElement.className;
  const hatCount = document.querySelectorAll(".season-logo-accessory").length;
  return {
    lights: { count: lights.length, css: (() => { const c = getComputedStyle(ls); return { zIndex: c.zIndex, position: c.position, display: c.display }; })(), bbox: { x: lb.x, y: lb.y, w: lb.width, h: lb.height }, elementAt: lightAt },
    snow: { count: snow.length, css: (() => { const c = getComputedStyle(ss); return { zIndex: c.zIndex, position: c.position, opacity: c.opacity, display: c.display }; })(), bbox: { x: sb.x, y: sb.y, w: sb.width, h: sb.height }, elementAt: snowAt },
    htmlClasses, hatCount,
    dataSeason: document.documentElement.getAttribute("data-season"),
  };
});
console.log(JSON.stringify(report, null, 2));
await browser.close();
