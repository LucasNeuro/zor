"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ExternalLink, MessageCircle, Settings, X } from "lucide-react";
import { MODO_OPERACAO_LABEL } from "@/lib/hub/agente-modo-operacao";

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
  if (!temInstancia) return { bg: "#30363d", fg: "#8b949e", border: "#484f58" };
  const s = (status || "").toLowerCase();
  if (s === "connected") return { bg: "#23863633", fg: "#3fb950", border: "#3fb95044" };
  if (s === "connecting") return { bg: "#bb800926", fg: "#e6c06a", border: "#bb800966" };
  return { bg: "#30363d", fg: "#8b949e", border: "#484f58" };
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
        borderBottom: "1px solid #21262d",
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: "#8b949e",
          letterSpacing: 0.4,
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 13, color: "#e6edf3", wordBreak: "break-word" }}>{value}</span>
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

  const modoWhatsapp = agente.modo_operacao === "canal_whatsapp";
  const modoLabel =
    agente.modo_operacao && agente.modo_operacao in MODO_OPERACAO_LABEL
      ? MODO_OPERACAO_LABEL[agente.modo_operacao as keyof typeof MODO_OPERACAO_LABEL]
      : agente.modo_operacao || "—";

  const temInstancia = Boolean((agente.uazapi_instance_id || "").trim());
  const badge = statusCores(agente.uazapi_connection_status, temInstancia);
  const rotuloEstado = temInstancia
    ? statusLabel(agente.uazapi_connection_status).toUpperCase()
    : "SEM INSTÂNCIA";
  const snapshotFmt = fmtDataHora(agente.uazapi_snapshot_at);

  return (
    <>
      <button
        type="button"
        aria-label="Fechar painel do canal"
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 70,
          background: "rgba(0,0,0,0.55)",
          border: "none",
          padding: 0,
          cursor: "pointer",
        }}
      />
      <aside
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "min(520px, 100vw)",
          zIndex: 80,
          background: "#0f1620",
          borderLeft: "1px solid #2d394b",
          boxShadow: "-12px 0 32px rgba(0,0,0,0.45)",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
        <header
          style={{
            borderBottom: "1px solid #2d394b",
            padding: 16,
            background: "linear-gradient(180deg,#121a26 0%, #101722 100%)",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ margin: 0, color: "#8ea1ba", fontSize: 11, letterSpacing: 0.8, fontWeight: 700 }}>
                CANAL WHATSAPP
              </p>
              <h2 style={{ margin: "4px 0 0", color: "#e6edf3", fontSize: 18, fontWeight: 800 }}>{agente.nome}</h2>
              <p style={{ margin: "6px 0 0", color: "#8b949e", fontSize: 12 }}>
                <code style={{ color: "#93c5fd", fontSize: 11 }}>{agente.agente_slug}</code>
                {" · "}
                {modoLabel}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              style={{
                flexShrink: 0,
                width: 36,
                height: 36,
                borderRadius: 8,
                border: "1px solid #30363d",
                background: "#21262d",
                color: "#8b949e",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="panel-scroll" style={{ flex: 1, overflowY: "auto", padding: 16, minHeight: 0 }}>
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

          <div
            style={{
              borderRadius: 12,
              border: "1px solid #30363d",
              background: "#161b22",
              padding: 16,
              marginBottom: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <MessageCircle size={20} style={{ color: "#25d366" }} />
              <span style={{ fontSize: 14, fontWeight: 700, color: "#e6edf3" }}>Estado da conexão</span>
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

            <p style={{ margin: "0 0 8px", color: "#8b949e", fontSize: 12, lineHeight: 1.5 }}>
              Dados espelhados no banco (sem consulta à UAZAPI nesta tela). Para criar instância, QR ou desligar
              sessão, use a ficha do modelo ou o wizard.
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
              borderRadius: 12,
              border: "1px solid #30363d",
              background: "#0d1117",
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
            <InfoRow label="Modo operação" value={modoLabel} />
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
              color: "#8b949e",
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
