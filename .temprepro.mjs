import { chromium } from "playwright";

const BASE = process.env.BASE || "http://localhost:3001";
const email = `u${Date.now()}@x.co`;
const logs = [];

const browser = await chromium.launch();
const ctx = await browser.newContext();
ctx.on("console", (m) => logs.push(`[console.${m.type()}] ${m.text()}`));
const page = await ctx.newPage();
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}\n${e.stack || ""}`));

try {
  await page.goto(`${BASE}/cadastro`, { waitUntil: "networkidle", timeout: 120000 });
  await page.fill('input[placeholder="Seu nome"]', "Teste");
  await page.fill('input[placeholder="voce@email.com"]', email);
  await page.fill('input[placeholder="Mínimo 6 caracteres"]', "senha123");
  await page.fill('input[placeholder="Repita a senha"]', "senha123");
  await page.click('button[type="submit"]').catch(async () => {
    await page.locator("form button").first().click();
  });
  await page.waitForURL("**/dashboard", { timeout: 90000 });
  logs.push("[ok] signed in, at dashboard");

  await page.goto(`${BASE}/configuracoes`, { waitUntil: "networkidle", timeout: 90000 });
  await page.locator('[role="switch"][aria-label="Lembrete de foco"]').waitFor({ timeout: 30000 });
  logs.push("[ok] settings page rendered");

  // Toggle the reminder switch a few times (granted/denied paths both).
  const sw = page.locator('[role="switch"][aria-label="Lembrete de foco"]');
  await sw.click();
  await page.waitForTimeout(1200);
  await sw.click();
  await page.waitForTimeout(1200);
  await sw.click();
  await page.waitForTimeout(1500);

  // Toggle the theme buttons too (another state path).
  await page.getByRole("button", { name: "Claro" }).click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Escuro" }).click();
  await page.waitForTimeout(500);

  // Save.
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await page.waitForTimeout(2500);

  logs.push("[ok] interactions finished");
} catch (e) {
  logs.push(`[script-error] ${e.message}`);
}

const errs = logs.filter((l) => l.startsWith("[pageerror]") || l.includes("error"));
console.log("===== ERROR-SIGNALING LINES =====");
console.log(errs.length ? errs.join("\n\n") : "(none)");
console.log("===== ALL LOGS =====");
console.log(logs.join("\n"));
await browser.close();