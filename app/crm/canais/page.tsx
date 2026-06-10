"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { RefreshCw } from "lucide-react";
import type { CrmResizableColumn } from "@/components/crm/CrmResizableDataTable";
import {
  CrmRetrofitTablePanel,
  crmRetrofitPageXClass,
  crmTableIdBadge,
  crmTableStatusPill,
} from "@/components/crm/CrmRetrofitTablePanel";
import { CrmCanalModoCell, modoOperacaoExportLabel } from "@/components/crm/CrmCanalModoCell";
import { CrmMetricCard, CrmMetricsGrid } from "@/components/crm/CrmMetricCard";
import { FilterPills } from "@/components/crm/FilterPills";
import { useCrmHeaderSlot } from "@/components/crm/CrmHeaderContext";
import { CrmCanalSideover, type CanalAgenteRow } from "@/components/crm/CrmCanalSideover";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import {
  sparklineFromCounts,
  sparklineFromSeed,
  trendLabel,
  trendPositive,
} from "@/lib/crm/metric-visuals";

type ListMode = "todos" | "conectados" | "sem_instancia";

const FILTRO_PILLS = [
  { id: "todos", label: "Todos" },
  { id: "conectados", label: "Conectados" },
  { id: "sem_instancia", label: "Sem instância" },
] as const;

const SLUGS_CANAL_PADRAO = new Set(["atendente", "sdr", "gerente_atendimento", "diretor_geral_ia"]);

function ehCanalRelevante(a: CanalAgenteRow): boolean {
  if (a.arquivado_em) return false;
  if (a.ativo === false) return false;
  if (a.modo_operacao === "jobs_internos") return false;
  if (a.modo_operacao === "canal_whatsapp") return true;
  const id = typeof a.uazapi_instance_id === "string" ? a.uazapi_instance_id.trim() : "";
  if (id.length > 0) return true;
  if (a.modo_operacao == null || a.modo_operacao === "") {
    return SLUGS_CANAL_PADRAO.has(a.agente_slug);
  }
  return false;
}

function statusLabel(status?: string | null, temInstancia?: boolean): string {
  if (!temInstancia) return "Sem instância";
  const s = (status || "").toLowerCase();
  if (s === "connected") return "Conectado";
  if (s === "connecting") return "Conectando";
  if (s === "disconnected") return "Desconectado";
  return status?.trim() || "—";
}

function conexaoTone(status?: string | null, temInstancia?: boolean): "green" | "amber" | "gray" {
  if (!temInstancia) return "gray";
  const s = (status || "").toLowerCase();
  if (s === "connected") return "green";
  if (s === "connecting") return "amber";
  return "gray";
}

function formatData(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(true);
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

  const botaoAtualizar = useMemo(
    () => (
      <button
        type="button"
        onClick={() => void carregar({ silent: true })}
        disabled={refreshing || loadingInicial}
        className="inline-flex items-center gap-1.5 rounded-xl border border-[#d4ecd0] bg-white px-3 py-2 text-xs font-semibold text-[#1e4a24] disabled:opacity-60"
      >
        <RefreshCw size={14} className={refreshing ? "animate-spin" : undefined} />
        Atualizar
      </button>
    ),
    [carregar, refreshing, loadingInicial]
  );

  useEffect(() => {
    setSlot({
      path: pathname,
      subtitle: `${agentes.length} canais · operação WhatsApp`,
      actions: botaoAtualizar,
    });
    return () => setSlot(null);
  }, [pathname, setSlot, agentes.length, botaoAtualizar]);

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
    const conectados = agentes.filter(
      (a) => (a.uazapi_connection_status || "").toLowerCase() === "connected"
    ).length;
    const conectando = agentes.filter(
      (a) => (a.uazapi_connection_status || "").toLowerCase() === "connecting"
    ).length;
    const desconectados = agentes.filter((a) => {
      const tem = Boolean((a.uazapi_instance_id || "").trim());
      const st = (a.uazapi_connection_status || "").toLowerCase();
      return tem && st !== "connected" && st !== "connecting";
    }).length;
    const comInstancia = agentes.filter((a) => (a.uazapi_instance_id || "").trim()).length;
    const semInstancia = agentes.length - comInstancia;
    return {
      total: agentes.length,
      conectados,
      conectando,
      desconectados,
      comInstancia,
      semInstancia,
    };
  }, [agentes]);

  const colunas = useMemo((): CrmResizableColumn<CanalAgenteRow>[] => {
    return [
      {
        id: "nome",
        label: "Agente",
        defaultWidth: 160,
        minWidth: 120,
        render: (a) => <span className="font-semibold text-[#0b2210]">{a.nome}</span>,
      },
      {
        id: "slug",
        label: "Slug",
        defaultWidth: 110,
        minWidth: 80,
        render: (a) => crmTableIdBadge(a.agente_slug, "green"),
      },
      {
        id: "instancia",
        label: "Instância",
        defaultWidth: 160,
        minWidth: 120,
        render: (a) => {
          const tem = Boolean((a.uazapi_instance_id || "").trim());
          return tem ? a.uazapi_instance_name || a.uazapi_instance_id || "—" : "—";
        },
      },
      {
        id: "instancia_id",
        label: "ID instância",
        defaultWidth: 140,
        minWidth: 100,
        render: (a) => (
          <span className="truncate font-mono text-[11px] text-[#5d7a67]" title={a.uazapi_instance_id ?? undefined}>
            {a.uazapi_instance_id || "—"}
          </span>
        ),
      },
      {
        id: "conexao",
        label: "Conexão",
        defaultWidth: 120,
        minWidth: 96,
        render: (a) => {
          const tem = Boolean((a.uazapi_instance_id || "").trim());
          const tone = conexaoTone(a.uazapi_connection_status, tem);
          const label = statusLabel(a.uazapi_connection_status, tem);
          return crmTableStatusPill(label, tone === "green");
        },
      },
      {
        id: "token",
        label: "Token",
        defaultWidth: 88,
        minWidth: 72,
        align: "center",
        render: (a) =>
          crmTableStatusPill(a.uazapi_has_instance_token ? "Configurado" : "Ausente", a.uazapi_has_instance_token),
      },
      {
        id: "modo",
        label: "Modo",
        defaultWidth: 148,
        minWidth: 120,
        render: (a) => (
          <CrmCanalModoCell
            modo={a.modo_operacao}
            legacyCanalWhatsapp={
              !a.modo_operacao &&
              (Boolean((a.uazapi_instance_id || "").trim()) ||
                SLUGS_CANAL_PADRAO.has(a.agente_slug))
            }
          />
        ),
      },
      {
        id: "ativo",
        label: "Status",
        defaultWidth: 88,
        minWidth: 72,
        align: "center",
        render: (a) => crmTableStatusPill(a.ativo !== false ? "Ativo" : "Inativo", a.ativo !== false),
      },
      {
        id: "snapshot",
        label: "Snapshot",
        defaultWidth: 130,
        minWidth: 100,
        render: (a) => formatData(a.uazapi_snapshot_at),
      },
    ];
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#f8fcf6]">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={`flex flex-col gap-3 pb-4 pt-3 ${crmRetrofitPageXClass}`}>
          <CrmMetricsGrid cols={4}>
          <CrmMetricCard
            label="Canais ativos"
            valor={kpis.total}
            tone="brand"
            sub="Agentes em modo WhatsApp"
            sparkline={sparklineFromCounts([
              kpis.conectados,
              kpis.conectando,
              kpis.desconectados,
              kpis.semInstancia,
              kpis.total,
            ])}
            trend={
              kpis.total > 0
                ? {
                    label: trendLabel(kpis.conectados, kpis.total) ?? "—",
                    positive: trendPositive(kpis.conectados, kpis.total),
                  }
                : undefined
            }
            loading={loadingInicial}
          />
          <CrmMetricCard
            label="Conectados"
            valor={kpis.conectados}
            tone="success"
            sub="WhatsApp online agora"
            sparkline={sparklineFromSeed(kpis.conectados + 1)}
            trend={
              kpis.comInstancia > 0
                ? {
                    label: trendLabel(kpis.conectados, kpis.comInstancia) ?? "—",
                    positive: kpis.conectados > 0,
                  }
                : undefined
            }
            loading={loadingInicial}
          />
          <CrmMetricCard
            label="Com instância UAZAPI"
            valor={kpis.comInstancia}
            tone="success"
            sub="Token / instância cadastrada"
            progress={{
              value: kpis.comInstancia,
              max: Math.max(kpis.total, 1),
              hint: `${kpis.comInstancia} de ${kpis.total}`,
            }}
            loading={loadingInicial}
          />
          <CrmMetricCard
            label="Sem instância"
            valor={kpis.semInstancia}
            tone="muted"
            sub="Precisam de configuração"
            sparkline={sparklineFromSeed(kpis.semInstancia + 3)}
            trend={
              kpis.total > 0
                ? {
                    label: trendLabel(kpis.semInstancia, kpis.total) ?? "—",
                    positive: !trendPositive(kpis.semInstancia, kpis.total, true),
                  }
                : undefined
            }
            loading={loadingInicial}
          />
          </CrmMetricsGrid>

          <p className="m-0 max-w-3xl text-xs leading-relaxed text-[#5d7a67]">
            Visão operacional da conexão WhatsApp.{" "}
            <strong className="text-[#3f9848]">Cadastrar instância</strong> (nome, proxy, token) é na ficha do
            agente; <strong className="text-[#3f9848]">QR / pareamento</strong> liga o telefone quando for operar.
          </p>

          {erro ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800" role="alert">
              {erro}
            </div>
          ) : null}

          {loadingInicial ? (
            <p className="py-8 text-center text-sm text-[#5d7a67]">Carregando canais…</p>
          ) : (
            <CrmRetrofitTablePanel
            tableId="crm-canais"
            columns={colunas}
            rows={filtrados}
            rowKey={(a) => a.agente_slug}
            emptyMessage="Nenhum canal WhatsApp encontrado para agentes ativos."
            footerSummary={`Exibindo ${filtrados.length} de ${agentes.length} canais`}
            onRowClick={setSideover}
            onViewRow={setSideover}
            toolbar={{
              searchValue: busca,
              onSearchChange: setBusca,
              searchPlaceholder: "Buscar por nome, slug ou instância…",
              showAdvancedFilters,
              onToggleAdvancedFilters: () => setShowAdvancedFilters((v) => !v),
              advancedFilters: (
                <FilterPills
                  pills={FILTRO_PILLS.map((p) => ({ id: p.id, label: p.label }))}
                  active={modoLista}
                  onChange={(id) => setModoLista(id as ListMode)}
                />
              ),
            }}
            exportConfig={{
              filename: "canais-whatsapp.csv",
              headers: [
                "Agente",
                "Slug",
                "Instância",
                "ID instância",
                "Conexão",
                "Token",
                "Modo",
                "Status",
                "Snapshot",
              ],
              rowValues: (a) => {
                const tem = Boolean((a.uazapi_instance_id || "").trim());
                return [
                  a.nome,
                  a.agente_slug,
                  tem ? a.uazapi_instance_name || a.uazapi_instance_id || "" : "",
                  a.uazapi_instance_id || "",
                  statusLabel(a.uazapi_connection_status, tem),
                  a.uazapi_has_instance_token ? "Configurado" : "Ausente",
                  modoOperacaoExportLabel(a.modo_operacao) ||
                    (SLUGS_CANAL_PADRAO.has(a.agente_slug) ? "Atendimento (WhatsApp)" : ""),
                  a.ativo !== false ? "Ativo" : "Inativo",
                  formatData(a.uazapi_snapshot_at),
                ];
              },
            }}
          />
          )}
        </div>
      </div>

      <CrmCanalSideover agente={sideover} onClose={() => setSideover(null)} />
    </div>
  );
}
