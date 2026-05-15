/** Chamadas Chat Completions Mistral — alinhado a `lib/playbook/mistral-appendix.ts`. */

const MISTRAL_CHAT_URL = "https://api.mistral.ai/v1/chat/completions";

export type MistralChatRole = "user" | "assistant";

export async function mistralChatCompletion(params: {
  model: string;
  system: string;
  messages: Array<{ role: MistralChatRole; content: string }>;
  maxTokens?: number;
  temperature?: number;
}): Promise<
  | { ok: true; text: string; inputTokens: number; outputTokens: number; model: string }
  | { ok: false; error: string }
> {
  const key = process.env.MISTRAL_API_KEY?.trim();
  if (!key) return { ok: false, error: "MISTRAL_API_KEY não configurada" };

  const body = {
    model: params.model,
    temperature: params.temperature ?? 0.7,
    max_tokens: params.maxTokens ?? 1024,
    messages: [{ role: "system" as const, content: params.system }, ...params.messages],
  };

  const res = await fetch(MISTRAL_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    return { ok: false, error: `Mistral HTTP ${res.status}: ${t.slice(0, 280)}` };
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string | unknown } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };

  const raw = data.choices?.[0]?.message?.content;
  const text = typeof raw === "string" ? raw : "";
  if (!text.trim()) return { ok: false, error: "Mistral: resposta sem texto" };

  const inputTokens =
    data.usage?.prompt_tokens ?? Math.ceil((params.system.length + JSON.stringify(params.messages).length) / 4);
  const outputTokens = data.usage?.completion_tokens ?? Math.ceil(text.length / 4);

  return { ok: true, text, inputTokens, outputTokens, model: params.model };
}
