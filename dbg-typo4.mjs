import { chromium } from "playwright-core";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto("https://energyos-tan.vercel.app/dashboard", { waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => {});
await page.waitForTimeout(3000);
const out = await page.evaluate(() => {
  const texts = [];
  document.querySelectorAll("*").forEach((el) => {
    const t = (el.textContent || "").trim();
    if (/Como\s+v[oó]?ce|dormiu/i.test(t) || /Como\s+voc[eê]/.test(t)) texts.push(t.slice(0, 100));
  });
  return [...new Set(texts)];
});
console.log("prod strings with dormiu/Como voce:", JSON.stringify(out, null, 2));
await browser.close();
