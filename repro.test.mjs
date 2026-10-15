import { test, expect } from "@playwright/test";

test("reproduce planner bugs", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push({ type: "pageerror", message: e.message, stack: e.stack }));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push({ type: "console-error", message: msg.text() });
  });

  await page.goto("http://localhost:3000/planner", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  console.log("=== INITIAL PAGE ===");
  console.log("URL:", page.url());
  console.log("Header label:", await page.locator("text=outubro de 2026, 12 - 18 de outubro, quinta-feira").first().textContent().catch(() => "n/a"));

  // Check week view is default
  console.log("=== WEEK VIEW ===");
  const weekLabel = page.locator("text=12 - 18 de outubro");
  console.log("week label visible:", await weekLabel.isVisible());

  // Click "Adicionar" on today column (Qui, 15) in week view
  const todayCol = page.locator('button:has-text("Qui")').filter(:has-text("15"));
  console.log("today col (Qui 15) count:", await todayCol.count());

  // Try adding from day view: switch to Day
  await page.locator('button:has-text("Dia")').click();
  await page.waitForTimeout(800);
  console.log("=== DAY VIEW ===");
  const dayHeader = await page.locator("h2").first().textContent();
  console.log("day h2:", dayHeader);
  const daySub = await page.locator("p").nth(1).textContent();
  console.log("day sub:", daySub);

  // Click "Adicionar plano" in day view
  const addBtn = page.getByRole("button", { name: /Adicionar plano/ });
  console.log("add btn count:", await addBtn.count());
  await addBtn.first().click();
  await page.waitForTimeout(500);

  // Fill dialog
  const titleInput = page.locator('input[placeholder*="Ir à academia"], input[type="text"]').first();
  await titleInput.fill("Tarefa de teste reproducao");
  await page.getByRole("button", { name: /Criar plano/ }).click();
  await page.waitForTimeout(1000);

  console.log("=== ERRORS COLLECTED ===");
  console.log(JSON.stringify(errors, null, 1));
  console.log("Task appears:", (await page.locator('text=Tarefa de teste reproducao').count()) > 0);

  await page.close();
});
