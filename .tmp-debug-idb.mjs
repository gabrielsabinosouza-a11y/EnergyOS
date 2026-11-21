// Debug: dump IDB databases + firebase-related keys after load.
import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
await page.waitForTimeout(3000);

const dump = await page.evaluate(async () => {
  const out = { dbs: null, records: null, documentTitle: document.title };
  try {
    out.dbs = (await indexedDB.databases()).map((d) => ({ name: d.name, version: d.version }));
  } catch (e) { out.dbs = String(e); }
  if (out.dbs) {
    out.records = [];
    for (const { name } of out.dbs) {
      const db = await new Promise((res, rej) => { const r = indexedDB.open(name); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
      const recs = [];
      for (const storeName of db.objectStoreNames) {
        const tx = db.transaction(storeName, "readonly");
        const req = tx.objectStore(storeName).getAll();
        await new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
        recs.push({ store: storeName, data: req.result.slice(0, 5) });
      }
      db.close();
      out.records.push({ db: name, stores: recs });
    }
  }
  return out;
});
console.log(JSON.stringify(dump, null, 1).slice(0, 3000));
await browser.close();
