"use client";

import type { MouseEvent } from "react";
import { Power, Trash2 } from "lucide-react";
import { cargaOperacionalVisual } from "@/lib/crm/agente-avatar-gen";
import { CrmIconButtonGroup } from "@/components/crm/CrmIconButtonGroup";
import { BRAND_GREEN_BRIGHT, BRAND_TEXT_DARK } from "@/lib/brand";
import { AgenteAvatar, agenteIdLabel, type AgenteAvatarStatus } from "@/components/crm/AgenteAvatar";

export type AgenteGridCardAgente = {
  agente_slug: string;
  nome: string;
  cargo?: string;
  segmento?: string;
  area?: string;
  nivel?: string;
  ativo?: boolean;
  arquivado_em?: string | null;
  avatar_url?: string | null;
};

export type AgenteGridCardProps = {
  agente: AgenteGridCardAgente;
  bio: string;
  selecionado: boolean;
  segCor: string;
  nivelCor: string;
  alternandoAtivo: boolean;
  excluindo: boolean;
  onSelect: () => void;
  onToggleAtivo: (e: MouseEvent) => void;
  onDelete: (e: MouseEvent) => void;
};

function statusAgente(agente: AgenteGridCardAgente): { label: string; tone: AgenteAvatarStatus } {
  if (agente.arquivado_em) return { label: "ARQUIVADO", tone: "arquivado" };
  if (agente.ativo === false) return { label: "INATIVO", tone: "inativo" };
  return { label: "ATIVO", tone: "ativo" };
}

export function AgenteGridCard({
  agente,
  bio,
  selecionado,
  segCor,
  nivelCor,
  alternandoAtivo,
  excluindo,
  onSelect,
  onToggleAtivo,
  onDelete,
}: AgenteGridCardProps) {
  const ativo = agente.ativo !== false && !agente.arquivado_em;
  const { label: statusLabel, tone: statusTone } = statusAgente(agente);
  const carga = cargaOperacionalVisual(agente.agente_slug, ativo);
  const cargaPct = Math.round(carga * 100);
  const segmento = agente.segmento || agente.area || "Geral";
  const nivel = agente.nivel ? String(agente.nivel) : "—";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      style={{
        background: selecionado
          ? "linear-gradient(165deg, #ffffff 0%, #f4fbf1 100%)"
          : "linear-gradient(165deg, #ffffff 0%, #fafdfa 100%)",
        borderRadius: 18,
        border: selecionado ? "1.5px solid rgba(146, 255, 0, 0.55)" : "1px solid rgba(18, 56, 43, 0.14)",
        boxShadow: selecionado
          ? "0 0 0 1px rgba(146, 255, 0, 0.12), 0 16px 40px rgba(15, 56, 39, 0.12)"
          : "0 8px 24px rgba(15, 56, 39, 0.07)",
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        cursor: "pointer",
        transition: "border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease",
        minWidth: 0,
        opacity: ativo ? 1 : 0.9,
      }}
      onMouseEnter={(e) => {
        if (!selecionado) e.currentTarget.style.boxShadow = "0 12px 32px rgba(15, 56, 39, 0.11)";
      }}
      onMouseLeave={(e) => {
        if (!selecionado) e.currentTarget.style.boxShadow = "0 8px 24px rgba(15, 56, 39, 0.07)";
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <AgenteAvatar
          seed={agente.agente_slug}
          nome={agente.nome}
          imageUrl={agente.avatar_url}
          size={52}
          shape="circle"
          status={statusTone}
          dim={!ativo}
          alt={agente.nome}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
            <p
              style={{
                margin: 0,
                color: BRAND_TEXT_DARK,
                fontWeight: 800,
                fontSize: 15,
                lineHeight: 1.25,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {agente.nome}
            </p>
            <span
              style={{
                flexShrink: 0,
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: 0.6,
                color: statusTone === "ativo" ? BRAND_TEXT_DARK : "#6b8a76",
                background: statusTone === "ativo" ? "rgba(146, 255, 0, 0.18)" : "rgba(18, 56, 43, 0.06)",
                border: `1px solid ${statusTone === "ativo" ? "rgba(146, 255, 0, 0.45)" : "rgba(18, 56, 43, 0.12)"}`,
                borderRadius: 999,
                padding: "4px 8px",
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: statusTone === "ativo" ? BRAND_GREEN_BRIGHT : "#94a3b8",
                  boxShadow: statusTone === "ativo" ? `0 0 6px ${BRAND_GREEN_BRIGHT}` : undefined,
                }}
              />
              {statusLabel}
            </span>
          </div>
          <p
            style={{
              margin: "5px 0 0",
              color: "#6b8a76",
              fontSize: 10,
              fontWeight: 600,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              letterSpacing: 0.3,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {agenteIdLabel(agente.agente_slug)}
          </p>
        </div>
      </div>

      {/* Bio */}
      <p
        style={{
          fontSize: 12,
          color: "#5d7a67",
          margin: 0,
          lineHeight: 1.55,
          minHeight: 38,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {bio}
      </p>

      {/* Métricas */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {[
          { label: "SEGMENTO", value: segmento, color: segCor },
          { label: "NÍVEL", value: nivel, color: nivelCor },
        ].map((tile) => (
          <div
            key={tile.label}
            style={{
              background: "rgba(18, 56, 43, 0.04)",
              border: "1px solid rgba(18, 56, 43, 0.1)",
              borderRadius: 12,
              padding: "10px 12px",
            }}
          >
            <p style={{ margin: 0, fontSize: 9, fontWeight: 800, letterSpacing: 0.7, color: "#6b8a76" }}>
              {tile.label}
            </p>
            <p
              style={{
                margin: "4px 0 0",
                fontSize: 14,
                fontWeight: 800,
                color: tile.color,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {tile.value}
            </p>
          </div>
        ))}
      </div>

      {/* Carga operacional */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: BRAND_TEXT_DARK }}>Carga operacional</span>
          <span style={{ fontSize: 11, fontWeight: 800, color: BRAND_GREEN_BRIGHT, filter: ativo ? undefined : "grayscale(1)" }}>
            {cargaPct}%
          </span>
        </div>
        <div
          style={{
            height: 6,
            borderRadius: 999,
            background: "rgba(18, 56, 43, 0.08)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${cargaPct}%`,
              height: "100%",
              borderRadius: 999,
              background: ativo
                ? `linear-gradient(90deg, #3f9848 0%, ${BRAND_GREEN_BRIGHT} 100%)`
                : "#94a3b8",
              transition: "width 400ms ease",
            }}
          />
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          marginTop: "auto",
          paddingTop: 10,
          borderTop: "1px solid rgba(18, 56, 43, 0.1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 11,
            color: "#6b8a76",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
            minWidth: 0,
          }}
        >
          {agente.cargo}
        </p>
        <div style={{ flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
          <CrmIconButtonGroup
            aria-label="Ações do agente"
            items={[
              {
                key: "toggle",
                variant: "primary",
                icon: <Power size={14} strokeWidth={2.25} aria-hidden />,
                onClick: onToggleAtivo,
                disabled: !!agente.arquivado_em || alternandoAtivo || excluindo,
                loading: alternandoAtivo,
                title: agente.arquivado_em
                  ? "Arquivado — não pode alterar estado"
                  : ativo
                    ? "Desativar agente"
                    : "Ativar agente",
                "aria-label": ativo ? "Desativar agente" : "Ativar agente",
              },
              {
                key: "excluir",
                variant: "danger",
                icon: <Trash2 size={14} strokeWidth={2.25} aria-hidden />,
                onClick: onDelete,
                disabled: excluindo || alternandoAtivo,
                loading: excluindo,
                title: "Excluir agente e dados associados",
                "aria-label": "Excluir agente",
              },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
