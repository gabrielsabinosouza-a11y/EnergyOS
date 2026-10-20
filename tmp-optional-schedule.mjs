import { chromium } from "playwright";

const EMAIL = "e2e.planner@energyos.test";
const PASS = "Planner123!";
const BASE = "http://localhost:3000";

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, timezoneId: "America/Sao_Paulo", serviceWorkers: "block" });
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 200)); });

await page.goto(BASE + "/login", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(8000);
if (page.url().includes("/login")) {
  await page.locator("#login-email").click();
  await page.locator("#login-email").type(EMAIL, { delay: 15 });
  await page.locator("#login-password").click();
  await page.locator("#login-password").type(PASS, { delay: 15 });
  await page.locator('button:has-text("Entrar")').click();
  await page.waitForTimeout(6000);
}
await page.goto(BASE + "/planner", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(9000);
const skip = page.locator('button:has-text("Pular tour")');
if ((await skip.count()) > 0) { await skip.first().click(); await page.waitForTimeout(300); }

const stamp = Date.now();
const title = `Tarefa sem data ${stamp}`;

// ── 1. Criar tarefa só com título (sem data, sem horário) ────────────────────
await page.locator('button[aria-label*="Adicionar plano"]').first().click({ force: true });
await page.waitForTimeout(1200);
console.log("[modal] aberto:", await page.locator('text=Novo plano').count());

// limpa a data (botão × do seletor)
const clearBtn = page.locator('button[aria-label="Limpar data"], [aria-label="Limpar data"]');
if (await clearBtn.count()) {
  await clearBtn.first().click();
  await page.waitForTimeout(400);
  console.log("[modal] data limpa");
} else {
  console.log("[modal] sem botão de limpar data");
}
console.log("[modal] valor do campo data:", await page.locator("#planner-plan-date").textContent());

// digita o título (typing contínuo, sem clicar de novo)
await page.locator("#planner-plan-title").click();
await page.locator("#planner-plan-title").type(title, { delay: 25 });
const typed = await page.locator("#planner-plan-title").inputValue();
console.log("[modal] título digitado:", typed === title ? "OK (sem perder foco)" : `FALHOU -> "${typed}"`);
console.log("[modal] foco no título:", await page.evaluate(() => document.activeElement?.id));

// limpa os horários (opcionais)
for (const id of ["#planner-plan-start-time", "#planner-plan-end-time"]) {
  const field = page.locator(id);
  if (await field.count()) {
    const current = await field.inputValue();
    if (current) { await field.fill(""); }
  }
}
console.log("[modal] início:", JSON.stringify(await page.locator("#planner-plan-start-time").inputValue()),
            "fim:", JSON.stringify(await page.locator("#planner-plan-end-time").inputValue()));

await page.screenshot({ path: "/tmp/opencode/planner-modal.png" });

await page.locator('button:has-text("Criar plano")').click();
await page.waitForTimeout(8000);

const unscheduled = page.locator('section[aria-label="Tarefas sem data"]');
console.log("\n[1] seção 'Sem data' visível:", await unscheduled.count());
if (await unscheduled.count()) {
  console.log("[1] tarefa aparece na seção:", await unscheduled.locator(`text=${title}`).count());
  console.log("[1] texto da seção:", (await unscheduled.innerText()).replace(/\n/g, " | ").slice(0, 160));
}
await page.screenshot({ path: "/tmp/opencode/planner-unscheduled.png", fullPage: false });

// a tarefa não pode aparecer no calendário
console.log("[1] aparece no calendário:", await page.locator(`article:has-text("${title}")`).count());

// ── 2. Editar: dar uma data → deve migrar para o calendário ─────────────────
if (await unscheduled.count()) {
  await unscheduled.locator(`text=${title}`).first().click();
  await page.waitForTimeout(1200);
  console.log("\n[2] modal de edição aberto:", await page.locator('text=Editar plano').count());
  console.log("[2] data carregada:", (await page.locator("#planner-plan-date").textContent() || "").trim());
  // escolhe uma data
  await page.locator("#planner-plan-date").click();
  await page.waitForTimeout(600);
  const dayBtn = page.locator('div[role="dialog"] button:not([aria-label*="Mês"])').filter({ hasText: /^\d{1,2}$/ }).first();
  if (await dayBtn.count()) {
    await dayBtn.click();
    await page.waitForTimeout(500);
    console.log("[2] data escolhida:", (await page.locator("#planner-plan-date").textContent() || "").trim());
  }
  await page.locator('button:has-text("Salvar alterações")').click();
  await page.waitForTimeout(8000);
  console.log("[2] ainda em 'Sem data':", await page.locator(`section[aria-label="Tarefas sem data"] >> text=${title}`).count());
  console.log("[2] agora no calendário:", await page.locator(`article:has-text("${title}")`).count());
  await page.screenshot({ path: "/tmp/opencode/planner-after-edit.png" });
}

// ── 3. Limpar a data de novo (edição) ────────────────────────────────────────
await page.locator(`article:has-text("${title}")`).first().locator('button[aria-label*="Ações"]').click();
await page.waitForTimeout(400);
await page.locator('button[role="menuitem"]:has-text("Editar")').click();
await page.waitForTimeout(1000);
const clear2 = page.locator('[aria-label="Limpar data"]');
if (await clear2.count()) {
  await clear2.first().click();
  await page.waitForTimeout(400);
  await page.locator('button:has-text("Salvar alterações")').click();
  await page.waitForTimeout(8000);
  console.log("\n[3] voltou para 'Sem data':", await page.locator(`section[aria-label="Tarefas sem data"] >> text=${title}`).count());
  console.log("[3] saiu do calendário:", await page.locator(`article:has-text("${title}")`).count());
}

// ── 4. Recorrência semanal sem data → erro explícito ────────────────────────
await page.locator('button[aria-label*="Adicionar plano"]').first().click({ force: true });
await page.waitForTimeout(1000);
const clear3 = page.locator('[aria-label="Limpar data"]');
if (await clear3.count()) { await clear3.first().click(); await page.waitForTimeout(300); }
await page.locator("#planner-plan-title").fill(`Recorrente sem data ${stamp}`);
await page.locator('button:has-text("Semanalmente")').click();
await page.waitForTimeout(300);
await page.locator('button:has-text("Criar plano")').click();
await page.waitForTimeout(1200);
const alertText = await page.locator('[role="alert"]').allTextContents();
console.log("\n[4] erro exibido:", JSON.stringify(alertText));
await page.screenshot({ path: "/tmp/opencode/planner-recurrence-error.png" });
await page.keyboard.press("Escape");
await page.waitForTimeout(600);

console.log("\nerros de página:", errors);
await browser.close();
