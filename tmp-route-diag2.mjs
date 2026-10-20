import { chromium } from "playwright";
const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: "block" });
const page = await ctx.newPage();
page.on("request", (r) => { if (r.url().includes("/api/")) console.log("REQ:", r.method(), r.url(), "resourceType:", r.resourceType()); });
await page.route("**/*", async (route) => {
  const url = route.request().url();
  if (url.includes("/api/recap")) {
    console.log("ROUTE HIT:", url);
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ recaps: [{ id: 1, profileId: "x", recapMonth: "2026-10-01", totalFocusMinutes: 3120, longestStreak: 47, streakIsAlive: true, leagueTier: "LENDAS", gardenCount: 293, totalXp: 6209, generatedAt: new Date().toISOString(), status: "live" }] }) });
    return;
  }
  await route.continue();
});
await page.goto("http://localhost:3000/perfil", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(20000);
console.log("Ver recap:", await page.locator('button:has-text("Ver recap de")').count());
await browser.close();
