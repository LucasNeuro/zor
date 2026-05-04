export type LeadPhase =
  | "entrando"
  | "aguardando"
  | "triagem"
  | "qualificando"
  | "qualificado"
  | "match_realizado"
  | "critico"
  | "frio"
  | "saindo";

export type LeadRoomId =
  | "main_entrance"
  | "waiting_area"
  | "main_reception_desk"
  | "lead_qualification_zone"
  | "active_attendance_stations"
  | "closer_room"
  | "customer_success";

export type LeadTipo =
  | "mercado_imobiliario"
  | "reforma"
  | "produto_servico"
  | "fornecedor_homologacao";

export const LEAD_TIPO_CONFIG: Record<LeadTipo, {
  label: string;
  cor: string;
  corBorda: string;
  corTexto: string;
  emoji: string;
  icone: string;
  descricao: string;
}> = {
  mercado_imobiliario: {
    label: "Imobiliário",
    cor: "#8b5cf6",
    corBorda: "#7c3aed",
    corTexto: "#c4b5fd",
    emoji: "🏠",
    icone: "I",
    descricao: "Compra, venda ou locação de imóvel",
  },
  reforma: {
    label: "Reforma",
    cor: "#f97316",
    corBorda: "#ea580c",
    corTexto: "#fed7aa",
    emoji: "🔨",
    icone: "R",
    descricao: "Reforma residencial ou comercial",
  },
  produto_servico: {
    label: "Produto/Serviço",
    cor: "#06b6d4",
    corBorda: "#0891b2",
    corTexto: "#a5f3fc",
    emoji: "📦",
    icone: "P",
    descricao: "Produto ou serviço específico",
  },
  fornecedor_homologacao: {
    label: "Fornecedor",
    cor: "#22c55e",
    corBorda: "#16a34a",
    corTexto: "#bbf7d0",
    emoji: "🤝",
    icone: "F",
    descricao: "Quer se homologar como parceiro",
  },
};

export const CONVERSAS_POR_TIPO: Record<LeadTipo, {
  lead: string[];
  agente: string[];
  sdr: string[];
}> = {
  mercado_imobiliario: {
    lead: [
      "Olá, vi o anúncio sobre imóveis na minha região",
      "Quero comprar um apartamento de 2 quartos em SP",
      "Preciso de um imóvel para alugar até R$3k",
      "Tenho um imóvel para vender, como funciona?",
      "Qual é a comissão de vocês?",
      "O imóvel já tem toda a documentação?",
      "Consigo financiamento pelo banco?",
      "Tem imóvel na zona sul de São Paulo?",
    ],
    agente: [
      "Olá! Sou a assistente da Obra10+. Como posso te ajudar?",
      "Entendido! Qual região você prefere para o imóvel?",
      "Qual é o seu orçamento disponível?",
      "Você precisa de financiamento ou tem valor à vista?",
      "Já tem alguma preferência de bairro?",
      "Quantos quartos você está buscando?",
      "Vou te conectar com o melhor parceiro da sua região",
    ],
    sdr: [
      "Qual é o seu nome completo?",
      "Você já tem carta de crédito aprovada?",
      "Qual é a urgência para fechar negócio?",
      "Prefere imóvel novo ou usado?",
      "Tem alguma restrição de CPF no momento?",
    ],
  },
  reforma: {
    lead: [
      "Quero reformar minha cozinha completa",
      "Preciso de orçamento para reforma do apartamento",
      "Quanto custa reformar um banheiro?",
      "Minha obra está parada, preciso de ajuda",
      "Quero fazer marcenaria planejada na sala",
      "Preciso de um arquiteto para meu projeto",
      "Tenho 60m² para reformar, qual o valor?",
      "Quero reformar o escritório da empresa",
    ],
    agente: [
      "Olá! Vou te ajudar a encontrar o melhor parceiro para sua reforma",
      "Qual é a metragem do espaço que você quer reformar?",
      "Você já tem projeto ou precisa criar do zero?",
      "Qual é o seu orçamento disponível para a reforma?",
      "Em qual cidade você está localizado?",
      "Precisa de arquiteto, engenheiro ou marceneiro?",
      "Qual é a urgência para iniciar a obra?",
      "Vou conectar você com o especialista ideal",
    ],
    sdr: [
      "A reforma é residencial ou comercial?",
      "Já tem algum projeto aprovado?",
      "Qual cômodo você quer reformar primeiro?",
      "Você precisa de projeto ou só execução?",
      "Tem alguma restrição de condomínio para obras?",
    ],
  },
  produto_servico: {
    lead: [
      "Preciso de um produto específico para minha obra",
      "Quero comprar porcelanato para o apartamento",
      "Preciso de serviço de elétrica urgente",
      "Quanto custa instalar ar condicionado?",
      "Preciso de pintura profissional",
      "Quero impermeabilizar minha laje",
      "Preciso de serviço de hidráulica",
      "Tem fornecedor de piso vinílico?",
    ],
    agente: [
      "Olá! Qual produto ou serviço você está buscando?",
      "Pode me dar mais detalhes sobre o que precisa?",
      "Qual é a quantidade ou metragem necessária?",
      "Você precisa de instalação junto com o produto?",
      "Qual é o prazo que você precisa?",
      "Em qual cidade você está?",
      "Temos parceiros especializados nisso",
    ],
    sdr: [
      "Já tem orçamento de outros fornecedores?",
      "Precisa de nota fiscal?",
      "Qual é o prazo máximo de entrega?",
      "Tem especificação técnica do produto?",
      "É para uso residencial ou comercial?",
    ],
  },
  fornecedor_homologacao: {
    lead: [
      "Quero me cadastrar como parceiro da Obra10+",
      "Como funciona o processo de homologação?",
      "Sou arquiteto e quero receber indicações de clientes",
      "Tenho uma marcenaria e quero expandir minha carteira",
      "Quanto tempo leva para ser aprovado?",
      "Quais documentos preciso enviar?",
      "Trabalho com reformas e quero ser parceiro",
      "Tenho empresa de engenharia e quero me cadastrar",
    ],
    agente: [
      "Olá! Fico feliz com seu interesse em ser parceiro Obra10+",
      "Qual é a sua área de atuação?",
      "Em qual região você atende?",
      "Qual é a sua capacidade mensal de projetos?",
      "Você tem CREA ou CAU ativo?",
      "Há quanto tempo você atua no mercado?",
      "Vou te passar o processo completo de homologação",
      "Qual é o seu ticket médio de projeto?",
    ],
    sdr: [
      "Você tem portfólio de obras realizadas?",
      "Pode nos enviar 3 referências de clientes?",
      "Tem seguro de responsabilidade civil?",
      "Qual é o seu CNPJ ou CPF profissional?",
      "Já trabalhou com plataformas de indicação antes?",
    ],
  },
};

export interface LeadMessage {
  texto: string;
  de: "lead" | "agente";
  agente_nome?: string;
  timestamp: Date;
}

export interface LiveLead {
  id: string;
  numero: number;
  nome: string;
  nome_curto: string;
  valor_estimado: number;
  tipo: LeadTipo;
  fase: LeadPhase;
  sala_atual: LeadRoomId;
  sala_destino: LeadRoomId | null;
  posicao: { x: number; y: number };
  posicao_destino: { x: number; y: number } | null;
  tempo_na_fase_ms: number;
  sla_target_ms: number;
  agente_responsavel_id: string | null;
  agente_responsavel_nome: string | null;
  ultima_mensagem: LeadMessage | null;
  mensagem_visivel: boolean;
  score_prioridade: number;
  canal: "meta_ads" | "google_ads" | "organico" | "indicacao";
  categoria: string;
  created_at: Date;
  movendo: boolean;
}

export const SALA_POSITIONS: Record<LeadRoomId, {
  x: number; y: number;
  spawn_range: { x: [number, number]; y: [number, number] };
}> = {
  main_entrance: {
    x: 488, y: 482,
    spawn_range: { x: [460, 520], y: [465, 500] },
  },
  waiting_area: {
    x: 750, y: 430,
    spawn_range: { x: [700, 820], y: [405, 455] },
  },
  main_reception_desk: {
    x: 344, y: 430,
    spawn_range: { x: [300, 390], y: [410, 450] },
  },
  lead_qualification_zone: {
    x: 161, y: 413,
    spawn_range: { x: [100, 250], y: [390, 445] },
  },
  active_attendance_stations: {
    x: 557, y: 413,
    spawn_range: { x: [450, 680], y: [385, 445] },
  },
  closer_room: {
    x: 749, y: 195,
    spawn_range: { x: [710, 800], y: [175, 215] },
  },
  customer_success: {
    x: 620, y: 301,
    spawn_range: { x: [580, 670], y: [280, 325] },
  },
};

export const PHASE_CONFIG: Record<LeadPhase, {
  cor: string;
  corBorda: string;
  label: string;
  badge: string;
  pulsacao: "lenta" | "rapida" | "parada";
  sala: LeadRoomId;
}> = {
  entrando:        { cor: "#fbbf24", corBorda: "#f59e0b", label: "Chegando",      badge: "NOVO",    pulsacao: "lenta",  sala: "main_entrance" },
  aguardando:      { cor: "#fbbf24", corBorda: "#f59e0b", label: "Aguardando",    badge: "FILA",    pulsacao: "lenta",  sala: "waiting_area" },
  triagem:         { cor: "#60a5fa", corBorda: "#3b82f6", label: "Triagem",       badge: "TRIAGEM", pulsacao: "lenta",  sala: "main_reception_desk" },
  qualificando:    { cor: "#60a5fa", corBorda: "#3b82f6", label: "Qualificando",  badge: "SDR",     pulsacao: "lenta",  sala: "lead_qualification_zone" },
  qualificado:     { cor: "#22c55e", corBorda: "#16a34a", label: "Qualificado",   badge: "OK",      pulsacao: "lenta",  sala: "active_attendance_stations" },
  match_realizado: { cor: "#22c55e", corBorda: "#16a34a", label: "Match feito",   badge: "MATCH",   pulsacao: "parada", sala: "closer_room" },
  critico:         { cor: "#ef4444", corBorda: "#dc2626", label: "CRÍTICO",       badge: "URGENTE", pulsacao: "rapida", sala: "active_attendance_stations" },
  frio:            { cor: "#6b7280", corBorda: "#4b5563", label: "Sem resposta",  badge: "FRIO",    pulsacao: "parada", sala: "waiting_area" },
  saindo:          { cor: "#22c55e", corBorda: "#16a34a", label: "Saindo",        badge: "DONE",    pulsacao: "parada", sala: "main_entrance" },
};

export const RESPONSAVEL_POR_SALA: Record<LeadRoomId, {
  agente_id: string;
  agente_nome: string;
  funcao: string;
  pode_atender: boolean;
}> = {
  main_entrance: {
    agente_id: "ag-019",
    agente_nome: "Atendente Beta",
    funcao: "Recepção — primeiro contato",
    pode_atender: true,
  },
  waiting_area: {
    agente_id: "ag-019",
    agente_nome: "Atendente Beta",
    funcao: "Recepção — gerencia a fila",
    pode_atender: true,
  },
  main_reception_desk: {
    agente_id: "ag-019",
    agente_nome: "Atendente Beta",
    funcao: "Recepção — triagem inicial",
    pode_atender: true,
  },
  lead_qualification_zone: {
    agente_id: "ag-018",
    agente_nome: "SDR Alpha",
    funcao: "SDR — qualificação",
    pode_atender: true,
  },
  active_attendance_stations: {
    agente_id: "ag-018",
    agente_nome: "SDR Alpha",
    funcao: "SDR — qualificação avançada",
    pode_atender: true,
  },
  closer_room: {
    agente_id: "ag-022",
    agente_nome: "Closer",
    funcao: "Closer — negociação",
    pode_atender: true,
  },
  customer_success: {
    agente_id: "ag-023",
    agente_nome: "CS",
    funcao: "CS — pós-match",
    pode_atender: true,
  },
};

export const INITIAL_LIVE_LEADS: LiveLead[] = [
  {
    id: "live-247",
    numero: 247,
    nome: "Carlos Mendes",
    nome_curto: "Carlos M.",
    valor_estimado: 80000,
    tipo: "reforma",
    fase: "critico",
    sala_atual: "active_attendance_stations",
    sala_destino: null,
    posicao: { x: 520, y: 413 },
    posicao_destino: null,
    tempo_na_fase_ms: 1080000,
    sla_target_ms: 300000,
    agente_responsavel_id: "ag-018",
    agente_responsavel_nome: "SDR Alpha",
    ultima_mensagem: {
      texto: "Quero reformar minha cozinha e sala",
      de: "lead",
      timestamp: new Date(Date.now() - 1020000),
    },
    mensagem_visivel: false,
    score_prioridade: 96,
    canal: "google_ads",
    categoria: "reforma_completa",
    created_at: new Date(Date.now() - 1080000),
    movendo: false,
  },
  {
    id: "live-248",
    numero: 248,
    nome: "Ana Paula Ferreira",
    nome_curto: "Ana P.",
    valor_estimado: 35000,
    tipo: "produto_servico",
    fase: "qualificando",
    sala_atual: "lead_qualification_zone",
    sala_destino: null,
    posicao: { x: 161, y: 413 },
    posicao_destino: null,
    tempo_na_fase_ms: 420000,
    sla_target_ms: 600000,
    agente_responsavel_id: "ag-018",
    agente_responsavel_nome: "SDR Alpha",
    ultima_mensagem: {
      texto: "Qual o prazo de entrega do piso?",
      de: "lead",
      timestamp: new Date(Date.now() - 300000),
    },
    mensagem_visivel: false,
    score_prioridade: 71,
    canal: "meta_ads",
    categoria: "marcenaria",
    created_at: new Date(Date.now() - 720000),
    movendo: false,
  },
  {
    id: "live-249",
    numero: 249,
    nome: "Roberto Lima",
    nome_curto: "Roberto L.",
    valor_estimado: 120000,
    tipo: "mercado_imobiliario",
    fase: "aguardando",
    sala_atual: "waiting_area",
    sala_destino: null,
    posicao: { x: 780, y: 430 },
    posicao_destino: null,
    tempo_na_fase_ms: 180000,
    sla_target_ms: 300000,
    agente_responsavel_id: null,
    agente_responsavel_nome: null,
    ultima_mensagem: null,
    mensagem_visivel: false,
    score_prioridade: 88,
    canal: "indicacao",
    categoria: "construcao",
    created_at: new Date(Date.now() - 180000),
    movendo: false,
  },
  {
    id: "live-250",
    numero: 250,
    nome: "Construtora Belo",
    nome_curto: "Construtora B.",
    valor_estimado: 0,
    tipo: "fornecedor_homologacao",
    fase: "triagem",
    sala_atual: "main_reception_desk",
    sala_destino: null,
    posicao: { x: 344, y: 430 },
    posicao_destino: null,
    tempo_na_fase_ms: 120000,
    sla_target_ms: 600000,
    agente_responsavel_id: "ag-019",
    agente_responsavel_nome: "Atendente Beta",
    ultima_mensagem: {
      texto: "Quero me cadastrar como parceiro",
      de: "lead",
      timestamp: new Date(Date.now() - 120000),
    },
    mensagem_visivel: false,
    score_prioridade: 0,
    canal: "organico",
    categoria: "arquitetura",
    created_at: new Date(Date.now() - 240000),
    movendo: false,
  },
  {
    id: "live-251",
    numero: 251,
    nome: "Beatriz Santos",
    nome_curto: "Beatriz S.",
    valor_estimado: 55000,
    tipo: "reforma",
    fase: "qualificado",
    sala_atual: "active_attendance_stations",
    sala_destino: null,
    posicao: { x: 600, y: 413 },
    posicao_destino: null,
    tempo_na_fase_ms: 60000,
    sla_target_ms: 300000,
    agente_responsavel_id: "ag-018",
    agente_responsavel_nome: "SDR Alpha",
    ultima_mensagem: {
      texto: "Ótimo! Quando podemos agendar?",
      de: "lead",
      timestamp: new Date(Date.now() - 60000),
    },
    mensagem_visivel: false,
    score_prioridade: 82,
    canal: "meta_ads",
    categoria: "reforma_completa",
    created_at: new Date(Date.now() - 900000),
    movendo: false,
  },
];

export function getRandomSpawnPosition(salaId: LeadRoomId): { x: number; y: number } {
  const sala = SALA_POSITIONS[salaId];
  const { x: [minX, maxX], y: [minY, maxY] } = sala.spawn_range;
  return {
    x: Math.round(minX + Math.random() * (maxX - minX)),
    y: Math.round(minY + Math.random() * (maxY - minY)),
  };
}

export function getNextPhase(fase: LeadPhase): LeadPhase | null {
  const flow: Partial<Record<LeadPhase, LeadPhase>> = {
    entrando: "aguardando",
    aguardando: "triagem",
    triagem: "qualificando",
    qualificando: "qualificado",
    qualificado: "match_realizado",
    match_realizado: "saindo",
  };
  return flow[fase] ?? null;
}

export function getNextSala(fase: LeadPhase): LeadRoomId {
  return PHASE_CONFIG[fase].sala;
}
