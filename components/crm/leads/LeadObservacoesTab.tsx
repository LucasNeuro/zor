"use client";

import {
  RF_ACCENT,
  RF_BORDER_STRONG,
  RF_INPUT_STYLE,
  RF_TEXT_MUTED,
  RF_TEXT_PRIMARY,
} from "@/lib/crm/crm-retrofit-dark-theme";

export type CrmNota = {
  id: string;
  conteudo: string;
  criado_por: string;
  criado_em: string;
};

type Props = {
  notas: CrmNota[];
  novaNota: string;
  onNovaNotaChange: (value: string) => void;
  onAdicionar: () => void | Promise<void>;
  adicionando?: boolean;
  /** sideover = painel escuro retrofit; waje = cartão claro em fichas CRM */
  variant?: "sideover" | "waje";
};

function tempo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}min`;
  if (m < 1440) return `${Math.floor(m / 60)}h`;
  return `${Math.floor(m / 1440)}d`;
}

/** Aba de observações reutilizável (leads e negócios). */
export function LeadObservacoesTab({
  notas,
  novaNota,
  onNovaNotaChange,
  onAdicionar,
  adicionando,
  variant = "sideover",
}: Props) {
  if (variant === "waje") {
    return (
      <div className="rounded-2xl border border-[#dcebd8] bg-white p-4">
        <textarea
          value={novaNota}
          onChange={(e) => onNovaNotaChange(e.target.value)}
          placeholder="Escreva uma observação…"
          rows={3}
          className="mb-2 w-full resize-y rounded-xl border border-[#dcebd8] bg-[#f8fcf6] p-3 text-sm text-[#0b2210] outline-none placeholder:text-[#90a89b] focus:border-[#92ff00]"
        />
        <button
          type="button"
          onClick={() => void onAdicionar()}
          disabled={!novaNota.trim() || adicionando}
          className="mb-4 w-full rounded-xl border-0 bg-[#92ff00] py-2.5 text-sm font-extrabold text-[#0b1f10] disabled:cursor-not-allowed disabled:opacity-50"
        >
          + Adicionar observação
        </button>
        {notas.length === 0 ? (
          <p className="py-4 text-center text-sm text-[#6b8a76]">Nenhuma observação ainda</p>
        ) : (
          notas.map((n) => (
            <div
              key={n.id}
              className="mb-2 rounded-xl border border-[#eef5ec] bg-[#f8fcf6] p-3 last:mb-0"
            >
              <p className="m-0 text-sm leading-relaxed text-[#0b2210]">{n.conteudo}</p>
              <div className="mt-2 text-xs text-[#6b8a76]">
                {n.criado_por} · {tempo(n.criado_em)} atrás
              </div>
            </div>
          ))
        )}
      </div>
    );
  }

  const INPUT: React.CSSProperties = {
    ...RF_INPUT_STYLE,
    padding: "10px 12px",
    borderRadius: 10,
    fontSize: 13,
  };

  return (
    <div>
      <textarea
        value={novaNota}
        onChange={(e) => onNovaNotaChange(e.target.value)}
        placeholder="Escreva uma observação…"
        rows={3}
        style={{ ...INPUT, width: "100%", resize: "vertical", marginBottom: 8 }}
      />
      <button
        type="button"
        onClick={() => void onAdicionar()}
        disabled={!novaNota.trim() || adicionando}
        style={{
          width: "100%",
          padding: "10px",
          borderRadius: 10,
          border: "none",
          background: RF_ACCENT,
          color: "#0b1f10",
          fontWeight: 800,
          fontSize: 13,
          cursor: novaNota.trim() && !adicionando ? "pointer" : "not-allowed",
          opacity: novaNota.trim() && !adicionando ? 1 : 0.5,
          marginBottom: 16,
        }}
      >
        + Adicionar observação
      </button>
      {notas.length === 0 ? (
        <p style={{ color: RF_TEXT_MUTED, fontSize: 13, textAlign: "center" }}>
          Nenhuma observação ainda
        </p>
      ) : (
        notas.map((n) => (
          <div
            key={n.id}
            style={{
              background: "rgba(18,56,43,0.15)",
              borderRadius: 10,
              padding: 12,
              marginBottom: 8,
              border: `1px solid ${RF_BORDER_STRONG}`,
            }}
          >
            <p style={{ margin: 0, fontSize: 13, color: RF_TEXT_PRIMARY, lineHeight: 1.5 }}>
              {n.conteudo}
            </p>
            <div style={{ marginTop: 8, fontSize: 11, color: RF_TEXT_MUTED }}>
              {n.criado_por} · {tempo(n.criado_em)} atrás
            </div>
          </div>
        ))
      )}
    </div>
  );
}
