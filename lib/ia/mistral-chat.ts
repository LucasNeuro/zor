/** Chamadas Chat Completions Mistral — alinhado a `lib/playbook/mistral-appendix.ts`. */

import { mistralApiKey } from "@/lib/ia/mistral-health";
import {
  extrairTextoRespostaMistral,
  resolveMistralReasoningEffort,
  type MistralReasoningEffort,
} from "@/lib/ia/mistral-reasoning";

const MISTRAL_CHAT_URL = "https://api.mistral.ai/v1/chat/completions";
const DEFAULT_MISTRAL_CHAT_TIMEOUT_MS = 30_000;
const DEFAULT_MISTRAL_CHAT_RETRIES = 1;

export type MistralChatRole = "user" | "assistant";

function mistralChatTimeoutMs(): number {
  const raw = Number.parseInt(String(process.env.MISTRAL_CHAT_TIMEOUT_MS || ""), 10);
  if (!Number.isFinite(raw) || raw < 5_000) return DEFAULT_MISTRAL_CHAT_TIMEOUT_MS;
  return raw;
}

function mistralChatRetries(): number {
  const raw = Number.parseInt(String(process.env.MISTRAL_CHAT_RETRIES || ""), 10);
  if (!Number.isFinite(raw) || raw < 0) return DEFAULT_MISTRAL_CHAT_RETRIES;
  return Math.min(raw, 3);
}

function shouldRetryMistral(status: number, body: string): boolean {
  if (status === 429 || status === 500 || status === 502 || status === 503 || status === 504) return true;
  const b = body.toLowerCase();
  return b.includes("service unavailable") || b.includes("timeout") || b.includes("overloaded");
}

export async function mistralChatCompletion(params: {
  model: string;
  system: string;
  messages: Array<{ role: MistralChatRole; content: string }>;
  maxTokens?: number;
  temperature?: number;
  /** Override; senão usa `resolveMistralReasoningEffort`. */
  reasoningEffort?: MistralReasoningEffort;
  playbookIaTurn?: boolean;
}): Promise<
  | { ok: true; text: string; inputTokens: number; outputTokens: number; model: string }
  | { ok: false; error: string }
> {
  const key = mistralApiKey();
  if (!key) return { ok: false, error: "MISTRAL_API_KEY não configurada" };

  const reasoningEffort =
    params.reasoningEffort ?? resolveMistralReasoningEffort({ playbookIaTurn: params.playbookIaTurn });
  const body: Record<string, unknown> = {
    model: params.model,
    temperature: params.temperature ?? 0.7,
    max_tokens: params.maxTokens ?? 1024,
    messages: [{ role: "system" as const, content: params.system }, ...params.messages],
  };
  if (reasoningEffort === "high") {
    body.reasoning_effort = "high";
  }
  const retries = mistralChatRetries();
  const timeoutMs = mistralChatTimeoutMs();

  let data: {
    choices?: Array<{ message?: { content?: string | unknown } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  } | null = null;
  let lastError = "Mistral: falha desconhecida";

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort("mistral_timeout"), timeoutMs);
    try {
      const res = await fetch(MISTRAL_CHAT_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        lastError = `Mistral HTTP ${res.status}: ${t.slice(0, 280)}`;
        if (attempt < retries && shouldRetryMistral(res.status, t)) {
          await new Promise((r) => setTimeout(r, 450 * (attempt + 1)));
          continue;
        }
        return { ok: false, error: lastError };
      }

      data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string | unknown } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      break;
    } catch (e) {
      clearTimeout(timeoutId);
      const msg = e instanceof Error ? e.message : String(e);
      lastError = msg.toLowerCase().includes("abort")
        ? `Mistral timeout após ${timeoutMs}ms`
        : msg || "fetch failed";
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 450 * (attempt + 1)));
        continue;
      }
      return { ok: false, error: lastError };
    }
  }

  if (!data) return { ok: false, error: lastError };

  const raw = data.choices?.[0]?.message?.content;
  const text = extrairTextoRespostaMistral(raw);
  if (!text.trim()) return { ok: false, error: "Mistral: resposta sem texto" };

  const inputTokens =
    data.usage?.prompt_tokens ?? Math.ceil((params.system.length + JSON.stringify(params.messages).length) / 4);
  const outputTokens = data.usage?.completion_tokens ?? Math.ceil(text.length / 4);

  return { ok: true, text, inputTokens, outputTokens, model: params.model };
}
