/**
 * HarnessHost — orquestra prompt, memória, skills, sessão, tools e runtime do turno.
 */
import {
  agenteRaciocinioAvancadoAtivo,
  mergeUsoFerramentasPorModoOperacao,
} from "@/lib/hub/agente-ferramentas-registry";
import { toolsetsActivos } from "@/lib/harness/toolsets";
import {
  fetchFerramentasCustomAtivas,
  rowParaMistralDef,
} from "@/lib/hub/ferramentas-custom-db";
import {
  fetchFerramentasExternasAtivas,
  rowParaMistralDefExterna,
} from "@/lib/hub/ferramentas-externas-db";
import { ferramentasIntegradorAtivasParaTenant } from "@/lib/hub/integradores-runtime";
import type { FerramentaIntegradorDefMistral } from "@/lib/hub/agente-ferramentas-registry";
import type { FerramentaCustomParaMistral } from "@/lib/hub/ferramentas-custom-db";
import type { FerramentaExternaParaMistral } from "@/lib/hub/ferramentas-externas-db";
import {
  montarBlocoMemoriaSuperagenteInterno,
  persistirMemoriaSuperagenteInterno,
} from "@/lib/hub/superagente/memoria-superagente";
import type { SuperagenteCanalInterno } from "@/lib/hub/superagente/canais-internos";
import { defaultTenantId } from "@/lib/tenant-default";
import { executarHarnessBackgroundReview } from "@/lib/harness/background-review";
import { montarSystemPromptHarness } from "@/lib/harness/build-system-prompt";
import { calcularCustoBrl } from "@/lib/harness/calcular-custo-brl";
import { normalizarEntregaArtefacto } from "@/lib/hub/superagente/entrega-artefato";
import { runWajeMistralHarnessTurn } from "@/lib/harness/runtime/waje-mistral-v1";
import { resumoTurnoParaMemoria } from "@/lib/harness/historico-copiloto";
import {
  compactarHistoricoHarness,
  formatarBlocoResumoCompactado,
} from "@/lib/harness/compaction";
import { montarBlocoConhecimentoTenantHarness } from "@/lib/harness/tenant-conhecimento-bloco";
import { listarPendingWritesAgente } from "@/lib/harness/stores/pending-approvals";
import { resumeHarnessAfterApproval } from "@/lib/harness/resume-after-approval";
import { obterOuCongelarMemorySnapshotSessao } from "@/lib/harness/stores/session-memory-frozen";
import { acumularMetricasSessaoHarness } from "@/lib/harness/stores/session-metrics";
import { carregarHarnessTenantConfig } from "@/lib/harness/tenant-config";
import {
  appendResumoTurnoCopiloto,
  formatarBlocoMemorySnapshot,
} from "@/lib/harness/stores/memory-store";
import {
  ensureSkillsSeedFromCargo,
  formatarBlocoSkillsL0,
  listarSkillsL0Agente,
} from "@/lib/harness/stores/skills-store";
import { getOrCreateHarnessSession } from "@/lib/harness/stores/session-store";
import { resolverPlanKnowledge } from "@/lib/harness/loop/inject-plan-knowledge";
import type {
  BriefingChatReplyResult,
  ExecutarAgenteInternoParams,
  HarnessHostContext,
  HarnessSurface,
} from "@/lib/harness/types";
import { HARNESS_VERSION } from "@/lib/harness/types";

function canalParaSurface(canal: SuperagenteCanalInterno): HarnessSurface {
  if (canal === "ciclo_programado") return "ciclo_programado";
  if (canal === "whatsapp_gestor") return "whatsapp_gestor";
  return "copiloto_crm";
}

export async function runHarnessHost(
  params: ExecutarAgenteInternoParams
): Promise<BriefingChatReplyResult> {
  const tenantForTools = (params.tenantId && params.tenantId.trim()) || defaultTenantId();

  const { data: ferrIaRow } = await params.supabase
    .from("hub_agente_identidade")
    .select("motor_ferramentas_habilitado, uso_ferramentas_ia, modo_operacao")
    .eq("agente_slug", params.agenteSlug)
    .maybeSingle();

  const motorFerramentas =
    ferrIaRow?.motor_ferramentas_habilitado !== false &&
    (ferrIaRow?.motor_ferramentas_habilitado === true ||
      ferrIaRow?.modo_operacao === "jobs_internos" ||
      !ferrIaRow?.modo_operacao);

  const usoMap = mergeUsoFerramentasPorModoOperacao(
    ferrIaRow?.uso_ferramentas_ia ?? {},
    ferrIaRow?.modo_operacao ?? "jobs_internos"
  );
  const agentReasoningEnabled = agenteRaciocinioAvancadoAtivo(usoMap);

  const canalInterno: SuperagenteCanalInterno =
    params.canalInterno ??
    (params.trigger === "ciclo" ? "ciclo_programado" : "copiloto_crm");

  const surface = canalParaSurface(canalInterno);
  const resourceId = params.usuarioCrmId?.trim() || params.telefoneSessao?.trim() || null;

  const sessao = await getOrCreateHarnessSession(params.supabase, {
    tenantId: tenantForTools,
    agenteSlug: params.agenteSlug,
    surface,
    resourceId,
    leadId: null,
  });

  await ensureSkillsSeedFromCargo(params.supabase, {
    tenantId: tenantForTools,
    agenteSlug: params.agenteSlug,
    cargo: params.cargo,
    area: params.area,
    surface,
  });

  const [skillsL0, tenantHarnessCfg] = await Promise.all([
    listarSkillsL0Agente(params.supabase, tenantForTools, params.agenteSlug),
    carregarHarnessTenantConfig(params.supabase, tenantForTools),
  ]);

  let blocoMemoria = params.memoriasAgenteBloco?.trim() || "";
  if (sessao?.id) {
    const frozen = await obterOuCongelarMemorySnapshotSessao(params.supabase, {
      sessionId: sessao.id,
      tenantId: tenantForTools,
      agenteSlug: params.agenteSlug,
    });
    if (frozen.bloco) {
      blocoMemoria = blocoMemoria ? `${blocoMemoria}\n\n${frozen.bloco}` : frozen.bloco;
    }
  } else {
    const { carregarMemorySnapshot } = await import("@/lib/harness/stores/memory-store");
    const memorySnap = await carregarMemorySnapshot(params.supabase, tenantForTools, params.agenteSlug);
    const blocoMemoryCurada = formatarBlocoMemorySnapshot(memorySnap);
    if (blocoMemoryCurada) {
      blocoMemoria = blocoMemoria ? `${blocoMemoria}\n\n${blocoMemoryCurada}` : blocoMemoryCurada;
    }
  }

  try {
    const montado = await montarBlocoMemoriaSuperagenteInterno(params.supabase, {
      tenantId: tenantForTools,
      agenteSlug: params.agenteSlug,
      mensagemUsuario: params.mensagemUsuario,
      telefoneSessao: params.telefoneSessao,
      usuarioCrmId: params.usuarioCrmId,
      usoFerramentas: usoMap,
    });
    if (montado) {
      blocoMemoria = blocoMemoria ? `${blocoMemoria}\n\n${montado}` : montado;
    }
  } catch {
    /* memória opcional */
  }

  const skillsBloco = formatarBlocoSkillsL0(skillsL0);

  let blocoRag = "";
  try {
    blocoRag = await montarBlocoConhecimentoTenantHarness(params.supabase, {
      tenantId: tenantForTools,
      mensagemUsuario: params.mensagemUsuario,
      historico: params.historico,
    });
  } catch {
    /* RAG opcional */
  }

  const historicoMensagens: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (const m of params.historico) {
    if (m.papel === "user") historicoMensagens.push({ role: "user", content: m.conteudo });
    else historicoMensagens.push({ role: "assistant", content: m.conteudo });
  }

  const compactado = await compactarHistoricoHarness(historicoMensagens);
  const mensagens: Array<{ role: "user" | "assistant"; content: string }> = [...compactado.mensagens];
  if (compactado.resumoAnterior) {
    mensagens.unshift({
      role: "user",
      content: formatarBlocoResumoCompactado(compactado.resumoAnterior),
    });
    mensagens.push({
      role: "assistant",
      content: "Entendido. Continuo com o contexto resumido e as mensagens recentes.",
    });
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

  const toolsetsAtivos = toolsetsActivos(usoMap).map((ts) => ts.id);

  const systemPrompt = montarSystemPromptHarness({
    agenteNome: params.agenteNome,
    agenteSlug: params.agenteSlug,
    cargo: params.cargo,
    area: params.area,
    bio: params.bio,
    promptBaseTrecho: params.promptBaseTrecho,
    playbookTrecho: params.playbookTrecho,
    canalInterno,
    briefCiclo: params.briefCiclo,
    memoriasBloco: blocoMemoria,
    historico: params.historico,
    snapshot: params.snapshot,
    skillsBloco: [skillsBloco, blocoRag].filter(Boolean).join("\n\n"),
    toolsetsAtivos,
    intDefNomes: intDefs.map((d) => d.ferramenta_key),
    extDefNomes: extDefs.map((d) => d.ferramenta_key),
  });

  const hostCtx: HarnessHostContext = {
    tenantId: tenantForTools,
    agenteSlug: params.agenteSlug,
    agenteNome: params.agenteNome,
    surface,
    telefoneSessao: params.telefoneSessao ?? null,
    usuarioCrmId: params.usuarioCrmId ?? null,
    sessionId: sessao?.id ?? null,
    modoId: sessao?.modo_id ?? "analisar",
    grants: sessao?.grants ?? {},
  };

  const modoIdAtivo = (sessao?.modo_id ?? "analisar") as import("@/lib/harness/types").HarnessModeId;
  const { planSteps, knowledgeEvents } = await resolverPlanKnowledge(
    params.supabase,
    hostCtx,
    params.mensagemUsuario,
    modoIdAtivo,
    skillsL0
  );

  let turn;
  if (params.approvalId && params.approvalDecisao) {
    turn = await resumeHarnessAfterApproval({
      supabase: params.supabase,
      hostCtx,
      approvalId: params.approvalId,
      decisao: params.approvalDecisao,
      systemPrompt,
      mensagens: compactado.mensagens,
      modelo: params.modelo,
      agentReasoningEnabled,
    });
  } else {
    turn = await runWajeMistralHarnessTurn({
      hostCtx,
      systemPrompt,
      mensagens,
      modelo: params.modelo,
      motorFerramentas,
      agentReasoningEnabled,
      mistralTools: [],
      toolDefs: { customDefs, extDefs, intDefs, usoMap },
      harnessToolsEnabled: motorFerramentas,
      planSteps,
      knowledgeEvents,
    });
  }

  if (params.briefingSessaoId && sessao?.id) {
    try {
      await params.supabase
        .from("hub_harness_sessions")
        .update({
          thread_id: params.briefingSessaoId,
          atualizado_em: new Date().toISOString(),
        })
        .eq("id", sessao.id);
    } catch {
      /* opcional */
    }
  }

  try {
    await persistirMemoriaSuperagenteInterno(params.supabase, {
      tenantId: tenantForTools,
      agenteSlug: params.agenteSlug,
      mensagemUsuario: params.mensagemUsuario,
      respostaIA: turn.texto,
      telefoneSessao: params.telefoneSessao,
      usuarioCrmId: params.usuarioCrmId,
      canalInterno,
      usoFerramentas: usoMap,
    });
  } catch {
    /* memória opcional */
  }

  if (params.usuarioCrmId?.trim() && canalInterno === "copiloto_crm") {
    try {
      const linha = resumoTurnoParaMemoria(params.mensagemUsuario, turn.texto);
      if (linha) {
        await appendResumoTurnoCopiloto(params.supabase, {
          tenantId: tenantForTools,
          agenteSlug: params.agenteSlug,
          linhaResumo: linha,
        });
      }
    } catch {
      /* memória opcional */
    }
  }

  try {
    await executarHarnessBackgroundReview(params.supabase, {
      tenantId: tenantForTools,
      agenteSlug: params.agenteSlug,
      surface,
      mensagemUsuario: params.mensagemUsuario,
      respostaIA: turn.texto,
      sessionId: sessao?.id ?? null,
      requireApproval: tenantHarnessCfg.memory_write_approval,
    });
  } catch {
    /* review opcional */
  }

  const { brl } = calcularCustoBrl(turn.modelo, turn.tokensEntrada, turn.tokensSaida);

  if (sessao?.id) {
    try {
      await acumularMetricasSessaoHarness(params.supabase, sessao.id, {
        tokens_input: turn.tokensEntrada,
        tokens_output: turn.tokensSaida,
        custo_brl: brl,
        aprovacao_aprovada: params.approvalDecisao === "aprovar",
        aprovacao_rejeitada: params.approvalDecisao === "rejeitar",
      });
    } catch {
      /* métricas opcionais */
    }
  }

  const entrega = normalizarEntregaArtefacto(turn.texto, turn.urlsPublicas);

  let pendingApprovals: Awaited<ReturnType<typeof listarPendingWritesAgente>> = [];
  try {
    pendingApprovals = await listarPendingWritesAgente(
      params.supabase,
      tenantForTools,
      params.agenteSlug
    );
  } catch {
    /* opcional */
  }

  return {
    texto: entrega.texto,
    modelo: turn.modelo,
    tokens_input: turn.tokensEntrada,
    tokens_output: turn.tokensSaida,
    custo_brl: brl,
    motor: "briefing_interno",
    urls_publicas: entrega.urls_publicas,
    harness_version: HARNESS_VERSION,
    pending_approvals: pendingApprovals,
  };
}

