"use client";

import type { CSSProperties } from "react";
import { useCallback, useState } from "react";
import { Loader2, Sparkles, Wand2 } from "lucide-react";
import type { TextoSugestaoContexto } from "@/lib/hub/sugerir-texto-fluxo-ia";
import { hubApiHeaders } from "@/lib/internal-api-headers-client";

export type TextoSugestaoIaParams = {
  agenteSlug: string;
  contexto: TextoSugestaoContexto;
  meta?: Record<string, unknown>;
};

export function useTextoSugestaoIa({ agenteSlug, contexto, meta }: TextoSugestaoIaParams) {
  const [loading, setLoading] = useState<null | "sugerir" | "melhorar">(null);
  const [erro, setErro] = useState("");

  const chamarIa = useCallback(
    async (acao: "sugerir" | "melhorar", texto_atual: string): Promise<string | null> => {
      if (!agenteSlug.trim()) {
        setErro("Agente inválido.");
        return null;
      }
      if (acao === "melhorar" && !texto_atual.trim()) {
        setErro("Escreva um rascunho antes de melhorar.");
        return null;
      }
      setLoading(acao);
      setErro("");
      try {
        const res = await fetch(
          `/api/hub/agentes/${encodeURIComponent(agenteSlug)}/texto-sugerir-ia`,
          {
            method: "POST",
            headers: { ...(await hubApiHeaders()), "Content-Type": "application/json" },
            body: JSON.stringify({
              acao,
              contexto,
              texto_atual,
              meta: meta ?? {},
            }),
          }
        );
        const data = (await res.json().catch(() => ({}))) as { texto?: string; error?: string };
        if (!res.ok) {
          setErro(typeof data.error === "string" ? data.error : `Erro ${res.status}`);
          return null;
        }
        if (typeof data.texto === "string" && data.texto.trim()) {
          return data.texto.trim();
        }
        setErro("Resposta vazia da IA.");
        return null;
      } catch {
        setErro("Falha de rede ao pedir sugestão.");
        return null;
      } finally {
        setLoading(null);
      }
    },
    [agenteSlug, contexto, meta]
  );

  return { loading, erro, setErro, chamarIa };
}

export type TextareaComSugestaoIaProps = {
  agenteSlug: string;
  contexto: TextoSugestaoContexto;
  value: string;
  onChange: (value: string) => void;
  label: string;
  rows?: number;
  placeholder?: string;
  disabled?: boolean;
  meta?: Record<string, unknown>;
  theme?: "light" | "dark";
  inputStyle?: CSSProperties;
  labelStyle?: CSSProperties;
};

export function TextareaComSugestaoIa({
  agenteSlug,
  contexto,
  value,
  onChange,
  label,
  rows = 3,
  placeholder,
  disabled,
  meta,
  theme = "dark",
  inputStyle,
  labelStyle,
}: TextareaComSugestaoIaProps) {
  const { loading, erro, setErro, chamarIa } = useTextoSugestaoIa({ agenteSlug, contexto, meta });

  const isLight = theme === "light";
  const accent = isLight ? "#2e7d32" : "#92ff00";

  async function onSugerir() {
    if (disabled || loading) return;
    const t = await chamarIa("sugerir", value);
    if (t) onChange(t);
  }

  async function onMelhorar() {
    if (disabled || loading) return;
    const t = await chamarIa("melhorar", value);
    if (t) onChange(t);
  }

  const btnBase: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    padding: "5px 9px",
    borderRadius: 7,
    fontSize: 10,
    fontWeight: 700,
    cursor: disabled || loading ? "not-allowed" : "pointer",
    opacity: disabled || loading ? 0.55 : 1,
    border: `1px solid ${isLight ? "#dcebd8" : "rgba(63, 152, 72, 0.35)"}`,
    background: isLight ? "#ffffff" : "rgba(6, 13, 8, 0.55)",
    color: isLight ? "#2e7d32" : accent,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={labelStyle}>{label}</span>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <button
            type="button"
            disabled={disabled || loading !== null}
            onClick={() => void onSugerir()}
            style={btnBase}
            title="Gerar sugestão com IA"
          >
            {loading === "sugerir" ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Sparkles size={12} />
            )}
            Sugerir
          </button>
          <button
            type="button"
            disabled={disabled || loading !== null || !value.trim()}
            onClick={() => void onMelhorar()}
            style={btnBase}
            title="Melhorar o rascunho actual"
          >
            {loading === "melhorar" ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Wand2 size={12} />
            )}
            Melhorar
          </button>
        </div>
      </div>
      <textarea
        rows={rows}
        value={value}
        disabled={disabled || loading !== null}
        onChange={(e) => {
          setErro("");
          onChange(e.target.value);
        }}
        placeholder={placeholder}
        style={{ ...inputStyle, resize: "vertical" }}
      />
      {erro ? (
        <p style={{ margin: 0, fontSize: 10, color: "#f85149", lineHeight: 1.35 }}>{erro}</p>
      ) : (
        <p style={{ margin: 0, fontSize: 9, color: isLight ? "#5d7a67" : "#6e7681", lineHeight: 1.35 }}>
          Use {"{nome}"} para personalizar. A IA segue o tom do agente.
        </p>
      )}
    </div>
  );
}
