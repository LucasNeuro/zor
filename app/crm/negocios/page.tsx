"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { useCrmHeaderSlot } from "@/components/crm/CrmHeaderContext";
import { useNarrowViewport } from "@/hooks/useNarrowViewport";
import { NegocioFormDrawer } from "@/components/crm/NegocioFormDrawer";
import { PipelineConfigSideover } from "@/components/crm/leads/PipelineConfigSideover";
import { CrmPipelinePageToolbar, type CrmPipelineViewMode } from "@/components/crm/pipelines/CrmPipelinePageToolbar";
import { CrmKanbanBoardScroll } from "@/components/crm/pipelines/CrmKanbanBoardScroll";
import { CrmKanbanColumn } from "@/components/crm/pipelines/CrmKanbanColumn";
import type { CrmResizableColumn } from "@/components/crm/CrmResizableDataTable";
import {
  CrmRetrofitAdvancedFiltersGrid,
  CrmRetrofitFilterField,
  CrmRetrofitTablePanel,
  crmRetrofitPageXClass,
  crmRetrofitFilterInputClass,
  crmRetrofitFilterSelectClass,
  crmTableIdBadge,
  crmTableStagePill,
  crmTableStatusPill,
} from "@/components/crm/CrmRetrofitTablePanel";
import { crmHeaderPrimaryBtnStyle } from "@/lib/crm/crm-list-pill-styles";
import { NegocioKanbanCard } from "@/components/crm/negocios/NegocioKanbanCard";
import {
  NegocioDetailSideover,
  type NegocioDetailData,
} from "@/components/crm/negocios/NegocioDetailSideover";
import { ESTAGIOS_FALLBACK_NEGOCIO_UI } from "@/lib/crm/pipeline-defaults";
import { useCrmToast } from "@/lib/crm/crm-feedback";
import { supabase } from "@/lib/supabase/client";
import { CrmTableNotesCell } from "@/components/crm/CrmTableNotesCell";
import { CrmMetricCard, CrmMetricsGrid } from "@/components/crm/CrmMetricCard";
import {
  sparklineFromCounts,
  sparklineFromSeed,
  trendLabel,
} from "@/lib/crm/metric-visuals";
import {
  loadNotasPreviewMap,
  notasParaNegocio,
} from "@/lib/crm/load-notas-preview";
import type { NotaPreview } from "@/components/crm/CrmKanbanNotesSection";

const LIMIT = 20;

const STATUS_LABEL: Record<string, string> = {
  aberto: "Aberto",
  em_negociacao: "Em negociação",
  fechado_ganho: "Ganho",
  fechado_perdido: "Perdido",
  cancelado: "Cancelado",
};

type Negocio = {
  id: string;
  codigo: string;
  titulo: string;
  prefixo_mercado: string;
  pipeline_id?: string | null;
  status: string;
  etapa: string;
  valor_estimado: number | null;
  valor_fechado: number | null;
  data_previsao_fechamento: string | null;
  criado_em: string | null;
  atualizado_em: string | null;
};

type PipelineUi = {
  id: string;
  slug: string;
  nome: string;
  mercado_sigla: string | null;
  estagios: { slug: string; label: string; cor: string; ativo: boolean; ordem?: number }[];
};

type EtapaUi = { id: string; label: string; color: string };

const ETAPAS_FALLBACK: EtapaUi[] = ESTAGIOS_FALLBACK_NEGOCIO_UI.map((e) => ({
  id: e.id,
  label: e.label,
  color: e.color,
}));

function moeda(v: number | null) {
  if (v == null || v <= 0) return "—";
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}k`;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
  }).format(v);
}

function formatData(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function tempo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}min`;
  if (m < 1440) return `${Math.floor(m / 60)}h`;
  return `${Math.floor(m / 1440)}d`;
}

function totalAberto(negocios: Negocio[]) {
  return negocios
    .filter((n) => !["ganho", "perdido"].includes(n.etapa))
    .reduce((s, n) => s + (n.valor_fechado ?? n.valor_estimado ?? 0), 0);
}

export default function NegociosPage() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setSlot } = useCrmHeaderSlot();
  const { error: toastError } = useCrmToast();
  const narrow = useNarrowViewport();
  const isMobile = narrow !== false;

  const [view, setView] = useState<CrmPipelineViewMode>("kanban");
  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [busca, setBusca] = useState("");
  const [etapa, setEtapa] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [offset, setOffset] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [drawerAberto, setDrawerAberto] = useState(false);
  const [pipelineConfigOpen, setPipelineConfigOpen] = useState(false);
  const [pipelines, setPipelines] = useState<PipelineUi[]>([]);
  const [pipelineId, setPipelineId] = useState<string | null>(null);
  const [etapasKanban, setEtapasKanban] = useState<EtapaUi[]>(ETAPAS_FALLBACK);
  const [notasMap, setNotasMap] = useState<Map<string, NotaPreview[]>>(new Map());
  const [selectedNegocioId, setSelectedNegocioId] = useState<string | null>(null);
  const [selectedNegocio, setSelectedNegocio] = useState<NegocioDetailData | null>(null);

  const carregarPipelines = useCallback(async () => {
    const res = await fetch("/api/crm/pipelines?tipo=negocio", {
      headers: internalApiHeaders(),
    });
    const json = await res.json().catch(() => ({ data: [] }));
    const list = (json.data || []) as PipelineUi[];
    if (!list.length) return;
    setPipelines(list);
    setPipelineId((prev) =>
      prev && list.some((p) => p.id === prev) ? prev : (list[0]?.id ?? null)
    );
  }, []);

  const pipelineAtivo = useMemo(
    () => pipelines.find((p) => p.id === pipelineId) ?? null,
    [pipelines, pipelineId]
  );

  useEffect(() => {
    void carregarPipelines();
  }, [carregarPipelines]);

  useEffect(() => {
    const cols =
      pipelineAtivo?.estagios
        ?.filter((e) => e.ativo !== false)
        .sort((a, b) => Number(a.ordem ?? 0) - Number(b.ordem ?? 0))
        .map((e) => ({ id: e.slug, label: e.label, color: e.cor || "#6B7280" })) ?? [];
    setEtapasKanban(cols.length ? cols : ETAPAS_FALLBACK);
  }, [pipelineAtivo]);

  const carregarLista = useCallback(
    (nextOffset = 0, append = false) => {
      if (append) setCarregandoMais(true);
      else setCarregando(true);

      const p = new URLSearchParams({ offset: String(nextOffset) });
      if (busca) p.set("busca", busca);
      if (etapa) p.set("etapa", etapa);
      if (pipelineAtivo?.id) {
        p.set("pipeline_id", pipelineAtivo.id);
      }

      return fetch(`/api/crm/negocios?${p}`, { headers: internalApiHeaders() })
        .then((r) => r.json())
        .then((d) => {
          const rows = (d.data ?? []) as Negocio[];
          setNegocios((prev) => (append ? [...prev, ...rows] : rows));
          setTotal(d.total ?? 0);
          setOffset(nextOffset + LIMIT);
        })
        .catch(() => {})
        .finally(() => {
          setCarregando(false);
          setCarregandoMais(false);
        });
    },
    [busca, etapa, pipelineAtivo]
  );

  useEffect(() => {
    const et = searchParams.get("etapa");
    const v = searchParams.get("view");
    const openNegocio = searchParams.get("negocio");
    if (et) setEtapa(et);
    if (v === "kanban" || v === "lista") setView(v);
    if (openNegocio) {
      setSelectedNegocioId(openNegocio);
      setSelectedNegocio(null);
      const p = new URLSearchParams(searchParams.toString());
      p.delete("negocio");
      const q = p.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    }
  }, [searchParams, isMobile, pathname, router]);

  useEffect(() => {
    void carregarLista(0, false);
  }, [carregarLista]);

  async function moverEtapa(
    negocioId: string,
    novaEtapa: string,
    options?: { optimistic?: boolean }
  ) {
    const negocioAtual = negocios.find((n) => n.id === negocioId);
    const etapaAnterior = negocioAtual?.etapa;

    if (options?.optimistic) {
      if (etapaAnterior === novaEtapa) return;
      setNegocios((prev) =>
        prev.map((n) => (n.id === negocioId ? { ...n, etapa: novaEtapa } : n))
      );
    }

    const res = await fetch(`/api/crm/negocios/${negocioId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...internalApiHeaders() },
      body: JSON.stringify({ etapa: novaEtapa }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (options?.optimistic && etapaAnterior) {
        setNegocios((prev) =>
          prev.map((n) => (n.id === negocioId ? { ...n, etapa: etapaAnterior } : n))
        );
      }
      toastError(typeof json?.error === "string" ? json.error : "Não foi possível mover o negócio.");
      return;
    }
    setNegocios((prev) =>
      prev.map((n) => (n.id === negocioId ? { ...n, etapa: novaEtapa } : n))
    );
  }

  const negociosFiltrados = useMemo(() => {
    return negocios.filter((n) => {
      if (filtroStatus && n.status !== filtroStatus) return false;
      const criado = n.criado_em;
      if (filtroDataInicio && criado) {
        const inicio = new Date(filtroDataInicio);
        inicio.setHours(0, 0, 0, 0);
        if (new Date(criado) < inicio) return false;
      }
      if (filtroDataFim && criado) {
        const fim = new Date(filtroDataFim);
        fim.setHours(23, 59, 59, 999);
        if (new Date(criado) > fim) return false;
      }
      return true;
    });
  }, [negocios, filtroStatus, filtroDataInicio, filtroDataFim]);

  const negociandoCount = negocios.filter((n) => n.etapa === "negociando").length;
  const pipelineTotal = totalAberto(negocios);
  const ganhosCount = negocios.filter((n) => n.etapa === "ganho").length;
  const perdidosCount = negocios.filter((n) => n.etapa === "perdido").length;
  const etapaSparkline = useMemo(() => {
    const buckets = etapasKanban.slice(0, 5).map(
      (est) => negocios.filter((n) => n.etapa === est.id).length
    );
    return sparklineFromCounts(buckets);
  }, [etapasKanban, negocios]);
  const temMais = negocios.length < total;

  useEffect(() => {
    const ids = negocios.map((n) => n.id);
    if (!ids.length) {
      setNotasMap((prev) => (prev.size === 0 ? prev : new Map()));
      return;
    }
    let cancelled = false;
    void loadNotasPreviewMap(supabase, { negocioIds: ids }).then((map) => {
      if (!cancelled) setNotasMap(map);
    });
    return () => {
      cancelled = true;
    };
  }, [negocios]);

  const colunasNegocios = useMemo((): CrmResizableColumn<Negocio>[] => {
    const etapaInfo = (negocio: Negocio) =>
      etapasKanban.find((e) => e.id === negocio.etapa);

    return [
      {
        id: "titulo",
        label: "Título",
        defaultWidth: 220,
        minWidth: 160,
        render: (negocio) => (
          <span className="font-semibold text-[#0b2210]">{negocio.titulo}</span>
        ),
      },
      {
        id: "codigo",
        label: "Código",
        defaultWidth: 120,
        minWidth: 90,
        render: (negocio) =>
          negocio.codigo ? crmTableIdBadge(negocio.codigo, "blue") : "—",
      },
      {
        id: "etapa",
        label: "Etapa",
        defaultWidth: 130,
        minWidth: 100,
        render: (negocio) => {
          const et = etapaInfo(negocio);
          if (!et) return "—";
          return crmTableStagePill(et.label, et.color);
        },
      },
      {
        id: "status",
        label: "Status",
        defaultWidth: 130,
        minWidth: 100,
        render: (negocio) => {
          const label = STATUS_LABEL[negocio.status] || negocio.status;
          const active = !["fechado_perdido", "cancelado"].includes(negocio.status);
          return crmTableStatusPill(label, active);
        },
      },
      {
        id: "valor",
        label: "Valor",
        defaultWidth: 110,
        minWidth: 80,
        align: "right",
        render: (negocio) =>
          moeda(negocio.valor_fechado ?? negocio.valor_estimado),
      },
      {
        id: "observacoes",
        label: "Observações",
        defaultWidth: 160,
        minWidth: 120,
        render: (negocio) => (
          <CrmTableNotesCell notas={notasParaNegocio(notasMap, negocio.id)} />
        ),
      },
      {
        id: "previsao",
        label: "Previsão",
        defaultWidth: 110,
        minWidth: 90,
        render: (negocio) => formatData(negocio.data_previsao_fechamento),
      },
      {
        id: "atualizado",
        label: "Atualizado",
        defaultWidth: 110,
        minWidth: 90,
        render: (negocio) => {
          const iso = negocio.atualizado_em ?? negocio.criado_em;
          if (!iso) return "—";
          return (
            <span className="text-[#6b8a76]" title={formatData(iso)}>
              {tempo(iso)}
            </span>
          );
        },
      },
    ];
  }, [etapasKanban, notasMap]);

  const abrirNegocio = useCallback((negocio: Negocio) => {
    setSelectedNegocioId(negocio.id);
    setSelectedNegocio({
      id: negocio.id,
      codigo: negocio.codigo,
      titulo: negocio.titulo,
      status: negocio.status,
      etapa: negocio.etapa,
      valor_estimado: negocio.valor_estimado,
      valor_fechado: negocio.valor_fechado,
      data_previsao_fechamento: negocio.data_previsao_fechamento,
      criado_em: negocio.criado_em,
      atualizado_em: negocio.atualizado_em,
    });
  }, []);

  const editarNegocio = useCallback(
    (negocio: Negocio) => {
      abrirNegocio(negocio);
    },
    [abrirNegocio]
  );

  const fecharNegocioSideover = useCallback(() => {
    setSelectedNegocioId(null);
    setSelectedNegocio(null);
  }, []);

  const onNegocioAtualizado = useCallback((updated: NegocioDetailData) => {
    setNegocios((prev) =>
      prev.map((n) =>
        n.id === updated.id
          ? {
              ...n,
              titulo: updated.titulo,
              status: updated.status,
              etapa: updated.etapa,
              valor_estimado: updated.valor_estimado,
              valor_fechado: updated.valor_fechado,
              data_previsao_fechamento: updated.data_previsao_fechamento,
              atualizado_em: updated.atualizado_em ?? n.atualizado_em,
            }
          : n
      )
    );
    setSelectedNegocio(updated);
  }, []);

  const negociosExportConfig = useMemo(
    () => ({
      filename: `negocios-${new Date().toISOString().slice(0, 10)}.csv`,
      headers: [
        "Título",
        "Código",
        "Etapa",
        "Status",
        "Valor",
        "Previsão",
        "Criado em",
      ],
      rowValues: (negocio: Negocio) => {
        const et = etapasKanban.find((e) => e.id === negocio.etapa);
        const valor = negocio.valor_fechado ?? negocio.valor_estimado;
        return [
          negocio.titulo,
          negocio.codigo || "",
          et?.label || negocio.etapa,
          STATUS_LABEL[negocio.status] || negocio.status,
          valor != null && valor > 0 ? String(valor) : "",
          formatData(negocio.data_previsao_fechamento),
          formatData(negocio.criado_em),
        ];
      },
    }),
    [etapasKanban]
  );

  const negociosFooterSummary =
    negociosFiltrados.length > 0
      ? `Exibindo 1-${negociosFiltrados.length} de ${total} negócios`
      : `Exibindo 0 de ${total} negócios`;

  const botaoNovoNegocio = useMemo(
    () => (
      <button
        type="button"
        onClick={() => setDrawerAberto(true)}
        style={crmHeaderPrimaryBtnStyle()}
      >
        + Novo negócio
      </button>
    ),
    []
  );

  useEffect(() => {
    if (isMobile) {
      setSlot(null);
      return;
    }
    setSlot({
      path: pathname,
      subtitle: `${total} negócios`,
      actions: botaoNovoNegocio,
    });
    return () => setSlot(null);
  }, [pathname, setSlot, total, isMobile, botaoNovoNegocio]);

  const pipelineToolbar = (
    <CrmPipelinePageToolbar
      pipelines={pipelines}
      activePipelineId={pipelineId}
      onSelectPipeline={setPipelineId}
      hidePipelines
      sectionLabel="FUNIL"
      view={view}
      onViewChange={setView}
      onOpenStages={() => setPipelineConfigOpen(true)}
    />
  );

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[#f8fcf6]">
      <NegocioFormDrawer
        open={drawerAberto}
        onClose={() => setDrawerAberto(false)}
        onSaved={(negocioId) => {
          void carregarLista(0, false);
          if (negocioId) {
            setSelectedNegocioId(negocioId);
            setSelectedNegocio(null);
          }
        }}
        pipelineId={pipelineAtivo?.id ?? null}
      />

      <PipelineConfigSideover
        open={pipelineConfigOpen}
        onClose={() => setPipelineConfigOpen(false)}
        tipo="negocio"
        pipelineId={pipelineId}
        onSelectPipeline={setPipelineId}
        showPipelineAdmin={false}
        onUpdated={() => {
          void carregarPipelines();
          void carregarLista(0, false);
        }}
      />

      {pipelineToolbar}

      {isMobile && (
        <div className="sticky top-0 z-20 shrink-0 border-b border-[#dcebd8] bg-[#ffffff] px-3 py-3">
          {botaoNovoNegocio}
        </div>
      )}

      <div className={`shrink-0 border-b border-[#dcebd8] bg-[#f8fcf6] py-3 ${crmRetrofitPageXClass}`}>
        <CrmMetricsGrid cols={4}>
          <CrmMetricCard
            label="Negócios"
            valor={total}
            tone="default"
            sub={`${negocios.length} carregados`}
            sparkline={etapaSparkline}
          />
          <CrmMetricCard
            label="Pipeline aberto"
            valor={moeda(pipelineTotal)}
            tone="success"
            sub="Fora de ganho/perdido"
            sparkline={sparklineFromSeed(Math.round(pipelineTotal / 1000) + 2)}
          />
          <CrmMetricCard
            label="Em negociação"
            valor={negociandoCount}
            tone="brand"
            sub="Etapa quente"
            sparkline={sparklineFromSeed(negociandoCount + 4)}
            trend={
              total > 0 && negociandoCount > 0
                ? { label: trendLabel(negociandoCount, total) ?? "—", positive: true }
                : undefined
            }
          />
          <CrmMetricCard
            label="Taxa de fechamento"
            valor={ganhosCount + perdidosCount > 0 ? `${Math.round((ganhosCount / (ganhosCount + perdidosCount)) * 100)}%` : "—"}
            tone="success"
            sub={`${ganhosCount} ganhos · ${perdidosCount} perdidos`}
            progress={{
              value: ganhosCount,
              max: Math.max(ganhosCount + perdidosCount, 1),
              hint: "Ganhos vs total fechado",
            }}
          />
        </CrmMetricsGrid>
      </div>

      <div className="flex-1 overflow-hidden">
        {carregando && negocios.length === 0 ? (
          <div className="flex h-full items-center justify-center px-4 text-sm text-[#5d7a67]">
            Carregando negócios...
          </div>
        ) : view === "kanban" ? (
          <CrmKanbanBoardScroll isMobile={isMobile}>
            {etapasKanban.map((est) => {
              const col = negocios.filter((n) => n.etapa === est.id);
              const totalCol = col.reduce(
                (s, n) => s + (n.valor_fechado ?? n.valor_estimado ?? 0),
                0
              );
              return (
                <CrmKanbanColumn
                  key={est.id}
                  stageId={est.id}
                  label={est.label}
                  color={est.color}
                  count={col.length}
                  totalValue={totalCol > 0 ? moeda(totalCol) : null}
                  dragOver={dragOver === est.id}
                  isMobile={isMobile}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(est.id);
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const id = e.dataTransfer.getData("negocioId");
                    if (id) void moverEtapa(id, est.id, { optimistic: true });
                    setDragId(null);
                    setDragOver(null);
                  }}
                >
                    {col.map((negocio) => (
                      <NegocioKanbanCard
                        key={negocio.id}
                        negocio={{ ...negocio, etapa_label: est.label }}
                        notas={notasParaNegocio(notasMap, negocio.id)}
                        stageColor={est.color}
                        dragging={dragId === negocio.id}
                        draggable={!isMobile}
                        onDragStart={(e) => {
                          e.dataTransfer.setData("negocioId", negocio.id);
                          setDragId(negocio.id);
                        }}
                        onDragEnd={() => {
                          setDragId(null);
                          setDragOver(null);
                        }}
                        onOpen={() => abrirNegocio(negocio)}
                        onEdit={() => abrirNegocio(negocio)}
                      />
                    ))}
                    {col.length === 0 ? (
                      <p className="py-4 text-center text-xs text-[#484f58]">vazio</p>
                    ) : null}
                </CrmKanbanColumn>
              );
            })}
          </CrmKanbanBoardScroll>
        ) : (
          <div className={`h-full overflow-y-auto pb-4 pt-3 ${crmRetrofitPageXClass}`}>
            <CrmRetrofitTablePanel
              tableId="crm-negocios-lista"
              columns={colunasNegocios}
              rows={negociosFiltrados}
              rowKey={(negocio) => negocio.id}
              emptyMessage="Nenhum negócio encontrado"
              footerSummary={negociosFooterSummary}
              onRowClick={abrirNegocio}
              onEditRow={editarNegocio}
              onViewRow={abrirNegocio}
              exportConfig={negociosExportConfig}
              toolbar={{
                searchValue: busca,
                onSearchChange: setBusca,
                searchPlaceholder: "Buscar título ou código…",
                showAdvancedFilters,
                onToggleAdvancedFilters: () => setShowAdvancedFilters((v) => !v),
                advancedFilters: (
                  <CrmRetrofitAdvancedFiltersGrid>
                    <CrmRetrofitFilterField label="Etapa">
                      <select
                        value={etapa}
                        onChange={(e) => setEtapa(e.target.value)}
                        className={crmRetrofitFilterSelectClass}
                      >
                        <option value="">Todas as etapas</option>
                        {etapasKanban.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.label}
                          </option>
                        ))}
                      </select>
                    </CrmRetrofitFilterField>
                    <CrmRetrofitFilterField label="Status">
                      <select
                        value={filtroStatus}
                        onChange={(e) => setFiltroStatus(e.target.value)}
                        className={crmRetrofitFilterSelectClass}
                      >
                        <option value="">Todos os status</option>
                        {Object.entries(STATUS_LABEL).map(([id, label]) => (
                          <option key={id} value={id}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </CrmRetrofitFilterField>
                    <CrmRetrofitFilterField label="Criado a partir de">
                      <input
                        type="date"
                        value={filtroDataInicio}
                        onChange={(e) => setFiltroDataInicio(e.target.value)}
                        className={crmRetrofitFilterInputClass}
                      />
                    </CrmRetrofitFilterField>
                    <CrmRetrofitFilterField label="Criado até">
                      <input
                        type="date"
                        value={filtroDataFim}
                        onChange={(e) => setFiltroDataFim(e.target.value)}
                        className={crmRetrofitFilterInputClass}
                      />
                    </CrmRetrofitFilterField>
                  </CrmRetrofitAdvancedFiltersGrid>
                ),
              }}
              footer={
                temMais ? (
                  <button
                    type="button"
                    onClick={() => void carregarLista(offset, true)}
                    disabled={carregandoMais}
                    className="rounded-lg border border-[#dcebd8] bg-white px-4 py-1.5 text-xs font-semibold text-[#5d7a67] disabled:opacity-50"
                  >
                    {carregandoMais
                      ? "Carregando..."
                      : `Carregar mais (${total - negocios.length} restantes)`}
                  </button>
                ) : undefined
              }
            />
          </div>
        )}
      </div>

      <NegocioDetailSideover
        open={!!selectedNegocioId}
        negocioId={selectedNegocioId}
        negocio={selectedNegocio}
        etapas={etapasKanban}
        onClose={fecharNegocioSideover}
        onUpdated={onNegocioAtualizado}
      />
    </div>
  );
}
