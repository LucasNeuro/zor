export type PartnerStatus = "ativo" | "ocupado" | "em_homologacao" | "pausado" | "inativo";
export type PartnerCategoria = "arquiteto" | "designer" | "engenheiro" | "decorador" | "construtora";
export type HomologacaoEtapa =
  | "prospecao" | "cadastro" | "documentacao" | "portfolio"
  | "referencias" | "entrevista" | "score" | "aprovacao"
  | "onboarding" | "ativo";

export interface PartnerMatch {
  lead_id: string;
  lead_nome: string;
  valor: number;
  status: "em_andamento" | "fechado" | "perdido";
  data: string;
}

export interface PartnerDocumento {
  nome: string;
  status: "ok" | "pendente" | "vencido";
  validade?: string;
}

export interface Partner {
  id: string;
  nome: string;
  empresa: string;
  categoria: PartnerCategoria;
  especialidades: string[];
  cidade: string;
  estado: string;
  status: PartnerStatus;
  telefone: string;
  email: string;
  transparency_score: number;
  nps: number;
  taxa_fechamento: number;
  capacidade_simultanea: number;
  obras_ativas: number;
  ticket_medio: number;
  total_comissoes: number;
  homologacao_etapa: HomologacaoEtapa;
  homologacao_progresso: number;
  fit_score_atual?: number;
  ultimos_matches: PartnerMatch[];
  documentos: PartnerDocumento[];
  notas: string;
  cadastrado_em: string;
  atualizado_em: string;
}

export const HOMOLOGACAO_ETAPAS: { id: HomologacaoEtapa; label: string; descricao: string }[] = [
  { id: "prospecao",    label: "Prospecção",    descricao: "Contato inicial e apresentação do Hub" },
  { id: "cadastro",     label: "Cadastro",      descricao: "Dados cadastrais e perfil completo" },
  { id: "documentacao", label: "Documentação",  descricao: "CNPJ, CAU/CREA, alvarás e seguros" },
  { id: "portfolio",    label: "Portfólio",     descricao: "Avaliação de obras e projetos anteriores" },
  { id: "referencias",  label: "Referências",   descricao: "Contato com clientes anteriores" },
  { id: "entrevista",   label: "Entrevista",    descricao: "Reunião de alinhamento com a equipe Hub" },
  { id: "score",        label: "Score",         descricao: "Cálculo do transparency score inicial" },
  { id: "aprovacao",    label: "Aprovação",     descricao: "Revisão final e aprovação pelo comitê" },
  { id: "onboarding",   label: "Onboarding",    descricao: "Treinamento do sistema e primeiros leads" },
  { id: "ativo",        label: "Ativo",         descricao: "Parceiro homologado e recebendo leads" },
];

export const PARTNERS_MOCK: Partner[] = [
  {
    id: "arq-costa",
    nome: "Ricardo Costa",
    empresa: "Costa Arquitetura",
    categoria: "arquiteto",
    especialidades: ["Reforma residencial", "Alto padrão", "Moderno industrial"],
    cidade: "São Paulo",
    estado: "SP",
    status: "ativo",
    telefone: "(11) 98877-6655",
    email: "ricardo@costaarquitetura.com.br",
    transparency_score: 94,
    nps: 9.1,
    taxa_fechamento: 82,
    capacidade_simultanea: 4,
    obras_ativas: 2,
    ticket_medio: 95000,
    total_comissoes: 14400,
    homologacao_etapa: "ativo",
    homologacao_progresso: 100,
    fit_score_atual: 96,
    ultimos_matches: [
      { lead_id: "lead-243", lead_nome: "Roberto Lima",   valor: 120000, status: "em_andamento", data: "2026-04-30" },
      { lead_id: "lead-238", lead_nome: "Patricia Souza", valor: 85000,  status: "fechado",      data: "2026-04-15" },
      { lead_id: "lead-231", lead_nome: "Marcos Oliveira",valor: 72000,  status: "fechado",      data: "2026-03-28" },
    ],
    documentos: [
      { nome: "CAU",                  status: "ok",      validade: "2027-03-15" },
      { nome: "Seguro responsabilidade civil", status: "ok", validade: "2026-12-01" },
      { nome: "Contrato Hub",         status: "ok",      validade: "2027-01-10" },
      { nome: "Certidão negativa",    status: "ok",      validade: "2026-08-20" },
    ],
    notas: "Parceiro estrela do Hub. Especialista em alto padrão e reformas complexas. Recomendado para leads acima de R$60k.",
    cadastrado_em: "2025-06-01",
    atualizado_em: "2026-05-03",
  },
  {
    id: "des-pedro",
    nome: "Pedro Alves",
    empresa: "Alves Design Interiores",
    categoria: "designer",
    especialidades: ["Design de interiores", "Escandinavo", "Minimalista"],
    cidade: "São Paulo",
    estado: "SP",
    status: "ocupado",
    telefone: "(11) 97766-5544",
    email: "pedro@alvesdesign.com",
    transparency_score: 61,
    nps: 6.8,
    taxa_fechamento: 54,
    capacidade_simultanea: 3,
    obras_ativas: 3,
    ticket_medio: 42000,
    total_comissoes: 5200,
    homologacao_etapa: "ativo",
    homologacao_progresso: 100,
    fit_score_atual: 71,
    ultimos_matches: [
      { lead_id: "lead-244", lead_nome: "Claudia Nunes",  valor: 38000, status: "em_andamento", data: "2026-04-20" },
      { lead_id: "lead-240", lead_nome: "Fernanda Rocha", valor: 45000, status: "perdido",      data: "2026-04-05" },
    ],
    documentos: [
      { nome: "Registro profissional", status: "ok",      validade: "2026-11-30" },
      { nome: "Seguro responsabilidade civil", status: "vencido", validade: "2026-04-01" },
      { nome: "Contrato Hub",           status: "ok",     validade: "2027-01-10" },
      { nome: "Certidão negativa",      status: "pendente" },
    ],
    notas: "Capacidade esgotada. Seguro vencido — CRÍTICO. Certidão negativa pendente. Revisar antes de novos matches.",
    cadastrado_em: "2025-09-15",
    atualizado_em: "2026-04-28",
  },
  {
    id: "arq-silva-homolog",
    nome: "Fernanda Silva",
    empresa: "Silva & Silva Arquitetura",
    categoria: "arquiteto",
    especialidades: ["Reforma residencial", "Contemporâneo", "Biofílico"],
    cidade: "Campinas",
    estado: "SP",
    status: "em_homologacao",
    telefone: "(19) 99123-4567",
    email: "fernanda@silvaarquitetura.com.br",
    transparency_score: 0,
    nps: 0,
    taxa_fechamento: 0,
    capacidade_simultanea: 3,
    obras_ativas: 0,
    ticket_medio: 55000,
    total_comissoes: 0,
    homologacao_etapa: "referencias",
    homologacao_progresso: 40,
    ultimos_matches: [],
    documentos: [
      { nome: "CAU",                  status: "ok",      validade: "2027-06-20" },
      { nome: "Seguro responsabilidade civil", status: "pendente" },
      { nome: "Contrato Hub",         status: "pendente" },
      { nome: "Certidão negativa",    status: "ok",      validade: "2026-09-10" },
    ],
    notas: "Ótimo portfólio em Campinas. Especialidade em biofílico alinhada com tendências. Processo de homologação em andamento.",
    cadastrado_em: "2026-03-10",
    atualizado_em: "2026-04-25",
  },
  {
    id: "dec-marc-belo",
    nome: "Marcela Belo",
    empresa: "Belo Interiores",
    categoria: "decorador",
    especialidades: ["Decoração residencial", "Escandinavo", "Provence"],
    cidade: "Campinas",
    estado: "SP",
    status: "ativo",
    telefone: "(19) 98877-2233",
    email: "marcela@belointeriores.com.br",
    transparency_score: 88,
    nps: 8.7,
    taxa_fechamento: 73,
    capacidade_simultanea: 5,
    obras_ativas: 2,
    ticket_medio: 38000,
    total_comissoes: 8600,
    homologacao_etapa: "ativo",
    homologacao_progresso: 100,
    fit_score_atual: 83,
    ultimos_matches: [
      { lead_id: "lead-245", lead_nome: "Juliana Carmo", valor: 32000, status: "fechado",      data: "2026-04-18" },
      { lead_id: "lead-241", lead_nome: "Lucas Prado",   valor: 41000, status: "fechado",      data: "2026-04-02" },
      { lead_id: "lead-236", lead_nome: "Sofia Martins", valor: 28000, status: "em_andamento", data: "2026-03-15" },
    ],
    documentos: [
      { nome: "Registro profissional", status: "ok",  validade: "2027-02-28" },
      { nome: "Seguro responsabilidade civil", status: "ok", validade: "2026-10-15" },
      { nome: "Contrato Hub",           status: "ok", validade: "2027-01-10" },
      { nome: "Certidão negativa",      status: "ok", validade: "2026-07-30" },
    ],
    notas: "Especialista ideal para leads de decoração escandinava/provence. Alta taxa de fechamento para ticket médio.",
    cadastrado_em: "2025-11-20",
    atualizado_em: "2026-04-30",
  },
];

export function getPartnerById(id: string): Partner | undefined {
  return PARTNERS_MOCK.find((p) => p.id === id);
}

export function getPartnerStatusLabel(status: PartnerStatus): string {
  const labels: Record<PartnerStatus, string> = {
    ativo: "Ativo",
    ocupado: "Ocupado",
    em_homologacao: "Em Homologação",
    pausado: "Pausado",
    inativo: "Inativo",
  };
  return labels[status];
}

export function getPartnerStatusColor(status: PartnerStatus): string {
  const colors: Record<PartnerStatus, string> = {
    ativo: "#22c55e",
    ocupado: "#eab308",
    em_homologacao: "#60a5fa",
    pausado: "#94a3b8",
    inativo: "#ef4444",
  };
  return colors[status];
}

export function getHomologacaoEtapaIndex(etapa: HomologacaoEtapa): number {
  return HOMOLOGACAO_ETAPAS.findIndex((e) => e.id === etapa);
}

export function getPartnersForLead(leadIntencao: string, leadCidade: string): Partner[] {
  return PARTNERS_MOCK.filter(
    (p) => p.status === "ativo" && (p.cidade === leadCidade || p.estado === "SP")
  ).sort((a, b) => (b.fit_score_atual ?? 0) - (a.fit_score_atual ?? 0));
}
