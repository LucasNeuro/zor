"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  FileText,
  Image as ImageIcon,
  Mic,
  Paperclip,
  Plus,
  Square,
  X,
} from "lucide-react";
import { MAX_BRIEFING_ANEXO_BYTES } from "@/lib/hub/briefing-chat-anexos-constants";
import {
  RF_BORDER,
  RF_BORDER_STRONG,
  RF_TEXT_MUTED,
  RF_TEXT_PRIMARY,
} from "@/lib/crm/crm-retrofit-dark-theme";

export type CopilotoAnexoPayload = {
  nome: string;
  mime: string;
  base64: string;
};

type AnexoLocal = {
  id: string;
  file: File;
  previewUrl: string | null;
};

type Props = {
  value: string;
  onChange: (v: string) => void;
  onSend: (payload: { texto: string; anexos: CopilotoAnexoPayload[] }) => void | Promise<void>;
  disabled?: boolean;
  sending?: boolean;
  placeholder?: string;
  multimodalAtivo?: boolean;
  /** Rodapé com dicas de anexos/áudio (desligado no copiloto interno). */
  mostrarDicas?: boolean;
};

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function formatRecordingTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function CopilotoMultimodalComposer({
  value,
  onChange,
  onSend,
  disabled = false,
  sending = false,
  placeholder = "Escreva sua mensagem…",
  multimodalAtivo = true,
  mostrarDicas = true,
}: Props) {
  const [anexos, setAnexos] = useState<AnexoLocal[]>([]);
  const [menuAberto, setMenuAberto] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [segundosGravacao, setSegundosGravacao] = useState(0);
  const [erroLocal, setErroLocal] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  const bloqueado = disabled || sending;

  const limparPreviews = useCallback((lista: AnexoLocal[]) => {
    for (const a of lista) {
      if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
    }
  }, []);

  useEffect(() => {
    return () => {
      limparPreviews(anexos);
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    };
  }, [anexos, limparPreviews]);

  useEffect(() => {
    if (!menuAberto) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuAberto(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuAberto]);

  function adicionarArquivo(file: File) {
    setErroLocal("");
    if (file.size > MAX_BRIEFING_ANEXO_BYTES) {
      setErroLocal(`Arquivo excede ${Math.round(MAX_BRIEFING_ANEXO_BYTES / (1024 * 1024))} MB.`);
      return;
    }
    setAnexos((prev) => {
      limparPreviews(prev);
      const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : null;
      return [{ id: `anexo-${Date.now()}`, file, previewUrl }];
    });
    setMenuAberto(false);
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) adicionarArquivo(file);
  }

  function removerAnexo(id: string) {
    setAnexos((prev) => {
      const alvo = prev.find((a) => a.id === id);
      if (alvo?.previewUrl) URL.revokeObjectURL(alvo.previewUrl);
      return prev.filter((a) => a.id !== id);
    });
  }

  async function pararGravacao() {
    const rec = mediaRecorderRef.current;
    if (!rec || rec.state === "inactive") return;
    rec.stop();
  }

  async function iniciarGravacao() {
    setErroLocal("");
    if (gravando) {
      await pararGravacao();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setErroLocal("Gravação de áudio não suportada neste browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime =
        MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : MediaRecorder.isTypeSupported("audio/webm")
            ? "audio/webm"
            : "audio/mp4";
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mime.split(";")[0] || "audio/webm" });
        const ext = mime.includes("webm") ? "webm" : "m4a";
        const file = new File([blob], `gravacao-${Date.now()}.${ext}`, {
          type: blob.type || "audio/webm",
        });
        adicionarArquivo(file);
        setGravando(false);
        setSegundosGravacao(0);
        if (timerRef.current) {
          window.clearInterval(timerRef.current);
          timerRef.current = null;
        }
        mediaRecorderRef.current = null;
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setGravando(true);
      setSegundosGravacao(0);
      timerRef.current = window.setInterval(() => {
        setSegundosGravacao((s) => s + 1);
      }, 1000);
    } catch {
      setErroLocal("Não foi possível aceder ao microfone.");
    }
  }

  const podeEnviar = Boolean(value.trim() || anexos.length > 0) && !bloqueado && !gravando;

  async function enviar() {
    if (!podeEnviar) return;
    setErroLocal("");
    const texto = value.trim();
    const payloads: CopilotoAnexoPayload[] = [];
    try {
      for (const a of anexos) {
        payloads.push({
          nome: a.file.name,
          mime: a.file.type || "application/octet-stream",
          base64: await fileToBase64(a.file),
        });
      }
      await onSend({ texto, anexos: payloads });
      onChange("");
      limparPreviews(anexos);
      setAnexos([]);
    } catch {
      setErroLocal("Falha ao preparar anexos para envio.");
    }
  }

  return (
    <div>
      {erroLocal ? (
        <p style={{ color: "#f85149", fontSize: 11, margin: "0 0 8px" }}>{erroLocal}</p>
      ) : null}

      {anexos.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
          {anexos.map((a) => (
            <div
              key={a.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                borderRadius: 10,
                border: `1px solid ${RF_BORDER}`,
                background: "rgba(6, 13, 8, 0.9)",
              }}
            >
              {a.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={a.previewUrl}
                  alt=""
                  style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover" }}
                />
              ) : a.file.type.startsWith("audio/") ? (
                <Mic size={18} color={RF_TEXT_MUTED} />
              ) : (
                <Paperclip size={18} color={RF_TEXT_MUTED} />
              )}
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: RF_TEXT_PRIMARY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {a.file.name}
                </p>
                <p style={{ margin: "2px 0 0", fontSize: 10, color: RF_TEXT_MUTED }}>
                  {(a.file.size / 1024).toFixed(0)} KB
                </p>
              </div>
              <button
                type="button"
                onClick={() => removerAnexo(a.id)}
                disabled={bloqueado}
                aria-label="Remover anexo"
                style={{ border: "none", background: "transparent", color: RF_TEXT_MUTED, cursor: "pointer", padding: 4 }}
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {gravando ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 10,
            padding: "8px 12px",
            borderRadius: 10,
            background: "rgba(248, 81, 73, 0.12)",
            border: "1px solid rgba(248, 81, 73, 0.35)",
            color: "#f85149",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#f85149", animation: "pulse 1s infinite" }} />
          A gravar áudio… {formatRecordingTime(segundosGravacao)}
        </div>
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar,application/*"
        onChange={onFileChange}
      />
      <input
        ref={imageInputRef}
        type="file"
        className="hidden"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={onFileChange}
      />
      <input
        ref={audioInputRef}
        type="file"
        className="hidden"
        accept="audio/*,.ogg,.opus,.mp3,.m4a,.wav,.webm"
        onChange={onFileChange}
      />

      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 8,
          background: "#212121",
          border: `1px solid ${RF_BORDER_STRONG}`,
          borderRadius: 26,
          padding: "6px 8px 6px 6px",
          boxShadow: "0 0 0 1px rgba(0,0,0,0.25)",
        }}
      >
        {multimodalAtivo ? (
          <div ref={menuRef} style={{ position: "relative", flexShrink: 0 }}>
            <button
              type="button"
              disabled={bloqueado || gravando}
              onClick={() => setMenuAberto((v) => !v)}
              aria-label="Anexar ficheiro"
              title="Anexar"
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                border: "none",
                background: menuAberto ? "rgba(255,255,255,0.12)" : "transparent",
                color: "#e3e3e3",
                cursor: bloqueado ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: bloqueado ? 0.45 : 1,
              }}
            >
              <Plus size={20} strokeWidth={2} />
            </button>
            {menuAberto ? (
              <div
                style={{
                  position: "absolute",
                  bottom: "calc(100% + 8px)",
                  left: 0,
                  minWidth: 180,
                  background: "#2f2f2f",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 12,
                  padding: 6,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
                  zIndex: 20,
                }}
              >
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  style={menuItemStyle}
                >
                  <ImageIcon size={16} /> Imagem
                </button>
                <button
                  type="button"
                  onClick={() => audioInputRef.current?.click()}
                  style={menuItemStyle}
                >
                  <Mic size={16} /> Ficheiro de áudio
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={menuItemStyle}
                >
                  <FileText size={16} /> Documento
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={gravando ? "A gravar… clique no microfone para parar" : placeholder}
          rows={1}
          disabled={bloqueado || gravando}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void enviar();
            }
          }}
          style={{
            flex: 1,
            minHeight: 36,
            maxHeight: 140,
            resize: "none",
            border: "none",
            background: "transparent",
            color: "#ececec",
            fontSize: 14,
            lineHeight: 1.45,
            outline: "none",
            padding: "8px 4px",
            opacity: bloqueado ? 0.6 : 1,
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          {multimodalAtivo ? (
            <button
              type="button"
              disabled={bloqueado}
              onClick={() => void iniciarGravacao()}
              aria-label={gravando ? "Parar gravação" : "Gravar áudio"}
              title={gravando ? "Parar gravação" : "Gravar áudio"}
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                border: "none",
                background: gravando ? "rgba(248, 81, 73, 0.2)" : "transparent",
                color: gravando ? "#f85149" : "#e3e3e3",
                cursor: bloqueado ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: bloqueado && !gravando ? 0.45 : 1,
              }}
            >
              {gravando ? <Square size={16} fill="currentColor" /> : <Mic size={18} />}
            </button>
          ) : null}

          <button
            type="button"
            disabled={!podeEnviar}
            onClick={() => void enviar()}
            aria-label="Enviar"
            title="Enviar"
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              border: "none",
              background: podeEnviar ? "#ffffff" : "rgba(255,255,255,0.15)",
              color: podeEnviar ? "#0d0d0d" : "#888",
              cursor: !podeEnviar ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ArrowUp size={18} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {multimodalAtivo && mostrarDicas ? (
        <p style={{ fontSize: 10, color: "#6e7681", margin: "8px 0 0", textAlign: "center" }}>
          + anexos · microfone grava ou envia áudio · OCR/transcrição via Mistral · até{" "}
          {Math.round(MAX_BRIEFING_ANEXO_BYTES / (1024 * 1024))} MB
        </p>
      ) : null}
    </div>
  );
}

const menuItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  width: "100%",
  padding: "10px 12px",
  border: "none",
  borderRadius: 8,
  background: "transparent",
  color: "#ececec",
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
  textAlign: "left",
};
