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

async function session(opts = {}) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 }, timezoneId: "America/Sao_Paulo", ...opts });
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 200)); });
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
  await page.waitForTimeout(1200);
  const skip = page.locator('button:has-text("Pular tour")');
  if ((await skip.count()) > 0) { await skip.first().click(); await page.waitForTimeout(300); }
  await page.locator('button:has-text("Ver recap de")').first().click();
  await page.waitForTimeout(1200);
  return { page, errors };
}

// 1) Som
{
  const { page, errors } = await session();
  const toggle = page.locator('button[aria-label*="sons do recap"]');
  console.log("[som] botão presente:", await toggle.count(), "| pressed inicial:", await toggle.getAttribute("aria-pressed"));
  await toggle.click();
  await page.waitForTimeout(400);
  console.log("[som] pressed depois do clique:", await toggle.getAttribute("aria-pressed"));
  console.log("[som] localStorage:", await page.evaluate(() => localStorage.getItem("energyos:recap-sound")));
  // navega com o som ligado (não pode quebrar)
  for (let i = 0; i < 6; i += 1) {
    await page.locator('button[aria-label="Próximo slide"]').click({ force: true });
    await page.waitForTimeout(400);
  }
  console.log("[som] erros após navegar com som ligado:", errors);
  await page.close();
}

// 2) Preferência persiste entre sessões (mesmo contexto = mesmo localStorage)
{
  const { page } = await session();
  await page.locator('button[aria-label*="sons do recap"]').click();
  await page.waitForTimeout(300);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.locator('button:has-text("Ver recap de")').first().click();
  await page.waitForTimeout(1000);
  console.log("[persistência] pressed ao reabrir (mesmo contexto):", await page.locator('button[aria-label*="sons do recap"]').getAttribute("aria-pressed"));
  await page.close();
}

// 3) prefers-reduced-motion
{
  const { page, errors } = await session({ reducedMotion: "reduce" });
  const particles = await page.evaluate(() => {
    const dialog = document.querySelector('div[role="dialog"]');
    return dialog ? dialog.querySelectorAll('span[style*="border-radius: 9999px"]').length : -1;
  });
  console.log("[reduced-motion] modal aberto:", await page.locator('div[role="dialog"]').count(), "| erros:", errors);
  await page.screenshot({ path: "/tmp/opencode/recap/reduced-motion.png" });
  await page.close();
}

await browser.close();
