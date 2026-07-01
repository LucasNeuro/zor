/**
 * Resume harness após aprovação humana de escrita CRM (RFC §9.3).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { completarChatPreferindoMistral } from "@/lib/ia/llm-completion";
import { executarFerramentaHub } from "@/lib/hub/executar-ferramenta-ia";
import { enriquecerObservationComVerify } from "@/lib/harness/loop/verify-tool-result";
import { truncarResultadoFerramentaParaModelo } from "@/lib/harness/tool-output-truncate";
import { resolverPendingWrite } from "@/lib/harness/stores/pending-approvals";
import type { HarnessHostContext, HarnessTurnResult } from "@/lib/harness/types";

export type ResumeAfterApprovalParams = {
  supabase: SupabaseClient;
  hostCtx: HarnessHostContext;
  approvalId: string;
  decisao: "aprovar" | "rejeitar";
  systemPrompt: string;
  mensagens: Array<{ role: "user" | "assistant"; content: string }>;
  modelo: string;
  agentReasoningEnabled?: boolean;
};

export async function resumeHarnessAfterApproval(
  params: ResumeAfterApprovalParams
): Promise<HarnessTurnResult & { rejeitado?: boolean }> {
  const resolved = await resolverPendingWrite(params.supabase, {
    approvalId: params.approvalId,
    tenantId: params.hostCtx.tenantId,
    agenteSlug: params.hostCtx.agenteSlug,
    decisao: params.decisao,
    sessionId: params.hostCtx.sessionId,
    modoId: params.hostCtx.modoId,
  });

  if (!resolved.ok) {
    throw new Error(resolved.erro ?? "falha_aprovacao");
  }

  if (params.decisao === "rejeitar") {
    const out = await completarChatPreferindoMistral({
      systemPrompt: params.systemPrompt,
      mensagens: [
        ...params.mensagens,
        {
          role: "user",
          content:
            "O utilizador rejeitou a alteração CRM pendente. Informe-o de forma breve e ofereça alternativas só de leitura.",
        },
      ],
      modeloFromDb: params.modelo,
      maxTokens: 2048,
      agentReasoningEnabled: params.agentReasoningEnabled,
    });
    if (!out.ok) throw new Error(out.erro || "falha_continuacao");
    return {
      texto: out.texto,
      modelo: out.modeloLog,
      tokensEntrada: out.tokensEntrada,
      tokensSaida: out.tokensSaida,
      urlsPublicas: [],
      rejeitado: true,
    };
  }

  const toolName = resolved.tool_name ?? "";
  const argumentos = resolved.argumentos ?? {};
  const grants = { ...(params.hostCtx.grants ?? {}), crm_escrita_sessao: true };

  let toolResult = await executarFerramentaHub(toolName, JSON.stringify(argumentos), {
    agenteSlug: params.hostCtx.agenteSlug,
    tenantId: params.hostCtx.tenantId,
    modoOperacao: "jobs_internos",
    agenteInterno: true,
    telefoneSessao: params.hostCtx.telefoneSessao,
    usuarioCrmId: params.hostCtx.usuarioCrmId,
    sessionId: params.hostCtx.sessionId,
    harnessModoId: params.hostCtx.modoId ?? "operar",
    harnessGrants: grants,
    harnessSurface: params.hostCtx.surface,
  });

  toolResult = enriquecerObservationComVerify(toolResult, toolName);
  toolResult = truncarResultadoFerramentaParaModelo(toolResult, toolName);

  const out = await completarChatPreferindoMistral({
    systemPrompt: params.systemPrompt,
    mensagens: [
      ...params.mensagens,
      {
        role: "user",
        content: `A alteração CRM foi aprovada e executada. Resultado da ferramenta ${toolName}:\n${toolResult}\n\nConfirme ao utilizador o que foi feito, em português claro.`,
      },
    ],
    modeloFromDb: params.modelo,
    maxTokens: 4096,
    agentReasoningEnabled: params.agentReasoningEnabled,
  });

  if (!out.ok) throw new Error(out.erro || "falha_continuacao_pos_aprovacao");

  return {
    texto: out.texto,
    modelo: out.modeloLog,
    tokensEntrada: out.tokensEntrada,
    tokensSaida: out.tokensSaida,
    urlsPublicas: [],
  };
}
