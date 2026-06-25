import type { SupabaseClient } from "@supabase/supabase-js";
import { completarChatPreferindoMistral } from "@/lib/ia/llm-completion";
import { completarChatComFerramentasMistral } from "@/lib/ia/llm-completion-tools";
import { construirPrompt } from "@/lib/ia/prompt-builder";
import { formatarBlocoContextoConversa } from "@/lib/ia/conversation-context";
import { resolveInferenceModelId, isMistralFamilyModelId } from "@/lib/ia/hub-model-defaults";
import {
  ferramentasMistralListaParaAgente,
  mergeUsoFerramentasComPadraoPreservandoCustom,
  mergeUsoFerramentasWhatsappCanal,
  agenteRaciocinioAvancadoAtivo,
} from "@/lib/hub/agente-ferramentas-registry";
import { executarFerramentaHub } from "@/lib/hub/executar-ferramenta-ia";
import {
  fetchFerramentasCustomAtivas,
  rowParaMistralDef,
  type FerramentaCustomParaMistral,
} from "@/lib/hub/ferramentas-custom-db";
import {
  fetchFerramentasExternasAtivas,
  rowParaMistralDefExterna,
  type FerramentaExternaParaMistral,
} from "@/lib/hub/ferramentas-externas-db";
import {
  ferramentasIntegradorAtivasParaTenant,
} from "@/lib/hub/integradores-runtime";
import type { FerramentaIntegradorDefMistral } from "@/lib/hub/agente-ferramentas-registry";
import { defaultTenantId } from "@/lib/tenant-default";
import { blocoDadosCanalWhatsappCrm } from "@/lib/crm/sincronizar-contato-whatsapp";
import { blocoIsolamentoConversaWhatsapp } from "@/lib/crm/isolamento-conversa-lead";
import { WHATSAPP_CANAL_PREAMBLE } from "@/lib/ia/atendimento-fluido";
import { garantirLeadSimulacaoCanal } from "@/lib/simulacao-canal/lead-simulacao";
import { agenteEhCopilotoInterno, isModoOperacaoAgente } from "@/lib/hub/agente-modo-operacao";
import { blocoEscopoFuncaoCopilotoInterno } from "@/lib/hub/copiloto-interno-escopo";
import { loadPublishedPlaybookRuntimeSource } from "@/lib/playbook/published-runtime";
import {
  avancarEstadoFluxoSimulacao,
  buildBlocoContextoFluxoParaLlm,
  loadSimFlowStateFromSessao,
  type SimFlowState,
} from "@/lib/playbook/simulacao-canal-flow";
import { playbookMenuUazapiEnhancementEnabled } from "@/lib/whatsapp/playbook-flow-runtime";

const MAX_SNAPSHOT_ACOES = 35;
const MAX_SNAPSHOT_CICLO_LOG = 60;
const MAX_SNAPSHOT_PROMPTS = 20;

export const BRIEFING_SYSTEM_PREAMBLE = `Você está no MODO BRIEFING INTERNO do CRM Waje (equipe), em conversa com um colega humano.
Regras absolutas:
- Use apenas os dados fornecidos no bloco "DADOS_OPERACIONAIS (somente leitura)" para falar sobre execuções, leads e ciclos. Se algo não aparecer lá, diga que não há registro — não invente.
- Esse bloco são **extractos internos de apoio** (ficheiros de registo no sistema), **não** são "ferramentas" do modelo nem botões que o colega possa clicar. Não os apresente como lista de ferramentas com nomes técnicos de tabela; diga apenas que tem acesso a dados de revisão interna.
- **Ferramentas Hub / Mistral** (resumo de lead, memórias, registo de nota, etc.) **não são invocadas neste painel**. Elas só correm na **engine em produção**, quando há **sessão com lead** (ex.: WhatsApp ou Hub). Aqui não há chamadas ao servidor como na conversa ao vivo — apenas interpretação do que já foi gravado nos extractos.
- Você NÃO está atendendo cliente final. NÃO simule WhatsApp, NÃO prometa envio de mensagens, NÃO altere CRM. Apenas explique, resuma e oriente revisão humana.
- Cite nomes de leads quando aparecerem nos dados (contexto interno autorizado).
- Seja objetivo e útil para operação: status, últimos erros, o que revisar em Ciclos IA / logs.
`;

export function copilotoInternoPreamble(
  agenteNome: string,
  cargo?: string,
  escopoExtra?: string
): string {
  const cargoLinha = cargo?.trim() ? `Cargo: ${cargo.trim()}.` : "";
  return `Você é o **copiloto interno** de **${agenteNome}** no CRM Waje — um assistente para a equipa, no estilo de um chat especializado (como um ChatGPT do papel deste agente).
${cargoLinha}
Regras:
- Converse com um colega humano (gestor, operador ou admin): tom natural, claro e útil.
- Explique a **função real deste agente** conforme o escopo oficial abaixo — não invente encaminhamentos nem atendimento WhatsApp.
- Use as **memórias deste agente** (só de ${agenteNome}), cargo, playbook e extractos operacionais quando relevante — nunca misture contexto de outro assistente.
- Este agente **não atende cliente final** e **não simula WhatsApp/Hub** neste painel.
- Ferramentas automáticas não são executadas aqui; interprete apenas o que já está nos extractos.
- Se faltar dado nos extractos, diga que não há registro — não invente.
${escopoExtra?.trim() ? `\n${escopoExtra.trim()}` : ""}`;
}

/** Pré-texto para o modo que espelha o system prompt de produção (prompt-builder), sem snapshot operacional. */
export const SIMULACAO_CANAL_PREAMBLE = `${WHATSAPP_CANAL_PREAMBLE}

### SIMULAÇÃO INTERNA (painel CRM)
- Não diga que está em simulação, briefing ou teste interno.
- WhatsApp real não envia mensagens neste painel — menus ficam simulados; ferramentas CRM e **Google Calendar/Gmail** funcionam de verdade (criam eventos na conta ligada).`;

export type BriefingModoSessao = "briefing_interno" | "simulacao_canal";

export type BriefingMensagemLinha = {
  papel: "user" | "assistant";
  conteudo: string;
};

function trunc(s: string, n: number): string {
  const t = (s || "").trim();
  if (t.length <= n) return t;
  return `${t.slice(0, n)}…`;
}

export async function montarSnapshotOperacionalReadOnly(
  supabase: SupabaseClient,
  agenteSlug: string,
  agenteNome: string
): Promise<string> {
  const blocos: string[] = [];
  blocos.push(`Agente: ${agenteNome} (${agenteSlug})`);
  blocos.push(`Gerado em (UTC aproximado do servidor): ${new Date().toISOString()}`);

  try {
    const { data: ciclos } = await supabase
      .from("hub_ciclos_ia")
      .select("nome, tipo, ativo, ultimo_ciclo, ultimo_status, total_execucoes, intervalo_minutos, cron_expressao")
      .eq("agente_slug", agenteSlug)
      .order("nome");
    if (ciclos?.length) {
      blocos.push("\n## Ciclos IA (cadastro)");
      for (const c of ciclos as Record<string, unknown>[]) {
        blocos.push(
          `- ${c.nome} | tipo=${c.tipo} | ativo=${c.ativo} | último_status=${c.ultimo_status ?? "—"} | exec=${c.total_execucoes ?? 0} | último_ciclo=${c.ultimo_ciclo ?? "—"}`
        );
      }
    } else {
      blocos.push("\n## Ciclos IA: nenhum registro para este slug.");
    }
  } catch {
    blocos.push("\n## Ciclos IA: falha ao ler.");
  }

  try {
    const { data: logs } = await supabase
      .from("hub_ciclos_log")
      .select("status, erro, iniciado_em, tokens_usados, custo_brl, acoes_tomadas")
      .eq("agente_slug", agenteSlug)
      .order("iniciado_em", { ascending: false })
      .limit(MAX_SNAPSHOT_CICLO_LOG);
    if (logs?.length) {
      blocos.push("\n## Histórico de corridas automáticas (últimas execuções)");
      for (const row of logs as Record<string, unknown>[]) {
        const ac = row.acoes_tomadas && typeof row.acoes_tomadas === "object" ? JSON.stringify(row.acoes_tomadas) : "";
        blocos.push(
          `- ${row.iniciado_em} | ${row.status} | tok=${row.tokens_usados ?? "—"} | R$=${row.custo_brl ?? "—"} | erro=${row.erro ? trunc(String(row.erro), 120) : "—"} | acoes=${trunc(ac, 200)}`
        );
      }
    } else {
      blocos.push("\n## Histórico de corridas: ainda sem linhas (normal antes da 1ª execução).");
    }
  } catch {
    blocos.push("\n## Histórico de corridas: falha ao ler.");
  }

  try {
    const { data: acoes } = await supabase
      .from("hub_acoes_ia")
      .select("id, tipo, descricao, lead_id, sucesso, erro, criado_em")
      .eq("agente_slug", agenteSlug)
      .order("criado_em", { ascending: false })
      .limit(MAX_SNAPSHOT_ACOES);

    const leadIds = [...new Set((acoes || []).map((a: { lead_id?: string }) => a.lead_id).filter(Boolean))] as string[];
    let nomesPorLead: Record<string, string> = {};
    if (leadIds.length > 0) {
      const { data: leads } = await supabase.from("hub_leads_crm").select("id, nome").in("id", leadIds);
      if (leads) {
        nomesPorLead = Object.fromEntries(leads.map((l: { id: string; nome: string }) => [l.id, l.nome]));
      }
    }

    if (acoes?.length) {
      blocos.push("\n## Últimas acções registadas pela IA para leads");
      for (const a of acoes as { tipo?: string; descricao?: string; lead_id?: string; sucesso?: boolean; erro?: string; criado_em?: string }[]) {
        const nomeLead = a.lead_id ? nomesPorLead[a.lead_id] || `(lead ${String(a.lead_id).slice(0, 8)}…)` : "—";
        blocos.push(
          `- ${a.criado_em} | ${a.tipo} | sucesso=${a.sucesso} | lead=${nomeLead} | ${trunc(String(a.descricao || ""), 160)} | erro=${a.erro ? trunc(String(a.erro), 80) : "—"}`
        );
      }
    } else {
      blocos.push("\n## Acções IA: sem linhas recentes.");
    }
  } catch {
    blocos.push("\n## Acções IA: falha ao ler.");
  }

  try {
    const { data: prompts } = await supabase
      .from("hub_prompt_logs")
      .select("criado_em, mensagem_usuario, modelo_usado, lead_id, tokens_input, tokens_output, custo_estimado_brl")
      .eq("agente_slug", agenteSlug)
      .order("criado_em", { ascending: false })
      .limit(MAX_SNAPSHOT_PROMPTS);
    if (prompts?.length) {
      blocos.push("\n## Últimas interações da engine com clientes (trechos)");
      for (const p of prompts as Record<string, unknown>[]) {
        blocos.push(
          `- ${p.criado_em} | modelo=${p.modelo_usado ?? "—"} | lead_id=${p.lead_id ?? "—"} | tok in/out=${p.tokens_input ?? "—"}/${p.tokens_output ?? "—"} | usr=${trunc(String(p.mensagem_usuario || ""), 100)}`
        );
      }
    } else {
      blocos.push("\n## Logs de pedidos ao modelo: sem linhas para este agente.");
    }
  } catch {
    blocos.push("\n## Logs de pedidos ao modelo: falha ao ler (schema ou permissões).");
  }

  return `### DADOS_OPERACIONAIS (somente leitura)\n${blocos.join("\n")}`;
}

function calcularCustoBrl(modelo: string, input: number, output: number): { brl: number; usd: number } {
  const inM = input / 1_000_000;
  const outM = output / 1_000_000;
  let usd = 0;
  const m = modelo.toLowerCase();
  if (m.includes("mistral") || m.includes("mixtral") || m.includes("ministral")) {
    usd = inM * 0.2 + outM * 0.6;
    return { usd, brl: usd * 5.5 };
  }
  if (m.includes("haiku")) usd = inM * 1 + outM * 5;
  else if (m.includes("sonnet")) usd = inM * 3 + outM * 15;
  else if (m.includes("opus")) usd = inM * 15 + outM * 75;
  else usd = inM * 3 + outM * 15;
  return { usd, brl: usd * 5.5 };
}

export type BriefingChatReplyResult = {
  texto: string;
  modelo: string;
  tokens_input: number;
  tokens_output: number;
  custo_brl: number;
  motor?: "briefing_interno" | "playbook_ia" | "llm_prompt";
  flow_state?: SimFlowState;
};

export async function executarBriefingReply(params: {
  modelo: string;
  agenteNome: string;
  agenteSlug: string;
  cargo?: string;
  area?: string;
  bio?: string;
  promptBaseTrecho?: string;
  playbookTrecho?: string;
  snapshot: string;
  historico: BriefingMensagemLinha[];
  mensagemUsuario: string;
  memoriasAgenteBloco?: string;
  modoOperacao?: string | null;
  agentReasoningEnabled?: boolean;
}): Promise<BriefingChatReplyResult> {
  const ehCopilotoInterno = agenteEhCopilotoInterno(
    isModoOperacaoAgente(params.modoOperacao) ? params.modoOperacao : null
  );
  const limitePromptBase = ehCopilotoInterno ? 3_200 : 1_200;

  const identity = [
    `Identidade do agente: nome=${params.agenteNome}, slug=${params.agenteSlug}`,
    params.cargo ? `Cargo: ${params.cargo}` : null,
    params.promptBaseTrecho
      ? `Instruções base do agente:\n${trunc(params.promptBaseTrecho, limitePromptBase)}`
      : null,
    params.playbookTrecho
      ? `Referência do playbook publicado (função operacional):\n${trunc(params.playbookTrecho, ehCopilotoInterno ? 2_400 : 1_200)}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const escopoInterno = ehCopilotoInterno
    ? blocoEscopoFuncaoCopilotoInterno({
        cargo: params.cargo,
        area: params.area,
        bio: params.bio,
      })
    : "";

  const preamble = ehCopilotoInterno
    ? copilotoInternoPreamble(params.agenteNome, params.cargo, escopoInterno)
    : BRIEFING_SYSTEM_PREAMBLE;

  const system = [
    preamble,
    identity,
    params.memoriasAgenteBloco?.trim() || null,
    params.snapshot,
  ]
    .filter(Boolean)
    .join("\n\n");

  const mensagens: Array<{ role: "user" | "assistant"; content: string }> = [];
  const anterior = [...params.historico];
  for (const m of anterior) {
    if (m.papel === "user") mensagens.push({ role: "user", content: m.conteudo });
    else mensagens.push({ role: "assistant", content: m.conteudo });
  }
  mensagens.push({ role: "user", content: params.mensagemUsuario });

  const out = await completarChatPreferindoMistral({
    systemPrompt: system,
    mensagens,
    modeloFromDb: params.modelo,
    maxTokens: 2048,
    agentReasoningEnabled: params.agentReasoningEnabled,
  });
  if (!out.ok) throw new Error(out.erro);

  const { brl } = calcularCustoBrl(out.modeloLog, out.tokensEntrada, out.tokensSaida);
  return {
    texto: out.texto,
    modelo: out.modeloLog,
    tokens_input: out.tokensEntrada,
    tokens_output: out.tokensSaida,
    custo_brl: brl,
    motor: "briefing_interno",
  };
}

export async function carregarTrechoPlaybookCopiloto(
  supabase: SupabaseClient,
  agenteSlug: string,
  meta: {
    playbook_generated_at?: string | null;
    playbook_object_path?: string | null;
    playbook_public_url?: string | null;
    playbook_source_hash?: string | null;
  }
): Promise<string | undefined> {
  const loaded = await loadPublishedPlaybookRuntimeSource(supabase, agenteSlug, meta);
  if (!loaded.ok) return undefined;
  return loaded.prompt;
}

export type SimulacaoCanalReplyResult = BriefingChatReplyResult;

async function executarSimulacaoCanalLlm(params: {
  agenteSlug: string;
  historico: BriefingMensagemLinha[];
  mensagemUsuario: string;
  blocoFluxoExtra?: string;
  motor: "playbook_ia" | "llm_prompt";
  flowState?: SimFlowState;
  supabase?: SupabaseClient;
  sessaoId?: string;
  tenantId?: string | null;
  modoOperacao?: string | null;
  agenteNome?: string | null;
}): Promise<SimulacaoCanalReplyResult> {
  const turnosConversa = params.historico.map((m) => ({
    role: (m.papel === "user" ? "user" : "assistant") as "user" | "assistant",
    content: m.conteudo,
  }));

  let leadId: string | undefined;
  let telefoneSim = "";
  let pushNameSim: string | undefined;

  if (params.supabase && params.sessaoId) {
    const leadSim = await garantirLeadSimulacaoCanal(params.supabase, {
      sessaoId: params.sessaoId,
      agenteSlug: params.agenteSlug,
      tenantId: params.tenantId,
      agenteNome: params.agenteNome,
    });
    leadId = leadSim.leadId;
    telefoneSim = leadSim.telefone;
    pushNameSim = leadSim.nome;
  }

  const pc = await construirPrompt({
    agenteSlug: params.agenteSlug,
    leadId,
    canal: "whatsapp",
    turnosAnteriores: params.historico.length,
    mensagemAtual: params.mensagemUsuario,
    turnosConversa: [...turnosConversa, { role: "user", content: params.mensagemUsuario }],
    blocoContextoFluxoPlaybook: params.blocoFluxoExtra?.trim() || undefined,
  });
  if (!pc) {
    throw new Error(
      "Não foi possível montar o prompt do agente. Verifique se o modelo está ativo em hub_agente_identidade."
    );
  }

  let systemPrompt = [
    SIMULACAO_CANAL_PREAMBLE,
    `═══ IDENTIDADE DA SIMULAÇÃO ═══
Você é **${pc.agenteNome}** neste teste. Responda sempre com o nome, tom e função deste assistente — nunca como outro agente do sistema.`,
    pc.systemPrompt,
  ]
    .filter(Boolean)
    .join("\n\n");

  if (turnosConversa.length > 0) {
    const blocoCtx = formatarBlocoContextoConversa(turnosConversa);
    if (blocoCtx) systemPrompt = `${systemPrompt}\n\n${blocoCtx}`;
  }

  if (telefoneSim) {
    systemPrompt = `${systemPrompt}\n\n${blocoDadosCanalWhatsappCrm({
      telefone: telefoneSim,
      pushName: pushNameSim,
      leadId,
    })}\n\n${blocoIsolamentoConversaWhatsapp(telefoneSim)}`;
  }

  const mensagens: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (const m of params.historico) {
    if (m.papel === "user") mensagens.push({ role: "user", content: m.conteudo });
    else mensagens.push({ role: "assistant", content: m.conteudo });
  }
  mensagens.push({ role: "user", content: params.mensagemUsuario });

  const playbookIaTurn =
    params.motor === "playbook_ia" || Boolean(params.blocoFluxoExtra?.trim());

  let out: Awaited<ReturnType<typeof completarChatPreferindoMistral>> | null = null;
  let agentReasoningEnabled = false;

  if (params.supabase) {
    const { data: ferrIaRowMeta } = await params.supabase
      .from("hub_agente_identidade")
      .select("uso_ferramentas_ia, modo_operacao")
      .eq("agente_slug", params.agenteSlug)
      .maybeSingle();
    const modoOpMeta =
      params.modoOperacao ??
      ferrIaRowMeta?.modo_operacao ??
      "canal_whatsapp";
    const usoMeta = mergeUsoFerramentasWhatsappCanal(
      mergeUsoFerramentasComPadraoPreservandoCustom(ferrIaRowMeta?.uso_ferramentas_ia ?? {}),
      modoOpMeta
    );
    agentReasoningEnabled = agenteRaciocinioAvancadoAtivo(usoMeta);
  }

  if (params.supabase && leadId) {
    const tenantForTools = (params.tenantId && params.tenantId.trim()) || defaultTenantId();
    const { data: ferrIaRow } = await params.supabase
      .from("hub_agente_identidade")
      .select("motor_ferramentas_habilitado, uso_ferramentas_ia, modo_operacao")
      .eq("agente_slug", params.agenteSlug)
      .maybeSingle();

    const motorFerramentas = ferrIaRow?.motor_ferramentas_habilitado === true;
    const modoOp =
      params.modoOperacao ??
      ferrIaRow?.modo_operacao ??
      "canal_whatsapp";

    let customDefs: FerramentaCustomParaMistral[] = [];
    try {
      const rows = await fetchFerramentasCustomAtivas(params.supabase, tenantForTools);
      customDefs = rows.map(rowParaMistralDef);
    } catch {
      customDefs = [];
    }
    let extDefs: FerramentaExternaParaMistral[] = [];
    try {
      const extRows = await fetchFerramentasExternasAtivas(params.supabase, tenantForTools);
      extDefs = extRows.map(rowParaMistralDefExterna);
    } catch {
      extDefs = [];
    }
    let intDefs: FerramentaIntegradorDefMistral[] = [];
    try {
      const rows = await ferramentasIntegradorAtivasParaTenant(params.supabase, tenantForTools);
      intDefs = rows.map((r) => ({
        ferramenta_key: r.ferramenta_key,
        descricao_modelo: r.descricao_modelo,
        parametros_schema: r.parametros_schema,
      }));
    } catch {
      intDefs = [];
    }

    const usoMap = mergeUsoFerramentasWhatsappCanal(
      mergeUsoFerramentasComPadraoPreservandoCustom(ferrIaRow?.uso_ferramentas_ia ?? {}),
      modoOp
    );
    const mistralTools = ferramentasMistralListaParaAgente(usoMap, customDefs, extDefs, intDefs);
    const modeloResolved = resolveInferenceModelId(pc.modelo);
    const temMistralKey = Boolean(process.env.MISTRAL_API_KEY?.trim());
    const podeToolsMistral =
      temMistralKey &&
      motorFerramentas &&
      mistralTools.length > 0 &&
      isMistralFamilyModelId(modeloResolved);

    if (podeToolsMistral) {
      out = await completarChatComFerramentasMistral({
        systemPrompt,
        mensagens,
        modeloFromDb: pc.modelo,
        tools: mistralTools,
        maxTokens: 2048,
        playbookPublicado: pc.playbookPublicado === true,
        playbookIaTurn,
        agentReasoningEnabled,
        executarTool: (nome, argumentosSerializados) =>
          executarFerramentaHub(nome, argumentosSerializados, {
            leadId,
            agenteSlug: params.agenteSlug,
            tenantId: params.tenantId ?? tenantForTools,
            telefoneSessao: telefoneSim,
            modoOperacao: modoOp,
            simulacaoCanal: true,
          }),
      });
    }
  }

  if (!out?.ok) {
    const semTools = await completarChatPreferindoMistral({
      systemPrompt,
      mensagens,
      modeloFromDb: pc.modelo,
      maxTokens: 2048,
      playbookIaTurn,
      agentReasoningEnabled,
    });
    if (semTools.ok) out = semTools;
    else if (!out) out = semTools;
  }

  if (!out?.ok) throw new Error(out?.erro || "Falha ao gerar resposta");

  const { brl } = calcularCustoBrl(out.modeloLog, out.tokensEntrada, out.tokensSaida);
  return {
    texto: out.texto,
    modelo: out.modeloLog,
    tokens_input: out.tokensEntrada,
    tokens_output: out.tokensSaida,
    custo_brl: brl,
    motor: params.motor,
    flow_state: params.flowState,
  };
}

/**
 * Simulação de canal: **sempre Mistral** (cargo + conhecimento + RAG).
 * O fluxo WhatsApp publicado só orienta passo e coleta — não substitui a IA.
 */
export async function executarSimulacaoCanalReply(params: {
  agenteSlug: string;
  historico: BriefingMensagemLinha[];
  mensagemUsuario: string;
  supabase?: SupabaseClient;
  sessaoId?: string;
  modoOperacao?: string | null;
  tenantId?: string | null;
  agenteNome?: string | null;
}): Promise<SimulacaoCanalReplyResult> {
  let flowState: SimFlowState | undefined;
  let blocoFluxoExtra = "";

  if (params.supabase && params.sessaoId && params.modoOperacao === "canal_whatsapp") {
    const estadoInicial = await loadSimFlowStateFromSessao(params.supabase, params.sessaoId);
    const avancado = await avancarEstadoFluxoSimulacao({
      supabase: params.supabase,
      agenteSlug: params.agenteSlug,
      mensagemUsuario: params.mensagemUsuario,
      flowState: estadoInicial,
    });
    if (avancado) {
      flowState = avancado.flowState;
      blocoFluxoExtra = buildBlocoContextoFluxoParaLlm(
        avancado.definition,
        flowState,
        params.mensagemUsuario,
        playbookMenuUazapiEnhancementEnabled(),
        [
          ...params.historico.map((m) => ({
            role: (m.papel === "user" ? "user" : "assistant") as "user" | "assistant",
            content: m.conteudo,
          })),
          { role: "user" as const, content: params.mensagemUsuario },
        ]
      );
    }
  }

  return executarSimulacaoCanalLlm({
    agenteSlug: params.agenteSlug,
    historico: params.historico,
    mensagemUsuario: params.mensagemUsuario,
    blocoFluxoExtra,
    motor: blocoFluxoExtra ? "playbook_ia" : "llm_prompt",
    flowState,
    supabase: params.supabase,
    sessaoId: params.sessaoId,
    tenantId: params.tenantId,
    modoOperacao: params.modoOperacao,
    agenteNome: params.agenteNome,
  });
}