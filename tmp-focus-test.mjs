// Browser repro/verification for the "Novo plano" title-input focus bug.
// Usage: node tmp-focus-test.mjs [label]
import { chromium } from "@playwright/test";

const EMAIL = "e2e.planner@energyos.test";
const PASS = "Planner123!";
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const label = process.argv[2] ?? "run";

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
});
const context = await browser.newContext({ timezoneId: "America/Sao_Paulo" });
const page = await context.newPage();

const consoleErrors = [];
page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(`console.error: ${m.text()}`);
});

// ── login ────────────────────────────────────────────────────────────────────
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
if (!page.url().includes("/login")) {
  await page.goto(`${BASE}/planner`, { waitUntil: "domcontentloaded" });
} else {
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASS);
  await page.locator('button:has-text("Entrar")').click();
  await page.waitForTimeout(1500);
  const skip = page.locator('button:has-text("Pular tour")');
  if ((await skip.count()) > 0) await skip.first().click();
}
await page.goto(`${BASE}/planner`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(600);
const skip = page.locator('button:has-text("Pular tour")');
if ((await skip.count()) > 0) await skip.first().click();

// ── open "Novo plano" via Dia view ───────────────────────────────────────────
await page.getByRole("button", { name: "Dia", exact: true }).first().click();
await page.waitForTimeout(500);
await page.getByRole("button", { name: /Adicionar plano/ }).first().click();
await page.waitForSelector("#planner-plan-title", { state: "visible", timeout: 5000 });
await page.waitForTimeout(400); // let autoFocus + rAF settle

const diag = await page.evaluate(() => {
  const input = document.querySelector("#planner-plan-title");
  return {
    hasAutofocusAttr: input?.hasAttribute("autofocus") ?? null,
    activeOnOpen: document.activeElement?.id || document.activeElement?.tagName,
  };
});
console.log(`[${label}] on open: autofocusAttr=${diag.hasAutofocusAttr} activeElement=#${diag.activeOnOpen}`);

// ── type char by char, tracking focus after each keystroke ───────────────────
const input = page.locator("#planner-plan-title");
await input.click();
await page.waitForTimeout(150);
const sentence = "Plano de teste foco";
const focusTrail = [];
for (const ch of sentence) {
  await page.keyboard.type(ch, { delay: 0 });
  await page.waitForTimeout(60);
  const active = await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName || "none");
  focusTrail.push(active === "planner-plan-title" ? "." : `!${active}`);
}
const valueAfterTyping = await input.inputValue();
console.log(`[${label}] focus trail (1 char each): ${focusTrail.join("")}`);
console.log(`[${label}] value after typing: "${valueAfterTyping}" (expected "${sentence}")`);

// ── editing operations ───────────────────────────────────────────────────────
await input.click();
await page.keyboard.press("Control+a");
await page.keyboard.type("Edicao me", { delay: 10 });
// move caret to middle, backspace, arrows
await page.keyboard.press("ArrowLeft");
await page.keyboard.press("ArrowLeft");
await page.keyboard.press("Backspace");
await page.keyboard.press("Shift+ArrowLeft");
await page.keyboard.type("X", { delay: 10 });
const mid = await input.inputValue();
const activeMid = await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName);
console.log(`[${label}] after edit ops: value="${mid}" active=#${activeMid}`);

// ── typing in the start-time field must NOT steal focus to the title ─────────
const startInput = page.locator("#planner-plan-start-time");
await startInput.click();
await page.keyboard.press("Control+a");
await page.keyboard.type("0930", { delay: 80 });
const activeStart = await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName);
console.log(`[${label}] typing in Início: activeElement=#${activeStart} value=${await startInput.inputValue()}`);

// ── cancel the modal ─────────────────────────────────────────────────────────
await page.getByRole("button", { name: "Cancelar" }).click();
await page.waitForTimeout(400);
const modalGone = (await page.locator("#planner-plan-title").count()) === 0;
console.log(`[${label}] modal closed: ${modalGone}`);

const errs = consoleErrors.filter((e) => !/favicon|404|net::ERR/.test(e));
console.log(`[${label}] console errors: ${errs.length ? errs.join(" | ") : "none"}`);

await browser.close();
