export type LeadStatus = "novo" | "em_contato" | "qualificado" | "em_match" | "pos_match" | "perdido";
export type Intencao = "reforma_completa" | "reforma_parcial" | "construcao" | "decoracao";
export type Urgencia = "imediata" | "1_3_meses" | "3_6_meses" | "6_meses_plus";
export type Categoria = "alto_valor" | "medio_valor" | "baixo_valor";

export interface LeadContato {
  tipo: "ligacao" | "whatsapp" | "email" | "sistema";
  texto: string;
  agente: string;
  timestamp: string;
}

export interface Lead {
  id: string;
  numero: number;
  nome: string;
  telefone: string;
  email: string;
  cidade: string;
  estado: string;
  origem: string;
  campanha: string;
  status: LeadStatus;
  intencao: Intencao;
  urgencia: Urgencia;
  categoria: Categoria;
  orcamento_estimado: number;
  descricao_projeto: string;
  area_m2?: number;
  estilo_preferido?: string;
  prazo_desejado?: string;
  prioridade: number;
  sla_tempo: number;
  sla_meta: number;
  fit_score: number;
  match_parceiro_id?: string;
  proxima_acao: string;
  notas: string;
  historico: LeadContato[];
  criado_em: string;
  atualizado_em: string;
}

export const LEADS_MOCK: Lead[] = [
  {
    id: "lead-247",
    numero: 247,
    nome: "Carlos Mendes",
    telefone: "(11) 99821-4477",
    email: "carlos.mendes@gmail.com",
    cidade: "São Paulo",
    estado: "SP",
    origem: "Meta Ads",
    campanha: "Reforma SP — Cozinha Moderna",
    status: "em_contato",
    intencao: "reforma_parcial",
    urgencia: "1_3_meses",
    categoria: "alto_valor",
    orcamento_estimado: 80000,
    descricao_projeto: "Reforma de cozinha e sala integradas. Apartamento 120m², Pinheiros. Interesse em acabamento premium com mármore e móveis planejados.",
    area_m2: 120,
    estilo_preferido: "Contemporâneo",
    prazo_desejado: "Março 2026",
    prioridade: 94,
    sla_tempo: 18,
    sla_meta: 5,
    fit_score: 87,
    proxima_acao: "SDR ligar agora — lead aguarda contato há 18 min, risco de esfriamento",
    notas: "Lead muito qualificado. Já tem projeto aprovado pelo condomínio. Decidido, só precisa do parceiro certo.",
    historico: [
      { tipo: "sistema",   texto: "Lead criado via Meta Ads — campanha Reforma SP",           agente: "Sistema",      timestamp: "2026-05-03T09:12:00" },
      { tipo: "whatsapp",  texto: "SDR enviou mensagem de boas-vindas automática",            agente: "SDR Virtual",  timestamp: "2026-05-03T09:13:00" },
      { tipo: "whatsapp",  texto: 'Carlos respondeu: "Cozinha + sala, SP, orçamento ~R$80k"', agente: "Carlos M.",    timestamp: "2026-05-03T09:15:00" },
      { tipo: "sistema",   texto: "Lead qualificado automaticamente — score 87",              agente: "Qualif. IA",   timestamp: "2026-05-03T09:16:00" },
      { tipo: "ligacao",   texto: "Tentativa de ligação — não atendeu",                       agente: "SDR Marina",   timestamp: "2026-05-03T09:30:00" },
    ],
    criado_em: "2026-05-03T09:12:00",
    atualizado_em: "2026-05-03T09:30:00",
  },
  {
    id: "lead-248",
    numero: 248,
    nome: "Ana Paula Ferreira",
    telefone: "(11) 97654-3210",
    email: "ana.ferreira@outlook.com",
    cidade: "Campinas",
    estado: "SP",
    origem: "Google Ads",
    campanha: "Decoração — Interior SP",
    status: "qualificado",
    intencao: "decoracao",
    urgencia: "3_6_meses",
    categoria: "medio_valor",
    orcamento_estimado: 35000,
    descricao_projeto: "Decoração de sala de estar e dois quartos. Casa própria, Campinas. Preferência por estilo escandinavo com elementos naturais.",
    area_m2: 85,
    estilo_preferido: "Escandinavo",
    prazo_desejado: "Julho 2026",
    prioridade: 62,
    sla_tempo: 3,
    sla_meta: 5,
    fit_score: 71,
    proxima_acao: "Enviar portfólios de parceiros especializados em decoração escandinava",
    notas: "Bem informada, já pesquisou bastante. Precisa de parceiro com portfólio forte em escandinavo.",
    historico: [
      { tipo: "sistema",  texto: "Lead criado via Google Ads — campanha Decoração SP",         agente: "Sistema",     timestamp: "2026-05-03T07:45:00" },
      { tipo: "whatsapp", texto: "SDR iniciou qualificação automática",                        agente: "SDR Virtual", timestamp: "2026-05-03T07:46:00" },
      { tipo: "whatsapp", texto: 'Ana Paula: "Quero decorar sala + 2 quartos, estilo nórdico"', agente: "Ana P.",      timestamp: "2026-05-03T07:52:00" },
      { tipo: "ligacao",  texto: "Ligação realizada — 8 min de conversa, muito receptiva",     agente: "SDR Marina",  timestamp: "2026-05-03T08:15:00" },
      { tipo: "sistema",  texto: "Status atualizado para qualificado",                         agente: "Sistema",     timestamp: "2026-05-03T08:20:00" },
    ],
    criado_em: "2026-05-03T07:45:00",
    atualizado_em: "2026-05-03T08:20:00",
  },
  {
    id: "lead-243",
    numero: 243,
    nome: "Roberto Lima",
    telefone: "(11) 98765-1234",
    email: "roberto.lima@empresa.com.br",
    cidade: "São Paulo",
    estado: "SP",
    origem: "Indicação",
    campanha: "Indicação — Parceiro Costa",
    status: "pos_match",
    intencao: "reforma_completa",
    urgencia: "imediata",
    categoria: "alto_valor",
    orcamento_estimado: 120000,
    descricao_projeto: "Reforma completa de apartamento duplex. 180m², Itaim Bibi. Obra já aprovada, parceiro Costa selecionado, aguardando contrato.",
    area_m2: 180,
    estilo_preferido: "Moderno Industrial",
    prazo_desejado: "Início imediato",
    prioridade: 88,
    sla_tempo: 0,
    sla_meta: 24,
    fit_score: 96,
    match_parceiro_id: "arq-costa",
    proxima_acao: "Enviar contrato para assinatura — NPS coletado após match",
    notas: "Cliente de altíssimo ticket. Match realizado com Arq. Costa (fit 96%). Comissão de R$1.440 já gerada.",
    historico: [
      { tipo: "sistema",   texto: "Lead criado via indicação do Parceiro Costa",             agente: "Sistema",       timestamp: "2026-04-28T14:00:00" },
      { tipo: "ligacao",   texto: "Qualificação completa — lead muito decidido",             agente: "SDR Rafael",    timestamp: "2026-04-28T15:30:00" },
      { tipo: "sistema",   texto: "Match realizado: Roberto × Arq. Costa (fit 96%)",        agente: "Match IA",      timestamp: "2026-04-30T10:00:00" },
      { tipo: "whatsapp",  texto: "Arq. Costa confirmou disponibilidade para o projeto",    agente: "Arq. Costa",    timestamp: "2026-04-30T11:15:00" },
      { tipo: "sistema",   texto: "Comissão R$1.440 gerada — NPS coletado: 9.2",            agente: "CRM",           timestamp: "2026-05-02T09:00:00" },
      { tipo: "email",     texto: "Contrato enviado para revisão — aguarda assinatura",     agente: "SDR Rafael",    timestamp: "2026-05-03T08:00:00" },
    ],
    criado_em: "2026-04-28T14:00:00",
    atualizado_em: "2026-05-03T08:00:00",
  },
];

export function getLeadById(id: string): Lead | undefined {
  return LEADS_MOCK.find((l) => l.id === id);
}

export function getLeadStatusLabel(status: LeadStatus): string {
  const labels: Record<LeadStatus, string> = {
    novo: "Novo",
    em_contato: "Em Contato",
    qualificado: "Qualificado",
    em_match: "Em Match",
    pos_match: "Pós-Match",
    perdido: "Perdido",
  };
  return labels[status];
}

export function getLeadStatusColor(status: LeadStatus): string {
  const colors: Record<LeadStatus, string> = {
    novo: "#60a5fa",
    em_contato: "#fbbf24",
    qualificado: "#34d399",
    em_match: "#a78bfa",
    pos_match: "#22c55e",
    perdido: "#ef4444",
  };
  return colors[status];
}

export function getPrioridadeLabel(p: number): string {
  if (p >= 90) return "Urgente";
  if (p >= 70) return "Alta";
  if (p >= 50) return "Média";
  return "Baixa";
}

export function getSlaStatus(tempo: number, meta: number): "ok" | "atencao" | "critico" | "estourado" {
  if (tempo <= meta * 0.8) return "ok";
  if (tempo <= meta) return "atencao";
  if (tempo <= meta * 1.5) return "critico";
  return "estourado";
}
