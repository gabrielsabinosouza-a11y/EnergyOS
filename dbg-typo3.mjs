import { readFileSync } from "node:fs";
const s = readFileSync("/home/gabriel/Documentos/EnergyOS/src/app/dashboard/page.tsx", "utf8");
const i = s.indexOf("Como voc");
const chunk = s.slice(i, i + 30);
console.log("chunk code points:", [...chunk].map((c) => c + "(" + c.codePointAt(0).toString(16) + ")").join(" ").slice(0, 200));
console.log("has 'voce' (no accent):", /voce/.test(s));
console.log("has 'voc\u00ea':", /voc\u00ea/.test(s));
console.log("all matches of Como [aeiou]{1,3}voc[aeiou]e dormiu:", [...s.matchAll(/Como \S{1,4} dormiu/g)].map(m => m[0]));
