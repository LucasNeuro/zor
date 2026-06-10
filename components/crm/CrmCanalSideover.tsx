"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ExternalLink, MessageCircle, Settings, X } from "lucide-react";
import { CrmCanalModoCell } from "@/components/crm/CrmCanalModoCell";
import {
  RF_ACCENT,
  RF_BORDER,
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

export type CanalAgenteRow = {
  agente_slug: string;
  nome: string;
  modo_operacao?: string | null;
  ativo?: boolean;
  arquivado_em?: string | null;
  uazapi_instance_id?: string | null;
  uazapi_instance_name?: string | null;
  uazapi_connection_status?: string | null;
  uazapi_has_instance_token?: boolean;
  uazapi_snapshot_at?: string | null;
};

type Props = {
  agente: CanalAgenteRow | null;
  onClose: () => void;
};

function statusLabel(status?: string | null): string {
  const s = (status || "").toLowerCase();
  if (s === "connected") return "Conectado";
  if (s === "connecting") return "Conectando";
  if (s === "disconnected") return "Desconectado";
  return status?.trim() || "—";
}

function statusCores(status?: string | null, temInstancia?: boolean): { bg: string; fg: string; border: string } {
  if (!temInstancia) return { bg: "#dcebd8", fg: "#5d7a67", border: "#484f58" };
  const s = (status || "").toLowerCase();
  if (s === "connected") return { bg: "#23863633", fg: "#3fb950", border: "#3fb95044" };
  if (s === "connecting") return { bg: "#bb800926", fg: "#e6c06a", border: "#bb800966" };
  return { bg: "#dcebd8", fg: "#5d7a67", border: "#484f58" };
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "140px 1fr",
        gap: 12,
        alignItems: "start",
        padding: "10px 0",
        borderBottom: `1px solid ${RF_BORDER}`,
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: RF_TEXT_MUTED,
          letterSpacing: 0.4,
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 13, color: RF_TEXT_PRIMARY, wordBreak: "break-word" }}>{value}</span>
    </div>
  );
}

function fmtDataHora(iso?: string | null): string | null {
  if (!iso?.trim()) return null;
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return null;
  }
}

export function CrmCanalSideover({ agente, onClose }: Props) {
  if (!agente) return null;

  const modoWhatsapp =
    agente.modo_operacao === "canal_whatsapp" ||
    ((!agente.modo_operacao || agente.modo_operacao === "") &&
      ["atendente", "sdr", "gerente_atendimento"].includes(agente.agente_slug));

  const temInstancia = Boolean((agente.uazapi_instance_id || "").trim());
  const badge = statusCores(agente.uazapi_connection_status, temInstancia);
  const rotuloEstado = temInstancia
    ? statusLabel(agente.uazapi_connection_status).toUpperCase()
    : "SEM INSTÂNCIA";
  const snapshotFmt = fmtDataHora(agente.uazapi_snapshot_at);

  return (
    <>
      <button type="button" aria-label="Fechar painel do canal" onClick={onClose} style={rfOverlayStyle(70)} />
      <aside style={rfAsideStyle("min(520px, 100vw)", 80)}>
        <header style={rfAsideHeaderStyle()}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ margin: 0, color: RF_ACCENT, fontSize: 11, letterSpacing: 0.8, fontWeight: 700 }}>
                CANAL WHATSAPP
              </p>
              <h2 style={{ margin: "4px 0 0", color: RF_TEXT_PRIMARY, fontSize: 18, fontWeight: 800 }}>{agente.nome}</h2>
              <p style={{ margin: "6px 0 0", color: RF_TEXT_SECONDARY, fontSize: 12, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <code style={{ color: RF_ACCENT, fontSize: 11 }}>{agente.agente_slug}</code>
                <CrmCanalModoCell
                  modo={agente.modo_operacao}
                  legacyCanalWhatsapp={modoWhatsapp}
                  variant="dark"
                />
              </p>
            </div>
            <button type="button" onClick={onClose} aria-label="Fechar" style={{ ...rfCloseButtonStyle(), width: 36, height: 36 }}>
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="panel-scroll" style={rfAsideBodyStyle()}>
          {!modoWhatsapp ? (
            <p
              style={{
                margin: "0 0 16px",
                padding: "10px 12px",
                borderRadius: 8,
                background: "#bb800926",
                border: "1px solid #bb800966",
                color: "#e6c06a",
                fontSize: 12,
                lineHeight: 1.45,
              }}
            >
              Este agente não está em modo WhatsApp. O atendimento ao vivo no canal depende do modo definido na ficha
              do modelo.
            </p>
          ) : null}

          <div style={{ ...rfInnerPanelStyle(), padding: 16, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <MessageCircle size={20} style={{ color: "#25d366" }} />
              <span style={{ fontSize: 14, fontWeight: 700, color: RF_TEXT_PRIMARY }}>Estado da conexão</span>
            </div>

            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 12px",
                borderRadius: 20,
                background: badge.bg,
                border: `1px solid ${badge.border}`,
                marginBottom: 12,
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: badge.fg }} />
              <span style={{ fontSize: 11, fontWeight: 800, color: badge.fg, letterSpacing: 0.5 }}>{rotuloEstado}</span>
            </div>

            <p style={{ margin: "0 0 8px", color: RF_TEXT_SECONDARY, fontSize: 12, lineHeight: 1.5 }}>
              Só leitura do estado. Cadastro da instância e QR de ligação ficam na ficha do agente (passos 1 e 2).
            </p>
            {snapshotFmt ? (
              <p style={{ margin: 0, fontSize: 11, color: "#6e7681" }}>Última gravação no sistema: {snapshotFmt}</p>
            ) : (
              <p style={{ margin: 0, fontSize: 11, color: "#6e7681" }}>
                Ainda não há registro de sincronização de status no sistema.
              </p>
            )}
          </div>

          <div
            style={{
              ...rfInnerPanelStyle(),
              padding: "4px 16px 12px",
              marginBottom: 16,
            }}
          >
            <InfoRow
              label="Instância"
              value={agente.uazapi_instance_name?.trim() || agente.uazapi_instance_id || "—"}
            />
            <InfoRow
              label="ID instância"
              value={
                agente.uazapi_instance_id ? (
                  <code style={{ fontSize: 11, color: "#93c5fd" }}>{agente.uazapi_instance_id}</code>
                ) : (
                  "—"
                )
              }
            />
            <InfoRow label="Conexão" value={statusLabel(agente.uazapi_connection_status)} />
            <InfoRow label="Token UAZAPI" value={agente.uazapi_has_instance_token ? "Configurado" : "Ausente"} />
            <InfoRow
              label="Modo operação"
              value={
                <CrmCanalModoCell
                  modo={agente.modo_operacao}
                  legacyCanalWhatsapp={modoWhatsapp}
                  variant="dark"
                />
              }
            />
            <InfoRow label="Agente ativo" value={agente.ativo === false ? "Não" : "Sim"} />
          </div>

          <Link
            href={`/crm/agentes/${encodeURIComponent(agente.agente_slug)}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              width: "100%",
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid #58a6ff66",
              background: "#1f6feb22",
              color: "#58a6ff",
              fontSize: 12,
              fontWeight: 700,
              textDecoration: "none",
              boxSizing: "border-box",
            }}
          >
            <Settings size={14} />
            Configurar canal na ficha do modelo
          </Link>

          <Link
            href={`/crm/agentes/${encodeURIComponent(agente.agente_slug)}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              width: "100%",
              marginTop: 8,
              fontSize: 11,
              color: "#5d7a67",
              textDecoration: "none",
              padding: "4px 0",
            }}
          >
            <ExternalLink size={12} />
            Prompt, conhecimento e ferramentas na ficha / wizard
          </Link>
        </div>
      </aside>
    </>
  );
}
