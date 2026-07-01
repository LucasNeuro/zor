/**
 * Runtime do turno — loop ReAct Mistral + tools + VERIFY (OpenClaw-style executor).
 */
import { completarChatPreferindoMistral } from "@/lib/ia/llm-completion";
import { completarChatComFerramentasMistral } from "@/lib/ia/llm-completion-tools";
import { isMistralFamilyModelId, resolveInferenceModelId } from "@/lib/ia/hub-model-defaults";
import { executarFerramentaHub } from "@/lib/hub/executar-ferramenta-ia";
import { ferramentasMistralListaParaAgente } from "@/lib/hub/agente-ferramentas-registry";
import { classifyHarnessOutcome } from "@/lib/harness/classify-outcome";
import { extrairUrlsPublicasDeResultadoFerramenta } from "@/lib/harness/extrair-urls-publicas";
import { enriquecerObservationComVerify } from "@/lib/harness/loop/verify-tool-result";
import {
  deveReforcarLoopEscrita,
  NUDGE_ESCRITA_HARNESS,
} from "@/lib/harness/loop/enforce-write-completion";
import { mergeHarnessToolsIntoMistral } from "@/lib/harness/tools/harness-tools-defs";
import type {
  HarnessHostContext,
  HarnessToolDefs,
  HarnessTurnInput,
  HarnessTurnResult,
} from "@/lib/harness/types";
import { HARNESS_RUNTIME_ID } from "@/lib/harness/types";

export type RunHarnessTurnParams = HarnessTurnInput & {
  hostCtx: HarnessHostContext;
  toolDefs: HarnessToolDefs;
  harnessToolsEnabled?: boolean;
};

export async function runWajeMistralHarnessTurn(
  params: RunHarnessTurnParams
): Promise<HarnessTurnResult> {
  const modeloResolved = resolveInferenceModelId(params.modelo);
  const temMistralKey = Boolean(process.env.MISTRAL_API_KEY?.trim());
  let mistralTools = ferramentasMistralListaParaAgente(
    params.toolDefs.usoMap,
    params.toolDefs.customDefs,
    params.toolDefs.extDefs,
    params.toolDefs.intDefs
  );

  if (params.harnessToolsEnabled !== false) {
    mistralTools = mergeHarnessToolsIntoMistral(mistralTools);
  }

  const podeToolsMistral =
    temMistralKey &&
    params.motorFerramentas &&
    mistralTools.length > 0 &&
    isMistralFamilyModelId(modeloResolved);

  const urlsPublicasColetadas: string[] = [];

  let out:
    | Awaited<ReturnType<typeof completarChatComFerramentasMistral>>
    | Awaited<ReturnType<typeof completarChatPreferindoMistral>>
    | null = null;

  if (podeToolsMistral) {
    const executarTool = async (nome: string, argumentosSerializados: string) => {
      const result = await executarFerramentaHub(nome, argumentosSerializados, {
        agenteSlug: params.hostCtx.agenteSlug,
        tenantId: params.hostCtx.tenantId,
        modoOperacao: "jobs_internos",
        agenteInterno: true,
        telefoneSessao: params.hostCtx.telefoneSessao,
        usuarioCrmId: params.hostCtx.usuarioCrmId,
        leadId: params.hostCtx.leadId ?? null,
        sessionId: params.hostCtx.sessionId ?? null,
        harnessSurface: params.hostCtx.surface,
      });
      const enriched = enriquecerObservationComVerify(result, nome);
      if (nome === "hub_superagente_artefato") {
        urlsPublicasColetadas.push(...extrairUrlsPublicasDeResultadoFerramenta(result));
      }
      return enriched;
    };

    const runToolsTurn = (mensagens: Array<{ role: "user" | "assistant"; content: string }>) =>
      completarChatComFerramentasMistral({
        systemPrompt: params.systemPrompt,
        mensagens,
        modeloFromDb: params.modelo,
        tools: mistralTools,
        maxTokens: 4096,
        modoCopilotoInterno: true,
        agentReasoningEnabled: params.agentReasoningEnabled,
        executarTool,
      });

    out = await runToolsTurn(params.mensagens);

    if (
      out?.ok &&
      "toolCallsExecutadas" in out &&
      deveReforcarLoopEscrita(out.texto, out.toolCallsExecutadas)
    ) {
      const retry = await runToolsTurn([
        ...params.mensagens,
        { role: "assistant", content: out.texto },
        { role: "user", content: NUDGE_ESCRITA_HARNESS },
      ]);
      if (retry?.ok) {
        out = {
          ...retry,
          tokensEntrada: out.tokensEntrada + retry.tokensEntrada,
          tokensSaida: out.tokensSaida + retry.tokensSaida,
        };
      }
    }
  }

  if (!out?.ok) {
    const semTools = await completarChatPreferindoMistral({
      systemPrompt: params.systemPrompt,
      mensagens: params.mensagens,
      modeloFromDb: params.modelo,
      maxTokens: 4096,
      agentReasoningEnabled: params.agentReasoningEnabled,
    });
    if (semTools.ok) out = semTools;
    else if (!out) out = semTools;
  }

  if (!out?.ok) {
    throw new Error(out?.erro || "Falha ao gerar resposta do agente interno");
  }

  const outcome = classifyHarnessOutcome({ texto: out.texto });
  if (outcome === "empty") {
    throw new Error("Harness runtime devolveu resposta vazia");
  }

  return {
    texto: out.texto,
    modelo: out.modeloLog,
    tokensEntrada: out.tokensEntrada,
    tokensSaida: out.tokensSaida,
    urlsPublicas: [...new Set(urlsPublicasColetadas)],
  };
}

export function wajeMistralRuntimeId(): typeof HARNESS_RUNTIME_ID {
  return HARNESS_RUNTIME_ID;
}
