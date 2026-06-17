"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, FileText, Loader2, Mic, Play, Pause } from "lucide-react";
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

function MiniAudioPlayer({ src, tema }: { src: string; tema: TemaClaro }) {
  const [audio] = useState(() => (typeof Audio !== "undefined" ? new Audio(src) : null));
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!audio) return;
    audio.src = src;
    audio.preload = "metadata";

    const onTime = () => setProgress(audio.currentTime);
    const onMeta = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const onEnd = () => {
      setPlaying(false);
      setProgress(0);
    };

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnd);
    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnd);
    };
  }, [audio, src]);

  function toggle() {
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      void audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
  }

  const pct = duration > 0 ? Math.min(100, (progress / duration) * 100) : 0;
  const fmt = (s: number) => {
    if (!Number.isFinite(s) || s <= 0) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex min-w-[200px] flex-1 items-center gap-2">
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pausar áudio" : "Reproduzir áudio"}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-0"
        style={{ background: tema.accent, color: "#0b2210" }}
      >
        {playing ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div
          className="h-1.5 w-full overflow-hidden rounded-full"
          style={{ background: `${tema.border}` }}
        >
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, background: tema.accent }}
          />
        </div>
        <span className="text-[10px] tabular-nums" style={{ color: tema.muted }}>
          {fmt(progress)} / {fmt(duration)}
        </span>
      </div>
    </div>
  );
}

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

  const podeResolver = Boolean(whatsappMessageId?.trim()) && !url;

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

  const autoLoadRef = useRef(false);

  useEffect(() => {
    if (autoLoadRef.current) return;
    if ((tipoMidia === "audio" || tipoMidia === "imagem") && podeResolver) {
      autoLoadRef.current = true;
      void resolverUrl();
    }
  }, [tipoMidia, podeResolver, resolverUrl]);

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
            minWidth: 220,
          }}
        >
          <Mic size={16} color={tema.accent} aria-hidden className="shrink-0" />
          {carregando ? (
            <span className="flex items-center gap-2 text-xs" style={{ color: tema.muted }}>
              <Loader2 size={14} className="animate-spin" />
              A carregar áudio…
            </span>
          ) : url ? (
            <MiniAudioPlayer src={url} tema={tema} />
          ) : podeResolver ? null : (
            <span className="text-xs" style={{ color: tema.muted }}>
              Áudio recebido
            </span>
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
          ) : carregando ? (
            <span className="text-xs" style={{ color: tema.muted }}>
              A carregar imagem…
            </span>
          ) : (
            <div
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
              style={{ background: tema.surface, border: `1px solid ${tema.border}`, color: tema.muted }}
            >
              <FileText size={14} />
              {nomeArquivo || "Imagem enviada"}
            </div>
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
          ) : podeResolver ? (
            <button
              type="button"
              onClick={() => void resolverUrl()}
              disabled={carregando}
              className="rounded-lg border px-2.5 py-1.5 text-[11px] font-bold"
              style={{ borderColor: tema.border, color: tema.accent }}
            >
              {carregando ? "…" : "Baixar"}
            </button>
          ) : null}
        </div>
      )}

      {erro ? (
        <p className="m-0 text-[11px]" style={{ color: "#b42318" }}>
          {erro}
          {podeResolver ? (
            <>
              {" "}
              <button
                type="button"
                className="underline"
                onClick={() => void resolverUrl()}
              >
                Tentar novamente
              </button>
            </>
          ) : null}
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
