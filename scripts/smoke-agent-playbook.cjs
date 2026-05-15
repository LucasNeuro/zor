/**
 * Smoke test: cria um agente de teste via API e verifica metadados do playbook.
 *
 * Requer servidor dev (`npm run dev`) e `.env` com:
 * - INTERNAL_API_KEY, NEXT_PUBLIC_APP_URL (ou PORT)
 * - SUPABASE_* e bucket `hub-agent-playbooks` aplicado
 *
 * Uso: node scripts/smoke-agent-playbook.cjs
 * Opcional: AGENTE_NOME="Meu QA" node scripts/smoke-agent-playbook.cjs
 */
const fs = require("fs");
const path = require("path");

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, "utf8");
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
      v = v.slice(1, -1);
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

function baseUrl() {
  const u = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  if (u) return u;
  const p = process.env.PORT || "3001";
  return `http://localhost:${p}`;
}

async function main() {
  loadDotEnv(path.join(__dirname, "..", ".env"));
  loadDotEnv(path.join(__dirname, "..", ".env.local"));

  const key = process.env.INTERNAL_API_KEY?.trim();
  const tenant = process.env.DEFAULT_TENANT_ID?.trim() || process.env.NEXT_PUBLIC_TENANT_ID?.trim();
  if (!key) {
    console.error("Falta INTERNAL_API_KEY no .env — ou testa pelo CRM (Novo agente) com login.");
    process.exit(1);
  }

  const root = baseUrl();
  const h = {
    "Content-Type": "application/json",
    "x-api-key": key,
  };
  if (tenant) h["x-tenant-id"] = tenant;

  const cargosRes = await fetch(`${root}/api/hub/cargos`, { headers: h });
  if (!cargosRes.ok) {
    const t = await cargosRes.text();
    console.error("GET /api/hub/cargos", cargosRes.status, t);
    process.exit(1);
  }
  const cargos = await cargosRes.json();
  if (!Array.isArray(cargos) || cargos.length === 0) {
    console.error("Nenhum cargo em hub_cargos_catalogo (ativo). Preencha a base primeiro.");
    process.exit(1);
  }
  const cargo_slug = cargos[0].slug;
  const nomeBase = process.env.AGENTE_NOME?.trim() || `QA Playbook ${new Date().toISOString().slice(0, 19)}`;

  console.log("POST /api/hub/agentes", { cargo_slug, nome: nomeBase });

  const postRes = await fetch(`${root}/api/hub/agentes`, {
    method: "POST",
    headers: h,
    body: JSON.stringify({ cargo_slug, nome: nomeBase }),
  });
  const created = await postRes.json().catch(() => ({}));
  if (!postRes.ok) {
    console.error("Erro ao criar agente:", postRes.status, created);
    process.exit(1);
  }
  const slug = created.agente_slug;
  if (!slug) {
    console.error("Resposta sem agente_slug:", created);
    process.exit(1);
  }
  console.log("Agente criado:", slug, "(aguarda pipeline playbook em background…)");

  const deadline = Date.now() + 120_000;
  let meta = null;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 3000));
    const getRes = await fetch(`${root}/api/hub/agentes/${encodeURIComponent(slug)}/playbook`, {
      headers: h,
    });
    meta = await getRes.json().catch(() => ({}));
    if (!getRes.ok) {
      console.warn("GET playbook", getRes.status, meta);
      continue;
    }
    if (meta.playbook_public_url) {
      console.log("\nOK — playbook gerado:");
      console.log("  playbook_object_path:", meta.playbook_object_path);
      console.log("  playbook_public_url:", meta.playbook_public_url);
      console.log("  playbook_generated_at:", meta.playbook_generated_at);
      process.exit(0);
    }
  }

  console.error("\nTimeout: playbook_public_url ainda vazio. Ver logs do `npm run dev` por [playbook].");
  console.error("Última meta:", meta);
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
