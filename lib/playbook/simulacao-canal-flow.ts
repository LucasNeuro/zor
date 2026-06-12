/**
 * Simulação interna (Copiloto IA) com o mesmo motor determinístico do WhatsApp
 * (`executeFlowEngine` + bloco waje_playbook_flow publicado).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { executeFlowEngine, type FlowEngineDefinition } from "@/lib/playbook/flow-engine";
import {
  carregarDynamicPlaybookRuntime,
  resolverChoiceId,
} from "@/lib/whatsapp/playbook-flow-maria";
import { mensagemEhSaudacaoSimples } from "@/lib/whatsapp/menu-triagem-uazapi";
import { MSG_PLAYBOOK_POS_CONCLUSAO } from "@/lib/hub/agente-playbook-routing";

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

export function buildBlocoContextoFluxoParaLlm(
  definition: FlowEngineDefinition,
  state: SimFlowState
): string {
  const stepId = state.step || definition.start_step;
  const step = definition.steps[stepId];
  const linhas: string[] = [
    "### CONTEXTO DO FLUXO WHATSAPP (playbook publicado)",
    `Passo atual do motor: ${stepId}`,
  ];

  const respostas = Object.entries(state.answers).filter(([, v]) => v.trim());
  if (respostas.length > 0) {
    linhas.push(
      "Dados já coletados no fluxo:",
      ...respostas.map(([k, v]) => `- ${k}: ${v}`)
    );
  }

  if (step?.type === "menu") {
    linhas.push(`Menu do fluxo: ${step.text}`);
    linhas.push(
      "Opções válidas:",
      ...step.choices.map((c, i) => `${i + 1}. ${c.label} (id: ${c.id})`)
    );
  } else if (step?.type === "ask_text" || step?.type === "await_name") {
    linhas.push(`Coleta esperada (${step.answer_key ?? "nome"}): ${step.prompt}`);
  } else if (step?.type === "send_text") {
    linhas.push(`Mensagem estrutural seguinte: ${step.text}`);
  }

  linhas.push(
    "",
    "Instrução: responda como atendente IA da empresa (base de conhecimento + cargo).",
    "Siga o fluxo quando o cliente colaborar, mas NÃO repita a mesma pergunta em loop.",
    "Se o cliente sair do roteiro, responda com naturalidade e conduza de volta ao próximo passo útil.",
    "Não diga que é simulação nem mencione passos técnicos do motor."
  );
  return linhas.join("\n");
}

export function fluxoAvancou(
  antes: SimFlowState,
  depois: SimFlowState
): boolean {
  if (antes.step !== depois.step) return true;
  return JSON.stringify(antes.answers) !== JSON.stringify(depois.answers);
}

function formatMenuParaSimulacao(texto: string, choices: string[]): string {
  const linhas = choices.map((raw, index) => {
    const pipe = raw.includes("|") ? raw.split("|") : [raw, raw];
    const label = (pipe[0] ?? raw).trim();
    return `${index + 1}. ${label}`;
  });
  return [
    texto.trim(),
    "",
    ...linhas,
    "",
    "_(Responda com o número ou o texto da opção — igual ao menu no WhatsApp.)_",
  ].join("\n");
}

export async function executarSimulacaoCanalFluxoPlaybook(params: {
  supabase: SupabaseClient;
  agenteSlug: string;
  mensagemUsuario: string;
  flowState: SimFlowState;
}): Promise<
  | {
      ok: true;
      texto: string;
      flowState: SimFlowState;
      motor: "playbook_flow";
    }
  | { ok: false; motivo: string; permitir_llm?: boolean; flowState?: SimFlowState }
> {
  const runtime = await carregarDynamicPlaybookRuntime(params.supabase, params.agenteSlug);
  if (!runtime) {
    return { ok: false, motivo: "runtime_indisponivel", permitir_llm: true };
  }

  let state: SimFlowState = { ...params.flowState, answers: { ...params.flowState.answers } };

  if (state.complete && mensagemEhSaudacaoSimples(params.mensagemUsuario)) {
    state = { ...EMPTY_FLOW_STATE };
  } else if (state.complete) {
    return { ok: false, motivo: "playbook_concluido", permitir_llm: true };
  }

  const outTexts: string[] = [];
  let persisted: SimFlowState = { ...state };

  const result = await executeFlowEngine(
    runtime.definition,
    {
      step: state.step,
      answers: { ...state.answers },
      mensagem: params.mensagemUsuario,
      tipoMidia: "texto",
    },
    {
      sendText: async (text) => {
        const t = text.trim();
        if (t) outTexts.push(t);
      },
      sendMenu: async ({ text, choices }) => {
        outTexts.push(formatMenuParaSimulacao(text, choices));
        return { ok: true };
      },
      resolveChoiceId: resolverChoiceId,
      persistState: async (patch) => {
        persisted = {
          step: patch.step !== undefined ? patch.step : persisted.step,
          answers: patch.answers ? { ...patch.answers } : persisted.answers,
          active: patch.active ?? persisted.active,
          complete: patch.complete ?? persisted.complete,
        };
        if (patch.resetAnswers) persisted.answers = {};
      },
    }
  );

  if (!result.handled) {
    return { ok: false, motivo: "flow_nao_tratou", permitir_llm: true, flowState: persisted };
  }

  if (outTexts.length === 0) {
    return { ok: false, motivo: "flow_sem_saida", permitir_llm: true, flowState: persisted };
  }

  const depois: SimFlowState = {
    ...persisted,
    step: result.step ?? persisted.step,
  };

  if (state.step && !fluxoAvancou(state, depois)) {
    return {
      ok: false,
      motivo: "resposta_fora_fluxo",
      permitir_llm: true,
      flowState: depois,
    };
  }

  if (persisted.complete) {
    const pos = MSG_PLAYBOOK_POS_CONCLUSAO.trim();
    if (pos && !outTexts.some((t) => t.includes(pos.slice(0, 24)))) {
      outTexts.push(pos);
    }
  }

  return {
    ok: true,
    texto: outTexts.join("\n\n"),
    flowState: depois,
    motor: "playbook_flow",
  };
}
