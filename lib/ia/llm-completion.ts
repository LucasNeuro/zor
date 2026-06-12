import Anthropic from "@anthropic-ai/sdk";
import {
  isAnthropicModelId,
  isMistralFamilyModelId,
  mistralDefaultModelId,
  resolveInferenceModelId,
} from "./hub-model-defaults";
import { mistralChatCompletion } from "./mistral-chat";

function anthropicErroProvavelmenteRecuperavelComMistral(raw: string): boolean {
  const s = raw.toLowerCase();
  return (
    /credit balance|too low|billing|plan|purchase credit/.test(s) ||
    /invalid_request_error/.test(s) ||
    /rate.?limit|429/.test(s) ||
    /overloaded|529/.test(s) ||
    /status code 402/.test(s)
  );
}

/** Preferir Mistral quando o modelo não é explicitamente Claude; Anthropic para IDs `claude-*`. */
export async function completarChatPreferindoMistral(params: {
  systemPrompt: string;
  mensagens: Array<{ role: "user" | "assistant"; content: string }>;
  modeloFromDb: string;
  maxTokens?: number;
  /** Turno playbook IA (WhatsApp híbrido) — afeta `MISTRAL_REASONING_EFFORT_PLAYBOOK_IA_ONLY`. */
  playbookIaTurn?: boolean;
}): Promise<
  | { ok: true; texto: string; tokensEntrada: number; tokensSaida: number; modeloLog: string }
  | { ok: false; erro: string }
> {
  const modeloResolved = resolveInferenceModelId(params.modeloFromDb);
  const mistralKey = process.env.MISTRAL_API_KEY?.trim();
  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();
  const maxTokens = params.maxTokens ?? 1024;

  async function viaMistral(): Promise<
    | { ok: true; texto: string; tokensEntrada: number; tokensSaida: number; modeloLog: string }
    | { ok: false; erro: string }
  > {
    if (!mistralKey) {
      return { ok: false, erro: "MISTRAL_API_KEY não configurada." };
    }
    const mid = isMistralFamilyModelId(modeloResolved) ? modeloResolved : mistralDefaultModelId();
    const chat = await mistralChatCompletion({
      model: mid,
      system: params.systemPrompt,
      messages: params.mensagens,
      maxTokens,
      playbookIaTurn: params.playbookIaTurn,
    });
    if (!chat.ok) return { ok: false, erro: chat.error };
    return {
      ok: true,
      texto: chat.text,
      tokensEntrada: chat.inputTokens,
      tokensSaida: chat.outputTokens,
      modeloLog: chat.model,
    };
  }

  if (isAnthropicModelId(modeloResolved) && anthropicKey) {
    try {
      const anthropic = new Anthropic({ apiKey: anthropicKey });
      const resposta = await anthropic.messages.create({
        model: modeloResolved,
        max_tokens: maxTokens,
        system: params.systemPrompt,
        messages: params.mensagens,
      });
      const texto = resposta.content[0].type === "text" ? resposta.content[0].text : "";
      return {
        ok: true,
        texto,
        tokensEntrada: resposta.usage.input_tokens,
        tokensSaida: resposta.usage.output_tokens,
        modeloLog: modeloResolved,
      };
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      if (mistralKey && anthropicErroProvavelmenteRecuperavelComMistral(raw)) {
        const m = await viaMistral();
        if (m.ok) return m;
      }
      return { ok: false, erro: raw };
    }
  }

  const mistralOut = await viaMistral();
  if (mistralOut.ok) return mistralOut;

  if (anthropicKey) {
    try {
      const anthropic = new Anthropic({ apiKey: anthropicKey });
      const fallback = "claude-haiku-4-5-20251001";
      const resposta = await anthropic.messages.create({
        model: fallback,
        max_tokens: maxTokens,
        system: params.systemPrompt,
        messages: params.mensagens,
      });
      const texto = resposta.content[0].type === "text" ? resposta.content[0].text : "";
      return {
        ok: true,
        texto,
        tokensEntrada: resposta.usage.input_tokens,
        tokensSaida: resposta.usage.output_tokens,
        modeloLog: fallback,
      };
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      if (mistralKey && anthropicErroProvavelmenteRecuperavelComMistral(raw)) {
        const m = await viaMistral();
        if (m.ok) return m;
      }
      return { ok: false, erro: raw };
    }
  }

  return {
    ok: false,
    erro:
      mistralOut.erro ||
      "Nenhum provedor IA configurado: defina MISTRAL_API_KEY (preferencial) ou ANTHROPIC_API_KEY",
  };
}
