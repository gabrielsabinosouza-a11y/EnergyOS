import { test } from "@playwright/test";
test("date check", async ({ page }) => {
  const r = await page.evaluate(() => {
    const d = new Date("2026-10-15");
    return {
      toString: d.toString(),
      weekday: d.toLocaleDateString("pt-BR", { weekday: "long" }),
      date: d.toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" }),
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  });
  console.log("DATE CHECK:", JSON.stringify(r));
});
