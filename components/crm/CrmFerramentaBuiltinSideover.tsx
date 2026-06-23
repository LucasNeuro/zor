"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { FileJson, Wrench, X } from "lucide-react";
import {
  RF_ACCENT,
  RF_BORDER,
  RF_BORDER_STRONG,
  RF_TEXT_MUTED,
  RF_TEXT_PRIMARY,
  RF_TEXT_SECONDARY,
  rfAsideBodyStyle,
  rfAsideHeaderStyle,
  rfAsideStyle,
  rfCloseButtonStyle,
  rfInnerPanelStyle,
  rfOverlayStyle,
} from "@/lib/crm/crm-retrofit-dark-theme";
import {
  catalogoBuiltinPorId,
  HUB_FERRAMENTA_ACESSO,
  HUB_FERRAMENTA_SECAO_LABEL,
  type HubAgenteFerramentaId,
} from "@/lib/hub/agente-ferramentas-registry";
import type { FerramentaAgenteUso } from "@/lib/hub/ferramentas-ia-ui";

type Props = {
  open: boolean;
  onClose: () => void;
  ferramentaId: HubAgenteFerramentaId | null;
  agentes: FerramentaAgenteUso[];
};

function MetaChip({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div
      style={{
        padding: "8px 10px",
        borderRadius: 8,
        border: `1px solid ${RF_BORDER}`,
        background: "rgba(6,13,8,0.45)",
        minWidth: 0,
      }}
    >
      <p style={{ margin: 0, fontSize: 9, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: RF_TEXT_MUTED }}>
        {label}
      </p>
      <p style={{ margin: "4px 0 0", fontSize: 12, fontWeight: 700, color: RF_TEXT_PRIMARY }}>{value}</p>
    </div>
  );
}

function ReadOnlyField({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: RF_ACCENT }}>{label}</p>
      <p
        style={{
          margin: 0,
          fontSize: 13,
          color: RF_TEXT_SECONDARY,
          lineHeight: 1.5,
          wordBreak: "break-word",
          fontFamily: mono ? "ui-monospace, monospace" : undefined,
        }}
      >
        {value}
      </p>
    </div>
  );
}

export function CrmFerramentaBuiltinSideover({ open, onClose, ferramentaId, agentes }: Props) {
  if (!open || !ferramentaId) return null;

  const cat = catalogoBuiltinPorId(ferramentaId);
  if (!cat) return null;

  const nivel = HUB_FERRAMENTA_ACESSO[ferramentaId];
  const schemaJson = cat.mistralFunction
    ? JSON.stringify(cat.mistralFunction.parameters, null, 2)
    : "{}";

  return (
    <>
      <button type="button" aria-label="Fechar painel" onClick={onClose} style={rfOverlayStyle(212)} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Ferramenta ${cat.titulo}`}
        style={rfAsideStyle("min(560px, 100vw)", 213)}
      >
        <header style={rfAsideHeaderStyle()}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flex: 1, minWidth: 0 }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(146,255,0,0.12)",
                  border: `1px solid ${RF_BORDER_STRONG}`,
                  flexShrink: 0,
                }}
              >
                <Wrench size={24} color={RF_ACCENT} strokeWidth={2} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ margin: 0, color: RF_ACCENT, fontSize: 11, letterSpacing: 0.8, fontWeight: 700 }}>
                  FERRAMENTA BUILT-IN · {HUB_FERRAMENTA_SECAO_LABEL[cat.categoria]}
                </p>
                <h2
                  style={{
                    margin: "4px 0 0",
                    fontSize: 17,
                    fontWeight: 800,
                    color: RF_TEXT_PRIMARY,
                    lineHeight: 1.3,
                    wordBreak: "break-word",
                  }}
                >
                  {cat.titulo}
                </h2>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 8 }}>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: 999,
                      background: nivel === "escrita" ? "rgba(248,81,73,0.14)" : "rgba(63,185,80,0.14)",
                      color: nivel === "escrita" ? "#f85149" : "#3fb950",
                      border: `1px solid ${nivel === "escrita" ? "rgba(248,81,73,0.35)" : "rgba(63,185,80,0.35)"}`,
                      textTransform: "uppercase",
                    }}
                  >
                    {nivel === "escrita" ? "Escrita" : "Só leitura"}
                  </span>
                  {cat.recomendadoWhatsApp ? (
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 999,
                        background: "rgba(230,192,106,0.12)",
                        color: "#e6c06a",
                        border: "1px solid rgba(230,192,106,0.35)",
                      }}
                    >
                      Sugerido WhatsApp
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
            <button type="button" onClick={onClose} aria-label="Fechar" style={rfCloseButtonStyle()}>
              <X size={16} strokeWidth={2} />
            </button>
          </div>
        </header>

        <div style={rfAsideBodyStyle()}>
          <div style={rfInnerPanelStyle()}>
            <div style={{ padding: "12px 14px", borderBottom: `1px solid ${RF_BORDER}` }}>
              <p style={{ margin: 0, color: RF_ACCENT, fontSize: 11, fontWeight: 700 }}>Detalhes</p>
            </div>
            <div style={{ padding: "12px 14px" }}>
              <ReadOnlyField label="Descrição" value={cat.descricao} />
              <ReadOnlyField label="Chave técnica" value={cat.mistralFunction?.name ?? cat.id} mono />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                <MetaChip label="Categoria" value={HUB_FERRAMENTA_SECAO_LABEL[cat.categoria]} />
                <MetaChip label="Acesso" value={nivel === "escrita" ? "Escrita" : "Só leitura"} />
                <MetaChip label="WhatsApp" value={cat.recomendadoWhatsApp ? "Recomendado" : "Opcional"} />
                <MetaChip label="ID interno" value={cat.id} />
              </div>
            </div>
          </div>

          <div style={{ ...rfInnerPanelStyle(), marginTop: 12 }}>
            <div
              style={{
                padding: "12px 14px",
                borderBottom: `1px solid ${RF_BORDER}`,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <FileJson size={14} color={RF_ACCENT} />
              <p style={{ margin: 0, color: RF_ACCENT, fontSize: 11, fontWeight: 700 }}>Parâmetros (JSON schema)</p>
            </div>
            <pre
              style={{
                margin: 0,
                padding: "12px 14px",
                maxHeight: 280,
                overflow: "auto",
                fontSize: 11,
                lineHeight: 1.5,
                color: RF_TEXT_SECONDARY,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                fontFamily: "ui-monospace, monospace",
              }}
            >
              {schemaJson}
            </pre>
          </div>

          <div style={{ ...rfInnerPanelStyle(), marginTop: 12 }}>
            <div style={{ padding: "12px 14px", borderBottom: `1px solid ${RF_BORDER}` }}>
              <p style={{ margin: 0, color: RF_ACCENT, fontSize: 11, fontWeight: 700 }}>
                Agentes com esta ferramenta activa ({agentes.length})
              </p>
            </div>
            <div style={{ padding: "12px 14px" }}>
              {agentes.length === 0 ? (
                <p style={{ margin: 0, fontSize: 12, color: RF_TEXT_MUTED, lineHeight: 1.5 }}>
                  Nenhum agente activo com motor de ferramentas e toggle ligados.
                </p>
              ) : (
                <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {agentes.map((a) => (
                    <li key={a.agente_slug}>
                      <Link
                        href={`/crm/agentes/${encodeURIComponent(a.agente_slug)}`}
                        style={agentLinkStyle}
                        onClick={onClose}
                      >
                        {a.nome?.trim() || a.agente_slug}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

const agentLinkStyle: CSSProperties = {
  display: "inline-block",
  padding: "6px 12px",
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 700,
  textDecoration: "none",
  background: "rgba(146,255,0,0.08)",
  color: RF_ACCENT,
  border: `1px solid ${RF_BORDER_STRONG}`,
};
