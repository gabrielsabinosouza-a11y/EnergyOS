// Minimal playwright config (avoids importing @playwright/test which isn't a
// project dependency; the npx-provided playwright binary is used).
module.exports = {
  testDir: ".",
  testMatch: /.*\.test\.js$/,
  use: {
    // E2E_BASE_URL permite rodar contra outro servidor (ex.: `next start`).
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    headless: true,
    launchOptions: { args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"] },
    contextOptions: { timezoneId: "America/Sao_Paulo" },
  },
  projects: [{ name: "chromium" }],
};
