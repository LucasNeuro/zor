export type AlertSeverity = "critical" | "warning" | "info";
export type AlertArea =
  | "marketing"
  | "comercial"
  | "atendimento"
  | "clientes"
  | "crm"
  | "criacao"
  | "campanhas"
  | "agente"
  | "tarefa"
  | "sistema";

export interface Alert {
  id: string;
  severity: AlertSeverity;
  area: AlertArea;
  titulo: string;
  descricao: string;
  acao_label?: string;
  acao_tipo?: string;
  acao_dados?: Record<string, unknown>;
  agente_id?: string;
  timestamp: Date;
  resolvido: boolean;
  auto_resolve_ms?: number;
}

export const ALERTS_MOCK: Alert[] = [
  {
    id: "alt-001",
    severity: "critical",
    area: "campanhas",
    titulo: "CPL acima do limite",
    descricao: "Meta Ads com CPL R$89 vs meta R$60. Conjunto B está drenando budget sem resultado.",
    acao_label: "Pausar conjunto B",
    acao_tipo: "pausar_campanha",
    acao_dados: { campanha: "meta_ads", conjunto: "B" },
    agente_id: "ag-010",
    timestamp: new Date(Date.now() - 12 * 60 * 1000),
    resolvido: false,
  },
  {
    id: "alt-002",
    severity: "critical",
    area: "comercial",
    titulo: "Proposta aguarda aprovação",
    descricao: "Proposta R$110k para João Silva enviada pelo Closer há 2h. Decisão necessária antes das 18h.",
    acao_label: "Ver proposta",
    acao_tipo: "aprovar_proposta",
    acao_dados: { valor: 110000, cliente: "João Silva" },
    agente_id: "ag-021",
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    resolvido: false,
  },
  {
    id: "alt-003",
    severity: "critical",
    area: "atendimento",
    titulo: "Lead #247 sem resposta",
    descricao: "Lead com potencial R$80k está há 18 min na fila. Tempo médio já é 8min vs meta 5min.",
    acao_label: "Acionar SDR",
    acao_tipo: "acionar_sdr",
    acao_dados: { lead_id: "#247", tempo_espera: 18 },
    agente_id: "ag-022",
    timestamp: new Date(Date.now() - 18 * 60 * 1000),
    resolvido: false,
  },
  {
    id: "alt-004",
    severity: "warning",
    area: "crm",
    titulo: "8 follow-ups vencidos",
    descricao: "Leads sem contato há mais de 48h. Risco de esfriamento do interesse.",
    acao_label: "Disparar todos",
    acao_tipo: "disparar_followup",
    acao_dados: { quantidade: 8 },
    timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000),
    resolvido: false,
  },
  {
    id: "alt-005",
    severity: "warning",
    area: "clientes",
    titulo: "Cliente Silva em risco",
    descricao: "NPS 4 e inativo há 8 dias. Histórico de churn em clientes com esse padrão.",
    acao_label: "Ligar agora",
    acao_tipo: "contato_cliente",
    acao_dados: { cliente: "Silva", nps: 4, dias_inativo: 8 },
    agente_id: "ag-023",
    timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000),
    resolvido: false,
  },
  {
    id: "alt-006",
    severity: "warning",
    area: "criacao",
    titulo: "Reel reforma sem material",
    descricao: "Motion IA aguarda material de cliente há 2 dias. Prazo de entrega em risco.",
    acao_label: "Solicitar material",
    acao_tipo: "solicitar_material",
    acao_dados: { tarefa: "Reel reforma", agente: "Motion IA" },
    agente_id: "ag-015",
    timestamp: new Date(Date.now() - 45 * 60 * 1000),
    resolvido: false,
  },
  {
    id: "alt-007",
    severity: "info",
    area: "marketing",
    titulo: "Google Ads performando bem",
    descricao: "ROAS 4.2x com CPL R$64 vs meta R$60. Campanha estável, crescimento de 8% ontem.",
    timestamp: new Date(Date.now() - 30 * 60 * 1000),
    resolvido: false,
    auto_resolve_ms: 120_000,
  },
  {
    id: "alt-008",
    severity: "info",
    area: "comercial",
    titulo: "Meta semanal a 78%",
    descricao: "Pipeline em R$94k de R$120k. Tendência de atingir meta até sexta com 2 deals em negociação.",
    timestamp: new Date(Date.now() - 10 * 60 * 1000),
    resolvido: false,
    auto_resolve_ms: 180_000,
  },
];

export function getAlertsByArea(area: AlertArea): Alert[] {
  return ALERTS_MOCK.filter((a) => a.area === area && !a.resolvido);
}

export function getCriticalAlerts(): Alert[] {
  return ALERTS_MOCK.filter((a) => a.severity === "critical" && !a.resolvido);
}

export function getWarningAlerts(): Alert[] {
  return ALERTS_MOCK.filter((a) => a.severity === "warning" && !a.resolvido);
}

export function getAlertsByAgent(agentId: string): Alert[] {
  return ALERTS_MOCK.filter((a) => a.agente_id === agentId && !a.resolvido);
}
