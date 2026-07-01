/**
 * Smoke harness: prompt Manus-style + modo operar + lead real (Mistral).
 *
 * Uso:
 *   npm run smoke:harness-copiloto
 *
 * Requer .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, MISTRAL_API_KEY, DEFAULT_TENANT_ID
 */
import { spawnSync } from "child_process";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

console.log("=== Smoke harness copiloto (modo operar) ===\n");

const leadSmoke = spawnSync("node", ["scripts/smoke-consultar-lead-tabela.mjs"], {
  cwd: root,
  stdio: "inherit",
  shell: true,
});

if (leadSmoke.status !== 0) {
  console.error("\nFAIL: smoke tabela hub_leads_crm");
  process.exit(leadSmoke.status ?? 1);
}

console.log("\n--- Testes unitários harness (prompt + event stream) ---\n");

const unit = spawnSync(
  "npx",
  [
    "vitest",
    "run",
    "lib/harness/build-system-prompt.test.ts",
    "lib/harness/runtime/event-stream-formatter.test.ts",
    "lib/harness/harness.test.ts",
  ],
  { cwd: root, stdio: "inherit", shell: true }
);

if (unit.status !== 0) {
  console.error("\nFAIL: testes unitários harness");
  process.exit(unit.status ?? 1);
}

console.log("\n--- Integração LLM (modo operar + lead) ---\n");

const integration = spawnSync(
  "npx",
  ["vitest", "run", "lib/harness/smoke-copiloto-operar.integration.test.ts"],
  { cwd: root, stdio: "inherit", shell: true }
);

if (integration.status !== 0) {
  console.error("\nFAIL: smoke integração harness");
  process.exit(integration.status ?? 1);
}

console.log("\nOK — smoke harness copiloto concluído.");
