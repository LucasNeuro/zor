"use client";

import { useState, type MouseEvent } from "react";
import { ChevronDown, StickyNote } from "lucide-react";
import { CRM_KANBAN } from "@/lib/crm/crm-kanban-card-styles";

export type NotaPreview = {
  id: string;
  conteudo: string;
  criado_por?: string;
  criado_em?: string;
};

type Props = {
  notas: NotaPreview[];
  /** @deprecated Mantido por compatibilidade; expandido mostra todas as notas. */
  maxPreview?: number;
  onClickContainer?: (e: MouseEvent) => void;
};

function tempo(iso?: string) {
  if (!iso) return "";
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}min`;
  if (m < 1440) return `${Math.floor(m / 60)}h`;
  return `${Math.floor(m / 1440)}d`;
}

/** Secção colapsável de anotações — só cabeçalho fechado (como card de automações). */
export function CrmKanbanNotesSection({ notas, onClickContainer }: Props) {
  const [aberto, setAberto] = useState(false);

  if (!notas.length) return null;

  function stop(e: MouseEvent) {
    e.stopPropagation();
    onClickContainer?.(e);
  }

  return (
    <div
      onClick={stop}
      onKeyDown={(e) => e.stopPropagation()}
      style={{
        borderRadius: 10,
        border: "1px solid rgba(18, 56, 43, 0.1)",
        overflow: "hidden",
        background: "rgba(18, 56, 43, 0.03)",
      }}
    >
      <button
        type="button"
        onClick={(e) => {
          stop(e);
          setAberto((v) => !v);
        }}
        aria-expanded={aberto}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: "8px 10px",
          border: "none",
          background: aberto ? "rgba(146, 255, 0, 0.06)" : "transparent",
          cursor: "pointer",
          color: CRM_KANBAN.title,
          fontSize: 10,
          fontWeight: 700,
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <StickyNote size={12} strokeWidth={2.2} color="#5d7a67" aria-hidden />
          Anotações ({notas.length})
        </span>
        <ChevronDown
          size={14}
          strokeWidth={2.25}
          color="#5d7a67"
          aria-hidden
          style={{
            transform: aberto ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
          }}
        />
      </button>

      {aberto ? (
        <div
          style={{
            padding: "0 10px 10px",
            display: "flex",
            flexDirection: "column",
            gap: 6,
            borderTop: "1px solid rgba(18, 56, 43, 0.08)",
          }}
        >
          {notas.map((n) => (
            <div
              key={n.id}
              style={{
                background: "#fff",
                borderRadius: 8,
                padding: "8px 10px",
                border: "1px solid rgba(18, 56, 43, 0.08)",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: 11,
                  lineHeight: 1.5,
                  color: CRM_KANBAN.body,
                  whiteSpace: "pre-wrap",
                }}
              >
                {n.conteudo}
              </p>
              {n.criado_por || n.criado_em ? (
                <p
                  style={{
                    margin: "6px 0 0",
                    fontSize: 10,
                    color: CRM_KANBAN.muted,
                    fontWeight: 600,
                  }}
                >
                  {[n.criado_por, n.criado_em ? `${tempo(n.criado_em)} atrás` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
