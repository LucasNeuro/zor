import { readFileSync } from "node:fs";

const md = readFileSync("docs/playbook-mari-unificado-obra10-plus.md", "utf8");
const re = /```json obra10_playbook_flow\s*\n([\s\S]*?)```/;
const m = md.match(re);
if (!m) {
  console.log("no match");
  process.exit(1);
}
try {
  const j = JSON.parse(m[1]);
  console.log("JSON ok", j.obra10_playbook_flow_schema, j.entry_step_id, j.steps.length);
} catch (e) {
  console.log("parse error", e.message);
  process.exit(1);
}
