"use client";

import Link from "next/link";
import { Briefcase, ExternalLink } from "lucide-react";
import type { CrmResumoNegocio } from "@/lib/crm/cliente-crm-resumo-types";
import {
  RF_ACCENT,
  RF_BORDER,
  RF_BORDER_STRONG,
  RF_TEXT_MUTED,
  RF_TEXT_PRIMARY,
  RF_TEXT_SECONDARY,
} from "@/lib/crm/crm-retrofit-dark-theme";

type Props = {
  negocios: CrmResumoNegocio[];
  loading?: boolean;
};

function formatarMoeda(v?: number | null) {
  if (v == null || Number.isNaN(v)) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString("pt-BR");
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    aberto: "Aberto",
    em_negociacao: "Em negociação",
    fechado_ganho: "Ganho",
    fechado_perdido: "Perdido",
    cancelado: "Cancelado",
  };
  return map[status] || status.replace(/_/g, " ");
}

export function CadastroClienteComprasTab({ negocios, loading }: Props) {
  if (loading) {
    return (
      <p style={{ color: RF_TEXT_MUTED, fontSize: 12, textAlign: "center", padding: "24px 0" }}>
        A carregar negócios…
      </p>
    );
  }

  if (negocios.length === 0) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "28px 12px",
          borderRadius: 12,
          border: `1px dashed ${RF_BORDER}`,
          color: RF_TEXT_MUTED,
          fontSize: 12,
        }}
      >
        Nenhum negócio ou compra registada para este cadastro.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {negocios.map((n) => (
        <div
          key={n.id}
          style={{
            padding: "12px 14px",
            borderRadius: 12,
            border: `1px solid ${RF_BORDER_STRONG}`,
            background: "rgba(6, 13, 8, 0.55)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start", minWidth: 0 }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  border: `1px solid ${RF_BORDER}`,
                  color: RF_ACCENT,
                  flexShrink: 0,
                }}
              >
                <Briefcase size={15} />
              </span>
              <div style={{ minWidth: 0 }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    fontWeight: 700,
                    color: RF_TEXT_PRIMARY,
                    lineHeight: 1.35,
                    wordBreak: "break-word",
                  }}
                >
                  {n.titulo}
                </p>
                <p style={{ margin: "4px 0 0", fontSize: 11, color: RF_TEXT_MUTED }}>
                  {[n.codigo, formatarData(n.criado_em)].filter(Boolean).join(" · ")}
                </p>
              </div>
            </div>
            <Link
              href={`/crm/negocios/${encodeURIComponent(n.id)}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 10,
                fontWeight: 700,
                color: RF_ACCENT,
                textDecoration: "none",
                flexShrink: 0,
              }}
            >
              Abrir
              <ExternalLink size={11} />
            </Link>
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              marginTop: 10,
              fontSize: 10,
              fontWeight: 700,
              color: RF_TEXT_SECONDARY,
            }}
          >
            <span style={{ color: RF_ACCENT }}>{n.etapa.replace(/_/g, " ")}</span>
            <span>{statusLabel(n.status)}</span>
            <span>{formatarMoeda(n.valor_estimado)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
