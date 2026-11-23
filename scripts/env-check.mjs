#!/usr/bin/env node
/**
 * env:check — verifies that local env files point at the SAME databases as
 * each other (and documents what Vercel should use). Prints hosts and
 * project ids ONLY — never credentials.
 *
 * Run: npm run env:check
 */
import { readFileSync, existsSync } from "node:fs";

const FILES = [".env", ".env.local", ".env.production", ".env.development"];

function loadEnv(file) {
  if (!existsSync(file)) return null;
  const out = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*"?([^"\n]*)"?\s*$/);
    if (m && !line.trimStart().startsWith("#")) out[m[1]] = m[2];
  }
  return out;
}

function hostOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return "(unparseable)";
  }
}

const seen = new Map(); // dbHost -> [files]
let problems = 0;

console.log("env:check — database / identity targets per env file\n");

for (const file of FILES) {
  const env = loadEnv(file);
  if (!env) continue;
  const dbHost = env.DATABASE_URL ? hostOf(env.DATABASE_URL) : "(unset — inherits .env)";
  const fbProject = env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "(unset)";
  const appUrl = env.NEXT_PUBLIC_APP_URL ?? "(unset)";
  console.log(`${file.padEnd(20)} db=${dbHost}  firebase=${fbProject}  app=${appUrl}`);
  if (env.DATABASE_URL) {
    const key = dbHost;
    if (!seen.has(key)) seen.set(key, []);
    seen.get(key).push(file);
  }
}

console.log("");
if (seen.size > 1) {
  problems++;
  console.log("FAIL: env files point at DIFFERENT databases:");
  for (const [host, files] of seen) console.log(`  ${host}  <- ${files.join(", ")}`);
  console.log("\nLocalhost and Vercel will show different data. Align DATABASE_URL.");
} else if (seen.size === 1) {
  console.log(`OK: all env files with DATABASE_URL point at ${[...seen.keys()][0]}`);
}

// Vercel vars live in the dashboard (or .env.vercel with [SENSITIVE] values).
// Compare .env.vercel's non-sensitive markers so drift is visible.
const vercel = loadEnv(".env.vercel");
if (vercel) {
  const vHost = vercel.DATABASE_URL && !vercel.DATABASE_URL.includes("[SENSITIVE]")
    ? hostOf(vercel.DATABASE_URL) : "(sensitive — check Vercel dashboard)";
  console.log(`.env.vercel           db=${vHost}`);
  if (vHost !== "(sensitive — check Vercel dashboard)" && seen.size === 1 && vHost !== [...seen.keys()][0]) {
    problems++;
    console.log("FAIL: .env.vercel DATABASE_URL differs from local env files.");
  }
}

console.log(problems ? `\nenv:check found ${problems} problem(s).` : "\nenv:check passed.");
process.exit(problems ? 1 : 0);
