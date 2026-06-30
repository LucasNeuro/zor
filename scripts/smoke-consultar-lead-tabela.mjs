/**
 * Smoke Fix-1: consultar lead na tabela hub_leads_crm (paridade com hub_operacao_empresa).
 * Uso: node scripts/smoke-consultar-lead-tabela.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

if (!process.env.STRICT_TLS) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

function loadEnv() {
  for (const name of [".env.local", ".env"]) {
    const p = resolve(root, name);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i < 1) continue;
      const k = t.slice(0, i).trim();
      let v = t.slice(i + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (!process.env[k]) process.env[k] = v;
    }
  }
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.log("SKIP: sem NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY");
  process.exit(0);
}

const tenant =
  process.env.DEFAULT_TENANT_ID?.trim() ||
  process.env.NEXT_PUBLIC_TENANT_ID?.trim() ||
  process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID?.trim() ||
  "";

if (!tenant) {
  console.error("FAIL: DEFAULT_TENANT_ID / NEXT_PUBLIC_TENANT_ID ausente no .env");
  process.exit(1);
}

const sb = createClient(url, key);

console.log("Tenant:", tenant);
console.log("Supabase:", url.replace(/https?:\/\//, "").split(".")[0] + "…");

// 1) Tabela real (Fix-1 — o que hub_int_crm_ent_lead consultar deve usar)
const tabela = await sb
  .from("hub_leads_crm")
  .select("id, nome, telefone, email, estagio, criado_em", { count: "exact" })
  .eq("tenant_id", tenant)
  .order("criado_em", { ascending: false })
  .limit(5);

if (tabela.error) {
  console.error("FAIL hub_leads_crm:", tabela.error.message);
  process.exit(1);
}

// 2) View enriquecida (caminho antigo — comparar)
const view = await sb
  .from("vw_rel_leads_enriquecidos")
  .select("id, nome", { count: "exact" })
  .limit(5);

console.log("\n--- Resultado ---");
console.log("hub_leads_crm (tabela):", tabela.count ?? tabela.data?.length ?? 0, "registos");
if (tabela.data?.length) {
  for (const row of tabela.data) {
    console.log(" ", row.id?.slice(0, 8) + "…", row.nome || "(sem nome)", row.estagio || "");
  }
} else {
  console.log("  (nenhum lead neste tenant na tabela)");
}

if (view.error) {
  console.log("vw_rel_leads_enriquecidos:", "ERRO —", view.error.message);
} else {
  console.log("vw_rel_leads_enriquecidos (view):", view.count ?? view.data?.length ?? 0, "registos");
  if ((tabela.count ?? 0) > 0 && (view.count ?? 0) === 0) {
    console.log("\nAVISO: há leads na tabela mas a view está vazia — vale revisar SQL da view.");
  }
}

if ((tabela.count ?? tabela.data?.length ?? 0) === 0) {
  console.log("\nOK smoke (tabela acessível, 0 leads neste tenant). Copiloto deve reportar zero com tool call.");
  process.exit(0);
}

console.log("\nOK smoke Fix-1 — tabela hub_leads_crm acessível com service_role.");
process.exit(0);
