/**
 * HarnessHost — orquestra prompt, memória, skills, sessão, tools e runtime do turno.
 */
import {
  agenteRaciocinioAvancadoAtivo,
  mergeUsoFerramentasComPadraoPreservandoCustom,
  mergeUsoFerramentasJobsInternos,
} from "@/lib/hub/agente-ferramentas-registry";
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
import { runWajeMistralHarnessTurn } from "@/lib/harness/runtime/waje-mistral-v1";
import {
  carregarMemorySnapshot,
  formatarBlocoMemorySnapshot,
} from "@/lib/harness/stores/memory-store";
import {
  ensureSkillsSeedFromCargo,
  formatarBlocoSkillsL0,
  listarSkillsL0Agente,
} from "@/lib/harness/stores/skills-store";
import { getOrCreateHarnessSession } from "@/lib/harness/stores/session-store";
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

  const usoMap = mergeUsoFerramentasJobsInternos(
    mergeUsoFerramentasComPadraoPreservandoCustom(ferrIaRow?.uso_ferramentas_ia ?? {}),
    "jobs_internos"
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

  const [skillsL0, memorySnap] = await Promise.all([
    listarSkillsL0Agente(params.supabase, tenantForTools, params.agenteSlug),
    carregarMemorySnapshot(params.supabase, tenantForTools, params.agenteSlug),
  ]);

  let blocoMemoria = params.memoriasAgenteBloco?.trim() || "";
  const blocoMemoryCurada = formatarBlocoMemorySnapshot(memorySnap);
  if (blocoMemoryCurada) {
    blocoMemoria = blocoMemoria ? `${blocoMemoria}\n\n${blocoMemoryCurada}` : blocoMemoryCurada;
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
    snapshot: params.snapshot,
    skillsBloco,
  });

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

  const hostCtx: HarnessHostContext = {
    tenantId: tenantForTools,
    agenteSlug: params.agenteSlug,
    agenteNome: params.agenteNome,
    surface,
    telefoneSessao: params.telefoneSessao ?? null,
    usuarioCrmId: params.usuarioCrmId ?? null,
    sessionId: sessao?.id ?? null,
    modoId: sessao?.modo_id ?? "operar",
  };

  const turn = await runWajeMistralHarnessTurn({
    hostCtx,
    systemPrompt,
    mensagens,
    modelo: params.modelo,
    motorFerramentas,
    agentReasoningEnabled,
    mistralTools: [],
    toolDefs: { customDefs, extDefs, intDefs, usoMap },
    harnessToolsEnabled: motorFerramentas,
  });

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

  try {
    await executarHarnessBackgroundReview(params.supabase, {
      tenantId: tenantForTools,
      agenteSlug: params.agenteSlug,
      surface,
      mensagemUsuario: params.mensagemUsuario,
      respostaIA: turn.texto,
      sessionId: sessao?.id ?? null,
      requireApproval: false,
    });
  } catch {
    /* review opcional */
  }

  const { brl } = calcularCustoBrl(turn.modelo, turn.tokensEntrada, turn.tokensSaida);

  return {
    texto: turn.texto,
    modelo: turn.modelo,
    tokens_input: turn.tokensEntrada,
    tokens_output: turn.tokensSaida,
    custo_brl: brl,
    motor: "briefing_interno",
    urls_publicas: turn.urlsPublicas.length ? turn.urlsPublicas : undefined,
    harness_version: HARNESS_VERSION,
  };
}
