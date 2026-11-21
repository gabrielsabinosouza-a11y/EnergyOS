// Poll the devtools badge on /dashboard during load+redirect, and dump console errors.
import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 150)); });
page.on("pageerror", (e) => consoleErrors.push(`[pageerror] ${String(e).slice(0, 150)}`));

const badgeStates = [];
await page.goto("http://localhost:3000/dashboard", { waitUntil: "domcontentloaded" });
for (let i = 0; i < 40; i++) {
  const snap = await page.evaluate(() => {
    const portal = document.querySelector("nextjs-portal");
    const sr = portal?.shadowRoot;
    const badge = sr?.querySelector("[data-next-badge]");
    const issuesOpen = sr ? sr.querySelectorAll("[data-issues-open]").length : 0;
    const dot = sr ? sr.querySelector("[data-dot]")?.getAttribute("style") || "" : "";
    return { url: location.pathname, error: badge?.getAttribute("data-error"), issuesOpen, dot: dot.slice(0, 60) };
  });
  const sig = JSON.stringify(snap);
  if (!badgeStates.length || badgeStates[badgeStates.length - 1] !== sig) badgeStates.push(sig);
  await page.waitForTimeout(150);
}
console.log("url/badge timeline:");
for (const s of badgeStates) console.log(" ", s);
console.log("console errors:");
for (const c of consoleErrors) console.log(" ", c);
await browser.close();
