import { chromium } from "playwright";

const EMAIL = "e2e.planner@energyos.test";
const PASS = "Planner123!";
const BASE = "http://localhost:3000";
const results = [];
function check(label, ok, extra = "") {
  results.push({ label, ok, extra });
  console.log(`${ok ? "✅" : "❌"} ${label}${extra ? " — " + extra : ""}`);
}

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, timezoneId: "America/Sao_Paulo" });
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 160)); });

async function login() {
  await page.goto(BASE + "/login", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(8000);
  if (page.url().includes("/login")) {
    await page.locator("#login-email").click();
    await page.locator("#login-email").type(EMAIL, { delay: 12 });
    await page.locator("#login-password").click();
    await page.locator("#login-password").type(PASS, { delay: 12 });
    await page.locator('button:has-text("Entrar")').click();
    await page.waitForTimeout(6000);
  }
  await page.goto(BASE + "/planner", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(9000);
}

async function openNewPlan() {
  await page.locator('button[aria-label*="Adicionar plano"]').first().click({ force: true });
  await page.waitForTimeout(1500);
}
async function clearDate() {
  const btn = page.locator('[aria-label="Limpar data"]');
  if (await btn.count()) { await btn.first().click(); await page.waitForTimeout(400); }
}
async function pickDate() {
  await page.locator("#planner-plan-date").click();
  await page.waitForTimeout(800);
  // dia 20 = hoje (semana visível 19–25/10)
  await page.locator('div[role="dialog"] button').filter({ hasText: /^20$/ }).first().click();
  await page.waitForTimeout(500);
}
async function submit(label) {
  await page.locator(`button:has-text("${label}")`).click();
  await page.waitForTimeout(4000);
}

await login();
const stamp = Date.now();

// ── Caso 1: só título ────────────────────────────────────────────────────────
await openNewPlan();
await clearDate();
const t1 = `Só título ${stamp}`;
await page.locator("#planner-plan-title").click();
await page.locator("#planner-plan-title").type(t1, { delay: 20 });
check("1. digitação contínua no Título (sem perder foco)",
  (await page.locator("#planner-plan-title").inputValue()) === t1 && (await page.evaluate(() => document.activeElement?.id)) === "planner-plan-title");
check("1. campo Data mostra placeholder 'Sem data'", (await page.locator("#planner-plan-date").textContent() || "").includes("Sem data"));
check("1. horários começam vazios (sem 09:00/10:00)",
  (await page.locator("#planner-plan-start-time").inputValue()) === "" && (await page.locator("#planner-plan-end-time").inputValue()) === "");
await submit("Criar plano");
const section = page.locator('section[aria-label="Tarefas sem data"]');
check("1. tarefa sem data criada e listada em 'Sem data'", (await section.locator(`text=${t1}`).count()) > 0);
check("1. não aparece no calendário", (await page.locator(`article:has-text("${t1}")`).count()) === 0);

// ── Caso 2: só data ──────────────────────────────────────────────────────────
await openNewPlan();
await clearDate();
const t2 = `Só data ${stamp}`;
await page.locator("#planner-plan-title").fill(t2);
await pickDate();
await submit("Criar plano");
check("2. tarefa só com data foi criada", (await page.locator(`article:has-text("${t2}")`).count()) > 0);

// ── Caso 3: data + início, sem fim ──────────────────────────────────────────
await openNewPlan();
await clearDate();
const t3 = `Data e início ${stamp}`;
await page.locator("#planner-plan-title").fill(t3);
await pickDate();
await page.locator("#planner-plan-start-time").fill("14:30");
await submit("Criar plano");
check("3. tarefa com data + início (sem fim) criada", (await page.locator(`article:has-text("${t3}")`).count()) > 0);

// ── Caso 4: data + início + fim ─────────────────────────────────────────────
await openNewPlan();
await clearDate();
const t4 = `Data e horários ${stamp}`;
await page.locator("#planner-plan-title").fill(t4);
await pickDate();
await page.locator("#planner-plan-start-time").fill("08:00");
await page.locator("#planner-plan-end-time").fill("09:00");
await submit("Criar plano");
check("4. tarefa com data + início + fim criada", (await page.locator(`article:has-text("${t4}")`).count()) > 0);

// ── Caso 5: edição removendo a data ─────────────────────────────────────────
await page.locator(`article:has-text("${t4}")`).first().locator('button[aria-label*="Ações"]').click();
await page.waitForTimeout(600);
await page.locator('button[role="menuitem"]:has-text("Editar")').click();
await page.waitForTimeout(1500);
check("5. edição carrega a data existente", !(await page.locator("#planner-plan-date").textContent() || "").includes("Sem data"));
await clearDate();
check("5. data pode ser limpa na edição", (await page.locator("#planner-plan-date").textContent() || "").includes("Sem data"));
await submit("Salvar alterações");
await page.waitForTimeout(2000);
check("5. após limpar, a tarefa vai para 'Sem data'", (await section.locator(`text=${t4}`).count()) > 0);
check("5. e some do calendário", (await page.locator(`article:has-text("${t4}")`).count()) === 0);

// ── Caso 6: edição limpando os horários ─────────────────────────────────────
await section.locator(`text=${t4}`).first().click();
await page.waitForTimeout(1500);
await page.locator("#planner-plan-start-time").fill("");
await page.locator("#planner-plan-end-time").fill("");
await submit("Salvar alterações");
check("6. edição sem horários salva", (await section.locator(`text=${t4}`).count()) > 0);

// ── Caso 7: recorrência semanal (exige data-âncora) ────────────────────────
await openNewPlan();
await clearDate();
await page.locator("#planner-plan-title").fill(`Recorrente sem data ${stamp}`);
await page.locator('button:has-text("Semanalmente")').click();
await page.waitForTimeout(400);
await submit("Criar plano");
const alertTexts = await page.locator('[role="alert"]').allTextContents();
check("7. recorrência sem data mostra erro explícito", alertTexts.some((t) => /data/i.test(t)), JSON.stringify(alertTexts));
await page.keyboard.press("Escape");
await page.waitForTimeout(800);

// recorrência COM data
await openNewPlan();
const t7 = `Recorrente ${stamp}`;
await page.locator("#planner-plan-title").fill(t7);
await pickDate();
await page.locator('button:has-text("Semanalmente")').click();
await page.waitForTimeout(400);
await submit("Criar plano");
check("7. recorrência com data criada", (await page.locator(`article:has-text("${t7}")`).count()) > 0
  || (await page.locator(`text=${t7}`).count()) > 0);

// ── Caso 8/9: tarefas existentes no calendário + sem data acessíveis ────────
check("8. seção 'Sem data' visível", (await section.count()) > 0);
check("8. tarefas sem data continuam acessíveis", (await section.locator('[data-testid^="plan-"]').count()) > 0);
check("9. plano agendado continua no calendário", (await page.locator("article").count()) > 0);
await page.screenshot({ path: "/tmp/opencode/optional-final.png" });

// ── Caso 10: concluir uma tarefa sem data (XP) ─────────────────────────────
const row = section.locator('[data-testid^="plan-"]').first();
const rowTitle = (await row.locator("button[aria-label*='Concluir']").getAttribute("aria-label")) || "";
await row.locator('button[aria-label*="Concluir"]').click();
await page.waitForTimeout(3500);
const feedback = await page.locator('[role="status"]').allTextContents();
check("10. concluir tarefa sem data funciona (com recompensa)", feedback.some((t) => /XP|moeda|Plano conclu/i.test(t)), JSON.stringify(feedback).slice(0, 120));

console.log("\nErros de console/página:", errors.length ? errors : "nenhum");
const failed = results.filter((r) => !r.ok);
console.log(`\nResumo: ${results.length - failed.length}/${results.length} verificações OK`);
if (failed.length) console.log("Falhas:", failed.map((f) => f.label).join(" | "));
await browser.close();
