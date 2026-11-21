// After loading /dashboard, dump firebaseLocalStorageDb records (keys only + user fields).
import { chromium } from "playwright";
import fs from "node:fs";

function readEnvValue(file, key) {
  const text = fs.readFileSync(file, "utf8");
  return new RegExp(`^${key}=(.+)$`, "m").exec(text)?.[1];
}
const apiKeys = [...new Set(["", ".env", ".env.local", ".env.vercel"]
  .filter(Boolean).map((f) => readEnvValue(f, "NEXT_PUBLIC_FIREBASE_API_KEY")).filter(Boolean))];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://localhost:3000/dashboard", { waitUntil: "networkidle" }).catch(() => {});
await page.waitForTimeout(5000);

const dump = await page.evaluate(async () => {
  const out = { url: location.pathname, dbs: null, records: null };
  out.dbs = (await indexedDB.databases()).map((d) => ({ name: d.name, version: d.version }));
  if (out.dbs.some((d) => d.name === "firebaseLocalStorageDb")) {
    const db = await new Promise((res, rej) => { const r = indexedDB.open("firebaseLocalStorageDb"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    out.records = [];
    for (const storeName of db.objectStoreNames) {
      const req = db.transaction(storeName, "readonly").objectStore(storeName).getAll();
      await new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
      out.records.push({ store: storeName, items: req.result.map((o) => ({ fbase_key: o.fbase_key, valueKeys: o.value ? Object.keys(o.value) : null })) });
    }
    db.close();
  }
  return out;
});
console.log(JSON.stringify(dump, null, 1));
console.log("expected apiKeys (lengths):", apiKeys.map((k) => k?.length));
await browser.close();
