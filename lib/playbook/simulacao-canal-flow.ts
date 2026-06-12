/**
 * Simulação de canal: o motor de fluxo só atualiza estado (passo + respostas).
 * O texto ao cliente é SEMPRE gerado pelo Mistral com cargo + conhecimento + RAG.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  executeFlowEngine,
  type FlowEngineDefinition,
  type FlowEngineInput,
  type FlowEnginePersistPatch,
  type FlowPendingMenu,
} from "@/lib/playbook/flow-engine";
import {
  carregarDynamicPlaybookRuntime,
  playbookMenuUazapiEnhancementEnabled,
  resolverChoiceId,
} from "@/lib/whatsapp/playbook-flow-runtime";
import { mensagemEhSaudacaoSimples } from "@/lib/whatsapp/menu-triagem-uazapi";

export type SimFlowState = {
  step: string | null;
  answers: Record<string, string>;
  active: boolean;
  complete: boolean;
};

const EMPTY_FLOW_STATE: SimFlowState = {
  step: null,
  answers: {},
  active: true,
  complete: false,
};

export function parseSimFlowState(raw: unknown): SimFlowState {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ...EMPTY_FLOW_STATE };
  const o = raw as Record<string, unknown>;
  const answers =
    o.answers && typeof o.answers === "object" && !Array.isArray(o.answers)
      ? Object.fromEntries(
          Object.entries(o.answers as Record<string, unknown>)
            .map(([k, v]) => [k, String(v ?? "").trim()])
            .filter(([, v]) => v.length > 0)
        )
      : {};
  return {
    step: typeof o.step === "string" ? o.step.trim() || null : null,
    answers,
    active: o.active !== false,
    complete: o.complete === true,
  };
}

export async function loadSimFlowStateFromSessao(
  supabase: SupabaseClient,
  sessaoId: string
): Promise<SimFlowState> {
  const { data } = await supabase
    .from("hub_crm_agente_briefing_mensagem")
    .select("metadata")
    .eq("sessao_id", sessaoId)
    .eq("papel", "assistant")
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle();

  return parseSimFlowState((data?.metadata as Record<string, unknown> | undefined)?.flow_state);
}

function descreverPassoFluxo(
  definition: FlowEngineDefinition,
  stepId: string,
  menuUazapiEnhancement?: boolean
): string[] {
  const step = definition.steps[stepId];
  if (!step) return [`Passo ${stepId} (sem detalhe no motor).`];

  if (step.type === "menu") {
    const linhas = [`Tipo: menu de triagem`, `Texto-base do fluxo: ${step.text}`];
    if (menuUazapiEnhancement) {
      linhas.push(
        "Opções (NÃO listar no texto — menu interativo UAZAPI será enviado em seguida):",
        ...step.choices.map((c) => `  - ${c.label}`)
      );
    } else {
      linhas.push(
        "Opções (apresente em linguagem natural, numeradas):",
        ...step.choices.map((c, i) => `  ${i + 1}. ${c.label}`)
      );
    }
    return linhas;
  }
  if (step.type === "ask_text" || step.type === "await_name") {
    const answerKey = step.answer_key ?? "nome";
    const linhas = [
      `Tipo: coleta de informação`,
      `Campo: ${answerKey}`,
      `Pergunta-base do fluxo: ${step.prompt}`,
    ];
    if (answerKey === "nome" || step.type === "await_name") {
      linhas.push(
        "IMPORTANTE: peça SOMENTE o nome do cliente (1 pergunta curta).",
        "NÃO pergunte «como posso ajudar», intenção ou assunto neste passo."
      );
    }
    return linhas;
  }
  if (step.type === "send_text") {
    return [`Tipo: mensagem`, `Conteúdo-base: ${step.text}`];
  }
  if (step.type === "complete") {
    return [`Tipo: conclusão do ramo`, step.text ? `Mensagem-base: ${step.text}` : ""].filter(Boolean);
  }
  return [`Passo ${stepId}`];
}

export function buildBlocoContextoFluxoParaLlm(
  definition: FlowEngineDefinition,
  state: SimFlowState,
  mensagemCliente?: string,
  menuUazapiEnhancement?: boolean
): string {
  const stepId = state.step || definition.start_step;
  const step = definition.steps[stepId];
  const menuEnhanceOn =
    menuUazapiEnhancement ?? playbookMenuUazapiEnhancementEnabled();
  const linhas: string[] = [
    "### ROTEIRO WHATSAPP (guia — NÃO copie frases fixas)",
    "O bloco abaixo define a **ordem** e os **temas** do atendimento. Você é a IA da empresa:",
    "use SEMPRE a base de conhecimento, cargo e playbook narrativo para redigir cada resposta.",
    "Nunca responda com uma única frase robótica; seja natural, empático e específico ao negócio.",
    "",
    `Passo atual no roteiro: ${stepId}`,
    ...descreverPassoFluxo(definition, stepId, menuEnhanceOn && step?.type === "menu"),
  ];

  const respostas = Object.entries(state.answers).filter(([, v]) => v.trim());
  if (respostas.length > 0) {
    linhas.push("", "Dados já informados pelo cliente nesta conversa:");
    for (const [k, v] of respostas) {
      linhas.push(`- ${k}: ${v}`);
    }
  }

  if (state.complete) {
    linhas.push("", "O roteiro estruturado foi concluído — pode atender dúvidas livres com a base de conhecimento.");
  }

  if (mensagemCliente?.trim()) {
    linhas.push("", `Última mensagem do cliente: «${mensagemCliente.trim().slice(0, 500)}»`);
  }

  linhas.push(
    "",
    "Regras de condução:",
    ...(step?.type === "menu" && menuEnhanceOn
      ? [
          "- Se for menu: escreva APENAS uma introdução curta (1–2 frases) contextualizando o assunto.",
          "- NÃO liste opções numeradas nem bullets — o menu interativo UAZAPI será enviado logo após sua mensagem.",
        ]
      : ["- Se for menu: apresente as opções de forma clara (lista numerada), contextualizando com o negócio."]),
    ...(step?.type === "await_name" ||
    (step?.type === "ask_text" && (step.answer_key === "nome" || !step.answer_key))
      ? [
          "- Se for coleta de nome: faça SOMENTE a pergunta pelo nome — sem «como posso ajudar» nem menu.",
        ]
      : ["- Se for coleta: faça a pergunta do passo com suas palavras, uma pergunta por vez."]),
    "- Se o cliente sair do roteiro: responda com IA (conhecimento) e retome suavemente o passo útil.",
    "- Não invente preços, prazos ou políticas fora da documentação.",
    "- Não mencione «passo», «motor», «playbook-flow» nem «simulação»."
  );

  return linhas.join("\n");
}

/** Avança passo/respostas no motor silenciosamente (sem texto fixo ao cliente). */
async function executarFluxoStateOnly(
  definition: FlowEngineDefinition,
  input: FlowEngineInput,
  callbacks: {
    resolveChoiceId: (mensagem: string, menuChoiceId?: string | null) => string | null;
    persistState: (patch: FlowEnginePersistPatch) => Promise<void>;
    onNameCaptured?: (name: string) => Promise<void>;
    onStepComplete?: (stepId: string, answers: Record<string, string>) => Promise<void>;
  }
): Promise<{
  flowState: SimFlowState;
  pendingMenu?: FlowPendingMenu;
}> {
  let persisted: SimFlowState = {
    step: input.step,
    answers: { ...input.answers },
    active: true,
    complete: false,
  };

  const result = await executeFlowEngine(
    definition,
    input,
    {
      sendText: async () => undefined,
      sendMenu: async () => ({ ok: true }),
      resolveChoiceId: callbacks.resolveChoiceId,
      persistState: async (patch) => {
        persisted = {
          step: patch.step !== undefined ? patch.step : persisted.step,
          answers: patch.answers ? { ...patch.answers } : persisted.answers,
          active: patch.active ?? persisted.active,
          complete: patch.complete ?? persisted.complete,
        };
        await callbacks.persistState(patch);
      },
      onNameCaptured: callbacks.onNameCaptured,
      onStepComplete: callbacks.onStepComplete,
      stateOnly: true,
    }
  );

  const flowState: SimFlowState = {
    ...persisted,
    step: result.handled ? (result.step ?? persisted.step) : persisted.step,
    complete: persisted.complete,
  };

  return { flowState, pendingMenu: result.handled ? result.pendingMenu : undefined };
}

export function simFlowStateFromPlaybookLead(params: {
  step: string | null;
  answers: Record<string, string>;
  active: boolean;
  complete: boolean;
}): SimFlowState {
  return {
    step: params.step,
    answers: { ...params.answers },
    active: params.active,
    complete: params.complete,
  };
}

/** Avança passo/respostas no motor silenciosamente (simulação CRM). */
export async function avancarEstadoFluxoSimulacao(params: {
  supabase: SupabaseClient;
  agenteSlug: string;
  mensagemUsuario: string;
  flowState: SimFlowState;
}): Promise<{ flowState: SimFlowState; definition: FlowEngineDefinition } | null> {
  const runtime = await carregarDynamicPlaybookRuntime(params.supabase, params.agenteSlug);
  if (!runtime) return null;

  let state: SimFlowState = { ...params.flowState, answers: { ...params.flowState.answers } };

  if (state.complete && mensagemEhSaudacaoSimples(params.mensagemUsuario)) {
    state = { ...EMPTY_FLOW_STATE };
  }

  const { flowState } = await executarFluxoStateOnly(
    runtime.definition,
    {
      step: state.step,
      answers: { ...state.answers },
      mensagem: params.mensagemUsuario,
      tipoMidia: "texto",
    },
    {
      resolveChoiceId: resolverChoiceId,
      persistState: async () => undefined,
    }
  );

  return { flowState, definition: runtime.definition };
}

/** Avança fluxo publicado em produção WhatsApp (estado no lead metadata). */
export async function avancarEstadoFluxoPlaybookWhatsapp(params: {
  supabase: SupabaseClient;
  agenteSlug: string;
  mensagemUsuario: string;
  menuChoiceId?: string | null;
  tipoMidia: string;
  flowState: SimFlowState;
  persistState: (patch: FlowEnginePersistPatch) => Promise<void>;
  onNameCaptured?: (name: string) => Promise<void>;
  onStepComplete?: (stepId: string, answers: Record<string, string>) => Promise<void>;
}): Promise<{
  flowState: SimFlowState;
  definition: FlowEngineDefinition;
  pendingMenu?: FlowPendingMenu;
} | null> {
  const runtime = await carregarDynamicPlaybookRuntime(params.supabase, params.agenteSlug);
  if (!runtime) return null;

  let state: SimFlowState = { ...params.flowState, answers: { ...params.flowState.answers } };

  if (state.complete && mensagemEhSaudacaoSimples(params.mensagemUsuario)) {
    state = { ...EMPTY_FLOW_STATE };
    await params.persistState({
      step: null,
      answers: {},
      active: true,
      complete: false,
      resetAnswers: true,
    });
  }

  const { flowState, pendingMenu } = await executarFluxoStateOnly(
    runtime.definition,
    {
      step: state.step,
      answers: { ...state.answers },
      mensagem: params.mensagemUsuario,
      menuChoiceId: params.menuChoiceId,
      tipoMidia: params.tipoMidia,
    },
    {
      resolveChoiceId: resolverChoiceId,
      persistState: params.persistState,
      onNameCaptured: params.onNameCaptured,
      onStepComplete: params.onStepComplete,
    }
  );

  return { flowState, definition: runtime.definition, pendingMenu };
}
