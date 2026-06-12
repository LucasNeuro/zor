/**
 * Extração de texto para a base de conhecimento do tenant.
 * Prioriza Mistral Document AI (leitura estruturada); fallback local em rag.ts.
 */

import { extensaoArquivo } from "@/lib/hub/rag-formatos";
import { extrairTextoDocumentoRag } from "@/lib/hub/rag";
import {
  formatoSuportadoMistralDocumentAi,
  mistralDocumentAiHabilitado,
  processarDocumentoMistralDocumentAi,
} from "@/lib/ia/mistral-document-ai";

export type ExtracaoConhecimentoFonte = "mistral_document_ai" | "local";

export type ExtracaoConhecimentoResult =
  | {
      ok: true;
      texto: string;
      fonte: ExtracaoConhecimentoFonte;
      resumo_ia?: Record<string, unknown> | null;
      metadata?: Record<string, unknown>;
    }
  | { ok: false; error: string };

function textoPlanoLocal(fileName: string, mimeType?: string | null): boolean {
  const ext = extensaoArquivo(fileName);
  const mime = (mimeType || "").toLowerCase();
  return (
    mime.startsWith("text/") ||
    mime === "application/json" ||
    mime === "application/xml" ||
    [".md", ".markdown", ".txt", ".csv", ".json", ".xml"].includes(ext)
  );
}

function anotacaoParaResumoIa(anotacao: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!anotacao || typeof anotacao !== "object") return null;
  const empresa = typeof anotacao.empresa === "string" ? anotacao.empresa.trim() : "";
  const nicho = typeof anotacao.nicho === "string" ? anotacao.nicho.trim() : "";
  if (!empresa && !nicho) return null;
  return {
    ...anotacao,
    _fonte: "mistral_document_ai",
  };
}

/**
 * Extrai texto (e opcionalmente resumo estruturado) para indexação na base de conhecimento.
 * PDFs e documentos binários usam Mistral Document AI quando disponível.
 */
export async function extrairTextoParaConhecimentoTenant(
  fileName: string,
  mimeType: string | null | undefined,
  buffer: Buffer
): Promise<ExtracaoConhecimentoResult> {
  const usarDocumentAi = mistralDocumentAiHabilitado() && formatoSuportadoMistralDocumentAi(fileName, mimeType);
  const textoPlano = textoPlanoLocal(fileName, mimeType);

  if (usarDocumentAi && !textoPlano) {
    const docAi = await processarDocumentoMistralDocumentAi({
      buffer,
      fileName,
      mimeType,
      comAnotacaoNegocio: true,
    });

    if (docAi.ok) {
      return {
        ok: true,
        texto: docAi.result.texto,
        fonte: "mistral_document_ai",
        resumo_ia: anotacaoParaResumoIa(docAi.result.anotacao),
        metadata: {
          extracao: "mistral_document_ai",
          document_ai_modelo: docAi.result.modelo,
          document_ai_paginas: docAi.result.paginas,
        },
      };
    }

    const local = extrairTextoDocumentoRag(fileName, mimeType, buffer);
    if (local.ok) {
      return {
        ok: true,
        texto: local.texto,
        fonte: "local",
        metadata: {
          extracao: "local",
          document_ai_erro: docAi.error.slice(0, 240),
        },
      };
    }

    return { ok: false, error: `${docAi.error} Fallback local: ${local.error}` };
  }

  const local = extrairTextoDocumentoRag(fileName, mimeType, buffer);
  if (local.ok) {
    return {
      ok: true,
      texto: local.texto,
      fonte: "local",
      metadata: { extracao: "local" },
    };
  }

  if (mistralDocumentAiHabilitado() && formatoSuportadoMistralDocumentAi(fileName, mimeType)) {
    const docAi = await processarDocumentoMistralDocumentAi({
      buffer,
      fileName,
      mimeType,
      comAnotacaoNegocio: true,
    });
    if (docAi.ok) {
      return {
        ok: true,
        texto: docAi.result.texto,
        fonte: "mistral_document_ai",
        resumo_ia: anotacaoParaResumoIa(docAi.result.anotacao),
        metadata: {
          extracao: "mistral_document_ai",
          document_ai_modelo: docAi.result.modelo,
          document_ai_paginas: docAi.result.paginas,
          fallback_de: "local",
        },
      };
    }
    return { ok: false, error: `${local.error} Document AI: ${docAi.error}` };
  }

  return local;
}
