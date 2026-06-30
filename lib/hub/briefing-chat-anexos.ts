import "server-only";

import { executarMistralPercepcao, type MistralPercepcaoArgs } from "@/lib/ia/mistral-multimodal";
import {
  MAX_BRIEFING_ANEXO_BYTES,
  MAX_BRIEFING_ANEXOS_POR_MENSAGEM,
} from "@/lib/hub/briefing-chat-anexos-constants";

export { MAX_BRIEFING_ANEXO_BYTES, MAX_BRIEFING_ANEXOS_POR_MENSAGEM };

export type BriefingChatAnexoInput = {
  nome: string;
  mime: string;
  base64: string;
};

export type BriefingChatAnexoProcessado = {
  nome: string;
  mime: string;
  tipo: "imagem" | "audio" | "documento" | "outro";
  modo_mistral: MistralPercepcaoArgs["modo"];
  resumo?: string;
  erro?: string;
};

function tipoAnexoDeMime(mime: string): BriefingChatAnexoProcessado["tipo"] {
  const m = mime.toLowerCase();
  if (m.startsWith("image/")) return "imagem";
  if (m.startsWith("audio/")) return "audio";
  if (
    m === "application/pdf" ||
    m.includes("document") ||
    m.includes("spreadsheet") ||
    m.includes("text/")
  ) {
    return "documento";
  }
  return "outro";
}

function modoMistralParaAnexo(
  mime: string,
  tipo: BriefingChatAnexoProcessado["tipo"]
): MistralPercepcaoArgs["modo"] {
  if (tipo === "audio") return "transcrever_audio";
  if (tipo === "imagem") return "descrever_imagem";
  if (tipo === "documento") return "ocr";
  return "ocr";
}

function extrairTextoPercepcao(raw: string, modo: MistralPercepcaoArgs["modo"]): string {
  try {
    const parsed = JSON.parse(raw) as {
      ok?: boolean;
      texto?: string;
      resposta?: string;
      erro?: string;
      detalhe?: string;
    };
    if (parsed.erro) {
      return `[Erro Mistral: ${parsed.erro}${parsed.detalhe ? ` — ${parsed.detalhe}` : ""}]`;
    }
    if (modo === "transcrever_audio" && typeof parsed.texto === "string") return parsed.texto.trim();
    if (modo === "descrever_imagem" && typeof parsed.resposta === "string") return parsed.resposta.trim();
    if ((modo === "ocr" || modo === "perguntar_documento") && typeof parsed.texto === "string") {
      return parsed.texto.trim();
    }
    if (typeof parsed.resposta === "string") return parsed.resposta.trim();
  } catch {
    return raw.slice(0, 8000);
  }
  return "";
}

export function validarAnexosBriefingChat(anexos: unknown): BriefingChatAnexoInput[] {
  if (!Array.isArray(anexos) || anexos.length === 0) return [];
  if (anexos.length > MAX_BRIEFING_ANEXOS_POR_MENSAGEM) {
    throw new Error(`Máximo de ${MAX_BRIEFING_ANEXOS_POR_MENSAGEM} anexos por mensagem.`);
  }

  const out: BriefingChatAnexoInput[] = [];
  for (const item of anexos) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const nome = String(rec.nome ?? "anexo").trim().slice(0, 240) || "anexo";
    const mime = String(rec.mime ?? "application/octet-stream").trim().slice(0, 120);
    const base64 = String(rec.base64 ?? "").trim();
    if (!base64) continue;

    const bytesAprox = Math.floor((base64.length * 3) / 4);
    if (bytesAprox > MAX_BRIEFING_ANEXO_BYTES) {
      throw new Error(`O anexo «${nome}» excede ${Math.round(MAX_BRIEFING_ANEXO_BYTES / (1024 * 1024))} MB.`);
    }

    out.push({ nome, mime, base64 });
  }
  return out;
}

export async function processarAnexosBriefingChat(
  anexos: BriefingChatAnexoInput[]
): Promise<{ blocoMultimodal: string; anexosMeta: BriefingChatAnexoProcessado[] }> {
  if (!anexos.length) {
    return { blocoMultimodal: "", anexosMeta: [] };
  }

  const temMistral = Boolean(process.env.MISTRAL_API_KEY?.trim());
  const partes: string[] = [];
  const anexosMeta: BriefingChatAnexoProcessado[] = [];

  for (const anexo of anexos) {
    const tipo = tipoAnexoDeMime(anexo.mime);
    const modo = modoMistralParaAnexo(anexo.mime, tipo);
    const meta: BriefingChatAnexoProcessado = {
      nome: anexo.nome,
      mime: anexo.mime,
      tipo,
      modo_mistral: modo,
    };

    if (!temMistral) {
      meta.erro = "MISTRAL_API_KEY ausente — anexo registado sem OCR/transcrição.";
      anexosMeta.push(meta);
      partes.push(`[Anexo: ${anexo.nome} (${tipo}) — percepção multimodal indisponível]`);
      continue;
    }

    const raw = await executarMistralPercepcao({
      modo,
      base64: anexo.base64,
      mime: anexo.mime,
      pergunta:
        tipo === "imagem"
          ? "Descreva esta imagem em português para um assistente interno de CRM."
          : undefined,
    });

    const resumo = extrairTextoPercepcao(raw, modo);
    if (resumo) meta.resumo = resumo.slice(0, 12_000);
    else meta.erro = "Não foi possível extrair conteúdo do anexo.";

    anexosMeta.push(meta);

    if (tipo === "audio") {
      partes.push(
        resumo
          ? `[Áudio anexado: ${anexo.nome}]\nTranscrição:\n${resumo}`
          : `[Áudio anexado: ${anexo.nome} — transcrição indisponível]`
      );
    } else if (tipo === "imagem") {
      partes.push(
        resumo
          ? `[Imagem anexada: ${anexo.nome}]\nDescrição:\n${resumo}`
          : `[Imagem anexada: ${anexo.nome} — descrição indisponível]`
      );
    } else {
      partes.push(
        resumo
          ? `[Documento anexado: ${anexo.nome}]\nConteúdo extraído (OCR):\n${resumo.slice(0, 8000)}`
          : `[Documento anexado: ${anexo.nome} — OCR indisponível]`
      );
    }
  }

  return {
    blocoMultimodal: partes.join("\n\n"),
    anexosMeta,
  };
}

export function montarMensagemComAnexos(textoUser: string, blocoMultimodal: string): string {
  const t = textoUser.trim();
  if (!blocoMultimodal.trim()) return t;
  if (!t) return blocoMultimodal.trim();
  return `${t}\n\n---\nConteúdo multimodal (anexos):\n${blocoMultimodal.trim()}`;
}
