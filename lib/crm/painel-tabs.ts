import type { CrmDashboardState } from "@/hooks/useCrmDashboard";
import type { CrmPainelFiltros } from "@/lib/crm/painel-filtros";
import { FILTROS_PAINEL_VAZIOS } from "@/lib/crm/painel-filtros";
import type { CrmMetricTone } from "@/lib/crm/crm-metric-theme";
import { moedaPipeline } from "@/lib/crm/pipeline-funil";
import type { RelatorioEntidade } from "@/lib/crm/relatorio-views-catalog";
import { CRM_MODULE_PARCEIROS_ENABLED } from "@/lib/crm/waje-modules";
import {
  resolveRelatorioViewId,
  viewIdFromEntidade,
  type RelatorioViewId,
} from "@/lib/crm/relatorio-views-catalog";

export type PainelTabId =
  | "visao-geral"
  | "comercial"
  | "atendimento"
  | "operacao"
  | "financeiro"
  | "personalizado";

export type PainelReportOption = {
  id: RelatorioEntidade;
  label: string;
};

export type PainelTabDef = {
  id: PainelTabId;
  label: string;
  description: string;
  reports: PainelReportOption[];
  defaultReport: RelatorioEntidade;
};

export const PAINEL_TABS: PainelTabDef[] = [
  {
    id: "visao-geral",
    label: "Visão geral",
    description: "Gráficos do funil comercial, obra e atendimento.",
    reports: [
      { id: "leads", label: "Leads" },
      { id: "negocios", label: "Negócios" },
    ],
    defaultReport: "leads",
  },
  {
    id: "comercial",
    label: "Comercial",
    description: "Funil, leads e negócios do pipeline comercial.",
    reports: [
      { id: "leads", label: "Leads" },
      { id: "negocios", label: "Negócios" },
      { id: "empresas", label: "Empresas" },
    ],
    defaultReport: "leads",
  },
  {
    id: "atendimento",
    label: "Atendimento",
    description: "Fila de mensagens, leads aguardando e operação WhatsApp.",
    reports: [{ id: "leads", label: "Leads em atendimento" }],
    defaultReport: "leads",
  },
  {
    id: "operacao",
    label: "Operação",
    description: "Negócios, obras, imóveis e encaminhamentos.",
    reports: [
      { id: "negocios", label: "Negócios" },
      { id: "imoveis", label: "Imóveis" },
      { id: "empresas", label: "Empresas" },
    ],
    defaultReport: "negocios",
  },
  {
    id: "financeiro",
    label: "Financeiro",
    description: "Contas a pagar, a receber e visão financeira.",
    reports: [
      { id: "financeiro", label: "Resumo financeiro" },
      { id: "contas_receber", label: "Contas a receber" },
      { id: "contas_pagar", label: "Contas a pagar" },
    ],
    defaultReport: "financeiro",
  },
  {
    id: "personalizado",
    label: "Personalizado",
    description: "Vistas salvas com filtros e relatórios do seu tenant.",
    reports: [],
    defaultReport: "leads",
  },
];

export function parsePainelTabId(raw: string | null | undefined): PainelTabId {
  const hit = PAINEL_TABS.find((t) => t.id === raw);
  return hit?.id ?? "visao-geral";
}

export function painelTabById(id: PainelTabId): PainelTabDef {
  return PAINEL_TABS.find((t) => t.id === id) ?? PAINEL_TABS[0]!;
}

export type PainelKpiCard = {
  key: string;
  label: string;
  valor: string | number;
  sub?: string;
  tone?: CrmMetricTone;
};

export function kpisForPainelTab(tabId: PainelTabId, dash: CrmDashboardState): PainelKpiCard[] {
  const m = dash;
  const receita = m.receitaPotencial > 0 ? moedaPipeline(m.receitaPotencial) : "R$ 0";

  switch (tabId) {
    case "visao-geral":
      return [
        { key: "leads-hoje", label: "Leads hoje", valor: m.leadsHoje, sub: "novos no período", tone: "brand" },
        {
          key: "pipeline",
          label: "Receita potencial",
          valor: receita,
          sub: "pipeline em aberto",
          tone: "brand",
        },
        {
          key: "agentes",
          label: "Agentes IA ativos",
          valor: m.agentesAtivos,
          sub: "modelos no hub",
          tone: "success",
        },
        {
          key: "fila",
          label: "Mensagens na fila",
          valor: m.mensagensFilaPendentes,
          sub: "pendentes de envio",
          tone: m.mensagensFilaPendentes > 0 ? "warning" : "muted",
        },
      ];
    case "comercial":
      return [
        {
          key: "qualif",
          label: "Taxa qualificação",
          valor: `${m.taxaQualificacao}%`,
          sub: "do total de leads",
          tone: "success",
        },
        ...(CRM_MODULE_PARCEIROS_ENABLED
          ? [{
              key: "enc",
              label: "Taxa encaminhamento",
              valor: `${m.taxaEncaminhamento}%`,
              sub: "leads com encaminhamento",
              tone: "brand" as CrmMetricTone,
            }]
          : [{
              key: "neg-abertos",
              label: "Negócios abertos",
              valor: m.operacao.negociosAbertos,
              sub: "pipeline comercial",
              tone: "brand" as CrmMetricTone,
            }]),
        { key: "receita", label: "Receita potencial", valor: receita, sub: "oportunidades abertas", tone: "brand" },
        ...(CRM_MODULE_PARCEIROS_ENABLED
          ? [{ key: "parceiros", label: "Parceiros ativos", valor: m.parceirosAtivos, sub: "homologados", tone: "success" as CrmMetricTone }]
          : [{ key: "leads-hoje", label: "Leads hoje", valor: m.leadsHoje, sub: "captação do dia", tone: "brand" as CrmMetricTone }]),
      ];
    case "atendimento":
      return [
        {
          key: "aguardando",
          label: "Leads aguardando",
          valor: m.leadsAguardando,
          sub: "precisam de ação",
          tone: m.leadsAguardando > 0 ? "warning" : "muted",
        },
        {
          key: "fila",
          label: "Mensagens na fila",
          valor: m.mensagensFilaPendentes,
          sub: "WhatsApp / canais",
          tone: m.mensagensFilaPendentes > 0 ? "warning" : "brand",
        },
        {
          key: "aprov",
          label: "Aprovações pendentes",
          valor: m.aprovacoesPendentes,
          sub: "decisões no hub",
          tone: m.aprovacoesPendentes > 0 ? "warning" : "muted",
        },
        { key: "agentes", label: "Agentes IA", valor: m.agentesAtivos, sub: "ativos no tenant", tone: "success" },
      ];
    case "operacao":
      return [
        {
          key: "neg",
          label: "Negócios abertos",
          valor: m.operacao.negociosAbertos,
          sub: "pipeline comercial",
          tone: "brand",
        },
        {
          key: "obras",
          label: "Obras em andamento",
          valor: m.operacao.obrasEmAndamento,
          sub: "execução",
          tone: "success",
        },
        {
          key: "pedidos",
          label: "Pedidos de material",
          valor: m.operacao.pedidosAbertos,
          sub: "rascunho a aprovado",
          tone: "brand",
        },
        ...(CRM_MODULE_PARCEIROS_ENABLED
          ? [{
              key: "enc-hoje",
              label: "Encaminhamentos hoje",
              valor: m.encaminhamentosHoje,
              sub: "rede de parceiros",
              tone: "success" as CrmMetricTone,
            }]
          : [{
              key: "leads-hoje",
              label: "Leads hoje",
              valor: m.leadsHoje,
              sub: "captação do dia",
              tone: "brand" as CrmMetricTone,
            }]),
      ];
    case "financeiro":
      return [
        { key: "receita", label: "Receita potencial", valor: receita, sub: "CRM comercial", tone: "brand" },
        {
          key: "neg-abertos",
          label: "Negócios abertos",
          valor: m.operacao.negociosAbertos,
          sub: "base do pipeline",
          tone: "brand",
        },
        {
          key: "leads-hoje",
          label: "Leads hoje",
          valor: m.leadsHoje,
          sub: "entrada no funil",
          tone: "muted",
        },
        {
          key: "qualif",
          label: "Taxa qualificação",
          valor: `${m.taxaQualificacao}%`,
          sub: "conversão inicial",
          tone: "success",
        },
      ];
    case "personalizado":
      return [];
    default:
      return [];
  }
}

export type PainelRelatorioCustom = {
  id: string;
  titulo: string;
  viewId: RelatorioViewId;
  /** @deprecated migrado automaticamente de entidade */
  entidade?: RelatorioEntidade;
  filtros: CrmPainelFiltros;
  /** Colunas visíveis; vazio = todas */
  colunas: string[];
  criadoEm: string;
};

/** @deprecated v1 — migrado para PainelRelatorioCustom */
export type PainelVistaSalva = {
  id: string;
  titulo: string;
  tabId: PainelTabId;
  entidade: RelatorioEntidade;
  search: string;
  estagio: string;
  criadoEm: string;
};

export const PAINEL_RELATORIOS_STORAGE_KEY = "waje_crm_painel_relatorios_v3";
export const PAINEL_RELATORIOS_STORAGE_KEY_V2 = "waje_crm_painel_relatorios_v2";
export const PAINEL_VISTAS_STORAGE_KEY = "waje_crm_painel_vistas_v1";

export function customRelatorioId(id: string): string {
  return `custom_${id}`;
}

export function parseCustomRelatorioId(rel: string | null): string | null {
  if (!rel?.startsWith("custom_")) return null;
  return rel.slice("custom_".length);
}

export function loadRelatoriosPersonalizados(): PainelRelatorioCustom[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PAINEL_RELATORIOS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PainelRelatorioCustom[];
      if (Array.isArray(parsed)) {
        return parsed.map((r) => ({
          ...r,
          viewId: r.viewId ?? resolveRelatorioViewId(r.entidade),
        }));
      }
    }
    const v2 = localStorage.getItem(PAINEL_RELATORIOS_STORAGE_KEY_V2);
    if (v2) {
      const old = JSON.parse(v2) as Array<PainelRelatorioCustom & { entidade: RelatorioEntidade }>;
      if (Array.isArray(old)) {
        const migrated = old.map((r) => ({
          id: r.id,
          titulo: r.titulo,
          viewId: resolveRelatorioViewId(r.entidade),
          filtros: r.filtros,
          colunas: r.colunas,
          criadoEm: r.criadoEm,
        }));
        saveRelatoriosPersonalizados(migrated);
        return migrated;
      }
    }
    const legacy = localStorage.getItem(PAINEL_VISTAS_STORAGE_KEY);
    if (!legacy) return [];
    const old = JSON.parse(legacy) as PainelVistaSalva[];
    if (!Array.isArray(old)) return [];
    return old.map((v) => ({
      id: v.id.replace(/^vista_/, "rel_"),
      titulo: v.titulo,
      viewId: viewIdFromEntidade(v.entidade),
      filtros: {
        ...FILTROS_PAINEL_VAZIOS,
        search: v.search,
        estagio: v.estagio,
      },
      colunas: [],
      criadoEm: v.criadoEm,
    }));
  } catch {
    return [];
  }
}

export function saveRelatoriosPersonalizados(relatorios: PainelRelatorioCustom[]) {
  localStorage.setItem(PAINEL_RELATORIOS_STORAGE_KEY, JSON.stringify(relatorios));
}
