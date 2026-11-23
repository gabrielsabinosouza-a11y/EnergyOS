import { readFileSync } from 'node:fs';
import pg from 'pg';
for (const f of ['.env.local']) {
  const env = {};
  for (const line of readFileSync(f,'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
    if (m) env[m[1]] = m[2];
  }
  // .env.local no longer has DATABASE_URL; read it commented? It was commented out.
  // Use .env for snowy-hill already done. For damp-meadow we need the old URL —
  // it's gone from .env.local now. Check git? It's gitignored. Try .env.local.backup?
}
console.log('need old URL source');
