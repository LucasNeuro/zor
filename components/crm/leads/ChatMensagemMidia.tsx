"use client";

import { useCallback, useState } from "react";
import { Download, FileText, Loader2, Mic } from "lucide-react";
import type { TipoMidiaChat } from "@/lib/crm/chat-mensagem-midia";
import { conteudoEhPlaceholderMidia } from "@/lib/crm/chat-mensagem-midia";
import { internalApiHeaders } from "@/lib/internal-api-headers";

type TemaClaro = {
  text: string;
  muted: string;
  border: string;
  surface: string;
  accent: string;
};

type Props = {
  leadId: string;
  conteudo: string;
  tipoMidia: TipoMidiaChat;
  urlMidia?: string | null;
  nomeArquivo?: string | null;
  whatsappMessageId?: string | null;
  tema: TemaClaro;
};

export function ChatMensagemMidia({
  leadId,
  conteudo,
  tipoMidia,
  urlMidia,
  nomeArquivo,
  whatsappMessageId,
  tema,
}: Props) {
  const [url, setUrl] = useState<string | null>(urlMidia ?? null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  const mostrarTexto =
    conteudo.trim().length > 0 && !conteudoEhPlaceholderMidia(conteudo, tipoMidia);

  const resolverUrl = useCallback(async () => {
    if (url) return url;
    const msgId = whatsappMessageId?.trim();
    if (!msgId) return null;
    setCarregando(true);
    setErro("");
    try {
      const qs = new URLSearchParams({
        leadId,
        messageId: msgId,
        tipo: tipoMidia,
      });
      const res = await fetch(`/api/crm/atendimento/midia?${qs}`, {
        headers: internalApiHeaders(),
      });
      const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !json.url) {
        setErro(typeof json.error === "string" ? json.error : "Não foi possível carregar a mídia.");
        return null;
      }
      setUrl(json.url);
      return json.url;
    } catch {
      setErro("Erro de rede ao carregar mídia.");
      return null;
    } finally {
      setCarregando(false);
    }
  }, [leadId, tipoMidia, url, whatsappMessageId]);

  if (tipoMidia === "texto") {
    return mostrarTexto ? (
      <span style={{ whiteSpace: "pre-wrap" }}>{conteudo}</span>
    ) : null;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {tipoMidia === "audio" ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 10px",
            borderRadius: 10,
            background: tema.surface,
            border: `1px solid ${tema.border}`,
          }}
        >
          <Mic size={16} color={tema.accent} aria-hidden />
          {carregando ? (
            <span className="flex items-center gap-2 text-xs" style={{ color: tema.muted }}>
              <Loader2 size={14} className="animate-spin" />
              A carregar áudio…
            </span>
          ) : url ? (
            <audio
              controls
              preload="metadata"
              src={url}
              style={{ width: "100%", height: 32, minWidth: 180 }}
            />
          ) : (
            <button
              type="button"
              onClick={() => void resolverUrl()}
              className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
              style={{
                borderColor: tema.border,
                color: tema.text,
                background: "#fff",
              }}
            >
              Ouvir áudio
            </button>
          )}
        </div>
      ) : null}

      {tipoMidia === "imagem" ? (
        <div>
          {url ? (
            <a href={url} target="_blank" rel="noopener noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={nomeArquivo || "Imagem"}
                style={{
                  maxWidth: "100%",
                  maxHeight: 280,
                  borderRadius: 10,
                  border: `1px solid ${tema.border}`,
                }}
              />
            </a>
          ) : (
            <button
              type="button"
              onClick={() => void resolverUrl()}
              disabled={carregando}
              className="text-xs font-semibold underline"
              style={{ color: tema.accent }}
            >
              {carregando ? "A carregar imagem…" : "Ver imagem"}
            </button>
          )}
        </div>
      ) : null}

      {(tipoMidia === "documento" || tipoMidia === "video") && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 12px",
            borderRadius: 10,
            background: tema.surface,
            border: `1px solid ${tema.border}`,
          }}
        >
          <FileText size={18} color={tema.muted} aria-hidden />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p className="m-0 truncate text-xs font-semibold" style={{ color: tema.text }}>
              {nomeArquivo || (tipoMidia === "video" ? "Vídeo" : "Documento")}
            </p>
            <p className="m-0 text-[10px]" style={{ color: tema.muted }}>
              {tipoMidia === "video" ? "Vídeo recebido" : "Arquivo recebido"}
            </p>
          </div>
          {url ? (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold"
              style={{ borderColor: tema.border, color: tema.accent }}
            >
              <Download size={12} />
              Abrir
            </a>
          ) : (
            <button
              type="button"
              onClick={() => void resolverUrl()}
              disabled={carregando}
              className="rounded-lg border px-2.5 py-1.5 text-[11px] font-bold"
              style={{ borderColor: tema.border, color: tema.accent }}
            >
              {carregando ? "…" : "Baixar"}
            </button>
          )}
        </div>
      )}

      {erro ? (
        <p className="m-0 text-[11px]" style={{ color: "#b42318" }}>
          {erro}
        </p>
      ) : null}

      {mostrarTexto ? (
        <p className="m-0 text-xs leading-relaxed" style={{ color: tema.muted, whiteSpace: "pre-wrap" }}>
          {conteudo}
        </p>
      ) : null}
    </div>
  );
}
