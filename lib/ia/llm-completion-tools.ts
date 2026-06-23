import {
  isMistralFamilyModelId,
  mistralDefaultModelId,
  resolveInferenceModelId,
} from "@/lib/ia/hub-model-defaults";
import {
  mistralChatCompletionToolRound,
  type MistralChatMessagePayload,
  type MistralChatToolDefinition,
} from "@/lib/ia/mistral-chat-tools";
import { blocoInstrucoesFerramentasCrmWhatsapp, blocoInstrucoesGoogleWorkspaceAgenda } from "@/lib/ia/bloco-ferramentas-crm-whatsapp";

const MAX_TOOL_ROUNDS = 6;

type ToolCallExecLog = {
  nome: string;
  ok: boolean;
  resultadoPreview: string;
};

export async function completarChatComFerramentasMistral(params: {
  systemPrompt: string;
  mensagens: Array<{ role: "user" | "assistant"; content: string }>;
  modeloFromDb: string;
  tools: MistralChatToolDefinition[];
  maxTokens?: number;
  /** Playbook Unificado no bucket — menus list (5) / button (2). */
  playbookPublicado?: boolean;
  /** Turno playbook IA — afeta `MISTRAL_REASONING_EFFORT_PLAYBOOK_IA_ONLY`. */
  playbookIaTurn?: boolean;
  executarTool: (nome: string, argumentosSerializados: string) => Promise<string>;
}): Promise<
  | {
      ok: true;
      texto: string;
      tokensEntrada: number;
      tokensSaida: number;
      modeloLog: string;
      toolCallsExecutadas: ToolCallExecLog[];
    }
  | { ok: false; erro: string }
> {
  const mistralKey = process.env.MISTRAL_API_KEY?.trim();
  if (!mistralKey) {
    return { ok: false, erro: "MISTRAL_API_KEY não configurada." };
  }
  if (!params.tools.length) {
    return { ok: false, erro: "Lista de ferramentas vazia." };
  }

  const modeloResolved = resolveInferenceModelId(params.modeloFromDb);
  const mid = isMistralFamilyModelId(modeloResolved) ? modeloResolved : mistralDefaultModelId();

  let messages: MistralChatMessagePayload[] = params.mensagens.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  let tokensEntrada = 0;
  let tokensSaida = 0;
  const toolCallsExecutadas: ToolCallExecLog[] = [];
  const nomesFerramentas = new Set(params.tools.map((t) => t.function.name));
  const menuWhatsappAtivo = nomesFerramentas.has("hub_whatsapp_menu");
  const googleAgendaAtivo =
    nomesFerramentas.has("hub_int_gcal_listar_eventos") ||
    nomesFerramentas.has("hub_int_gcal_criar_evento") ||
    nomesFerramentas.has("hub_int_gcal_cancelar_evento") ||
    nomesFerramentas.has("hub_int_gcal_listar_reservas_lead");

  let systemExtra = `\n\n${blocoInstrucoesFerramentasCrmWhatsapp({
    temMenuWhatsapp: menuWhatsappAtivo,
    temAtualizarLead: nomesFerramentas.has("hub_atualizar_lead"),
    playbookUnificado: params.playbookPublicado === true,
  })}`;

  if (googleAgendaAtivo) {
    systemExtra += `\n\n${blocoInstrucoesGoogleWorkspaceAgenda()}`;
  }

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const out = await mistralChatCompletionToolRound({
      model: mid,
      system: params.systemPrompt + systemExtra,
      messages,
      tools: params.tools,
      maxTokens: params.maxTokens ?? 1024,
      playbookIaTurn: params.playbookIaTurn,
    });

    if (!out.ok) return { ok: false, erro: out.error };

    tokensEntrada += out.usage.inputTokens;
    tokensSaida += out.usage.outputTokens;

    if (out.kind === "message") {
      return {
        ok: true,
        texto: out.text,
        tokensEntrada,
        tokensSaida,
        modeloLog: mid,
        toolCallsExecutadas,
      };
    }

    const assistantPayload: MistralChatMessagePayload = {
      role: "assistant",
      content: null,
      tool_calls: out.toolCalls.map((tc) => ({
        id: tc.id,
        type: "function",
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments ?? "{}",
        },
      })),
    };
    messages = [...messages, assistantPayload];

    for (const tc of out.toolCalls) {
      const name = tc.function?.name ?? "";
      const argsStr = tc.function?.arguments ?? "{}";
      const result = await params.executarTool(name, typeof argsStr === "string" ? argsStr : "{}");
      let parsed: Record<string, unknown> | null = null;
      try {
        parsed = JSON.parse(result) as Record<string, unknown>;
      } catch {
        parsed = null;
      }
      const ok =
        parsed?.ok === true ||
        (typeof parsed?.erro !== "string" && typeof parsed?.error !== "string");
      const resultadoPreview =
        typeof result === "string" && result.trim().length > 0
          ? result.trim().slice(0, 240)
          : "";
      toolCallsExecutadas.push({ nome: name, ok, resultadoPreview });
      messages.push({
        role: "tool",
        name,
        tool_call_id: tc.id,
        content: result,
      });
    }
  }

  return {
    ok: false,
    erro: "Limite de voltas com ferramentas excedido; simplifique o pedido ou desative tools.",
  };
}
