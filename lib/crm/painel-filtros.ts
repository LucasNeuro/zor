import type { RelatorioEntidade } from "@/lib/crm/relatorio-views-catalog";

export type PainelPeriodoFiltro = "todos" | "7d" | "30d" | "90d";

export type RelatorioFiltroTipo = "search" | "periodo" | "estagio" | "status" | "origem";

export type CrmPainelFiltros = {
  search: string;
  estagio: string;
  periodo: PainelPeriodoFiltro;
  status: string;
  origem: string;
};

export const FILTROS_PAINEL_VAZIOS: CrmPainelFiltros = {
  search: "",
  estagio: "",
  periodo: "todos",
  status: "",
  origem: "",
};

export function sinceFromPeriodoFiltro(periodo: PainelPeriodoFiltro): string | null {
  if (periodo === "todos") return null;
  const days = periodo === "7d" ? 7 : periodo === "30d" ? 30 : 90;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export function rowMatchesPainelFiltros(
  row: Record<string, unknown>,
  filtros: CrmPainelFiltros
): boolean {
  const q = filtros.search.trim().toLowerCase();
  if (q && !Object.values(row).some((v) => String(v ?? "").toLowerCase().includes(q))) {
    return false;
  }

  if (filtros.estagio.trim()) {
    const val = String(row.estagio ?? row.etapa ?? "").toLowerCase();
    if (!val.includes(filtros.estagio.toLowerCase())) return false;
  }

  if (filtros.status.trim()) {
    const val = String(row.status ?? "").toLowerCase();
    if (!val.includes(filtros.status.toLowerCase())) return false;
  }

  if (filtros.origem.trim()) {
    const val = String(row.origem ?? "").toLowerCase();
    if (!val.includes(filtros.origem.toLowerCase())) return false;
  }

  const since = sinceFromPeriodoFiltro(filtros.periodo);
  if (since) {
    const raw =
      row.criado_em ??
      row.vencimento ??
      row.created_at ??
      row.enviada_em ??
      row.recebida_em ??
      row.ultima_mensagem_em;
    if (raw) {
      const d = new Date(String(raw));
      if (!Number.isNaN(d.getTime()) && d.toISOString() < since) return false;
    }
  }

  return true;
}

export const PAINEL_ENTIDADES_BUILDER: Array<{ id: RelatorioEntidade; label: string }> = [
  { id: "leads", label: "Leads" },
  { id: "negocios", label: "Negócios" },
  { id: "empresas", label: "Empresas" },
  { id: "imoveis", label: "Imóveis" },
  { id: "financeiro", label: "Financeiro (resumo)" },
  { id: "contas_receber", label: "Contas a receber" },
  { id: "contas_pagar", label: "Contas a pagar" },
];

export const PAINEL_PERIODOS_UI: Array<{ value: PainelPeriodoFiltro; label: string }> = [
  { value: "todos", label: "Todo o período" },
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "90d", label: "Últimos 90 dias" },
];

export const PAINEL_ESTAGIOS_UI = [
  { value: "", label: "Todos os estágios" },
  { value: "novo", label: "Novo" },
  { value: "qualificado", label: "Qualificado" },
  { value: "proposta", label: "Proposta" },
  { value: "negociacao", label: "Negociação" },
  { value: "fechamento", label: "Fechamento" },
  { value: "ganho", label: "Ganho" },
  { value: "perdido", label: "Perdido" },
];
