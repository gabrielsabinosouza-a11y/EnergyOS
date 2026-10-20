// Temporary inspection script: logs in, opens the profile page, opens the
// monthly recap and screenshots the final slide at several widths.
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const EMAIL = process.env.E2E_EMAIL ?? "e2e.planner@energyos.test";
const PASS = process.env.E2E_PASS ?? "Planner123!";
const OUT = "/tmp/opencode/recap-shots";
fs.mkdirSync(OUT, { recursive: true });

const WIDTHS = (process.env.WIDTHS ?? "1440,1024,768,390,320")
  .split(",")
  .map((w) => Number(w.trim()));

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
});
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: "America/Sao_Paulo" });
const page = await context.newPage();

const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text()}`); });

async function dismissTour(p) {
  const skip = p.locator('button:has-text("Pular tour")');
  if (await skip.count()) { await skip.first().click(); await p.waitForTimeout(400); }
}

console.log("→ login");
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 300000 });
await page.locator('input[type="email"]').waitFor({ state: "visible", timeout: 300000 });
await page.waitForTimeout(800);
if (page.url().includes("/login")) {
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASS);
  await page.locator('button[type="submit"]:has-text("Entrar")').click();
  await page.waitForTimeout(8000);
  const loginError = await page.locator("text=/E-mail ou senha incorretos/").count();
  console.log("  login error visible:", loginError);
  await page.screenshot({ path: `${OUT}/00-login-state.png` });
  if (loginError) {
    await page.screenshot({ path: `${OUT}/00-login-error.png` });
  }
}
await dismissTour(page);
console.log("  url after login:", page.url());

console.log("→ profile");
await page.goto(`${BASE}/perfil`, { waitUntil: "domcontentloaded", timeout: 300000 });
page.on("response", async (r) => {
  if (r.url().includes("/api/recap")) {
    let body = "";
    try { body = (await r.text()).slice(0, 400); } catch { /* ignore */ }
    console.log("  [api]", r.status(), r.url(), body);
  }
});
await page.waitForTimeout(12000);
await dismissTour(page);

const trigger = page.locator('button:has-text("Ver recap de")');
const count = await trigger.count();
console.log("  recap triggers:", count);
if (count === 0) {
  await page.screenshot({ path: `${OUT}/00-no-recap.png`, fullPage: false });
  console.log("ERROR: no recap found");
  console.log(errors.slice(0, 20).join("\n"));
  const html = await page.evaluate(() => document.body.innerText.slice(0, 1500));
  console.log("--- body text ---\n" + html);
  await browser.close();
  process.exit(1);
}

await trigger.first().click();
await page.waitForTimeout(2000);
await page.locator('[role="dialog"]').waitFor({ state: "visible", timeout: 60000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/01-slide-intro.png` });

// Navigate to the last slide (6 of 7) using the right arrow.
for (let i = 0; i < 6; i++) {
  await page.locator('button[aria-label="Próximo slide"]').click();
  await page.waitForTimeout(700);
}
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/02-final-1440.png` });

// Measure the surface
const info = await page.evaluate(() => {
  const dialog = document.querySelector('[role="dialog"]');
  const card = dialog?.querySelector("div[style*='aspect-ratio']");
  const rect = (el) => el ? (({x,y,width,height}) => ({x,y,width,height}))(el.getBoundingClientRect()) : null;
  return {
    dialog: rect(dialog),
    card: rect(card),
    docScrollW: document.documentElement.scrollWidth,
    docClientW: document.documentElement.clientWidth,
  };
});
console.log("  layout:", JSON.stringify(info));

for (const w of WIDTHS) {
  await page.setViewportSize({ width: w, height: 900 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/final-${w}.png` });
  const m = await page.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth,
  }));
  console.log(`  ${w}px → scrollW=${m.scrollW} clientW=${m.clientW}`);
}

console.log("ERRORS:\n" + (errors.slice(0, 20).join("\n") || "(none)"));
await browser.close();
