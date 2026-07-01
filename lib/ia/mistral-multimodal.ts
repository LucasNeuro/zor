/**
 * Mistral multimodal — OCR, transcrição, visão (Document AI + Chat Completions).
 * Geração de imagem: usar artefactos HTML ou integração externa (Mistral não gera imagens nativamente).
 */

import { delayMsParaRetryMistral, isMistralRateLimitError } from "@/lib/ia/mistral-rate-limit";

const MISTRAL_API = "https://api.mistral.ai/v1";
const DEFAULT_MISTRAL_MM_RETRIES = 2;

function apiKey(): string | null {
  const k = process.env.MISTRAL_API_KEY?.trim();
  return k || null;
}

async function mistralFetch<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const key = apiKey();
  if (!key) throw new Error("MISTRAL_API_KEY_ausente");

  let lastErr = "mistral_http_error";

  for (let attempt = 0; attempt <= DEFAULT_MISTRAL_MM_RETRIES; attempt++) {
    const res = await fetch(`${MISTRAL_API}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const json = (await res.json().catch(() => ({}))) as T & { message?: string; detail?: string };
    if (res.ok) return json;

    const msg =
      (json as { message?: string }).message ||
      (json as { detail?: string }).detail ||
      `mistral_http_${res.status}`;
    lastErr = String(msg).slice(0, 400);

    if (attempt < DEFAULT_MISTRAL_MM_RETRIES && (res.status === 429 || res.status >= 500)) {
      await new Promise((r) => setTimeout(r, delayMsParaRetryMistral(res.status, attempt)));
      continue;
    }

    throw new Error(`Mistral HTTP ${res.status}: ${lastErr}`);
  }

  throw new Error(lastErr);
}

export type MistralPercepcaoArgs = {
  modo: "ocr" | "transcrever_audio" | "descrever_imagem" | "perguntar_documento";
  url?: string;
  base64?: string;
  mime?: string;
  pergunta?: string;
};

export async function executarMistralPercepcao(args: MistralPercepcaoArgs): Promise<string> {
  const modo = args.modo;
  const url = String(args.url || "").trim();
  const b64 = String(args.base64 || "").trim();
  const mime = String(args.mime || "application/pdf").trim();

  if (!url && !b64) {
    return JSON.stringify({ erro: "url_ou_base64_obrigatorio" });
  }

  try {
    if (modo === "ocr" || modo === "perguntar_documento") {
      const document = url
        ? { type: "document_url", document_url: url }
        : { type: "document_url", document_url: `data:${mime};base64,${b64}` };

      const ocr = await mistralFetch<{ pages?: Array<{ markdown?: string }> }>("/ocr", {
        model: "mistral-ocr-latest",
        document,
      });

      const texto = (ocr.pages ?? [])
        .map((p) => p.markdown || "")
        .join("\n\n")
        .trim();

      if (modo === "ocr") {
        return JSON.stringify({ ok: true, modo: "ocr", caracteres: texto.length, texto: texto.slice(0, 50_000) });
      }

      const pergunta = String(args.pergunta || "Resuma o documento em português.").trim();
      const vision = await mistralFetch<{ choices?: Array<{ message?: { content?: string } }> }>(
        "/chat/completions",
        {
          model: process.env.MISTRAL_VISION_MODEL?.trim() || "pixtral-large-latest",
          messages: [
            {
              role: "user",
              content: [{ type: "text", text: `${pergunta}\n\nTexto OCR:\n${texto.slice(0, 24_000)}` }],
            },
          ],
          max_tokens: 2048,
        }
      );
      const resposta = vision.choices?.[0]?.message?.content || "";
      return JSON.stringify({ ok: true, modo: "perguntar_documento", resposta, ocr_chars: texto.length });
    }

    if (modo === "transcrever_audio") {
      const key = apiKey();
      if (!key) throw new Error("MISTRAL_API_KEY_ausente");

      let audioBlob: Blob;
      if (url) {
        const ar = await fetch(url);
        if (!ar.ok) throw new Error(`audio_fetch_${ar.status}`);
        audioBlob = await ar.blob();
      } else {
        const buf = Buffer.from(b64, "base64");
        audioBlob = new Blob([buf], { type: mime || "audio/mpeg" });
      }

      let json: { text?: string; error?: { message?: string } } = {};
      for (let attempt = 0; attempt <= DEFAULT_MISTRAL_MM_RETRIES; attempt++) {
        const form = new FormData();
        form.append("file", audioBlob, "audio.mp3");
        form.append("model", process.env.MISTRAL_TRANSCRIBE_MODEL?.trim() || "voxtral-mini-latest");

        const res = await fetch(`${MISTRAL_API}/audio/transcriptions`, {
          method: "POST",
          headers: { Authorization: `Bearer ${key}` },
          body: form,
        });
        json = (await res.json()) as { text?: string; error?: { message?: string } };
        if (res.ok) break;
        const errMsg = json.error?.message || `transcribe_${res.status}`;
        if (attempt < DEFAULT_MISTRAL_MM_RETRIES && (res.status === 429 || res.status >= 500)) {
          await new Promise((r) => setTimeout(r, delayMsParaRetryMistral(res.status, attempt)));
          continue;
        }
        throw new Error(
          isMistralRateLimitError(errMsg) || res.status === 429
            ? `Mistral HTTP 429: ${errMsg}`
            : errMsg
        );
      }
      return JSON.stringify({
        ok: true,
        modo: "transcrever_audio",
        texto: (json.text || "").slice(0, 50_000),
      });
    }

    if (modo === "descrever_imagem") {
      const imageUrl = url || `data:${mime || "image/jpeg"};base64,${b64}`;
      const pergunta = String(args.pergunta || "Descreva a imagem em detalhe em português.").trim();
      const vision = await mistralFetch<{ choices?: Array<{ message?: { content?: string } }> }>(
        "/chat/completions",
        {
          model: process.env.MISTRAL_VISION_MODEL?.trim() || "pixtral-large-latest",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: pergunta },
                { type: "image_url", image_url: { url: imageUrl } },
              ],
            },
          ],
          max_tokens: 2048,
        }
      );
      const resposta = vision.choices?.[0]?.message?.content || "";
      return JSON.stringify({ ok: true, modo: "descrever_imagem", resposta });
    }

    return JSON.stringify({
      erro: "modo_invalido",
      modos: ["ocr", "transcrever_audio", "descrever_imagem", "perguntar_documento"],
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro_mistral";
    return JSON.stringify({ erro: "mistral_percepcao_falhou", detalhe: msg.slice(0, 400) });
  }
}
