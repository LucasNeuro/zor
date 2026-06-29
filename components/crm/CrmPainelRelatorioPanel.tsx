"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Pencil, RefreshCw, Search, SlidersHorizontal } from "lucide-react";
import {
  CrmResizableDataTable,
  type CrmResizableColumn,
} from "@/components/crm/CrmResizableDataTable";
import {
  formatarCelulaRelatorio,
  labelColunaRelatorio,
} from "@/lib/crm/relatorios-data";
import type { RelatorioViewId } from "@/lib/crm/relatorio-views-catalog";
import { resolveRelatorioViewId } from "@/lib/crm/relatorio-views-catalog";
import {
  PAINEL_ESTAGIOS_UI,
  PAINEL_PERIODOS_UI,
  rowMatchesPainelFiltros,
  type CrmPainelFiltros,
} from "@/lib/crm/painel-filtros";
import { CrmPainelTableSkeleton } from "@/components/crm/painel/CrmPainelSkeleton";
import { crmFetch } from "@/lib/internal-api-headers-client";

type RelatorioJson = {
  viewId: string;
  headers: string[];
  rows: Record<string, unknown>[];
  total: number;
  aviso?: string;
};

type Props = {
  viewId: RelatorioViewId | string;
  filtros: CrmPainelFiltros;
  onFiltrosChange: (next: CrmPainelFiltros) => void;
  tableIdSuffix: string;
  colunasVisiveis?: string[];
  onEditFiltros?: () => void;
  readOnlyFiltros?: boolean;
};

function larguraPadraoColuna(header: string): number {
  const h = header.toLowerCase();
  if (h.includes("data") || h.endsWith("_em") || h.includes("criado") || h.includes("atualizado")) {
    return 132;
  }
  if (h.includes("email") || h.includes("descricao") || h.includes("conteudo") || h.includes("observ")) {
    return 200;
  }
  if (h.includes("nome") || h.includes("titulo") || h.includes("endereco")) return 168;
  if (h.includes("valor") || h.includes("preco") || h.includes("total")) return 112;
  if (h.includes("id") || h.includes("slug") || h.includes("status")) return 120;
  return 140;
}

export type { CrmPainelFiltros };

export function CrmPainelRelatorioPanel({
  viewId: viewIdRaw,
  filtros,
  onFiltrosChange,
  tableIdSuffix,
  colunasVisiveis,
  onEditFiltros,
  readOnlyFiltros,
}: Props) {
  const [dataset, setDataset] = useState<RelatorioJson | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const viewId = resolveRelatorioViewId(viewIdRaw);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const params = new URLSearchParams({
        view_id: viewId,
        format: "json",
      });
      if (colunasVisiveis?.length) {
        params.set("colunas", colunasVisiveis.join(","));
      }
      const res = await crmFetch(`/api/crm/relatorios/export?${params.toString()}`);
      const json = (await res.json().catch(() => ({}))) as RelatorioJson & { error?: string };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setDataset(json);
    } catch (e) {
      setDataset(null);
      setErro(e instanceof Error ? e.message : "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, [viewId, colunasVisiveis]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const rowsFiltradas = useMemo(() => {
    const rows = dataset?.rows ?? [];
    return rows.filter((row) => rowMatchesPainelFiltros(row, filtros));
  }, [dataset?.rows, filtros]);

  const headersAtivos = useMemo(() => {
    const all = dataset?.headers ?? [];
    if (!colunasVisiveis?.length) return all;
    return all.filter((h) => colunasVisiveis.includes(h));
  }, [dataset?.headers, colunasVisiveis]);

  const linhasTabela = useMemo(
    () =>
      rowsFiltradas.map((row, i) => ({
        _key: `${viewId}-${i}`,
        data: row,
      })),
    [rowsFiltradas, viewId]
  );

  const colunas = useMemo((): CrmResizableColumn<{ _key: string; data: Record<string, unknown> }>[] => {
    return headersAtivos.map((h) => ({
      id: h,
      label: labelColunaRelatorio(h),
      defaultWidth: larguraPadraoColuna(h),
      minWidth: 72,
      render: (linha) => (
        <span title={String(linha.data[h] ?? "")}>{formatarCelulaRelatorio(h, linha.data[h])}</span>
      ),
    }));
  }, [headersAtivos]);

  function exportarCsv() {
    const params = new URLSearchParams({ view_id: viewId, format: "csv" });
    if (colunasVisiveis?.length) params.set("colunas", colunasVisiveis.join(","));
    const url = `/api/crm/relatorios/export?${params.toString()}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  const filterFields = readOnlyFiltros ? (
    <div className="flex flex-wrap items-center gap-2 text-xs text-[#5d7a67]">
      <span className="rounded-lg bg-[#eef7eb] px-2 py-1">
        Período: {PAINEL_PERIODOS_UI.find((p) => p.value === filtros.periodo)?.label ?? filtros.periodo}
      </span>
      {filtros.estagio ? (
        <span className="rounded-lg bg-[#eef7eb] px-2 py-1">Estágio: {filtros.estagio}</span>
      ) : null}
      {filtros.status ? (
        <span className="rounded-lg bg-[#eef7eb] px-2 py-1">Status: {filtros.status}</span>
      ) : null}
      {filtros.origem ? (
        <span className="rounded-lg bg-[#eef7eb] px-2 py-1">Origem: {filtros.origem}</span>
      ) : null}
      {filtros.search ? (
        <span className="rounded-lg bg-[#eef7eb] px-2 py-1">Busca: {filtros.search}</span>
      ) : null}
      {onEditFiltros ? (
        <button
          type="button"
          onClick={onEditFiltros}
          className="inline-flex items-center gap-1 rounded-lg border border-[#d4ecd0] px-2.5 py-1 font-bold text-[#0f6b4f]"
        >
          <Pencil size={11} />
          Editar filtros
        </button>
      ) : null}
    </div>
  ) : (
    <>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto_auto_auto]">
        <div className="flex h-10 items-center gap-2 rounded-xl border border-[#d4ecd0] bg-white px-3">
          <Search size={14} className="text-[#6b8a76]" />
          <input
            value={filtros.search}
            onChange={(e) => onFiltrosChange({ ...filtros, search: e.target.value })}
            placeholder="Buscar nos resultados..."
            className="w-full bg-transparent text-sm text-[#1e3a23] outline-none placeholder:text-[#90a89b]"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#d4ecd0] bg-white px-3 text-xs font-semibold text-[#1e4a24]"
        >
          <SlidersHorizontal size={13} />
          Filtros
        </button>
        <button
          type="button"
          onClick={() => void carregar()}
          disabled={loading}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#d4ecd0] bg-white px-3 text-xs font-semibold text-[#1e4a24] disabled:opacity-50"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          Atualizar
        </button>
        <button
          type="button"
          onClick={exportarCsv}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#d4ecd0] bg-white px-3 text-xs font-semibold text-[#1e4a24]"
        >
          <Download size={13} />
          Exportar
        </button>
      </div>
      {showAdvanced ? (
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#89a095]">Período</span>
            <select
              value={filtros.periodo}
              onChange={(e) =>
                onFiltrosChange({
                  ...filtros,
                  periodo: e.target.value as CrmPainelFiltros["periodo"],
                })
              }
              className="h-10 w-full rounded-xl border border-[#d4ecd0] bg-white px-3 text-sm text-[#1e4a24]"
            >
              {PAINEL_PERIODOS_UI.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#89a095]">
              Estágio / etapa
            </span>
            <select
              value={filtros.estagio}
              onChange={(e) => onFiltrosChange({ ...filtros, estagio: e.target.value })}
              className="h-10 w-full rounded-xl border border-[#d4ecd0] bg-white px-3 text-sm text-[#1e4a24]"
            >
              {PAINEL_ESTAGIOS_UI.map((opt) => (
                <option key={opt.value || "all"} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#89a095]">Status</span>
            <input
              value={filtros.status}
              onChange={(e) => onFiltrosChange({ ...filtros, status: e.target.value })}
              placeholder="Ex.: aberto"
              className="h-10 w-full rounded-xl border border-[#d4ecd0] bg-white px-3 text-sm text-[#1e4a24]"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#89a095]">Origem</span>
            <input
              value={filtros.origem}
              onChange={(e) => onFiltrosChange({ ...filtros, origem: e.target.value })}
              placeholder="Ex.: whatsapp"
              className="h-10 w-full rounded-xl border border-[#d4ecd0] bg-white px-3 text-sm text-[#1e4a24]"
            />
          </label>
        </div>
      ) : null}
    </>
  );

  return (
    <div className="flex min-h-0 flex-col">
      {loading ? (
        <CrmPainelTableSkeleton />
      ) : (
        <>
          <div className="shrink-0 border-b border-[#eef5ec] px-4 py-3">{filterFields}</div>

          {erro ? (
            <div className="mx-4 mt-4 shrink-0 rounded-lg border border-[#f8514966] bg-[#fff5f5] px-3 py-3 text-sm text-[#b91c1c]">
              {erro}
              <button type="button" onClick={() => void carregar()} className="ml-2 text-xs font-bold underline">
                Tentar novamente
              </button>
            </div>
          ) : null}

          {!erro && dataset?.aviso ? (
            <div className="mx-4 mt-4 shrink-0 rounded-lg border border-[#d2992266] bg-[#fffbeb] px-3 py-3 text-xs leading-relaxed text-[#8a6d1a]">
              {dataset.aviso}
            </div>
          ) : null}

          <div className="flex min-h-[min(62vh,560px)] min-w-0 flex-1 flex-col px-2 pb-4 pt-2">
            <div className="mb-2 flex shrink-0 flex-wrap items-center justify-between gap-2 px-2">
              <p className="m-0 text-[10px] text-[#6e7681]">
                {`${rowsFiltradas.length} de ${dataset?.total ?? 0} registo(s)`}
              </p>
              <p className="m-0 text-[10px] text-[#89a095]">
                Scroll na tabela · arraste a borda da coluna para ajustar · duplo clique restaura
              </p>
            </div>

            {linhasTabela.length === 0 && !dataset?.aviso ? (
              <p className="py-12 text-center text-sm text-[#5d7a67]">Nenhum registo encontrado.</p>
            ) : colunas.length > 0 ? (
              <div
                className="min-h-0 flex-1 overflow-hidden rounded-lg border border-[#dcebd8] bg-white"
                style={{ minHeight: 320 }}
              >
                <CrmResizableDataTable
                  tableId={`crm-painel-${tableIdSuffix}-${viewId}`}
                  variant="waje"
                  columns={colunas}
                  rows={linhasTabela}
                  rowKey={(linha) => linha._key}
                  maxHeight="100%"
                  className="h-full border-t-0 text-xs"
                  rowCellClassName="px-3 py-2 align-top text-[#0b2210]"
                  getRowStyle={() => ({ borderBottom: "1px solid #eef7eb" })}
                />
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
