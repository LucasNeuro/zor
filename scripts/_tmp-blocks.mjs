import { readFileSync } from "node:fs";

const FENCED_CODE_BLOCK_RE = /```([a-zA-Z0-9_-]+)?\s*\n([\s\S]*?)```/g;

const md = readFileSync("docs/playbook-mari-unificado-obra10-plus.md", "utf8");
const blocks = [];
for (const match of md.matchAll(FENCED_CODE_BLOCK_RE)) {
  const lang = (match[1] || "").trim().toLowerCase();
  const code = (match[2] || "").trim();
  blocks.push({ lang, codeStart: code.slice(0, 40) });
}
console.log("blocks", blocks.length);
for (const b of blocks) console.log(b);
