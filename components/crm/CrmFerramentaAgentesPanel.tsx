"use client";

import type { CSSProperties } from "react";
import {
  RF_ACCENT,
  RF_BORDER,
  RF_BORDER_STRONG,
  RF_TEXT_MUTED,
  RF_TEXT_PRIMARY,
  RF_TEXT_SECONDARY,
} from "@/lib/crm/crm-retrofit-dark-theme";
import { mergeUsoFerramentasComPadraoPreservandoCustom } from "@/lib/hub/agente-ferramentas-registry";
import type { AgenteFerramentaSyncRow } from "@/lib/hub/sync-ferramenta-agentes";

type Props = {
  ferramentaKey: string | null;
  agentes: AgenteFerramentaSyncRow[];
  nomes?: Record<string, string>;
  seleccionados: Set<string>;
  onToggle: (agenteSlug: string, ativo: boolean) => void;
  disabled?: boolean;
  theme?: "dark" | "light";
};

function ToggleMini({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        width: 40,
        height: 22,
        borderRadius: 11,
        border: "none",
        padding: 2,
        cursor: disabled ? "not-allowed" : "pointer",
        background: checked ? "#3fb950" : "rgba(45,74,56,0.9)",
        opacity: disabled ? 0.5 : 1,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          display: "block",
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "#fff",
          transform: checked ? "translateX(18px)" : "translateX(0)",
          transition: "transform 0.15s ease",
        }}
      />
    </button>
  );
}

export function agentesComFerramentaKey(
  agentes: AgenteFerramentaSyncRow[],
  key: string
): Set<string> {
  const out = new Set<string>();
  for (const a of agentes) {
    if (a.motor_ferramentas_habilitado !== true) continue;
    const uso = mergeUsoFerramentasComPadraoPreservandoCustom(a.uso_ferramentas_ia);
    if (uso[key] === true) out.add(a.agente_slug);
  }
  return out;
}

export function CrmFerramentaAgentesPanel({
  ferramentaKey,
  agentes,
  nomes = {},
  seleccionados,
  onToggle,
  disabled,
  theme = "dark",
}: Props) {
  const dark = theme === "dark";
  const panel: CSSProperties = dark
    ? {
        borderRadius: 12,
        border: `1px solid ${RF_BORDER_STRONG}`,
        background: "rgba(6, 13, 8, 0.72)",
        padding: 14,
      }
    : {
        borderRadius: 12,
        border: "1px solid #dcebd8",
        background: "#f8fcf6",
        padding: 14,
      };

  const tituloCor = dark ? RF_TEXT_PRIMARY : "#0b2210";
  const muted = dark ? RF_TEXT_MUTED : "#5d7a67";
  const nomeCor = dark ? RF_TEXT_SECONDARY : "#1e4a24";

  if (!ferramentaKey && agentes.length > 0) {
    return (
      <div style={panel}>
        <p style={{ margin: 0, fontSize: 12, color: muted }}>
          Guarde a ferramenta primeiro para atribuir aos agentes.
        </p>
      </div>
    );
  }

  const lista = agentes.filter((a) => a.agente_slug?.trim());

  return (
    <div style={panel}>
      <p
        style={{
          margin: "0 0 4px",
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 0.6,
          textTransform: "uppercase",
          color: RF_ACCENT,
        }}
      >
        Agentes com esta ferramenta
      </p>
      <p style={{ margin: "0 0 12px", fontSize: 11, color: muted, lineHeight: 1.45 }}>
        Active nos modelos que devem invocar <code style={{ fontSize: 10 }}>{ferramentaKey}</code>. O motor IA
        liga-se automaticamente ao activar.
      </p>

      {lista.length === 0 ? (
        <p style={{ margin: 0, fontSize: 12, color: muted }}>Nenhum agente activo no tenant.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {lista.map((a) => {
            const slug = a.agente_slug;
            const ligado = seleccionados.has(slug);
            const label = nomes[slug]?.trim() || slug;
            return (
              <div
                key={slug}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: `1px solid ${ligado ? "rgba(63,185,80,0.35)" : RF_BORDER}`,
                  background: ligado ? "rgba(146,255,0,0.06)" : "rgba(6,13,8,0.45)",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: tituloCor }}>{label}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 10, color: nomeCor }}>{slug}</p>
                </div>
                <ToggleMini
                  checked={ligado}
                  onChange={(v) => onToggle(slug, v)}
                  disabled={disabled || !ferramentaKey}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
