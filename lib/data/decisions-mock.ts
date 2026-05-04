export type DecisionStatus = "critical" | "warning" | "info" | "system";
export type DecisionArea =
  | "atendimento" | "marketing" | "parceiros"
  | "pos_match" | "homologacao" | "crm" | "financeiro";

export interface DecisionSource {
  nome: string;
  atualizadoHa: string;
}

export interface DecisionAction {
  label: string;
  tipo: "primary" | "secondary" | "danger" | "delegate";
  critica: boolean;
  confirma_com: string | null;
}

export interface Decision {
  id: string;
  status: DecisionStatus;
  titulo: string;
  resumo: string;
  impacto_financeiro: number;
  impacto_label: string;
  tempo_atraso: string;
  sla_meta: string;
  responsavel: string;
  agente_id: string;
  area: DecisionArea;
  causa_provavel: string;
  recomendacao: string;
  confianca: "alta" | "media" | "baixa";
  fontes: DecisionSource[];
  acoes: DecisionAction[];
  prioridade: number;
  lead_id?: string;
  parceiro_id?: string;
  campanha_id?: string;
  criado_em: Date;
}

export const DECISIONS_MOCK: Decision[] = [
  {
    id: "dec-001",
    status: "critical",
    titulo: "Lead #247 sem resposta",
    resumo: "Lead de R$80k estimados há 18min sem contato. SLA era 5 minutos. SDR Alpha está com fila cheia.",
    impacto_financeiro: 80000,
    impacto_label: "R$80k em risco",
    tempo_atraso: "18 min",
    sla_meta: "5 min",
    responsavel: "SDR Alpha",
    agente_id: "ag-018",
    area: "atendimento",
    causa_provavel: "SDR Alpha com 3 leads ativos simultaneamente — capacidade excedida",
    recomendacao: "Transferir para SDR Beta e enviar WhatsApp automático agora",
    confianca: "alta",
    fontes: [
      { nome: "CRM", atualizadoHa: "2 min" },
      { nome: "WhatsApp", atualizadoHa: "1 min" },
      { nome: "Google Ads", atualizadoHa: "12 min" },
    ],
    acoes: [
      { label: "Executar recomendação", tipo: "primary", critica: true, confirma_com: "Transferir Lead #247 para SDR Beta e enviar WhatsApp automático?" },
      { label: "Ver Lead 360", tipo: "secondary", critica: false, confirma_com: null },
      { label: "Delegar ao gerente", tipo: "delegate", critica: false, confirma_com: null },
      { label: "Ignorar por 1h", tipo: "danger", critica: true, confirma_com: "Ignorar este lead por 1 hora? Risco estimado de perda: R$80k." },
    ],
    prioridade: 96,
    lead_id: "lead-247",
    criado_em: new Date(Date.now() - 1080000),
  },
  {
    id: "dec-002",
    status: "critical",
    titulo: "3 leads parados há mais de 72h",
    resumo: "Leads de alto potencial sem retorno. Última ação: WhatsApp enviado sem resposta.",
    impacto_financeiro: 185000,
    impacto_label: "R$185k em oportunidade parada",
    tempo_atraso: "72h+",
    sla_meta: "48h",
    responsavel: "CRM IA",
    agente_id: "ag-024",
    area: "crm",
    causa_provavel: "Sequência de follow-up encerrou sem retorno do lead",
    recomendacao: "Iniciar sequência de recuperação automática com novo ângulo de abordagem",
    confianca: "alta",
    fontes: [
      { nome: "CRM", atualizadoHa: "5 min" },
      { nome: "WhatsApp", atualizadoHa: "3 min" },
    ],
    acoes: [
      { label: "Iniciar recuperação", tipo: "primary", critica: true, confirma_com: "Iniciar sequência de recuperação para os 3 leads parados?" },
      { label: "Ver leads", tipo: "secondary", critica: false, confirma_com: null },
      { label: "Marcar como perdidos", tipo: "danger", critica: true, confirma_com: "Marcar esses 3 leads como perdidos? Esta ação não pode ser desfeita." },
    ],
    prioridade: 88,
    criado_em: new Date(Date.now() - 259200000),
  },
  {
    id: "dec-003",
    status: "critical",
    titulo: "CPL Meta Ads acima da meta",
    resumo: "CPL em R$89 vs meta R$60. Tendência de alta por 2 dias. ROAS ainda saudável em 3.8x.",
    impacto_financeiro: 12000,
    impacto_label: "R$12k de custo extra projetado",
    tempo_atraso: "2 dias",
    sla_meta: "CPL R$60",
    responsavel: "Tráfego Beta",
    agente_id: "ag-013",
    area: "marketing",
    causa_provavel: "Criativo com frequência alta — público saturando",
    recomendacao: "Trocar criativo antes de pausar. ROAS saudável indica lead de qualidade.",
    confianca: "alta",
    fontes: [
      { nome: "Meta Ads", atualizadoHa: "8 min" },
      { nome: "Analytics IA", atualizadoHa: "15 min" },
    ],
    acoes: [
      { label: "Revisar campanha", tipo: "primary", critica: true, confirma_com: null },
      { label: "Trocar criativo", tipo: "secondary", critica: true, confirma_com: "Solicitar novo criativo ao Design Alpha para substituir conjunto B?" },
      { label: "Pausar conjunto B", tipo: "danger", critica: true, confirma_com: "Pausar conjunto B? Isso reduzirá o volume de leads em aproximadamente 40%." },
    ],
    prioridade: 72,
    campanha_id: "camp-meta-001",
    criado_em: new Date(Date.now() - 172800000),
  },
  {
    id: "dec-004",
    status: "critical",
    titulo: "Parceiro sem responder lead há 4h",
    resumo: "Arq. Pedro recebeu Lead #243 há 4h e não fez contato. Cliente aguarda.",
    impacto_financeiro: 45000,
    impacto_label: "R$45k em comissão em risco",
    tempo_atraso: "4h",
    sla_meta: "2h",
    responsavel: "CS",
    agente_id: "ag-023",
    area: "pos_match",
    causa_provavel: "Parceiro pode estar sem capacidade ou sem acesso ao sistema",
    recomendacao: "Notificar parceiro via WhatsApp e preparar parceiro substituto",
    confianca: "media",
    fontes: [
      { nome: "CRM", atualizadoHa: "10 min" },
      { nome: "Pós-Match", atualizadoHa: "5 min" },
    ],
    acoes: [
      { label: "Notificar parceiro", tipo: "primary", critica: false, confirma_com: null },
      { label: "Redirecionar lead", tipo: "secondary", critica: true, confirma_com: "Redirecionar Lead #243 para outro parceiro disponível?" },
      { label: "Pausar parceiro", tipo: "danger", critica: true, confirma_com: "Pausar Arq. Pedro temporariamente? Ele não receberá novos leads até reativação." },
    ],
    prioridade: 85,
    parceiro_id: "parceiro-pedro",
    criado_em: new Date(Date.now() - 14400000),
  },
  {
    id: "dec-005",
    status: "warning",
    titulo: "Parceiro aguardando homologação",
    resumo: "Arq. Silva tem score 87/100 e documentação completa. Aguarda aprovação há 3 dias.",
    impacto_financeiro: 25000,
    impacto_label: "R$25k em capacidade bloqueada",
    tempo_atraso: "3 dias",
    sla_meta: "5 dias",
    responsavel: "Dir. Comercial",
    agente_id: "ag-020",
    area: "homologacao",
    causa_provavel: "Pendência de aprovação executiva na fila",
    recomendacao: "Aprovar com limite inicial de 2 leads simultâneos. Score e docs OK.",
    confianca: "alta",
    fontes: [
      { nome: "Sistema de Homologação", atualizadoHa: "1h" },
      { nome: "Documentação", atualizadoHa: "3 dias" },
    ],
    acoes: [
      { label: "Ver Partner 360", tipo: "primary", critica: false, confirma_com: null },
      { label: "Aprovar com limite", tipo: "secondary", critica: true, confirma_com: "Aprovar Arq. Silva com limite de 2 leads simultâneos?" },
      { label: "Solicitar documento", tipo: "delegate", critica: false, confirma_com: null },
    ],
    prioridade: 61,
    parceiro_id: "parceiro-silva",
    criado_em: new Date(Date.now() - 259200000),
  },
  {
    id: "dec-006",
    status: "warning",
    titulo: "2 clientes com NPS abaixo de 7",
    resumo: "Clientes A e B deram NPS 4 e 5. Parceiros responsáveis com atraso na obra.",
    impacto_financeiro: 18000,
    impacto_label: "R$18k em comissão em risco de estorno",
    tempo_atraso: "5 dias",
    sla_meta: "NPS 7+",
    responsavel: "CS",
    agente_id: "ag-023",
    area: "pos_match",
    causa_provavel: "Atraso na entrega da obra pelo parceiro sem comunicação proativa",
    recomendacao: "CS contatar clientes hoje. Avaliar pausar parceiro responsável.",
    confianca: "alta",
    fontes: [
      { nome: "NPS System", atualizadoHa: "2h" },
      { nome: "CRM", atualizadoHa: "30 min" },
    ],
    acoes: [
      { label: "Acionar CS agora", tipo: "primary", critica: false, confirma_com: null },
      { label: "Ver clientes em risco", tipo: "secondary", critica: false, confirma_com: null },
      { label: "Pausar parceiro", tipo: "danger", critica: true, confirma_com: "Pausar o parceiro responsável temporariamente?" },
    ],
    prioridade: 55,
    criado_em: new Date(Date.now() - 432000000),
  },
];

export const REVENUE_AT_RISK = {
  total: 47000,
  comissao_potencial: 156000,
  comissao_provavel: 89000,
  comissao_confirmada: 23400,
  causas: [
    { descricao: "3 leads sem contato", valor: 18000 },
    { descricao: "2 matches sem atualização", valor: 12000 },
    { descricao: "1 parceiro sem responder", valor: 9000 },
    { descricao: "2 clientes com NPS baixo", valor: 8000 },
  ],
  proxima_acao: "Resolver Lead #247 primeiro — maior impacto potencial",
};

export function getPriorityColor(prioridade: number): string {
  if (prioridade >= 90) return "#ef4444";
  if (prioridade >= 70) return "#f97316";
  if (prioridade >= 50) return "#eab308";
  return "#22c55e";
}

export function getStatusLabel(status: DecisionStatus): string {
  const labels: Record<DecisionStatus, string> = {
    critical: "Crítico",
    warning: "Atenção",
    info: "Informativo",
    system: "Sistema",
  };
  return labels[status];
}

export function getConfiancaLabel(confianca: string): string {
  const labels: Record<string, string> = {
    alta: "Alta confiança",
    media: "Confiança média",
    baixa: "Baixa confiança",
  };
  return labels[confianca] ?? confianca;
}

export function sortDecisionsByPriority(decisions: Decision[]): Decision[] {
  return [...decisions].sort((a, b) => b.prioridade - a.prioridade);
}

export function getDecisionsByStatus(decisions: Decision[], status: DecisionStatus): Decision[] {
  return decisions.filter((d) => d.status === status);
}
