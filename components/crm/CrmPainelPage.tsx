"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { ContaSectionTabs } from "@/components/crm/ContaSectionTabs";
import { CrmPainelRelatorioBuilderSideover } from "@/components/crm/CrmPainelRelatorioBuilderSideover";
import { CrmPainelRelatorioPanel } from "@/components/crm/CrmPainelRelatorioPanel";
import { CrmPainelMetricsRow } from "@/components/crm/painel/CrmPainelMetricsRow";
import { CrmPainelTabCharts } from "@/components/crm/painel/CrmPainelTabCharts";
import { CrmPainelChartsSkeleton } from "@/components/crm/painel/CrmPainelSkeleton";
import { CrmPainelViewToolbar } from "@/components/crm/painel/CrmPainelViewToolbar";
import { useCrmDashboard } from "@/hooks/useCrmDashboard";
import { useCrmPainelAnalytics } from "@/hooks/useCrmPainelAnalytics";
import { FILTROS_PAINEL_VAZIOS, type CrmPainelFiltros } from "@/lib/crm/painel-filtros";
import {
  customRelatorioId,
  kpisForPainelTab,
  loadRelatoriosPersonalizados,
  PAINEL_TABS,
  painelTabById,
  parseCustomRelatorioId,
  parsePainelTabId,
  saveRelatoriosPersonalizados,
  type PainelRelatorioCustom,
  type PainelTabId,
} from "@/lib/crm/painel-tabs";
import {
  painelSuportaGraficos,
  parsePainelViewMode,
  type PainelViewMode,
} from "@/lib/crm/painel-view";
import type { AnalyticsPeriodo } from "@/lib/crm/analytics-period";
import type { RelatorioEntidade } from "@/lib/crm/relatorio-views-catalog";
import { viewIdFromEntidade } from "@/lib/crm/relatorio-views-catalog";

export function CrmPainelPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dash = useCrmDashboard();

  const tabFromUrl = parsePainelTabId(searchParams.get("tab"));
  const [tabAtiva, setTabAtiva] = useState<PainelTabId>(tabFromUrl);
  const tabDef = painelTabById(tabAtiva);

  const viewFromUrl = parsePainelViewMode(searchParams.get("view"), tabAtiva);
  const [viewMode, setViewMode] = useState<PainelViewMode>(viewFromUrl);
  const [periodo, setPeriodo] = useState<AnalyticsPeriodo>("7d");

  const analytics = useCrmPainelAnalytics(periodo);
  const mostrarGraficos = viewMode === "paineis" && painelSuportaGraficos(tabAtiva);

  const reportFromUrl = searchParams.get("relatorio");
  const customId = parseCustomRelatorioId(reportFromUrl);
  const isCustomReport = tabAtiva === "personalizado" && Boolean(customId);

  const [relatorioAtivo, setRelatorioAtivo] = useState<RelatorioEntidade>(tabDef.defaultReport);
  const [filtros, setFiltros] = useState<CrmPainelFiltros>(FILTROS_PAINEL_VAZIOS);
  const [relatoriosCustom, setRelatoriosCustom] = useState<PainelRelatorioCustom[]>([]);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editandoRelatorio, setEditandoRelatorio] = useState<PainelRelatorioCustom | null>(null);

  const relatorioCustomAtivo = useMemo(
    () => (customId ? relatoriosCustom.find((r) => r.id === customId) ?? null : null),
    [customId, relatoriosCustom]
  );

  useEffect(() => {
    setRelatoriosCustom(loadRelatoriosPersonalizados());
  }, []);

  useEffect(() => {
    setTabAtiva(tabFromUrl);
  }, [tabFromUrl]);

  useEffect(() => {
    setViewMode(parsePainelViewMode(searchParams.get("view"), tabFromUrl));
  }, [searchParams, tabFromUrl]);

  useEffect(() => {
    if (isCustomReport && relatorioCustomAtivo) {
      setFiltros(relatorioCustomAtivo.filtros);
      return;
    }
    const tab = painelTabById(tabAtiva);
    if (tabAtiva === "personalizado") return;
    const validReport = tab.reports.find((r) => r.id === reportFromUrl);
    setRelatorioAtivo(validReport?.id ?? tab.defaultReport);
    setFiltros(FILTROS_PAINEL_VAZIOS);
  }, [tabAtiva, reportFromUrl, isCustomReport, relatorioCustomAtivo]);

  const atualizarUrl = useCallback(
    (patch: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v == null || v === "") params.delete(k);
        else params.set(k, v);
      }
      router.replace(`/crm/painel?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  const navegarTab = useCallback(
    (tabId: PainelTabId) => {
      const tab = painelTabById(tabId);
      const params = new URLSearchParams();
      params.set("tab", tabId);
      params.set("view", tabId === "personalizado" ? "tabela" : viewMode);
      if (tabId === "personalizado") {
        const first = relatoriosCustom[0];
        if (first) params.set("relatorio", customRelatorioId(first.id));
      } else {
        params.set("relatorio", tab.defaultReport);
      }
      router.replace(`/crm/painel?${params.toString()}`, { scroll: false });
    },
    [router, relatoriosCustom, viewMode]
  );

  const navegarView = useCallback(
    (mode: PainelViewMode) => {
      setViewMode(mode);
      atualizarUrl({ view: mode });
    },
    [atualizarUrl]
  );

  const navegarRelatorio = useCallback(
    (entidade: RelatorioEntidade) => {
      atualizarUrl({ tab: tabAtiva, relatorio: entidade });
    },
    [atualizarUrl, tabAtiva]
  );

  const navegarRelatorioCustom = useCallback(
    (rel: PainelRelatorioCustom) => {
      const params = new URLSearchParams();
      params.set("tab", "personalizado");
      params.set("view", "tabela");
      params.set("relatorio", customRelatorioId(rel.id));
      router.replace(`/crm/painel?${params.toString()}`, { scroll: false });
    },
    [router]
  );

  const kpis = useMemo(() => kpisForPainelTab(tabAtiva, dash), [tabAtiva, dash]);

  function persistirRelatorios(next: PainelRelatorioCustom[]) {
    setRelatoriosCustom(next);
    saveRelatoriosPersonalizados(next);
  }

  function handleSalvarRelatorio(rel: PainelRelatorioCustom) {
    const exists = relatoriosCustom.some((r) => r.id === rel.id);
    const next = exists
      ? relatoriosCustom.map((r) => (r.id === rel.id ? rel : r))
      : [rel, ...relatoriosCustom].slice(0, 30);
    persistirRelatorios(next);
    navegarRelatorioCustom(rel);
  }

  function removerRelatorio(id: string) {
    const next = relatoriosCustom.filter((r) => r.id !== id);
    persistirRelatorios(next);
    if (customId === id) {
      if (next[0]) navegarRelatorioCustom(next[0]);
      else router.replace("/crm/painel?tab=personalizado&view=tabela", { scroll: false });
    }
  }

  function abrirNovoRelatorio() {
    setEditandoRelatorio(null);
    setBuilderOpen(true);
  }

  function abrirEditarRelatorio(rel: PainelRelatorioCustom) {
    setEditandoRelatorio(rel);
    setBuilderOpen(true);
  }

  return (
    <div className="flex min-h-full flex-col bg-[#f8fcf6]">
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        {dash.erro ? (
          <div
            className="mb-4 rounded-xl border border-[#f8514966] bg-[#fff5f5] px-4 py-3 text-sm text-[#b91c1c]"
            role="alert"
          >
            {dash.erro}
            <button
              type="button"
              onClick={() => dash.recarregar()}
              className="ml-2 text-xs font-bold underline"
            >
              Tentar novamente
            </button>
          </div>
        ) : null}

        <CrmPainelMetricsRow kpis={kpis} loading={dash.loading} />

        <div className="w-full min-w-0 rounded-2xl border border-[#dcebd8] bg-white shadow-[0_2px_8px_rgba(11,31,16,0.05)]">
          <ContaSectionTabs
            tabs={PAINEL_TABS.map((t) => ({ id: t.id, label: t.label }))}
            activeId={tabAtiva}
            onSelect={(id) => navegarTab(id as PainelTabId)}
          />

          <CrmPainelViewToolbar
            description={tabDef.description}
            viewMode={viewMode}
            onViewModeChange={navegarView}
            showViewToggle={painelSuportaGraficos(tabAtiva)}
            periodo={periodo}
            onPeriodoChange={setPeriodo}
            showPeriodo={painelSuportaGraficos(tabAtiva)}
            onRefresh={mostrarGraficos ? () => void analytics.recarregar() : undefined}
            refreshing={analytics.carregando}
            dark={false}
          />

          {mostrarGraficos ? (
            <>
              {analytics.erro && !analytics.carregando ? (
                <div
                  className="mx-4 mb-4 rounded-xl border border-[#f8514966] bg-[#fff5f5] px-4 py-3 text-sm text-[#b91c1c]"
                  role="alert"
                >
                  {analytics.erro}
                  <button
                    type="button"
                    onClick={() => void analytics.recarregar()}
                    className="ml-2 text-xs font-bold underline"
                  >
                    Tentar novamente
                  </button>
                </div>
              ) : null}

              {analytics.carregando ? (
                <CrmPainelChartsSkeleton tabId={tabAtiva} />
              ) : analytics.data ? (
                <CrmPainelTabCharts tabId={tabAtiva} data={analytics.data} periodo={periodo} />
              ) : null}
            </>
          ) : null}

          {!mostrarGraficos ? (
            <>
              {tabAtiva === "personalizado" ? (
                <>
                  <div className="flex flex-wrap items-center gap-2 border-t border-[#eef5ec] px-4 py-3">
                    <button
                      type="button"
                      onClick={abrirNovoRelatorio}
                      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold"
                      style={{ background: "#0b1f10", color: "#92ff00" }}
                    >
                      <Plus size={13} />
                      Novo relatório
                    </button>
                    {relatoriosCustom.map((rel) => (
                      <div key={rel.id} className="inline-flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => navegarRelatorioCustom(rel)}
                          className="rounded-l-lg px-3 py-1.5 text-xs font-bold transition-colors"
                          style={{
                            background: customId === rel.id ? "#dcebd8" : "#eef7eb",
                            color: customId === rel.id ? "#0b2210" : "#5d7a67",
                            borderTop: `1px solid ${customId === rel.id ? "#c9a24a66" : "#dcebd8"}`,
                            borderBottom: `1px solid ${customId === rel.id ? "#c9a24a66" : "#dcebd8"}`,
                            borderLeft: `1px solid ${customId === rel.id ? "#c9a24a66" : "#dcebd8"}`,
                            borderRight: "none",
                          }}
                        >
                          {rel.titulo}
                        </button>
                        <button
                          type="button"
                          onClick={() => abrirEditarRelatorio(rel)}
                          className="border border-[#dcebd8] bg-[#eef7eb] px-2 py-1.5 text-[#5d7a67]"
                          title="Editar"
                        >
                          <Pencil size={11} />
                        </button>
                        <button
                          type="button"
                          onClick={() => removerRelatorio(rel.id)}
                          className="rounded-r-lg border border-[#fecaca] bg-[#fff5f5] px-2 py-1.5 text-[#b91c1c]"
                          title="Remover"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    ))}
                  </div>

                  {!relatorioCustomAtivo ? (
                    <div className="px-4 py-12 text-center">
                      <p className="text-sm font-semibold text-[#0b2210]">Monte seu primeiro relatório</p>
                      <p className="mt-2 text-xs text-[#5d7a67]">
                        Clique em <strong>Novo relatório</strong> para escolher fonte de dados, filtros e
                        colunas no painel lateral.
                      </p>
                      <button
                        type="button"
                        onClick={abrirNovoRelatorio}
                        className="mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold"
                        style={{ background: "#0b1f10", color: "#92ff00" }}
                      >
                        <Plus size={14} />
                        Novo relatório
                      </button>
                    </div>
                  ) : (
                    <CrmPainelRelatorioPanel
                      viewId={relatorioCustomAtivo.viewId}
                      filtros={relatorioCustomAtivo.filtros}
                      onFiltrosChange={(f) => {
                        const updated = { ...relatorioCustomAtivo, filtros: f };
                        persistirRelatorios(
                          relatoriosCustom.map((r) => (r.id === updated.id ? updated : r))
                        );
                      }}
                      tableIdSuffix={`custom-${relatorioCustomAtivo.id}`}
                      colunasVisiveis={relatorioCustomAtivo.colunas}
                      readOnlyFiltros={false}
                      onEditFiltros={() => abrirEditarRelatorio(relatorioCustomAtivo)}
                    />
                  )}
                </>
              ) : (
                <>
                  {tabDef.reports.length > 1 ? (
                    <div className="flex flex-wrap gap-2 border-t border-[#eef5ec] px-4 py-3">
                      {tabDef.reports.map((rep) => (
                        <button
                          key={rep.id}
                          type="button"
                          onClick={() => navegarRelatorio(rep.id)}
                          className="rounded-lg px-3 py-1.5 text-xs font-bold transition-colors"
                          style={{
                            background: relatorioAtivo === rep.id ? "#dcebd8" : "#eef7eb",
                            color: relatorioAtivo === rep.id ? "#0b2210" : "#5d7a67",
                            border: `1px solid ${relatorioAtivo === rep.id ? "#c9a24a66" : "#dcebd8"}`,
                          }}
                        >
                          {rep.label}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  <CrmPainelRelatorioPanel
                    viewId={viewIdFromEntidade(relatorioAtivo)}
                    filtros={filtros}
                    onFiltrosChange={setFiltros}
                    tableIdSuffix={tabAtiva}
                  />
                </>
              )}
            </>
          ) : null}
        </div>
      </div>

      <CrmPainelRelatorioBuilderSideover
        open={builderOpen}
        onClose={() => {
          setBuilderOpen(false);
          setEditandoRelatorio(null);
        }}
        initial={editandoRelatorio}
        onSave={handleSalvarRelatorio}
      />
    </div>
  );
}
