import { chromium } from "playwright";

const EMAIL = "e2e.planner@energyos.test";
const PASS = "Planner123!";
const BASE = "http://localhost:3000";

const RECAP = {
  id: 999999, profileId: "e2e", recapMonth: "2026-10-01",
  totalFocusMinutes: 3120, longestStreak: 47, streakIsAlive: true,
  leagueTier: "LENDAS", leagueAtStart: "OURO", leaguePromoted: true,
  gardenCount: 293, totalXp: 6209, coinsGained: 120,
  missionsCompleted: 18, goalsCompleted: 4, achievementsUnlocked: 7,
  hasBeenShared: false, generatedAt: new Date().toISOString(), status: "live",
};

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 860 }, reducedMotion: "reduce" });
page.on("console", (m) => { if (m.type() === "error") console.log("=== CONSOLE ERROR ===\n" + m.text().slice(0, 3000)); });
await page.route("**/api/recap**", async (route) => {
  await route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify(route.request().method() === "GET" ? { recaps: [RECAP] } : { recap: RECAP }),
  });
});
await page.goto(BASE + "/login", { waitUntil: "networkidle" });
if (page.url().includes("/login")) {
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASS);
  await page.locator('button:has-text("Entrar")').click();
  await page.waitForTimeout(2500);
}
await page.goto(BASE + "/perfil", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
const skip = page.locator('button:has-text("Pular tour")');
if ((await skip.count()) > 0) { await skip.first().click(); await page.waitForTimeout(300); }
await page.locator('button:has-text("Ver recap de")').first().click();
await page.waitForTimeout(1500);
await browser.close();
