/**
 * Mistral Document AI — leitura estruturada de documentos (POST /v1/ocr).
 * Usado na base de conhecimento do tenant para extrair texto + anotações de negócio.
 */

import { mistralApiKey } from "@/lib/ia/mistral-health";
import { extensaoArquivo } from "@/lib/hub/rag-formatos";

const MISTRAL_OCR_URL = "https://api.mistral.ai/v1/ocr";
const DEFAULT_TIMEOUT_MS = 120_000;
const MAX_PAGES_PROCESSAR = 40;

export type MistralDocumentAiFonte = "mistral_document_ai";

export type MistralDocumentAiResult = {
  texto: string;
  anotacao: Record<string, unknown> | null;
  paginas: number;
  modelo: string;
  fonte: MistralDocumentAiFonte;
};

/** Document AI activo por defeito quando há MISTRAL_API_KEY (desligar com HUB_CONHECIMENTO_MISTRAL_DOCUMENT_AI=false). */
export function mistralDocumentAiHabilitado(): boolean {
  const flag = process.env.HUB_CONHECIMENTO_MISTRAL_DOCUMENT_AI?.trim().toLowerCase();
  if (flag === "false" || flag === "0" || flag === "off") return false;
  return Boolean(mistralApiKey());
}

export function formatoSuportadoMistralDocumentAi(fileName: string, mimeType?: string | null): boolean {
  const ext = extensaoArquivo(fileName);
  const mime = (mimeType || "").toLowerCase();

  if (ext === ".pdf" || mime === "application/pdf") return true;
  if (
    ext === ".docx" ||
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  )
    return true;
  if (
    ext === ".pptx" ||
    mime === "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  )
    return true;
  if (ext === ".odt" || mime === "application/vnd.oasis.opendocument.text") return true;
  if (ext === ".rtf" || mime === "application/rtf" || mime === "text/rtf") return true;
  if (ext === ".html" || ext === ".htm" || mime === "text/html") return true;
  if (
    ext === ".xlsx" ||
    mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  )
    return true;
  if ([".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(ext)) return true;
  if (mime.startsWith("image/")) return true;

  return false;
}

function mimeParaDataUrl(fileName: string, mimeType?: string | null): string {
  const ext = extensaoArquivo(fileName);
  const mime = (mimeType || "").toLowerCase();
  if (mime && mime !== "application/octet-stream") return mime;
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (ext === ".pptx") return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  if (ext === ".odt") return "application/vnd.oasis.opendocument.text";
  if (ext === ".xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  if (ext === ".html" || ext === ".htm") return "text/html";
  if (ext === ".rtf") return "application/rtf";
  return "application/octet-stream";
}

function documentAiTimeoutMs(): number {
  const raw = Number.parseInt(String(process.env.MISTRAL_DOCUMENT_AI_TIMEOUT_MS || ""), 10);
  if (!Number.isFinite(raw) || raw < 10_000) return DEFAULT_TIMEOUT_MS;
  return Math.min(raw, 300_000);
}

function documentAiModel(): string {
  return (
    process.env.MISTRAL_DOCUMENT_AI_MODEL?.trim() ||
    process.env.MISTRAL_OCR_MODEL?.trim() ||
    "mistral-ocr-latest"
  );
}

const ANOTACAO_NEGOCIO_SCHEMA = {
  type: "json_schema" as const,
  json_schema: {
    name: "conhecimento_negocio_documento",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        empresa: {
          type: "string",
          description: "O que a empresa faz no dia a dia (operação concreta).",
        },
        tipo_documento: {
          type: "string",
          description: "Tipo do documento (ex.: POP, contrato, catálogo, manual).",
        },
        nicho: {
          type: "string",
          description: "Nicho específico inferido (ex.: construção civil, clínica, restaurante).",
        },
        modelo_negocio: {
          type: "string",
          description: "B2C, B2B, misto ou vazio se incerto.",
        },
        segmentos: {
          type: "array",
          items: { type: "string" },
          description: "Segmentos de mercado mencionados ou inferidos.",
        },
        produtos_servicos: {
          type: "array",
          items: { type: "string" },
          description: "Produtos ou serviços concretos.",
        },
        publico_alvo: { type: "string" },
        tom_voz: { type: "string" },
        pontos_chave: {
          type: "array",
          items: { type: "string" },
          description: "Até 8 factos relevantes do documento.",
        },
      },
      required: [
        "empresa",
        "tipo_documento",
        "nicho",
        "modelo_negocio",
        "segmentos",
        "produtos_servicos",
        "publico_alvo",
        "tom_voz",
        "pontos_chave",
      ],
    },
  },
};

const ANOTACAO_NEGOCIO_PROMPT = `Analisa este documento interno de UMA empresa no ecossistema Waje.
Extrai o NEGÓCIO REAL (não o tema jurídico/formal). POPs e termos descrevem processos internos — identifica quem presta o serviço (ex.: obra, clínica, loja).
Não inventes marcas ou números ausentes. Campos vazios: string "" ou array [].`;

type OcrPage = {
  index?: number;
  markdown?: string;
  text?: string;
};

function parseAnotacao(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null;
  if (typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }
  return null;
}

function textoDasPaginas(pages: OcrPage[]): string {
  return pages
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map((p) => (p.markdown || p.text || "").trim())
    .filter(Boolean)
    .join("\n\n")
    .replace(/\u0000/g, "")
    .trim();
}

function montarDocumentPayload(
  buffer: Buffer,
  fileName: string,
  mimeType?: string | null
): Record<string, unknown> {
  const ext = extensaoArquivo(fileName);
  const mime = mimeParaDataUrl(fileName, mimeType);
  const b64 = buffer.toString("base64");

  if (mime.startsWith("image/") || [".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(ext)) {
    return {
      type: "image_url",
      image_url: `data:${mime};base64,${b64}`,
    };
  }

  return {
    type: "document_url",
    document_url: `data:${mime};base64,${b64}`,
  };
}

/**
 * Processa documento via Mistral Document AI (leitura + anotações estruturadas).
 */
export async function processarDocumentoMistralDocumentAi(params: {
  buffer: Buffer;
  fileName: string;
  mimeType?: string | null;
  comAnotacaoNegocio?: boolean;
}): Promise<{ ok: true; result: MistralDocumentAiResult } | { ok: false; error: string }> {
  const key = mistralApiKey();
  if (!key) return { ok: false, error: "MISTRAL_API_KEY não configurada para Document AI." };

  if (!formatoSuportadoMistralDocumentAi(params.fileName, params.mimeType)) {
    return { ok: false, error: "Formato não suportado pelo Mistral Document AI." };
  }

  const model = documentAiModel();
  const document = montarDocumentPayload(params.buffer, params.fileName, params.mimeType);

  const body: Record<string, unknown> = {
    model,
    document,
    include_image_base64: false,
  };

  if (params.comAnotacaoNegocio !== false) {
    body.document_annotation_format = ANOTACAO_NEGOCIO_SCHEMA;
    body.document_annotation_prompt = ANOTACAO_NEGOCIO_PROMPT;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort("mistral_document_ai_timeout"), documentAiTimeoutMs());

  try {
    const res = await fetch(MISTRAL_OCR_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return {
        ok: false,
        error: `Mistral Document AI HTTP ${res.status}: ${t.slice(0, 360)}`,
      };
    }

    const data = (await res.json()) as {
      pages?: OcrPage[];
      model?: string;
      document_annotation?: unknown;
    };

    const pages = Array.isArray(data.pages) ? data.pages.slice(0, MAX_PAGES_PROCESSAR) : [];
    const texto = textoDasPaginas(pages);

    if (texto.length < 40) {
      return {
        ok: false,
        error:
          "Mistral Document AI não devolveu texto suficiente. Verifique se o ficheiro tem conteúdo legível.",
      };
    }

    return {
      ok: true,
      result: {
        texto,
        anotacao: parseAnotacao(data.document_annotation),
        paginas: pages.length,
        modelo: String(data.model || model),
        fonte: "mistral_document_ai",
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("abort") || msg.includes("timeout")) {
      return { ok: false, error: "Mistral Document AI: tempo limite excedido." };
    }
    return { ok: false, error: `Mistral Document AI: ${msg.slice(0, 280)}` };
  } finally {
    clearTimeout(timeoutId);
  }
}
