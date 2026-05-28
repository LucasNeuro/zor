"use client";

import type { ReactNode } from "react";

export type CadastroFichaTabId = "resumo" | "dados" | "vinculos" | "relacionados";

const TAB_LABELS: Record<CadastroFichaTabId, string> = {
  resumo: "Resumo",
  dados: "Dados",
  vinculos: "Vínculos",
  relacionados: "Leads e negócios",
};

type Props = {
  active: CadastroFichaTabId;
  onChange: (tab: CadastroFichaTabId) => void;
  children: ReactNode;
};

export function CadastroFichaTabs({ active, onChange, children }: Props) {
  const tabs: CadastroFichaTabId[] = ["resumo", "dados", "vinculos", "relacionados"];

  return (
    <div>
      <div
        role="tablist"
        style={{
          display: "flex",
          gap: 4,
          flexWrap: "wrap",
          marginBottom: 20,
          borderBottom: "1px solid #30363d",
          paddingBottom: 0,
        }}
      >
        {tabs.map((id) => {
          const selected = active === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onChange(id)}
              style={{
                padding: "10px 14px",
                fontSize: 13,
                fontWeight: selected ? 700 : 500,
                color: selected ? "#e6edf3" : "#8b949e",
                background: "transparent",
                border: "none",
                borderBottom: selected ? "2px solid #c9a24a" : "2px solid transparent",
                cursor: "pointer",
                marginBottom: -1,
              }}
            >
              {TAB_LABELS[id]}
            </button>
          );
        })}
      </div>
      <div role="tabpanel">{children}</div>
    </div>
  );
}
