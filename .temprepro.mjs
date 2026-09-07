import { chromium } from "playwright";

const BASE = process.env.BASE || "http://localhost:3000";
const email = `u${Date.now()}@x.co`;
const logs = [];

const browser = await chromium.launch();
const ctx = await browser.newContext();
await ctx.grantPermissions(["notifications"], { origin: BASE });
ctx.on("console", (m) => logs.push(`[console.${m.type()}] ${m.text()}`));
const page = await ctx.newPage();
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}\n${e.stack || ""}`));

const gotoSafe = async (url, sel, t = 200000) => {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: t });
  await page.waitForSelector(sel, { timeout: t });
  logs.push(`[ok] loaded ${url}`);
};

try {
  await gotoSafe(`${BASE}/cadastro`, 'input[placeholder="Seu nome"]');
  await page.fill('input[placeholder="Seu nome"]', "Teste");
  await page.fill('input[placeholder="voce@email.com"]', email);
  await page.fill('input[placeholder="Mínimo 6 caracteres"]', "senha123");
  await page.fill('input[placeholder="Repita a senha"]', "senha123");
  await page.locator("form button").first().click();
  await page.waitForURL("**/dashboard", { timeout: 180000 });
  logs.push("[ok] signed in, at dashboard");

  await page.waitForTimeout(1200);
  // Dismiss the onboarding tour if it shows (covers skip propagation too).
  const skipBtn = page.getByRole("button", { name: "Pular tour" });
  if (await skipBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await skipBtn.click();
    logs.push("[ok] clicked Pular tour");
    await page.waitForTimeout(1500);
  }

  await gotoSafe(`${BASE}/configuracoes`, '[role="switch"][aria-label="Lembrete de foco"]');
  await page.waitForTimeout(1500);

  const sw = page.locator('[role="switch"][aria-label="Lembrete de foco"]');
  await sw.click();
  await page.waitForTimeout(1500);
  await sw.click();
  await page.waitForTimeout(1500);
  await sw.click();
  await page.waitForTimeout(1800);

  await page.getByRole("switch", { name: "Lembrete de check-in" }).click();
  await page.waitForTimeout(1200);

  await page.getByRole("button", { name: "Claro" }).click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Escuro" }).click();
  await page.waitForTimeout(500);

  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await page.waitForTimeout(3000);

  // Reload the settings page to force a full re-render with saved state.
  await page.reload({ waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForSelector('[role="switch"][aria-label="Lembrete de foco"]', { timeout: 120000 });
  await page.waitForTimeout(2500);

  logs.push("[ok] interactions finished");
} catch (e) {
  logs.push(`[script-error] ${e.message}`);
}

const errs = logs.filter((l) => l.includes("[pageerror]"));
console.log("===== PAGE ERRORS =====");
console.log(errs.length ? errs.join("\n\n") : "(none)");
console.log("===== ALL LOGS =====");
console.log(logs.join("\n"));
await browser.close();