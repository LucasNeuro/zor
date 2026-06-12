/**
 * Simulação interna (Copiloto IA) com o mesmo motor determinístico do WhatsApp
 * (`executeFlowEngine` + bloco waje_playbook_flow publicado).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { executeFlowEngine } from "@/lib/playbook/flow-engine";
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
  | { ok: false; motivo: string; permitir_llm?: boolean }
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
    return { ok: false, motivo: "flow_nao_tratou", permitir_llm: true };
  }

  if (outTexts.length === 0) {
    return { ok: false, motivo: "flow_sem_saida", permitir_llm: true };
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
    flowState: {
      ...persisted,
      step: result.step ?? persisted.step,
    },
    motor: "playbook_flow",
  };
}
