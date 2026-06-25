import Anthropic from "@anthropic-ai/sdk";

const MISTRAL_CHAT_URL = "https://api.mistral.ai/v1/chat/completions";

const DEFAULT_SYSTEM = `És um assistente técnico do CRM Waje (automação de agentes e ciclos IA).
Respostas só em português (Brasil), concisas e práticas. Não inventes dados sensíveis.`;

function sanitizarErroApi(raw: string, max = 280): string {
  const t = (raw || "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

async function gerarComMistral(
  user: string,
  system: string,
  maxTokens: number
): Promise<{ ok: true; texto: string } | { ok: false; error: string }> {
  const key = process.env.MISTRAL_API_KEY?.trim();
  if (!key) return { ok: false, error: "MISTRAL_API_KEY não configurada." };

  const model =
    process.env.MISTRAL_MODEL?.trim() ||
    process.env.AGENTE_WIZARD_CONHECIMENTO_MISTRAL_MODEL?.trim() ||
    "mistral-small-latest";

  try {
    const res = await fetch(MISTRAL_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.35,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return { ok: false, error: `Mistral: ${sanitizarErroApi(t || `HTTP ${res.status}`)}` };
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string | unknown } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    let texto = "";
    if (typeof content === "string") texto = content;
    else if (Array.isArray(content)) {
      for (const part of content as unknown[]) {
        if (part && typeof part === "object" && "text" in (part as object)) {
          const t = (part as { text?: string }).text;
          if (typeof t === "string") texto += t;
        }
      }
    }
    const cleaned = texto.trim();
    if (!cleaned) return { ok: false, error: "Mistral devolveu texto vazio." };
    return { ok: true, texto: cleaned };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Mistral: ${sanitizarErroApi(msg)}` };
  }
}

async function gerarComAnthropic(
  user: string,
  system: string,
  maxTokens: number
): Promise<{ ok: true; texto: string } | { ok: false; error: string }> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) return { ok: false, error: "ANTHROPIC_API_KEY não configurada." };

  const modelo =
    process.env.AGENTE_WIZARD_CONHECIMENTO_MODEL?.trim() || "claude-haiku-4-5-20251001";
  const anthropic = new Anthropic({ apiKey: key });

  try {
    const msg = await anthropic.messages.create({
      model: modelo,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    });
    const block = msg.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") {
      return { ok: false, error: "Anthropic: resposta sem texto." };
    }
    const texto = block.text.trim();
    if (!texto) return { ok: false, error: "Anthropic: texto vazio." };
    return { ok: true, texto: texto };
  } catch (e: unknown) {
    const raw = e instanceof Error ? e.message : String(e);
    return { ok: false, error: sanitizarErroApi(raw) };
  }
}

export type GerarTextoIaOpts = {
  user: string;
  system?: string;
  maxTokens?: number;
};

/** Gera texto via Mistral (preferido) com fallback Anthropic. */
export async function gerarTextoIa(
  opts: GerarTextoIaOpts
): Promise<{ ok: true; texto: string } | { ok: false; error: string }> {
  const system = opts.system?.trim() || DEFAULT_SYSTEM;
  const maxTokens = opts.maxTokens ?? 512;
  const user = opts.user;

  const mistralKey = process.env.MISTRAL_API_KEY?.trim();
  if (mistralKey) {
    const r = await gerarComMistral(user, system, maxTokens);
    if (r.ok) return r;
    const fallback = await gerarComAnthropic(user, system, maxTokens);
    if (fallback.ok) return fallback;
    return { ok: false, error: `${r.error} Fallback: ${fallback.error}` };
  }
  const only = await gerarComAnthropic(user, system, maxTokens);
  if (only.ok) return only;
  return {
    ok: false,
    error: only.error + " Configure MISTRAL_API_KEY ou ANTHROPIC_API_KEY.",
  };
}
