// Extract the Firebase apiKey used by the app bundle from the served HTML/chunks.
import { chromium } from "playwright";
import fs from "node:fs";

function readEnvValue(file, key) {
  const text = fs.readFileSync(file, "utf8");
  return new RegExp(`^${key}=(.+)$`, "m").exec(text)?.[1];
}
const envFiles = [".env", ".env.local", ".env.vercel"];
const candidates = [...new Set(envFiles.map((f) => readEnvValue(f, "NEXT_PUBLIC_FIREBASE_API_KEY")).filter(Boolean))];

// Fetch the dashboard page HTML with the dev header.
const apiKeyHeader = readEnvValue(".env.local", "DEV_PROFILE_ID");
const res = await fetch("http://localhost:3000/dashboard", { headers: { "x-dev-profile-id": apiKeyHeader } });
const html = await res.text();
console.log("page status:", res.status);

// Gather script srcs
const srcs = [...html.matchAll(/src="([^"]+)"/g)].map((m) => m[1]).filter((s) => s.includes(".js"));
console.log("script srcs:", srcs.slice(0, 10));

// Fetch each script and search for apiKey values
const found = new Map();
for (const src of srcs) {
  const url = src.startsWith("http") ? src : `http://localhost:3000${src}`;
  const js = await fetch(url).then((r) => r.text()).catch(() => "");
  if (!js) continue;
  // match apiKey: "..." or apiKey: '...' or inlined "apiKey":"..."
  const re = /apiKey["']?\s*[:=]\s*["']([^"']{10,60})["']/g;
  let m;
  while ((m = re.exec(js))) found.set(m[1], { src: url.slice(-60) });
}
console.log("candidate apiKeys in bundle:", [...found.keys()].map((k) => ({ len: k.length, matchesEnv: candidates.includes(k), isEnvFileValue: candidates.includes(k) ? candidates.indexOf(k) : -1 })));
console.log("env candidates (lengths):", candidates.map((c) => c?.length));
