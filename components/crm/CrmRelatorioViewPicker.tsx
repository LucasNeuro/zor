"use client";

import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import {
  RELATORIO_VIEW_ICONE,
  relatorioViewsPorCategoria,
  type RelatorioViewId,
} from "@/lib/crm/relatorio-views-catalog";
import {
  RF_BORDER,
  RF_BORDER_STRONG,
  RF_TEXT_MUTED,
  RF_TEXT_PRIMARY,
  RF_TEXT_SECONDARY,
} from "@/lib/crm/crm-retrofit-dark-theme";

type Props = {
  value: RelatorioViewId;
  onChange: (id: RelatorioViewId) => void;
};

const ROW_BASE: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "12px 14px",
  borderRadius: 12,
  cursor: "pointer",
  textAlign: "left",
  width: "100%",
};

export function CrmRelatorioViewPicker({ value, onChange }: Props) {
  const grupos = relatorioViewsPorCategoria();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        maxHeight: 280,
        overflowY: "auto",
        paddingRight: 4,
      }}
    >
      <p style={{ color: RF_TEXT_MUTED, fontSize: 11, margin: 0, lineHeight: 1.5 }}>
        Escolha uma <strong style={{ color: RF_TEXT_SECONDARY }}>fonte de dados</strong>. Cada opção
        agrega joins do banco (lead + pessoa, negócio + empresa, etc.).
      </p>

      {grupos.map((grupo) => (
        <div key={grupo.categoria}>
          <p
            style={{
              color: RF_TEXT_MUTED,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 0.06,
              margin: "0 0 8px",
            }}
          >
            {grupo.label}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {grupo.views.map((view) => {
              const active = value === view.id;
              const Icon: LucideIcon = RELATORIO_VIEW_ICONE[view.id];
              return (
                <button
                  key={view.id}
                  type="button"
                  onClick={() => onChange(view.id)}
                  style={{
                    ...ROW_BASE,
                    border: `1px solid ${active ? "rgba(63, 152, 72, 0.55)" : RF_BORDER}`,
                    background: active ? "rgba(146, 255, 0, 0.08)" : "rgba(6, 13, 8, 0.85)",
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      background: active ? "rgba(146, 255, 0, 0.14)" : "rgba(11, 31, 16, 0.9)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      color: active ? "#92ff00" : RF_TEXT_SECONDARY,
                      border: `1px solid ${active ? RF_BORDER_STRONG : RF_BORDER}`,
                    }}
                  >
                    <Icon size={20} strokeWidth={2} aria-hidden />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        color: active ? RF_TEXT_PRIMARY : "#c8e6c9",
                        fontSize: 13,
                        fontWeight: 700,
                        display: "block",
                      }}
                    >
                      {view.label}
                    </span>
                    <span
                      style={{
                        display: "block",
                        color: RF_TEXT_SECONDARY,
                        fontSize: 11,
                        marginTop: 2,
                        lineHeight: 1.4,
                      }}
                    >
                      {view.descricao}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: active ? "#92ff00" : RF_TEXT_MUTED,
                      flexShrink: 0,
                    }}
                  >
                    {active ? "SELECIONADO" : "ESCOLHER"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
