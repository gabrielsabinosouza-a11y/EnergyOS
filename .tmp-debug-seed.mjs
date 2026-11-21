// Debug seeding: init script seeds, logs; page dumps databases.
import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
page.on("console", (m) => console.log("[console]", m.type(), m.text().slice(0, 200)));
page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 300)));

await page.addInitScript(() => {
  const rec = { uid: "seed-dev-user-1", email: "dev@example.com" };
  console.log("init script: idb available?", typeof indexedDB, typeof indexedDB.databases);
  try {
    const open = indexedDB.open("firebaseLocalStorageDb", 1);
    open.onupgradeneeded = () => { console.log("upgrade needed"); open.result.createObjectStore("firebaseLocalStorage", { keyPath: "fbase_key" }); };
    open.onsuccess = () => {
      console.log("opened");
      const db = open.result;
      const tx = db.transaction("firebaseLocalStorage", "readwrite");
      const req = tx.objectStore("firebaseLocalStorage").put({ fbase_key: "k1", value: rec });
      req.onsuccess = () => console.log("put ok, key:", req.result);
      tx.oncomplete = () => { db.close(); console.log("seeded+closed"); };
      tx.onerror = () => { console.log("tx error"); db.close(); };
    };
    open.onerror = () => console.log("open error", open.error);
  } catch (e) { console.log("seed threw:", String(e)); }
});

await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
await page.waitForTimeout(3000);

const dump = await page.evaluate(async () => {
  const dbs = await indexedDB.databases();
  const out = { dbs };
  return out;
});
console.log("databases after load:", JSON.stringify(dump));
await browser.close();
