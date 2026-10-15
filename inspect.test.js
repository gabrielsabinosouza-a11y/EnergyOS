import { test } from "@playwright/test";

test("inspect planner page", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push({ type: "pageerror", message: e.message, stack: e.stack }));
  page.on("console", (msg) => { if (msg.type() === "error") errors.push({ type: "console-error", message: msg.text() }); });

  await page.goto("/planner", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "/tmp/opencode/planner-week.png", fullPage: true });
  console.log("=== ALL H2 ===");
  const h2s = page.locator("h2");
  for (let i = 0; i < await h2s.count(); i++) console.log("h2[" + i + "]:", await h2s.nth(i).textContent());
  console.log("=== BUTTONS with text ===");
  const btns = page.locator("button");
  for (let i = 0; i < await btns.count(); i++) {
    const t = await btns.nth(i).textContent();
    if (t && t.trim()) console.log("btn[" + i + "]:", JSON.stringify(t.trim()));
  }
  console.log("=== ERRORS ===");
  console.log(JSON.stringify(errors));
  await page.close();
});
