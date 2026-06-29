/**
 * Motor unificado para agentes internos (copiloto CRM, ciclos programados).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { completarChatPreferindoMistral } from "@/lib/ia/llm-completion";
import { completarChatComFerramentasMistral } from "@/lib/ia/llm-completion-tools";
import { resolveInferenceModelId, isMistralFamilyModelId } from "@/lib/ia/hub-model-defaults";
import {
  agenteRaciocinioAvancadoAtivo,
  ferramentasMistralListaParaAgente,
  mergeUsoFerramentasComPadraoPreservandoCustom,
  mergeUsoFerramentasJobsInternos,
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
import { ferramentasIntegradorAtivasParaTenant } from "@/lib/hub/integradores-runtime";
import type { FerramentaIntegradorDefMistral } from "@/lib/hub/agente-ferramentas-registry";
import { defaultTenantId } from "@/lib/tenant-default";
import { agenteEhCopilotoInterno, isModoOperacaoAgente } from "@/lib/hub/agente-modo-operacao";
import { blocoEscopoFuncaoCopilotoInterno } from "@/lib/hub/copiloto-interno-escopo";
import { copilotoInternoPreamble } from "@/lib/agente-briefing-chat";
import type { BriefingChatReplyResult, BriefingMensagemLinha } from "@/lib/agente-briefing-chat";
import { HUB_DADOS_EMPRESA_VIEWS_PROMPT } from "@/lib/hub/hub-dados-empresa";
import { HUB_OPERACAO_EMPRESA_ENTIDADES_PROMPT } from "@/lib/hub/hub-operacao-empresa";

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

export type AgenteInternoTrigger = "copiloto" | "ciclo";

function trunc(s: string, n: number): string {
  const t = (s || "").trim();
  if (t.length <= n) return t;
  return `${t.slice(0, n)}…`;
}

const BLOCO_FERRAMENTAS_INTERNAS = `### FERRAMENTAS INTERNAS (function calling)
- **hub_operacao_empresa** — interface conversacional do CRM: consultar, obter, criar, actualizar e notas (leads, negócios, financeiro, KPIs, etc.). Prefira esta ferramenta para alterações.
- **hub_dados_empresa** — leitura rápida em views vw_rel_* (listas e números).
- Entidades operáveis:
${HUB_OPERACAO_EMPRESA_ENTIDADES_PROMPT}
- Views de consulta (vw_rel_*):
${HUB_DADOS_EMPRESA_VIEWS_PROMPT}
- **hub_metricas_escritorio** para contagens rápidas; integrações Google/HTTP se estiverem activas.
- Confirme ids reais com obter/consultar antes de gravar. Não invente números nem simule WhatsApp comercial.`;

export async function executarAgenteInterno(params: {
  supabase: SupabaseClient;
  modelo: string;
  agenteNome: string;
  agenteSlug: string;
  tenantId?: string | null;
  cargo?: string;
  area?: string;
  bio?: string;
  promptBaseTrecho?: string;
  playbookTrecho?: string;
  snapshot?: string;
  historico: BriefingMensagemLinha[];
  mensagemUsuario: string;
  memoriasAgenteBloco?: string;
  trigger: AgenteInternoTrigger;
  briefCiclo?: string;
}): Promise<BriefingChatReplyResult> {
  const tenantForTools = (params.tenantId && params.tenantId.trim()) || defaultTenantId();

  const { data: ferrIaRow } = await params.supabase
    .from("hub_agente_identidade")
    .select("motor_ferramentas_habilitado, uso_ferramentas_ia, modo_operacao")
    .eq("agente_slug", params.agenteSlug)
    .maybeSingle();

  const motorFerramentas = ferrIaRow?.motor_ferramentas_habilitado === true;
  const usoMap = mergeUsoFerramentasJobsInternos(
    mergeUsoFerramentasComPadraoPreservandoCustom(ferrIaRow?.uso_ferramentas_ia ?? {}),
    "jobs_internos"
  );
  const agentReasoningEnabled = agenteRaciocinioAvancadoAtivo(usoMap);

  const escopoInterno = blocoEscopoFuncaoCopilotoInterno({
    cargo: params.cargo,
    area: params.area,
    bio: params.bio,
  });

  const identity = [
    `Identidade: nome=${params.agenteNome}, slug=${params.agenteSlug}`,
    params.cargo ? `Cargo: ${params.cargo}` : null,
    params.promptBaseTrecho
      ? `Instruções base:\n${trunc(params.promptBaseTrecho, 3_200)}`
      : null,
    params.playbookTrecho
      ? `Playbook publicado:\n${trunc(params.playbookTrecho, 2_400)}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const triggerLinha =
    params.trigger === "ciclo"
      ? `Modo: **ciclo programado** (execução automática). Brief: ${params.briefCiclo?.trim() || "Análise operacional conforme cargo."}`
      : "Modo: **copiloto** (conversa com colega humano no CRM).";

  const preamble = copilotoInternoPreamble(params.agenteNome, params.cargo, escopoInterno);

  const system = [
    preamble,
    triggerLinha,
    BLOCO_FERRAMENTAS_INTERNAS,
    identity,
    params.memoriasAgenteBloco?.trim() || null,
    params.snapshot?.trim() || null,
  ]
    .filter(Boolean)
    .join("\n\n");

  const mensagens: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (const m of params.historico) {
    if (m.papel === "user") mensagens.push({ role: "user", content: m.conteudo });
    else mensagens.push({ role: "assistant", content: m.conteudo });
  }
  mensagens.push({ role: "user", content: params.mensagemUsuario });

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

  const mistralTools = ferramentasMistralListaParaAgente(usoMap, customDefs, extDefs, intDefs);
  const modeloResolved = resolveInferenceModelId(params.modelo);
  const temMistralKey = Boolean(process.env.MISTRAL_API_KEY?.trim());
  const podeToolsMistral =
    temMistralKey &&
    motorFerramentas &&
    mistralTools.length > 0 &&
    isMistralFamilyModelId(modeloResolved);

  let out:
    | Awaited<ReturnType<typeof completarChatComFerramentasMistral>>
    | Awaited<ReturnType<typeof completarChatPreferindoMistral>>
    | null = null;

  if (podeToolsMistral) {
    out = await completarChatComFerramentasMistral({
      systemPrompt: system,
      mensagens,
      modeloFromDb: params.modelo,
      tools: mistralTools,
      maxTokens: 2048,
      agentReasoningEnabled,
      executarTool: (nome, argumentosSerializados) =>
        executarFerramentaHub(nome, argumentosSerializados, {
          agenteSlug: params.agenteSlug,
          tenantId: tenantForTools,
          modoOperacao: "jobs_internos",
          agenteInterno: true,
        }),
    });
  }

  if (!out?.ok) {
    const semTools = await completarChatPreferindoMistral({
      systemPrompt: system,
      mensagens,
      modeloFromDb: params.modelo,
      maxTokens: 2048,
      agentReasoningEnabled,
    });
    if (semTools.ok) out = semTools;
    else if (!out) out = semTools;
  }

  if (!out?.ok) throw new Error(out?.erro || "Falha ao gerar resposta do agente interno");

  const { brl } = calcularCustoBrl(out.modeloLog, out.tokensEntrada, out.tokensSaida);

  return {
    texto: out.texto,
    modelo: out.modeloLog,
    tokens_input: out.tokensEntrada,
    tokens_output: out.tokensSaida,
    custo_brl: brl,
    motor: params.trigger === "ciclo" ? "briefing_interno" : "briefing_interno",
  };
}

export function agenteInternoMotorDisponivel(
  ferrIaRow: { motor_ferramentas_habilitado?: boolean | null } | null | undefined
): boolean {
  return ferrIaRow?.motor_ferramentas_habilitado === true;
}

export function ehAgenteInternoOperacao(modoOperacao?: string | null): boolean {
  return agenteEhCopilotoInterno(
    isModoOperacaoAgente(modoOperacao) ? modoOperacao : null
  );
}
