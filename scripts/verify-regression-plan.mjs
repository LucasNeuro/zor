/**
 * Checklist do plano "Auditoria não-regressão":
 * 1) Schema Supabase (tabelas financeiras, tenant_id em hub_negocios)
 * 2) Smoke APIs analytics + relatórios JSON
 * 3) Smoke export CSV financeiro (sem format=json)
 *
 * Uso: node scripts/verify-regression-plan.mjs
 * Opcional: BASE_URL=http://localhost:3001
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
  const out = {};
  for (const name of [".env", ".env.local"]) {
    const path = resolve(root, name);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
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
  }
  return out;
}

const env = { ...loadEnv(), ...process.env };
const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const srk = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const baseUrl = (env.BASE_URL || "http://localhost:3001").replace(/\/+$/, "");
const apiKey = env.INTERNAL_API_KEY?.trim() || env.NEXT_PUBLIC_INTERNAL_API_KEY?.trim();
const tenantId =
  env.DEFAULT_TENANT_ID?.trim() ||
  env.NEXT_PUBLIC_TENANT_ID?.trim() ||
  "00000000-0000-4000-8000-000000000001";

/** @type {Array<{ id: string; ok: boolean; detail: string }>} */
const results = [];

function record(id, ok, detail) {
  results.push({ id, ok, detail });
  const mark = ok ? "OK" : "FAIL";
  console.log(`[${mark}] ${id}: ${detail}`);
}

function isMissingColumn(err) {
  const code = err?.code ?? "";
  const msg = (err?.message ?? "").toLowerCase();
  return (
    code === "PGRST204" ||
    code === "42703" ||
    msg.includes("does not exist") ||
    msg.includes("column") && msg.includes("not exist")
  );
}

async function probeTable(sb, table, select) {
  const { error } = await sb.from(table).select(select).limit(1);
  if (!error) return { ok: true, detail: `tabela ${table} acessível` };
  if (isMissingColumn(error)) {
    return { ok: false, detail: `coluna em falta em ${table}: ${error.message}` };
  }
  const m = (error.message ?? "").toLowerCase();
  if (m.includes("could not find the table") || (m.includes("relation") && m.includes("does not exist"))) {
    return {
      ok: false,
      detail: `tabela ${table} não existe — execute docs/sql/relatorios-schema-fix.sql`,
    };
  }
  return { ok: false, detail: error.message ?? String(error) };
}

async function checkSchema() {
  if (!url || !srk) {
    record("schema:env", false, "Falta NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY");
    return;
  }
  record("schema:env", true, url.replace(/^https?:\/\//, "").slice(0, 40));

  const sb = createClient(url, srk, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const pagar = await probeTable(sb, "hub_contas_pagar", "id, descricao, status");
  record("schema:hub_contas_pagar", pagar.ok, pagar.detail);

  const receber = await probeTable(sb, "hub_contas_receber", "id, descricao, status");
  record("schema:hub_contas_receber", receber.ok, receber.detail);

  const negTenant = await probeTable(sb, "hub_negocios", "tenant_id");
  record("schema:hub_negocios.tenant_id", negTenant.ok, negTenant.detail);

  const negPrefixo = await probeTable(sb, "hub_negocios", "prefixo_mercado, etapa");
  record("schema:hub_negocios.prefixo_mercado", negPrefixo.ok, negPrefixo.detail);

  const empPrefixo = await probeTable(sb, "hub_empresas", "prefixo_mercado, razao_social");
  record("schema:hub_empresas.prefixo_mercado", empPrefixo.ok, empPrefixo.detail);

  const { error: mercadoErr } = await sb.from("hub_empresas").select("mercado").limit(1);
  if (mercadoErr && isMissingColumn(mercadoErr)) {
    record("schema:hub_empresas.sem_mercado", true, "coluna mercado ausente (esperado; usar prefixo_mercado)");
  } else if (!mercadoErr) {
    record("schema:hub_empresas.sem_mercado", true, "coluna mercado existe (relatórios usam prefixo_mercado)");
  } else {
    record("schema:hub_empresas.sem_mercado", false, mercadoErr.message ?? "");
  }
}

function apiHeaders() {
  const h = { "x-tenant-id": tenantId };
  if (apiKey) h["x-api-key"] = apiKey;
  return h;
}

async function fetchApi(path, opts = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    ...opts,
    headers: { ...apiHeaders(), ...(opts.headers || {}) },
  });
  const ct = res.headers.get("content-type") || "";
  let body;
  if (ct.includes("application/json")) {
    body = await res.json().catch(() => ({}));
  } else {
    body = await res.text();
  }
  return { res, body, ct };
}

async function checkApiSmoke() {
  if (!apiKey) {
    record("api:auth", false, "INTERNAL_API_KEY ausente — rotas /api podem retornar 401");
  } else {
    record("api:auth", true, "x-api-key configurado");
  }

  let serverUp = false;
  try {
    const ping = await fetch(`${baseUrl}/api/crm/analytics?periodo=24h`, {
      headers: apiHeaders(),
      signal: AbortSignal.timeout(8000),
    });
    serverUp = ping.status !== 0;
    if (ping.status === 503) {
      record("api:server", false, "Servidor responde mas Supabase CRM não configurado (503)");
      return;
    }
    if (ping.status === 401 || ping.status === 403) {
      record("api:server", false, `HTTP ${ping.status} — verifique INTERNAL_API_KEY / proxy`);
      return;
    }
    record("api:server", ping.ok || ping.status < 500, `HTTP ${ping.status} em ${baseUrl}`);
  } catch (e) {
    record(
      "api:server",
      false,
      `Servidor indisponível em ${baseUrl} — execute: node scripts/dev-insecure-tls.cjs (${e instanceof Error ? e.message : e})`
    );
    return;
  }

  const { res: a1, body: p1 } = await fetchApi("/api/crm/analytics?periodo=24h");
  const funilLeads = Array.isArray(p1?.funilLeads) ? p1.funilLeads.length : 0;
  const okAnalytics =
    a1.ok &&
    typeof p1 === "object" &&
    Array.isArray(p1.funilLeads) &&
    Array.isArray(p1.funilNegocios);
  record(
    "smoke:analytics/leads",
    okAnalytics,
    okAnalytics
      ? `funilLeads=${funilLeads} etapas, funilNegocios=${p1.funilNegocios.length} (vazio sem mercado OK)`
      : p1?.error ?? `HTTP ${a1.status}`
  );

  const { res: a2, body: p2 } = await fetchApi("/api/crm/analytics?periodo=24h&mercado=IMB");
  const okMercado =
    a2.ok && Array.isArray(p2?.funilNegocios) && p2.funilNegocios.length > 0;
  record(
    "smoke:analytics/mercado=IMB",
    okMercado,
    okMercado
      ? `funilNegocios=${p2.funilNegocios.length} barras`
      : p2?.error ?? `HTTP ${a2.status} — verifique hub_negocios.tenant_id e dados IMB`
  );

  const entidades = ["leads", "negocios", "empresas", "imoveis", "financeiro"];
  for (const ent of entidades) {
    const { res, body } = await fetchApi(
      `/api/crm/relatorios/export?entidade=${ent}&format=json`
    );
    const ok =
      res.ok &&
      body?.entidade === ent &&
      Array.isArray(body.headers) &&
      Array.isArray(body.rows);
    const aviso = body?.aviso ? ` aviso=${String(body.aviso).slice(0, 80)}` : "";
    record(
      `smoke:relatorios/json/${ent}`,
      ok,
      ok ? `rows=${body.rows.length}${aviso}` : body?.error ?? `HTTP ${res.status}`
    );
  }

  for (const ent of ["contas_pagar", "contas_receber", "financeiro"]) {
    const { res, body, ct } = await fetchApi(`/api/crm/relatorios/export?entidade=${ent}`);
    const isCsv =
      res.ok &&
      (ct.includes("text/csv") || typeof body === "string") &&
      (typeof body === "string" ? body.includes(",") : true);
    const disp = res.headers.get("content-disposition") || "";
    record(
      `smoke:csv/${ent}`,
      isCsv && disp.includes("attachment"),
      isCsv
        ? `Content-Type=${ct.split(";")[0]} · ${disp.slice(0, 50)}`
        : body?.error ?? `HTTP ${res.status} — esperado CSV attachment`
    );
  }
}

async function main() {
  console.log("\n=== Verificação plano não-regressão ===\n");
  await checkSchema();
  console.log("");
  await checkApiSmoke();
  console.log("");

  const failed = results.filter((r) => !r.ok);
  const passed = results.filter((r) => r.ok);
  console.log(`Resumo: ${passed.length} OK, ${failed.length} FAIL\n`);
  if (failed.length) {
    console.log("Itens em falha:");
    for (const f of failed) console.log(`  - ${f.id}: ${f.detail}`);
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
