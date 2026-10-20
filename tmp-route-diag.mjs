import { chromium } from "playwright";
const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 860 }, serviceWorkers: "block" });
await page.route("**/api/recap**", async (route) => {
  console.log("ROUTE HIT:", route.request().method(), route.request().url());
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ recaps: [{ id: 1, profileId: "x", recapMonth: "2026-10-01", totalFocusMinutes: 3120, longestStreak: 47, streakIsAlive: true, leagueTier: "LENDAS", gardenCount: 293, totalXp: 6209, generatedAt: new Date().toISOString(), status: "live" }] }) });
});
await page.goto("http://localhost:3000/perfil", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(5000);
console.log("Ver recap:", await page.locator('button:has-text("Ver recap de")').count());
await browser.close();
