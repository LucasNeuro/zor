"use client";

import {
  RF_ACCENT,
  RF_BORDER_STRONG,
  RF_TEXT_MUTED,
} from "@/lib/crm/crm-retrofit-dark-theme";

export type CadastroClienteTabId = "timeline" | "compras" | "atendimentos" | "dados";

const TABS: { id: CadastroClienteTabId; label: string }[] = [
  { id: "timeline", label: "Timeline" },
  { id: "compras", label: "Compras" },
  { id: "atendimentos", label: "Atendimentos" },
  { id: "dados", label: "Dados" },
];

type Props = {
  tab: CadastroClienteTabId;
  onTabChange: (tab: CadastroClienteTabId) => void;
  comprasCount?: number;
  atendimentosCount?: number;
};

export function CadastroClienteSideoverTabs({
  tab,
  onTabChange,
  comprasCount,
  atendimentosCount,
}: Props) {
  return (
    <div
      style={{
        display: "flex",
        borderBottom: `1px solid ${RF_BORDER_STRONG}`,
        marginBottom: 16,
        overflowX: "auto",
      }}
    >
      {TABS.map((t) => {
        let label = t.label;
        if (t.id === "compras" && comprasCount != null && comprasCount > 0) {
          label = `${t.label} (${comprasCount})`;
        }
        if (t.id === "atendimentos" && atendimentosCount != null && atendimentosCount > 0) {
          label = `${t.label} (${atendimentosCount})`;
        }

        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onTabChange(t.id)}
            style={{
              flex: "1 0 auto",
              minWidth: 0,
              padding: "10px 8px",
              fontSize: 11,
              fontWeight: 700,
              border: "none",
              background: "transparent",
              color: tab === t.id ? RF_ACCENT : RF_TEXT_MUTED,
              borderBottom: tab === t.id ? `2px solid ${RF_ACCENT}` : "2px solid transparent",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
