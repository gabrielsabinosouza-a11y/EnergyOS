// Focused check: does "Cancelar" actually close the Novo plano modal?
import { chromium } from "@playwright/test";

const EMAIL = "e2e.planner@energyos.test";
const PASS = "Planner123!";
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-gpu"] });
const page = await (await browser.newContext({ timezoneId: "America/Sao_Paulo" })).newPage();
page.setDefaultTimeout(90000);
page.setDefaultNavigationTimeout(90000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
if (page.url().includes("/login")) {
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASS);
  await page.locator('button:has-text("Entrar")').click();
  await page.waitForTimeout(1500);
  const skip = page.locator('button:has-text("Pular tour")');
  if ((await skip.count()) > 0) await skip.first().click();
}
await page.goto(`${BASE}/planner`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);
const skip = page.locator('button:has-text("Pular tour")');
if ((await skip.count()) > 0) await skip.first().click();

await page.getByRole("button", { name: "Dia", exact: true }).first().click();
await page.waitForTimeout(500);
await page.getByRole("button", { name: /Adicionar plano/ }).first().click();
await page.waitForSelector("#planner-plan-title", { state: "visible" });
await page.waitForTimeout(400);

// Type something so the form is dirty, then cancel.
await page.locator("#planner-plan-title").click();
await page.keyboard.type("form sujo", { delay: 20 });

const cancelButtons = await page.getByRole("button", { name: "Cancelar" }).count();
console.log(`Cancelar buttons visible: ${cancelButtons}`);
await page.getByRole("button", { name: "Cancelar" }).first().click();

for (const wait of [300, 700, 1500]) {
  await page.waitForTimeout(wait === 300 ? 300 : wait - 300);
  const count = await page.locator("#planner-plan-title").count();
  const dialogs = await page.getByRole("dialog").count();
  const texts = await page.locator('[role="alert"], [role="dialog"]').allInnerTexts().catch(() => []);
  console.log(`after cumulative ~${wait}ms: titleInputs=${count} dialogs=${dialogs} texts=${JSON.stringify(texts).slice(0, 300)}`);
}

// If still open, try Escape to close.
const stillOpen = (await page.locator("#planner-plan-title").count()) > 0;
if (stillOpen) {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(800);
  console.log(`after Escape: titleInputs=${await page.locator("#planner-plan-title").count()}`);
}

// Reopen and confirm a fresh form (title empty).
await page.getByRole("button", { name: /Adicionar plano/ }).first().click();
await page.waitForSelector("#planner-plan-title", { state: "visible", timeout: 5000 }).catch(() => {});
await page.waitForTimeout(500);
const reopenedValue = await page.locator("#planner-plan-title").inputValue().catch((e) => `ERR:${e.message.slice(0, 80)}`);
console.log(`reopened title value: "${reopenedValue}"`);

console.log(`pageerrors: ${errors.length ? errors.join(" | ") : "none"}`);
await browser.close();
