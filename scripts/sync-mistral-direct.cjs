/**
 * Sync Mistral directo (sem servidor Next): normaliza modelos + Agents API.
 * Uso: node scripts/sync-mistral-direct.cjs
 */
if (!process.env.STRICT_TLS) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

function parseEnvFile(filePath) {
  const o = {};
  if (!fs.existsSync(filePath)) return o;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    o[k] = v;
  }
  return o;
}

function loadEnv(root) {
  return { ...parseEnvFile(path.join(root, ".env")), ...parseEnvFile(path.join(root, ".env.local")) };
}

function mistralModel(env) {
  return env.MISTRAL_MODEL?.trim() || "mistral-small-latest";
}

function isClaudeOrLegacy(m) {
  const t = String(m ?? "").trim().toLowerCase();
  return !t ? false : ["haiku", "sonnet", "opus"].includes(t) || t.startsWith("claude-");
}

async function syncOne(supabase, row, key, model) {
  const slug = row.agente_slug;
  const body = {
    model,
    name: `hub-${slug}`.slice(0, 64),
    description: `Agente Hub «${row.nome || slug}» — sync directo.`,
    instructions: String(row.system_prompt_base || row.nome || slug).slice(0, 32000),
  };

  const headers = {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  let mistralId = row.mistral_agent_id?.trim();
  let created = false;

  if (mistralId) {
    const res = await fetch(`https://api.mistral.ai/v1/agents/${encodeURIComponent(mistralId)}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const res2 = await fetch("https://api.mistral.ai/v1/agents", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      const t2 = await res2.text();
      if (!res2.ok) {
        await supabase
          .from("hub_agente_identidade")
          .update({ mistral_agent_sync_erro: t2.slice(0, 2000) })
          .eq("agente_slug", slug);
        return { ok: false, error: t2.slice(0, 200) };
      }
      const d2 = JSON.parse(t2);
      mistralId = d2.id || d2.agent_id;
      created = true;
    }
  } else {
    const res = await fetch("https://api.mistral.ai/v1/agents", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) {
      await supabase
        .from("hub_agente_identidade")
        .update({ mistral_agent_sync_erro: text.slice(0, 2000) })
        .eq("agente_slug", slug);
      return { ok: false, error: text.slice(0, 200) };
    }
    const d = JSON.parse(text);
    mistralId = d.id || d.agent_id;
    created = true;
  }

  await supabase
    .from("hub_agente_identidade")
    .update({
      mistral_agent_id: mistralId,
      mistral_agent_sync_em: new Date().toISOString(),
      mistral_agent_sync_erro: null,
    })
    .eq("agente_slug", slug);

  return { ok: true, mistral_agent_id: mistralId, created };
}

async function main() {
  const env = loadEnv(path.join(__dirname, ".."));
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const srk = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const mk = env.MISTRAL_API_KEY?.trim();
  if (!url || !srk || !mk) {
    console.error("Supabase + MISTRAL_API_KEY obrigatórios.");
    process.exit(1);
  }

  const supabase = createClient(url, srk);
  const model = mistralModel(env);

  const { data: rows } = await supabase
    .from("hub_agente_identidade")
    .select(
      "agente_slug, nome, system_prompt_base, modelo_padrao, mistral_agent_id, mistral_agent_sync_habilitado"
    )
    .order("agente_slug");

  console.log("\n=== SYNC MISTRAL DIRECTO ===\n");
  console.log("Modelo Agents API:", model, "\n");

  for (const row of rows ?? []) {
    if (isClaudeOrLegacy(row.modelo_padrao)) {
      await supabase
        .from("hub_agente_identidade")
        .update({ modelo_padrao: "mistral", modelo_critico: "mistral", modelo_alto_valor: "mistral" })
        .eq("agente_slug", row.agente_slug);
      console.log(`modelo → mistral: ${row.agente_slug}`);
    }

    if (row.mistral_agent_sync_habilitado !== true) {
      console.log(`— ${row.agente_slug}: sync off (skip)`);
      continue;
    }

    process.stdout.write(`→ ${row.agente_slug}... `);
    const out = await syncOne(supabase, row, mk, model);
    console.log(out.ok ? `OK ${out.mistral_agent_id}` : `FALHOU ${out.error}`);
  }
  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
