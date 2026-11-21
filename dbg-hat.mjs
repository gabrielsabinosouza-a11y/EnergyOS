import { chromium } from "playwright-core";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto("https://energyos-tan.vercel.app/dashboard", { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
await page.waitForTimeout(3000);
const out = await page.evaluate(() => {
  const hat1 = document.querySelectorAll(".season-logo-accessory").length;
  const hat2 = document.querySelectorAll('svg[stroke="#e63946"]').length;
  const hat3 = document.querySelectorAll('svg[fill="#e63946"]').length;
  const logoSpan = document.querySelectorAll("header svg, nav svg");
  const detail = (n) => n ? n.parentElement?.className?.slice(0, 60) : null;
  // any svg near logo?
  const h1s = Array.from(document.querySelectorAll("h1, header a, nav a")).slice(0, 4).map((a) => ({
    text: a.textContent?.slice(0, 20),
    cls: (a.className || "").slice(0, 50),
    svgs: a.querySelectorAll("svg").length,
    hat: a.querySelector('svg[fill="#e63946"]') ? "HAT(fill)" : a.querySelector('svg[stroke="#e63946"]') ? "HAT(stroke)" : null,
  }));
  return { hat1, hat2, hat3, h1s: h1s.filter((h) => h.svgs > 0) };
});
console.log(JSON.stringify(out, null, 2));
await browser.close();
