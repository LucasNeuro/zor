/**
 * Auditoria: motor de ferramentas e toggles por agente.
 * Lê `.env` / `.env.local`. Não imprime segredos.
 *
 * Uso: npm run audit:ferramentas
 */
if (!process.env.STRICT_TLS) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const BUILTIN_TOOLS = [
  "hub_lead_resumo",
  "hub_lead_memorias",
  "hub_lead_lookup_por_telefone",
  "hub_metricas_escritorio",
  "hub_relatorio_html_simples",
  "hub_registar_nota_lead",
  "hub_whatsapp_menu",
  "hub_atualizar_lead",
];

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
  return {
    ...parseEnvFile(path.join(root, ".env")),
    ...parseEnvFile(path.join(root, ".env.local")),
  };
}

function coalesceBool(v) {
  return v === true || v === "true" || v === 1 || v === "1";
}

function countToolsAtivas(uso) {
  if (!uso || typeof uso !== "object") return { total: 0, custom: 0, builtins: 0 };
  let total = 0;
  let custom = 0;
  let builtins = 0;
  for (const [k, v] of Object.entries(uso)) {
    if (!coalesceBool(v)) continue;
    total += 1;
    if (k.startsWith("hub_custom_")) custom += 1;
    else if (BUILTIN_TOOLS.includes(k)) builtins += 1;
  }
  return { total, custom, builtins };
}

function calcularAlerta(row, counts) {
  if (!row.motor_ferramentas_habilitado) return "motor_desligado";
  if (counts.total === 0) return "motor_ligado_sem_tools";
  if (
    row.modo_operacao === "canal_whatsapp" &&
    !coalesceBool(row.uso_ferramentas_ia?.hub_whatsapp_menu) &&
    coalesceBool(row.uso_ferramentas_ia?.hub_atualizar_lead)
  ) {
    return "whatsapp_sem_menu_interactivo";
  }
  return "ok";
}

function pad(s, n) {
  const t = String(s ?? "");
  return t.length >= n ? t.slice(0, n - 1) + "…" : t.padEnd(n);
}

async function main() {
  const root = path.join(__dirname, "..");
  const env = loadEnv(root);
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const srk = env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !srk) {
    console.error("[audit:ferramentas] NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios.");
    process.exit(1);
  }

  const supabase = createClient(url, srk);
  const { data, error } = await supabase
    .from("hub_agente_identidade")
    .select(
      "agente_slug, nome, ativo, modo_operacao, modelo_padrao, motor_ferramentas_habilitado, mistral_agent_sync_habilitado, mistral_agent_id, mistral_agent_sync_erro, uso_ferramentas_ia"
    )
    .order("ativo", { ascending: false })
    .order("nome", { ascending: true });

  if (error) {
    console.error("[audit:ferramentas] Erro Supabase:", error.message);
    process.exit(1);
  }

  const rows = (data || []).map((r) => {
    const counts = countToolsAtivas(r.uso_ferramentas_ia);
    const alerta = calcularAlerta(r, counts);
    return { ...r, counts, alerta };
  });

  const resumo = {};
  for (const r of rows) {
    resumo[r.alerta] = (resumo[r.alerta] || 0) + 1;
  }

  console.log("\n=== AUDITORIA FERRAMENTAS POR AGENTE ===\n");
  console.log("Resumo alertas:", resumo);
  console.log(`Total agentes: ${rows.length}\n`);

  console.log(
    [
      pad("SLUG", 22),
      pad("NOME", 20),
      pad("ATIVO", 6),
      pad("MODO", 14),
      pad("MOTOR", 6),
      pad("TOOLS", 6),
      pad("ALERTA", 28),
    ].join(" ")
  );
  console.log("-".repeat(110));

  for (const r of rows) {
    console.log(
      [
        pad(r.agente_slug, 22),
        pad(r.nome, 20),
        pad(r.ativo ? "sim" : "nao", 6),
        pad(r.modo_operacao || "—", 14),
        pad(r.motor_ferramentas_habilitado ? "ON" : "OFF", 6),
        pad(String(r.counts.total), 6),
        pad(r.alerta, 28),
      ].join(" ")
    );
  }

  console.log("\n--- Detalhe tools activas ---\n");
  for (const r of rows) {
    const uso = r.uso_ferramentas_ia || {};
    const ativas = Object.entries(uso)
      .filter(([, v]) => coalesceBool(v))
      .map(([k]) => k);
    console.log(`${r.agente_slug} (${r.nome || "—"})`);
    console.log(`  motor=${r.motor_ferramentas_habilitado ? "ON" : "OFF"} | mistral_sync=${r.mistral_agent_sync_habilitado ? "ON" : "OFF"} | alerta=${r.alerta}`);
    console.log(`  tools: ${ativas.length ? ativas.join(", ") : "(nenhuma)"}`);
    if (r.mistral_agent_sync_erro) {
      console.log(`  mistral_erro: ${String(r.mistral_agent_sync_erro).slice(0, 120)}`);
    }
    console.log("");
  }

  const comProblema = rows.filter((r) => r.alerta !== "ok");
  if (comProblema.length) {
    console.log(`⚠ ${comProblema.length} agente(s) com alerta antes do deploy.\n`);
    process.exitCode = 0;
  } else {
    console.log("✓ Todos os agentes passaram na auditoria básica.\n");
  }
}

main().catch((e) => {
  console.error("[audit:ferramentas] fatal:", e instanceof Error ? e.message : e);
  process.exit(1);
});
