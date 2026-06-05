"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Eye, RefreshCw } from "lucide-react";
import { useCrmHeaderSlot } from "@/components/crm/CrmHeaderContext";
import { CrmCanalSideover, type CanalAgenteRow } from "@/components/crm/CrmCanalSideover";
import { EmptyState } from "@/components/crm/EmptyState";
import { FilterPills } from "@/components/crm/FilterPills";
import { SearchBar } from "@/components/crm/SearchBar";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { MODO_OPERACAO_LABEL, type ModoOperacaoAgente } from "@/lib/hub/agente-modo-operacao";

type ListMode = "todos" | "conectados" | "sem_instancia";

const FILTRO_PILLS = [
  { id: "todos", label: "Todos" },
  { id: "conectados", label: "Conectados" },
  { id: "sem_instancia", label: "Sem instância" },
] as const;

const TH: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  fontSize: 11,
  fontWeight: 700,
  color: "#5d7a67",
  letterSpacing: 0.5,
  textTransform: "uppercase",
  borderBottom: "1px solid #dcebd8",
  background: "#ffffff",
};

const TD: React.CSSProperties = {
  padding: "12px",
  fontSize: 13,
  color: "#0b2210",
  verticalAlign: "middle",
};

const SLUGS_CANAL_PADRAO = new Set(["atendente", "sdr", "gerente_atendimento", "diretor_geral_ia"]);

function ehCanalRelevante(a: CanalAgenteRow): boolean {
  if (a.arquivado_em) return false;
  if (a.ativo === false) return false;
  if (a.modo_operacao === "jobs_internos") return false;
  if (a.modo_operacao === "canal_whatsapp") return true;
  const id = typeof a.uazapi_instance_id === "string" ? a.uazapi_instance_id.trim() : "";
  if (id.length > 0) return true;
  // Sem coluna modo_operacao no banco: mostrar agentes de atendimento típicos
  if (a.modo_operacao == null || a.modo_operacao === "") {
    return SLUGS_CANAL_PADRAO.has(a.agente_slug);
  }
  return false;
}

function statusLabel(status?: string | null): string {
  const s = (status || "").toLowerCase();
  if (s === "connected") return "Conectado";
  if (s === "connecting") return "Conectando";
  if (s === "disconnected") return "Desconectado";
  return status?.trim() || "—";
}

function statusCores(status?: string | null): { bg: string; fg: string; border: string } {
  const s = (status || "").toLowerCase();
  if (s === "connected") return { bg: "#23863633", fg: "#3fb950", border: "#3fb95044" };
  if (s === "connecting") return { bg: "#bb800926", fg: "#e6c06a", border: "#bb800966" };
  return { bg: "#dcebd8", fg: "#5d7a67", border: "#484f58" };
}

export default function CanaisPage() {
  const pathname = usePathname();
  const { setSlot } = useCrmHeaderSlot();
  const [agentes, setAgentes] = useState<CanalAgenteRow[]>([]);
  const [loadingInicial, setLoadingInicial] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [modoLista, setModoLista] = useState<ListMode>("todos");
  const [sideover, setSideover] = useState<CanalAgenteRow | null>(null);

  const carregar = useCallback(async (opts?: { silent?: boolean }) => {
    setErro(null);
    if (opts?.silent) setRefreshing(true);
    else setLoadingInicial(true);
    try {
      const r = await fetch("/api/hub/canais", { headers: internalApiHeaders() });
      const json: unknown = await r.json();
      if (!r.ok) {
        const msg =
          json && typeof json === "object" && "error" in json && typeof (json as Record<string, unknown>).error === "string"
            ? String((json as Record<string, unknown>).error)
            : "Falha ao listar agentes.";
        throw new Error(msg);
      }
      const lista = Array.isArray(json) ? (json as CanalAgenteRow[]) : [];
      setAgentes(lista.filter(ehCanalRelevante));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar canais.");
      setAgentes([]);
    } finally {
      setLoadingInicial(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    setSlot({
      path: pathname,
      actions: (
        <button
          type="button"
          onClick={() => void carregar({ silent: true })}
          disabled={refreshing || loadingInicial}
          className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-semibold"
          style={{
            background: "#eef7eb",
            color: "#c9a24a",
            border: "1px solid #dcebd8",
            cursor: refreshing || loadingInicial ? "wait" : "pointer",
          }}
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : undefined} />
          Atualizar
        </button>
      ),
    });
    return () => setSlot(null);
  }, [pathname, setSlot, carregar, refreshing, loadingInicial]);

  const filtrados = useMemo(() => {
    let rows = agentes;
    if (modoLista === "conectados") {
      rows = rows.filter((a) => (a.uazapi_connection_status || "").toLowerCase() === "connected");
    } else if (modoLista === "sem_instancia") {
      rows = rows.filter((a) => !(a.uazapi_instance_id || "").trim());
    }
    const q = busca.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((a) => {
      const nome = (a.nome || "").toLowerCase();
      const slug = (a.agente_slug || "").toLowerCase();
      const inst = (a.uazapi_instance_name || "").toLowerCase();
      return nome.includes(q) || slug.includes(q) || inst.includes(q);
    });
  }, [agentes, modoLista, busca]);

  const kpis = useMemo(() => {
    const conectados = agentes.filter((a) => (a.uazapi_connection_status || "").toLowerCase() === "connected").length;
    const comInstancia = agentes.filter((a) => (a.uazapi_instance_id || "").trim()).length;
    return { total: agentes.length, conectados, comInstancia };
  }, [agentes]);

  return (
    <div style={{ height: "100%", overflowY: "auto", background: "#f8fcf6", padding: 24 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 12,
          marginBottom: 20,
        }}
      >
        {[
          { label: "Canais ativos", value: kpis.total, color: "#c9a24a" },
          { label: "Conectados", value: kpis.conectados, color: "#3fb950" },
          { label: "Com instância UAZAPI", value: kpis.comInstancia, color: "#93c5fd" },
        ].map((k) => (
          <div
            key={k.label}
            style={{
              padding: "14px 16px",
              borderRadius: 12,
              background: "#ffffff",
              border: "1px solid #dcebd8",
            }}
          >
            <p style={{ margin: 0, fontSize: 11, color: "#5d7a67", fontWeight: 600 }}>{k.label}</p>
            <p style={{ margin: "6px 0 0", fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</p>
          </div>
        ))}
      </div>

      <p style={{ margin: "0 0 16px", color: "#5d7a67", fontSize: 13, lineHeight: 1.5, maxWidth: 720 }}>
        Visão operacional: só estado da conexão. <strong style={{ color: "#c9a24a" }}>Cadastrar instância</strong> (nome,
        proxy, token UAZAPI) é na ficha do agente; <strong style={{ color: "#c9a24a" }}>QR / pareamento</strong> é um
        passo à parte, quando for ligar o WhatsApp ao telefone.
      </p>

      <div style={{ marginBottom: 12 }}>
        <SearchBar value={busca} onChange={setBusca} placeholder="Buscar por nome, slug ou instância…" />
      </div>

      <div style={{ marginBottom: 20 }}>
        <FilterPills
          pills={FILTRO_PILLS.map((p) => ({ id: p.id, label: p.label }))}
          active={modoLista}
          onChange={(id) => setModoLista(id as ListMode)}
        />
      </div>

      {erro ? (
        <p style={{ color: "#f85149", fontSize: 13, marginBottom: 16 }}>{erro}</p>
      ) : null}

      {loadingInicial ? (
        <p style={{ color: "#5d7a67", fontSize: 13 }}>Carregando canais…</p>
      ) : filtrados.length === 0 ? (
        <EmptyState
          message={
            modoLista === "sem_instancia"
              ? "Nenhum agente em modo WhatsApp sem instância."
              : modoLista === "conectados"
                ? "Nenhum canal conectado no momento."
                : "Nenhum canal WhatsApp encontrado para agentes ativos."
          }
        />
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
            <thead>
              <tr>
                <th style={TH}>Agente</th>
                <th style={TH}>Slug</th>
                <th style={TH}>Instância</th>
                <th style={TH}>Conexão</th>
                <th style={TH}>Modo</th>
                <th style={{ ...TH, width: 72, textAlign: "center" }} aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {filtrados.map((a) => {
                const st = statusCores(a.uazapi_connection_status);
                const modo =
                  a.modo_operacao && a.modo_operacao in MODO_OPERACAO_LABEL
                    ? MODO_OPERACAO_LABEL[a.modo_operacao as ModoOperacaoAgente]
                    : a.modo_operacao || "—";
                const temInst = Boolean((a.uazapi_instance_id || "").trim());
                return (
                  <tr key={a.agente_slug} style={{ borderBottom: "1px solid #eef7eb" }}>
                    <td style={{ ...TD, fontWeight: 600 }}>{a.nome}</td>
                    <td style={{ ...TD, color: "#5d7a67", fontSize: 12 }}>
                      <code>{a.agente_slug}</code>
                    </td>
                    <td style={{ ...TD, color: "#5d7a67", fontSize: 12 }}>
                      {temInst ? a.uazapi_instance_name || a.uazapi_instance_id : "—"}
                    </td>
                    <td style={TD}>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "3px 10px",
                          borderRadius: 20,
                          background: st.bg,
                          color: st.fg,
                          border: `1px solid ${st.border}`,
                        }}
                      >
                        {temInst ? statusLabel(a.uazapi_connection_status) : "Sem instância"}
                      </span>
                    </td>
                    <td style={{ ...TD, color: "#5d7a67", fontSize: 12, maxWidth: 200 }}>{modo}</td>
                    <td style={{ ...TD, textAlign: "center" }}>
                      <button
                        type="button"
                        aria-label={`Gerenciar canal de ${a.nome}`}
                        onClick={() => setSideover(a)}
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 8,
                          border: "1px solid #dcebd8",
                          background: "#eef7eb",
                          color: "#c9a24a",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Eye size={18} strokeWidth={1.75} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <CrmCanalSideover agente={sideover} onClose={() => setSideover(null)} />
    </div>
  );
}
