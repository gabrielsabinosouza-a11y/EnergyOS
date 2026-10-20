import { chromium } from "playwright";

const EMAIL = "e2e.planner@energyos.test";
const PASS = "Planner123!";
const BASE = "http://localhost:3000";

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, timezoneId: "America/Sao_Paulo" });
page.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE ERROR:", m.text().slice(0, 300)); });
page.on("response", async (r) => {
  if (r.url().includes("/api/recap")) {
    let body = "";
    try { body = (await r.text()).slice(0, 400); } catch {}
    console.log("RESPONSE", r.status(), r.url(), body);
  }
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

const gen = page.locator('button:has-text("Gerar recap")').first();
console.log("botao gerar:", await gen.count());
if (await gen.count()) {
  await gen.scrollIntoViewIfNeeded();
  await gen.click();
  await page.waitForTimeout(8000);
}
console.log("alerta erro:", await page.locator('[role="alert"]').allTextContents());
console.log("sucesso:", await page.locator('text=/atualizado com sucesso/').count());
console.log("cards recap:", await page.locator('button:has-text("Ver recap de")').count());
await browser.close();
