// Dump Next.js dev overlay structure: any data-* elements, fixed/sticky corner elements, issue texts.
import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

page.on("console", (m) => { if (m.type() === "error") console.log("[console.error]", m.text().slice(0, 200)); });
page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 300)));

await page.goto("http://localhost:3000/dashboard", { waitUntil: "domcontentloaded" });

for (let t = 0; t < 12; t++) {
  await page.waitForTimeout(1000);
  const snap = await page.evaluate(() => {
    const out = { url: location.pathname, dataAttrs: [], corners: [], issueTexts: [] };
    for (const el of document.querySelectorAll("[data-nextjs-dev-overlay], [data-nextjs-devtools], .nextjs-dev-overlay, [data-issues], [class*='dev-overlay']")) {
      out.dataAttrs.push({ tag: el.tagName, cls: el.className, html: el.outerHTML.slice(0, 600) });
    }
    for (const el of document.querySelectorAll("*")) {
      const style = el.style?.cssText || "";
      const cs = getComputedStyle(el);
      if ((cs.position === "fixed" || cs.position === "sticky") && (cs.bottom !== "auto" || cs.left !== "auto")) {
        const r = el.getBoundingClientRect();
        out.corners.push({ tag: el.tagName, cls: String(el.className).slice(0, 80), pos: cs.position,
          b: cs.bottom, l: cs.left, x: Math.round(r.x), y: Math.round(r.y), text: el.innerText.trim().slice(0, 80) });
      }
      if (/issue/i.test(el.innerText?.trim() || "")) {
        const r = el.getBoundingClientRect();
        out.issueTexts.push({ tag: el.tagName, text: el.innerText.trim().slice(0, 120),
          x: Math.round(r.x), y: Math.round(r.y) });
      }
    }
    return out;
  });
  console.log(`--- t=${t + 1}s url=${snap.url}`);
  if (snap.dataAttrs.length) console.log("dataAttrs:", JSON.stringify(snap.dataAttrs.slice(0, 3), null, 1));
  console.log("corners:", JSON.stringify(snap.corners));
  console.log("issueTexts:", JSON.stringify(snap.issueTexts));
}
await browser.close();
