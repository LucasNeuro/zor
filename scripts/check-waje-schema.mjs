/**
 * Verifica no Supabase remoto se tabelas/views do bootstrap Waje existem.
 * Uso: node scripts/check-waje-schema.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  const envPath = resolve(root, ".env");
  const raw = readFileSync(envPath, "utf8");
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

async function probeTable(supabase, table) {
  const { error } = await supabase.from(table).select("id").limit(1);
  if (!error) return true;
  const msg = (error.message || "").toLowerCase();
  return !(
    msg.includes("could not find the table") ||
    (msg.includes("does not exist") && msg.includes("relation"))
  );
}

async function probeRpc(supabase) {
  const { error } = await supabase.rpc("hub_upsert_servicos_catalogo_batch", {
    p_tenant_id: "00000000-0000-0000-0000-000000000000",
    p_itens: [],
  });
  if (!error) return true;
  const msg = (error.message || "").toLowerCase();
  return !(
    msg.includes("could not find the function") ||
    (msg.includes("does not exist") && msg.includes("function"))
  );
}

const env = loadEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env");
  process.exit(1);
}

const supabase = createClient(url, key);

const checks = [
  ["hub_negocios", "Negócios (tabela)"],
  ["hub_contas_receber", "Contas a receber (tabela)"],
  ["hub_contas_pagar", "Contas a pagar (tabela)"],
  ["hub_tenant_servicos_catalogo", "Catálogo de serviços"],
  ["vw_rel_fluxo_caixa", "View fluxo de caixa"],
  ["vw_rel_contas_receber", "View contas a receber"],
  ["vw_rel_contas_pagar", "View contas a pagar"],
];

let allOk = true;
for (const [table, label] of checks) {
  const ok = await probeTable(supabase, table);
  console.log(`${ok ? "OK" : "FALTA"} — ${label} (${table})`);
  if (!ok) allOk = false;
}

const rpcOk = await probeRpc(supabase);
console.log(`${rpcOk ? "OK" : "FALTA"} — RPC sync catálogo`);
if (!rpcOk) allOk = false;

if (!allOk) {
  console.log("\nExecute no Supabase SQL Editor:");
  console.log("  - docs/sql/waje-hub-negocios.sql (só negócios — mais rápido)");
  console.log("  - ou docs/sql/waje-bootstrap-prioridade.sql (completo)");
  console.log("  - ou docs/sql/hub-upsert-servicos-catalogo-rpc.sql (só a RPC, se a tabela já existir)");
  console.log("Depois: Settings → API → Reload schema");
  console.log("\nNota: a app usa upsert direto na tabela quando a RPC está ausente (desde que hub_tenant_servicos_catalogo exista).");
  process.exit(2);
}

console.log("\nSchema Waje pronto para catálogo, negócios e financeiro.");
