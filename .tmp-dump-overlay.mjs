// Load /dashboard with auth + interception, dump overlay badge + expanded issue panel text.
import { chromium } from "playwright";
import fs from "node:fs";

const readEnvValue = (file, key) => new RegExp(`^${key}=(.+)$`, "m").exec(fs.readFileSync(file, "utf8"))?.[1];
const devProfileId = readEnvValue(".env.local", "DEV_PROFILE_ID");
const apiKey = readEnvValue(".env", "NEXT_PUBLIC_FIREBASE_API_KEY");

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
if (devProfileId) await context.setExtraHTTPHeaders({ "x-dev-profile-id": devProfileId });
const page = await context.newPage();
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 250)); });
page.on("pageerror", (e) => consoleErrors.push(`[pageerror] ${String(e).slice(0, 250)}`));

await page.route("**/identitytoolkit.googleapis.com/**", (route) => {
  const url = route.request().url();
  if (url.includes("accounts:lookup")) {
    return route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ users: [{ localId: "seed-dev-user-1", displayName: "Dev User", email: "dev@example.com", emailVerified: true, photoUrl: "", providerUserInfo: [] }] }),
    });
  }
  return route.abort();
});

await page.addInitScript((key) => {
  const open = indexedDB.open("firebaseLocalStorageDb", 1);
  open.onupgradeneeded = () => open.result.createObjectStore("firebaseLocalStorage", { keyPath: "fbase_key" });
  open.onsuccess = () => {
    const tx = open.result.transaction("firebaseLocalStorage", "readwrite");
    tx.objectStore("firebaseLocalStorage").put({
      fbase_key: `firebase:authUser:${key}:[DEFAULT]`,
      value: {
        uid: "seed-dev-user-1", email: "dev@example.com", displayName: "Dev User", emailVerified: true, isAnonymous: false, providerData: [],
        stsTokenManager: { refreshToken: "fake-refresh-token", accessToken: "fake-access-token", expirationTime: Date.now() + 3600_000 },
      },
    });
    tx.oncomplete = () => open.result.close();
  };
}, apiKey);

await page.goto("http://localhost:3000/dashboard", { waitUntil: "domcontentloaded", timeout: 120000 }).catch((e) => console.log("goto:", e.message));
await page.waitForTimeout(12000);

const dump = await page.evaluate(() => {
  const out = { url: location.pathname, badge: null, panel: "", startBtn: null };
  const portal = document.querySelector("nextjs-portal");
  const sr = portal?.shadowRoot;
  if (sr) {
    const badge = sr.querySelector("[data-next-badge]");
    if (badge) out.badge = { attrs: [...badge.attributes].map((a) => `${a.name}=${a.value}`).join(" "), bg: getComputedStyle(badge).backgroundColor, text: badge.innerText.trim() };
    // Dump all shadow text
    const acc = [];
    const walk = (root) => {
      for (const el of root.querySelectorAll("*")) {
        const t = (el.innerText || el.textContent || "").trim();
        if (t) acc.push(`[${el.tagName}${el.getAttribute("data-testid") ? `:${el.getAttribute("data-testid")}` : ""}] ${t.replace(/\s+/g, " ").slice(0, 200)}`);
        if (el.shadowRoot) walk(el.shadowRoot);
      }
    };
    walk(sr);
    out.panel = acc.slice(0, 60).join("\n");
  }
  const start = [...document.querySelectorAll("button")].find((b) => /iniciar foco/i.test(b.innerText));
  out.startBtn = start ? { text: start.innerText.trim() } : null;
  return out;
});
console.log("URL:", dump.url);
console.log("BADGE:", JSON.stringify(dump.badge));
console.log("START BTN:", JSON.stringify(dump.startBtn));
console.log("SHADOW TEXT (first 60):\n" + dump.panel);
console.log("CONSOLE:\n" + consoleErrors.join("\n"));
await browser.close();
