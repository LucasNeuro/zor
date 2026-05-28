/**
 * Valida e corrige agentes modo canal_whatsapp + cargo (perguntas essenciais).
 * Uso: node scripts/validar-agentes-whatsapp.cjs
 *      node scripts/validar-agentes-whatsapp.cjs --fix
 */
if (!process.env.STRICT_TLS) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const FIX = process.argv.includes("--fix");

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

const root = path.join(__dirname, "..");
const env = { ...parseEnvFile(path.join(root, ".env")), ...parseEnvFile(path.join(root, ".env.local")) };
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env.local");
  process.exit(1);
}

const supabase = createClient(url, key);

const PERGUNTAS_SDR_PADRAO = [
  "Qual é o principal objetivo que você busca com esse projeto ou reforma?",
  "Qual é o seu orçamento estimado para esse projeto?",
  "Qual é o prazo que você tem em mente para iniciar ou concluir?",
  "Quem são os decisores envolvidos nesse processo?",
  "Já trabalhou com algum fornecedor ou prestador de serviço neste tipo de projeto?",
];

const SAUDACAO_PADRAO =
  "Oi, tudo bem? Meu nome é [Nome], da Obra10+. Vi que você entrou em contato conosco — como posso te ajudar hoje? Qual seu Nome?";

const USO_WHATSAPP_PADRAO = {
  hub_atualizar_lead: true,
  hub_lead_memorias: true,
  hub_lead_resumo: true,
  hub_lead_lookup_por_telefone: false,
  hub_metricas_escritorio: false,
  hub_relatorio_html_simples: false,
  hub_registar_nota_lead: true,
  hub_whatsapp_menu: true,
};

function coalesceBool(v) {
  return v === true || v === "true" || v === 1 || v === "1";
}

function cargoPareceAtendimento(cargo) {
  const t = `${cargo?.slug || ""} ${cargo?.titulo || ""} ${cargo?.segmento || ""}`.toLowerCase();
  return /sdr|qualific|atend|comercial|vendas|closer|capta|whatsapp|obra10/i.test(t);
}

async function main() {
  const { data: agentes, error: eA } = await supabase
    .from("hub_agente_identidade")
    .select(
      "agente_slug,nome,cargo,ativo,modo_operacao,motor_ferramentas_habilitado,uso_ferramentas_ia,uazapi_instance_token,uazapi_connection_status,mistral_agent_id"
    )
    .eq("ativo", true)
    .is("arquivado_em", null)
    .order("agente_slug");

  if (eA) {
    console.error("Erro agentes:", eA.message);
    process.exit(1);
  }

  const { data: cargos, error: eC } = await supabase
    .from("hub_cargos_catalogo")
    .select(
      "id,slug,titulo,ativo,saudacao_cliente,usar_perguntas_essenciais,ordem_perguntas_essenciais,perguntas_essenciais,comprimento_padrao"
    )
    .eq("ativo", true);

  if (eC) {
    console.error("Erro cargos:", eC.message);
    process.exit(1);
  }

  const cargoByTitulo = new Map();
  for (const c of cargos || []) {
    if (c.titulo) cargoByTitulo.set(String(c.titulo).trim(), c);
  }

  const temToken = (a) => Boolean(String(a.uazapi_instance_token || "").trim());
  const wa = (agentes || []).filter(
    (a) => a.modo_operacao === "canal_whatsapp" || temToken(a)
  );
  console.log(`\n=== Agentes WhatsApp (canal ou token UAZAPI): ${wa.length} ===\n`);

  const fixes = [];
  let ok = 0;
  let warn = 0;

  for (const ag of wa) {
    const cargo = cargoByTitulo.get(String(ag.cargo || "").trim());
    const issues = [];

    if (!temToken(ag)) issues.push("sem_token_uazapi");
    if (ag.modo_operacao !== "canal_whatsapp") issues.push("modo_operacao_nao_canal_whatsapp");
    if (ag.uazapi_connection_status && ag.uazapi_connection_status !== "connected") {
      issues.push(`whatsapp_status_${ag.uazapi_connection_status}`);
    }
    if (!cargo) issues.push("cargo_nao_encontrado_no_catalogo");
    else {
      if (!cargo.usar_perguntas_essenciais) issues.push("cargo_sem_perguntas_essenciais");
      const n = Array.isArray(cargo.perguntas_essenciais) ? cargo.perguntas_essenciais.length : 0;
      if (n < 1) issues.push("cargo_sem_lista_perguntas");
      if (!String(cargo.saudacao_cliente || "").trim()) issues.push("cargo_sem_saudacao");
    }
    if (!ag.motor_ferramentas_habilitado) issues.push("motor_ferramentas_desligado");
    const uso = ag.uso_ferramentas_ia || {};
    if (!coalesceBool(uso.hub_atualizar_lead)) issues.push("tool_hub_atualizar_lead_off");

    const status = issues.length === 0 ? "OK" : issues.join(", ");
    if (issues.length === 0) ok += 1;
    else warn += 1;

    console.log(`${ag.agente_slug} (${ag.nome})`);
    console.log(`  cargo: ${ag.cargo || "—"}`);
    if (cargo) {
      console.log(`  perguntas_essenciais: ${cargo.usar_perguntas_essenciais} (${(cargo.perguntas_essenciais || []).length} itens)`);
      if ((cargo.perguntas_essenciais || []).length) {
        (cargo.perguntas_essenciais || []).slice(0, 5).forEach((p, i) => {
          console.log(`    ${i + 1}. ${String(p).slice(0, 72)}${String(p).length > 72 ? "…" : ""}`);
        });
      }
      console.log(`  saudacao: ${String(cargo.saudacao_cliente || "").slice(0, 80)}…`);
    }
    console.log(`  motor_ferramentas: ${ag.motor_ferramentas_habilitado}`);
    console.log(`  status: ${status}\n`);

    if (FIX && issues.length > 0) {
      if (cargo && cargoPareceAtendimento(cargo)) {
        const patchCargo = {};
        if (!cargo.usar_perguntas_essenciais) patchCargo.usar_perguntas_essenciais = true;
        if (!Array.isArray(cargo.perguntas_essenciais) || cargo.perguntas_essenciais.length < 1) {
          patchCargo.perguntas_essenciais = PERGUNTAS_SDR_PADRAO;
        }
        if (!String(cargo.saudacao_cliente || "").trim()) {
          patchCargo.saudacao_cliente = SAUDACAO_PADRAO;
        }
        if (!String(cargo.comprimento_padrao || "").trim()) {
          patchCargo.comprimento_padrao = "Respostas objetivas, no máximo 2 frases por mensagem.";
        }
        if (Object.keys(patchCargo).length) {
          fixes.push(
            supabase.from("hub_cargos_catalogo").update(patchCargo).eq("id", cargo.id)
          );
        }
      }

      const patchAg = {};
      if (!ag.motor_ferramentas_habilitado) patchAg.motor_ferramentas_habilitado = true;
      const usoNovo = { ...(ag.uso_ferramentas_ia || {}), ...USO_WHATSAPP_PADRAO };
      if (!coalesceBool(uso.hub_atualizar_lead)) patchAg.uso_ferramentas_ia = usoNovo;
      if (ag.modo_operacao !== "canal_whatsapp") patchAg.modo_operacao = "canal_whatsapp";
      if (Object.keys(patchAg).length) {
        fixes.push(
          supabase.from("hub_agente_identidade").update(patchAg).eq("agente_slug", ag.agente_slug)
        );
      }
    }
  }

  const outros = (agentes || []).filter((a) => a.modo_operacao !== "canal_whatsapp");
  if (outros.length) {
    console.log(`=== Outros agentes ativos (não WhatsApp): ${outros.length} ===`);
    outros.forEach((a) => console.log(`  - ${a.agente_slug} (${a.modo_operacao || "null"})`));
  }

  if (FIX && fixes.length) {
    console.log(`\nAplicando ${fixes.length} correção(ões)...`);
    for (const p of fixes) {
      const { error } = await p;
      if (error) console.error("  ERRO:", error.message);
    }
    console.log("Concluído. Execute de novo sem --fix para rever.\n");
  } else if (warn > 0 && !FIX) {
    console.log(`Resumo: ${ok} OK, ${warn} com pendências. Rode com --fix para corrigir cargo/agente automaticamente.\n`);
  } else {
    console.log(`Resumo: ${ok} agentes WhatsApp prontos.\n`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
