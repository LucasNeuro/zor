"use client";

import { useMemo, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import {
  CrmResizableDataTable,
  type CrmResizableColumn,
} from "@/components/crm/CrmResizableDataTable";
import { CRM_ACCENT } from "@/lib/crm/crm-button-styles";
import type { FollowupOperacaoSnapshot, FollowupTimelineEvento } from "@/lib/hub/followup-operacao";

export type AgenteFollowupPanelProps = {
  followup: FollowupOperacaoSnapshot | null | undefined;
  loading?: boolean;
  atualizadoEm?: number | null;
  onRefresh?: () => void;
};

type FollowupTableRow = {
  id: string;
  em: string;
  lead: string;
  passo: number | null;
  status: FollowupTimelineEvento["status"];
  tipo: FollowupTimelineEvento["tipo"];
  titulo: string;
  detalhe: string;
  fonte: string;
};

function tempoRelativo(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const diff = Date.now() - t;
  const sec = Math.floor(diff / 1000);
  if (sec < 45) return "agora";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 48) return `${h} h`;
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatarDataHora(iso: string): string {
  if (iso === "pendente") return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(status: FollowupTimelineEvento["status"], tipo: FollowupTimelineEvento["tipo"]): string {
  if (status === "aguardando") return "Aguardando";
  if (status === "erro") return "Erro";
  if (tipo === "envio" && status === "sucesso") return "Enviado";
  if (tipo === "tick") return "Verificação";
  if (tipo === "arquivado") return "Arquivado";
  return "Registo";
}

function StatusBadge({ status, tipo }: { status: FollowupTimelineEvento["status"]; tipo: FollowupTimelineEvento["tipo"] }) {
  const label = statusLabel(status, tipo);
  const styles: Record<string, { bg: string; fg: string; border: string }> = {
    Enviado: { bg: "#eef7eb", fg: "#15803d", border: "#c8e6c0" },
    Aguardando: { bg: "#fffbeb", fg: "#a16207", border: "#fde68a" },
    Erro: { bg: "#fef2f2", fg: "#dc2626", border: "#fecaca" },
    Verificação: { bg: "#f7fbff", fg: "#61789b", border: "#dce8f5" },
    Arquivado: { bg: "#f3f4f6", fg: "#4b5563", border: "#e5e7eb" },
    Registo: { bg: "#f8fcf6", fg: "#6b8a76", border: "#dcebd8" },
  };
  const s = styles[label] ?? styles.Registo;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "3px 10px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        background: s.bg,
        color: s.fg,
        border: `1px solid ${s.border}`,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function timelineParaLinhas(timeline: FollowupTimelineEvento[]): FollowupTableRow[] {
  return timeline.map((ev) => ({
    id: ev.id,
    em: ev.status === "aguardando" ? "pendente" : ev.em,
    lead: ev.lead_nome?.trim() || "—",
    passo: ev.passo ?? null,
    status: ev.status,
    tipo: ev.tipo,
    titulo: ev.titulo,
    detalhe: ev.detalhe?.trim() || "—",
    fonte: ev.fonte?.trim() || (ev.tipo === "envio" ? "whatsapp" : "—"),
  }));
}

export function AgenteFollowupPanel({
  followup,
  loading,
  atualizadoEm,
  onRefresh,
}: AgenteFollowupPanelProps) {
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "enviados" | "pendentes">("todos");

  const linhas = useMemo(() => {
    let rows = timelineParaLinhas(followup?.timeline ?? []);
    const q = busca.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (r) =>
          r.lead.toLowerCase().includes(q) ||
          r.titulo.toLowerCase().includes(q) ||
          r.detalhe.toLowerCase().includes(q)
      );
    }
    if (filtroStatus === "enviados") {
      rows = rows.filter((r) => r.tipo === "envio" && r.status === "sucesso");
    } else if (filtroStatus === "pendentes") {
      rows = rows.filter((r) => r.status === "aguardando");
    }
    return rows;
  }, [followup?.timeline, busca, filtroStatus]);

  const columns = useMemo((): CrmResizableColumn<FollowupTableRow>[] => {
    return [
      {
        id: "em",
        label: "Data / hora",
        defaultWidth: 128,
        minWidth: 110,
        render: (r) => (
          <span title={r.em === "pendente" ? "Aguardando próximo ciclo" : r.em}>
            {r.em === "pendente" ? (
              <span style={{ color: "#a16207", fontWeight: 600 }}>Pendente</span>
            ) : (
              formatarDataHora(r.em)
            )}
          </span>
        ),
      },
      {
        id: "lead",
        label: "Lead",
        defaultWidth: 140,
        minWidth: 100,
        render: (r) => <span style={{ fontWeight: 600 }}>{r.lead}</span>,
      },
      {
        id: "passo",
        label: "Passo",
        defaultWidth: 72,
        minWidth: 64,
        align: "center",
        render: (r) => (r.passo != null ? String(r.passo) : "—"),
      },
      {
        id: "status",
        label: "Status",
        defaultWidth: 120,
        minWidth: 100,
        render: (r) => <StatusBadge status={r.status} tipo={r.tipo} />,
      },
      {
        id: "detalhe",
        label: "Mensagem / motivo",
        defaultWidth: 320,
        minWidth: 180,
        render: (r) => (
          <span title={r.detalhe !== "—" ? r.detalhe : r.titulo}>
            {r.detalhe !== "—" ? r.detalhe : r.titulo}
          </span>
        ),
      },
      {
        id: "fonte",
        label: "Canal",
        defaultWidth: 100,
        minWidth: 80,
        render: (r) => (
          <span style={{ textTransform: "capitalize", color: "#6b8a76", fontSize: 12 }}>{r.fonte}</span>
        ),
      },
    ];
  }, []);

  const elegiveis = followup?.estado_atual?.leads_elegiveis ?? 0;
  const envios24h = followup?.envios_24h ?? 0;
  const pendentes = (followup?.timeline ?? []).filter((e) => e.status === "aguardando").length;
  const janela = followup?.execucao_janela;
  const foraDaJanela = janela?.modo === "janela_horaria" && janela.ativa === false;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div
        style={{
          borderRadius: 16,
          border: "1px solid #dcebd8",
          background: "#ffffff",
          padding: "20px 22px",
          boxShadow: "0 4px 18px rgba(15, 56, 39, 0.04)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
            marginBottom: 18,
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#0b2210" }}>Follow-ups</h2>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "#5d7a67", lineHeight: 1.5, maxWidth: 560 }}>
              {followup?.ativo
                ? followup.resumo_cadencia ?? "Follow-up activo"
                : "Follow-up inactivo — active em Integrações para ver envios automáticos."}
            </p>
            {foraDaJanela ? (
              <p
                style={{
                  margin: "8px 0 0",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#a16207",
                  lineHeight: 1.45,
                  maxWidth: 560,
                }}
              >
                Fora da janela horária
                {janela?.proximo_slot ? ` — próximo envio ~${janela.proximo_slot}` : ""}
                {janela?.horarios?.length ? ` (slots: ${janela.horarios.join(", ")})` : ""}. A cadência só dispara
                dentro desses horários.
              </p>
            ) : janela?.modo === "continuo" ? (
              <p style={{ margin: "8px 0 0", fontSize: 12, fontWeight: 600, color: "#15803d", lineHeight: 1.45 }}>
                Modo contínuo — cadência activa a qualquer hora.
              </p>
            ) : null}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {atualizadoEm ? (
              <span style={{ fontSize: 11, fontWeight: 600, color: "#6b8a76" }}>
                Actualizado {tempoRelativo(new Date(atualizadoEm).toISOString())}
              </span>
            ) : null}
            {onRefresh ? (
              <button
                type="button"
                onClick={onRefresh}
                disabled={loading}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  height: 36,
                  padding: "0 14px",
                  borderRadius: 10,
                  border: "1px solid #d4ecd0",
                  background: "#fff",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#1e4a24",
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.6 : 1,
                }}
              >
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                Actualizar
              </button>
            ) : null}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 12,
            marginBottom: 18,
          }}
        >
          {[
            { label: "Leads elegíveis", value: String(elegiveis) },
            { label: "Envios (24h)", value: String(envios24h), accent: true },
            { label: "Pendentes", value: String(pendentes) },
            {
              label: "Último ciclo",
              value: followup?.ultimo_tick_em ? tempoRelativo(followup.ultimo_tick_em) : "—",
            },
          ].map((tile) => (
            <div
              key={tile.label}
              style={{
                borderRadius: 12,
                border: "1px solid #eef5ec",
                background: "#f8fcf6",
                padding: "12px 14px",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: 0.5,
                  textTransform: "uppercase",
                  color: "#89a095",
                }}
              >
                {tile.label}
              </p>
              <p
                style={{
                  margin: "6px 0 0",
                  fontSize: 22,
                  fontWeight: 800,
                  color: tile.accent ? CRM_ACCENT : "#0b2210",
                  lineHeight: 1.1,
                }}
              >
                {tile.value}
              </p>
            </div>
          ))}
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            alignItems: "center",
            marginBottom: 14,
          }}
        >
          <div
            style={{
              flex: "1 1 220px",
              display: "flex",
              alignItems: "center",
              gap: 8,
              height: 40,
              padding: "0 12px",
              borderRadius: 12,
              border: "1px solid #d4ecd0",
              background: "#fff",
            }}
          >
            <Search size={15} style={{ color: "#6b8a76", flexShrink: 0 }} />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar nos resultados..."
              style={{
                width: "100%",
                border: "none",
                outline: "none",
                fontSize: 13,
                color: "#1e3a23",
                background: "transparent",
              }}
            />
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {(
              [
                { id: "todos", label: "Todos" },
                { id: "enviados", label: "Enviados" },
                { id: "pendentes", label: "Pendentes" },
              ] as const
            ).map((opt) => {
              const active = filtroStatus === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setFiltroStatus(opt.id)}
                  style={{
                    height: 36,
                    padding: "0 14px",
                    borderRadius: 10,
                    border: active ? `1px solid ${CRM_ACCENT}` : "1px solid #d4ecd0",
                    background: active ? "rgba(146, 255, 0, 0.12)" : "#fff",
                    color: active ? "#1a5c32" : "#1e4a24",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 600, color: "#6b8a76" }}>
          {linhas.length} de {(followup?.timeline ?? []).length} registo(s)
        </p>

        <div
          style={{
            borderRadius: 12,
            border: "1px solid #eef5ec",
            overflow: "hidden",
            background: "#fff",
          }}
        >
          {loading && linhas.length === 0 ? (
            <p style={{ margin: 0, padding: 24, fontSize: 13, color: "#6b8a76" }}>A carregar follow-ups…</p>
          ) : (
            <CrmResizableDataTable
              tableId="agente-followup-historico"
              variant="waje"
              columns={columns}
              rows={linhas}
              rowKey={(r) => r.id}
              maxHeight="min(52vh, 520px)"
              emptyMessage={
                followup?.ativo
                  ? "Nenhum follow-up registado ainda neste período."
                  : "Active o follow-up em Integrações para acompanhar envios aqui."
              }
              rowCellClassName="px-4 py-3.5 align-top text-sm"
              fillExtraSpace
            />
          )}
        </div>
      </div>
    </div>
  );
}
