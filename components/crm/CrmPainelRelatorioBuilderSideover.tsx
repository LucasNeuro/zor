"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Save } from "lucide-react";
import { CrmSideoverShell } from "@/components/crm/CrmSideoverShell";
import { CrmRelatorioViewPicker } from "@/components/crm/CrmRelatorioViewPicker";
import { CrmRelatorioColunasPicker } from "@/components/crm/CrmRelatorioColunasPicker";
import {
  FILTROS_PAINEL_VAZIOS,
  PAINEL_ESTAGIOS_UI,
  PAINEL_PERIODOS_UI,
  type CrmPainelFiltros,
} from "@/lib/crm/painel-filtros";
import {
  RF_LABEL_STYLE,
  RF_SECTION_STYLE,
  rfInputStyle,
  rfLabelStyle,
} from "@/lib/crm/crm-retrofit-dark-theme";
import {
  relatorioViewById,
  resolveRelatorioViewId,
  type RelatorioViewId,
} from "@/lib/crm/relatorio-views-catalog";
import type { PainelRelatorioCustom } from "@/lib/crm/painel-tabs";
import { crmFetch } from "@/lib/internal-api-headers-client";

type ColunasMeta = {
  disponiveis: string[];
  recomendadas: string[];
  aviso?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  initial?: PainelRelatorioCustom | null;
  onSave: (relatorio: PainelRelatorioCustom) => void;
};

export function CrmPainelRelatorioBuilderSideover({ open, onClose, initial, onSave }: Props) {
  const [titulo, setTitulo] = useState("");
  const [viewId, setViewId] = useState<RelatorioViewId>("vw_rel_leads_enriquecidos");
  const [filtros, setFiltros] = useState<CrmPainelFiltros>(FILTROS_PAINEL_VAZIOS);
  const [colunasMeta, setColunasMeta] = useState<ColunasMeta>({ disponiveis: [], recomendadas: [] });
  const [colunas, setColunas] = useState<string[]>([]);
  const [loadingColunas, setLoadingColunas] = useState(false);

  const viewDef = useMemo(() => relatorioViewById(viewId), [viewId]);
  const filtrosDisponiveis = viewDef?.filtros ?? ["search", "periodo"];

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setTitulo(initial.titulo);
      setViewId(initial.viewId ?? resolveRelatorioViewId(initial.entidade));
      setFiltros(initial.filtros);
    } else {
      setTitulo("");
      setViewId("vw_rel_leads_enriquecidos");
      setFiltros(FILTROS_PAINEL_VAZIOS);
      setColunas([]);
    }
  }, [open, initial]);

  const carregarColunas = useCallback(
    async (vid: RelatorioViewId) => {
      setLoadingColunas(true);
      try {
        const res = await crmFetch(
          `/api/crm/relatorios/columns?view_id=${encodeURIComponent(vid)}`
        );
        const json = (await res.json().catch(() => ({}))) as ColunasMeta & { error?: string };
        const disponiveis = Array.isArray(json.disponiveis) ? json.disponiveis : [];
        const recomendadas = Array.isArray(json.recomendadas)
          ? json.recomendadas
          : relatorioViewById(vid)?.colunas ?? [];
        setColunasMeta({ disponiveis, recomendadas, aviso: json.aviso });

        const initialVid = initial?.viewId ?? resolveRelatorioViewId(initial?.entidade);
        if (initial && initialVid === vid && initial.colunas.length > 0) {
          setColunas(initial.colunas.filter((c) => disponiveis.includes(c)));
        } else if (initial && initialVid === vid && initial.colunas.length === 0) {
          setColunas(recomendadas.filter((c) => disponiveis.includes(c)));
        } else {
          setColunas(recomendadas.filter((c) => disponiveis.includes(c)));
        }
      } catch {
        const fallback = relatorioViewById(vid)?.colunas ?? [];
        setColunasMeta({ disponiveis: fallback, recomendadas: fallback });
        setColunas(fallback);
      } finally {
        setLoadingColunas(false);
      }
    },
    [initial]
  );

  useEffect(() => {
    if (!open) return;
    void carregarColunas(viewId);
  }, [open, viewId, carregarColunas]);

  function handleSave() {
    if (colunas.length === 0) return;
    const tituloFinal = titulo.trim() || viewDef?.label || viewId;
    const todasSelecionadas =
      colunas.length === colunasMeta.disponiveis.length && colunasMeta.disponiveis.length > 0;
    const rel: PainelRelatorioCustom = {
      id: initial?.id ?? `rel_${Date.now()}`,
      titulo: tituloFinal,
      viewId,
      filtros: { ...filtros },
      colunas: todasSelecionadas ? [] : colunas,
      criadoEm: initial?.criadoEm ?? new Date().toISOString(),
    };
    onSave(rel);
    onClose();
  }

  if (!open) return null;

  return (
    <CrmSideoverShell
      open={open}
      onClose={onClose}
      title={initial ? "Editar relatório" : "Novo relatório personalizado"}
      subtitle="Escolha a fonte, filtros e colunas — monte o relatório do seu jeito."
      width={680}
      footer={
        <button
          type="button"
          onClick={handleSave}
          disabled={colunas.length === 0 || loadingColunas}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-45"
          style={{ background: "#0b1f10", color: "#92ff00", border: "1px solid rgba(63, 152, 72, 0.42)" }}
        >
          <Save size={16} />
          {initial ? "Guardar alterações" : "Criar relatório"}
        </button>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <label style={rfLabelStyle()}>Nome do relatório</label>
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex.: Leads qualificados últimos 30 dias"
            style={rfInputStyle()}
          />
        </div>

        <div style={RF_SECTION_STYLE}>
          <p style={{ ...RF_LABEL_STYLE, marginBottom: 10 }}>Fonte de dados</p>
          <CrmRelatorioViewPicker value={viewId} onChange={setViewId} />
        </div>

        <div style={RF_SECTION_STYLE}>
          <p style={{ ...RF_LABEL_STYLE, marginBottom: 10 }}>Filtros</p>
          <div className="flex flex-col gap-3">
            {filtrosDisponiveis.includes("search") ? (
              <div>
                <label style={{ ...rfLabelStyle(), fontSize: 10 }}>Busca textual</label>
                <input
                  value={filtros.search}
                  onChange={(e) => setFiltros((f) => ({ ...f, search: e.target.value }))}
                  placeholder="Filtrar em todas as colunas..."
                  style={rfInputStyle()}
                />
              </div>
            ) : null}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {filtrosDisponiveis.includes("periodo") ? (
                <div>
                  <label style={{ ...rfLabelStyle(), fontSize: 10 }}>Período</label>
                  <select
                    value={filtros.periodo}
                    onChange={(e) =>
                      setFiltros((f) => ({
                        ...f,
                        periodo: e.target.value as CrmPainelFiltros["periodo"],
                      }))
                    }
                    style={rfInputStyle()}
                  >
                    {PAINEL_PERIODOS_UI.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              {filtrosDisponiveis.includes("estagio") ? (
                <div>
                  <label style={{ ...rfLabelStyle(), fontSize: 10 }}>Estágio / etapa</label>
                  <select
                    value={filtros.estagio}
                    onChange={(e) => setFiltros((f) => ({ ...f, estagio: e.target.value }))}
                    style={rfInputStyle()}
                  >
                    {PAINEL_ESTAGIOS_UI.map((s) => (
                      <option key={s.value || "all"} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              {filtrosDisponiveis.includes("status") ? (
                <div>
                  <label style={{ ...rfLabelStyle(), fontSize: 10 }}>Status</label>
                  <input
                    value={filtros.status}
                    onChange={(e) => setFiltros((f) => ({ ...f, status: e.target.value }))}
                    placeholder="Ex.: aberto, pronto..."
                    style={rfInputStyle()}
                  />
                </div>
              ) : null}
              {filtrosDisponiveis.includes("origem") ? (
                <div>
                  <label style={{ ...rfLabelStyle(), fontSize: 10 }}>Origem</label>
                  <input
                    value={filtros.origem}
                    onChange={(e) => setFiltros((f) => ({ ...f, origem: e.target.value }))}
                    placeholder="Ex.: whatsapp, site..."
                    style={rfInputStyle()}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div style={RF_SECTION_STYLE}>
          <p style={{ ...RF_LABEL_STYLE, marginBottom: 10 }}>Colunas da tabela</p>
          <CrmRelatorioColunasPicker
            disponiveis={colunasMeta.disponiveis}
            recomendadas={colunasMeta.recomendadas}
            selecionadas={colunas}
            onChange={setColunas}
            loading={loadingColunas}
          />
        </div>
      </div>
    </CrmSideoverShell>
  );
}
