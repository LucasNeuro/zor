"use client";

import { useState, useEffect } from "react";
import { Alert } from "@/lib/alerts-system";

export interface SlidePanelItem {
  id: string;
  titulo: string;
  subtitulo?: string;
  severity?: "critical" | "warning" | "info" | "ok";
  alert?: Alert;
  agente_id?: string;
  tarefa_id?: string;
  detail?: React.ReactNode;
}

interface SlidePanelProps {
  title: string;
  subtitle?: string;
  items: SlidePanelItem[];
  isOpen: boolean;
  onClose: () => void;
  onAgenteClick?: (agenteId: string) => void;
}

const SEV_COLORS = {
  critical: { dot: "#ef4444", bg: "rgba(239,68,68,0.1)",  border: "rgba(239,68,68,0.25)" },
  warning:  { dot: "#eab308", bg: "rgba(234,179,8,0.08)",  border: "rgba(234,179,8,0.2)"  },
  info:     { dot: "#60a5fa", bg: "rgba(96,165,250,0.08)", border: "rgba(96,165,250,0.2)" },
  ok:       { dot: "#22c55e", bg: "rgba(34,197,94,0.06)",  border: "rgba(34,197,94,0.15)" },
};

function C4Item({ item, onAgenteClick }: { item: SlidePanelItem; onAgenteClick?: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const sev = item.severity ?? "ok";
  const c = SEV_COLORS[sev];

  return (
    <div style={{
      borderRadius: 8, border: `1px solid ${c.border}`,
      background: c.bg, marginBottom: 8, overflow: "hidden",
    }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "10px 12px", cursor: "pointer", userSelect: "none",
        }}
      >
        <div style={{ width: 7, height: 7, borderRadius: "50%", background: c.dot, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.85)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {item.titulo}
          </div>
          {item.subtitulo && (
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)" }}>{item.subtitulo}</div>
          )}
        </div>
        <span style={{
          fontSize: 9, color: "rgba(255,255,255,0.3)",
          transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
          transition: "transform 200ms", display: "inline-block", flexShrink: 0,
        }}>▼</span>
      </div>

      {expanded && (
        <div className="panel-block-content" style={{ padding: "0 12px 12px", borderTop: `1px solid ${c.border}` }}>
          {item.alert && (
            <div style={{ padding: "8px 0", fontSize: 10, color: "rgba(255,255,255,0.6)", lineHeight: 1.5 }}>
              {item.alert.descricao}
            </div>
          )}
          {item.detail}
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            {item.agente_id && onAgenteClick && (
              <button
                onClick={(e) => { e.stopPropagation(); onAgenteClick(item.agente_id!); }}
                style={{
                  padding: "4px 10px", borderRadius: 5, fontSize: 10, fontWeight: 600, cursor: "pointer",
                  background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
                  color: "rgba(255,255,255,0.7)",
                }}
              >
                Ver agente →
              </button>
            )}
            {item.tarefa_id && (
              <button
                style={{
                  padding: "4px 10px", borderRadius: 5, fontSize: 10, fontWeight: 600, cursor: "pointer",
                  background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.2)",
                  color: "#60a5fa",
                }}
              >
                Ver tarefa →
              </button>
            )}
            {item.alert?.acao_label && (
              <button
                style={{
                  padding: "4px 10px", borderRadius: 5, fontSize: 10, fontWeight: 600, cursor: "pointer",
                  background: c.bg, border: `1px solid ${c.border}`, color: c.dot,
                }}
              >
                {item.alert.acao_label}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function SlidePanel({ title, subtitle, items, isOpen, onClose, onAgenteClick }: SlidePanelProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 900,
          background: "rgba(0,0,0,0.4)",
          animation: "fadeIn 200ms ease",
        }}
      />

      {/* Panel — C3 layer */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 901,
        width: 380, background: "#0f172a",
        borderLeft: "1px solid rgba(255,255,255,0.08)",
        display: "flex", flexDirection: "column",
        animation: "slideInRight 250ms ease",
      }}>
        {/* Header */}
        <div style={{
          padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.9)" }}>{title}</div>
            {subtitle && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>{subtitle}</div>}
          </div>
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center",
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.5)", fontSize: 14, cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>

        {/* C4 items — scrollable */}
        <div className="panel-scroll" style={{ flex: 1, overflowY: "auto", padding: 12 }}>
          {items.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "rgba(255,255,255,0.3)", fontSize: 12 }}>
              Nenhum item para exibir
            </div>
          ) : (
            items.map((item) => (
              <C4Item key={item.id} item={item} onAgenteClick={onAgenteClick} />
            ))
          )}
        </div>
      </div>
    </>
  );
}
