/** Uma volta de chat completions com suporte a `tools` (Mistral). */

import {
  extrairTextoRespostaMistral,
  resolveMistralReasoningEffort,
  type MistralReasoningEffort,
} from "@/lib/ia/mistral-reasoning";

const MISTRAL_CHAT_URL = "https://api.mistral.ai/v1/chat/completions";

export type MistralChatToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type MistralToolCall = {
  id: string;
  type?: string;
  function: {
    name: string;
    arguments?: string;
  };
};

/** Mensagem já no formato esperado pela API Mistral (incl. tool). */
export type MistralChatMessagePayload = Record<string, unknown>;

function somarUsage(
  a: { input: number; out: number },
  u?: { prompt_tokens?: number; completion_tokens?: number }
) {
  if (!u) return a;
  return {
    input: a.input + (u.prompt_tokens ?? 0),
    out: a.out + (u.completion_tokens ?? 0),
  };
}

export async function mistralChatCompletionToolRound(params: {
  model: string;
  system: string;
  messages: MistralChatMessagePayload[];
  tools: MistralChatToolDefinition[];
  maxTokens?: number;
  temperature?: number;
  reasoningEffort?: MistralReasoningEffort;
  playbookIaTurn?: boolean;
}): Promise<
  | {
      ok: true;
      kind: "message";
      text: string;
      usage: { inputTokens: number; outputTokens: number };
      finishReason?: string | null;
    }
  | {
      ok: true;
      kind: "tool_calls";
      toolCalls: MistralToolCall[];
      usage: { inputTokens: number; outputTokens: number };
      finishReason?: string | null;
    }
  | { ok: false; error: string }
> {
  const key = process.env.MISTRAL_API_KEY?.trim();
  if (!key) return { ok: false, error: "MISTRAL_API_KEY não configurada" };

  const reasoningEffort =
    params.reasoningEffort ?? resolveMistralReasoningEffort({ playbookIaTurn: params.playbookIaTurn });
  const body: Record<string, unknown> = {
    model: params.model,
    temperature: params.temperature ?? 0.4,
    max_tokens: params.maxTokens ?? 1024,
    parallel_tool_calls: false,
    tool_choice: "auto",
    tools: params.tools,
    messages: [{ role: "system", content: params.system }, ...params.messages],
  };
  if (reasoningEffort === "high") {
    body.reasoning_effort = "high";
  }

  const res = await fetch(MISTRAL_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const rawText = await res.text();
  if (!res.ok) {
    return { ok: false, error: `Mistral HTTP ${res.status}: ${rawText.slice(0, 400)}` };
  }

  let data: {
    choices?: Array<{
      finish_reason?: string | null;
      message?: {
        role?: string;
        content?: string | null;
        tool_calls?: MistralToolCall[];
      };
    }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  try {
    data = JSON.parse(rawText);
  } catch {
    return { ok: false, error: "Mistral: JSON inválido na resposta" };
  }

  const choice = data.choices?.[0];
  const msg = choice?.message;
  const usageBase = { input: 0, out: 0 };
  const usage = somarUsage(usageBase, data.usage);

  const toolCalls = msg?.tool_calls;
  if (Array.isArray(toolCalls) && toolCalls.length > 0) {
    return {
      ok: true,
      kind: "tool_calls",
      toolCalls,
      usage: { inputTokens: usage.input, outputTokens: usage.out },
      finishReason: choice?.finish_reason,
    };
  }

  const trimmed = extrairTextoRespostaMistral(msg?.content);
  if (!trimmed) {
    return { ok: false, error: "Mistral: resposta vazia (sem texto nem tools)" };
  }

  return {
    ok: true,
    kind: "message",
    text: trimmed,
    usage: { inputTokens: usage.input, outputTokens: usage.out },
    finishReason: choice?.finish_reason,
  };
}
