// office-intelligence — revisão 2025
export const HIERARQUIA = {
  usuario:             ["usuario"],
  nivel1_ceo:          ["ag-002"],
  nivel2_diretorias:   ["ag-001", "ag-020", "ag-004"],
  nivel3_gerencias:    ["ag-003", "ag-014", "ag-021", "ag-025"],
  nivel4_execucao:     [
    "ag-006","ag-007","ag-008",
    "ag-009","ag-010","ag-011",
    "ag-012","ag-013",
    "ag-015","ag-016","ag-017",
    "ag-022","ag-023","ag-024",
  ],
  nivel5_atendimento:  ["ag-005","ag-018","ag-019"],
};

export const ROOM_BOUNDS = {
  diretoria:   { x: 130, y:  70, w: 160, h: 150, cx: 152, cy: 145 },
  sala_ceo:    { x: 295, y:  70, w: 155, h: 150, cx: 310, cy: 145 },
  reuniao_01:  { x: 460, y:  70, w: 155, h: 110, cx: 518, cy: 125 },
  reuniao_02:  { x: 625, y:  70, w: 155, h: 110, cx: 683, cy: 125 },
  lounge:      { x: 790, y:  70, w:  95, h:  85, cx: 837, cy: 112 },
  estrategia:  { x: 130, y: 225, w: 165, h: 165, cx: 145, cy: 310 },
  copy_lab:    { x: 295, y: 225, w: 155, h: 165, cx: 307, cy: 310 },
  design:      { x: 455, y: 225, w: 155, h: 165, cx: 467, cy: 310 },
  performance: { x: 615, y: 225, w: 160, h: 165, cx: 627, cy: 310 },
  conteudo:    { x: 775, y: 225, w: 185, h: 165, cx: 835, cy: 310 },
  recepcao:    { x: 390, y: 395, w: 195, h: 110, cx: 480, cy: 450 },
};

export const RELACIONAMENTOS: Record<string, string[]> = {
  "ag-002": ["ag-001","ag-020","ag-004","ag-014"],
  "ag-001": ["ag-002","ag-003","ag-012","ag-014","ag-020"],
  "ag-020": ["ag-002","ag-001","ag-021","ag-025","ag-014"],
  "ag-004": ["ag-002","ag-001","ag-003","ag-020"],
  "ag-003": ["ag-001","ag-004","ag-005","ag-006","ag-009"],
  "ag-014": ["ag-001","ag-002","ag-020","ag-012","ag-013"],
  "ag-021": ["ag-020","ag-022","ag-024","ag-025"],
  "ag-025": ["ag-020","ag-021","ag-018","ag-019"],
  "ag-006": ["ag-003","ag-007","ag-009"],
  "ag-007": ["ag-006","ag-008","ag-015"],
  "ag-008": ["ag-007"],
  "ag-009": ["ag-003","ag-006","ag-010","ag-012"],
  "ag-010": ["ag-009","ag-011","ag-015"],
  "ag-011": ["ag-010"],
  "ag-012": ["ag-003","ag-009","ag-013","ag-014"],
  "ag-013": ["ag-012","ag-014","ag-015"],
  "ag-015": ["ag-007","ag-010","ag-013","ag-016"],
  "ag-016": ["ag-015","ag-017"],
  "ag-017": ["ag-016","ag-018"],
  "ag-022": ["ag-021","ag-023","ag-024"],
  "ag-023": ["ag-022","ag-025","ag-024"],
  "ag-024": ["ag-021","ag-022","ag-023","ag-025"],
  "ag-018": ["ag-025","ag-019","ag-022"],
  "ag-019": ["ag-018","ag-025"],
  "ag-005": ["ag-003","ag-004","ag-025"],
};

export interface Reuniao {
  id: string;
  nome: string;
  convocante: string;
  participantes: string[];
  sala: string;
  sala_id: string;
  sala_posicao: { x: number; y: number };
  duracao_segundos: number;
  intervalo_minutos: number;
  descricao: string;
  gatilho?: string;
}

export const REUNIOES: Reuniao[] = [
  {
    id: "briefing_campanha",
    nome: "Briefing de Campanha",
    convocante: "ag-003",
    participantes: ["ag-003","ag-006","ag-009"],
    sala: "reuniao_01",
    sala_id: "meeting_room_01",
    sala_posicao: { x: 497, y: 86 },
    duracao_segundos: 45,
    intervalo_minutos: 5,
    gatilho: "nova_campanha",
    descricao: "Estratégia alinha Copy e Design para nova campanha",
  },
  {
    id: "review_performance",
    nome: "Review de Performance",
    convocante: "ag-014",
    participantes: ["ag-014","ag-001","ag-012","ag-013"],
    sala: "reuniao_02",
    sala_id: "meeting_room_02",
    sala_posicao: { x: 626, y: 86 },
    duracao_segundos: 40,
    intervalo_minutos: 6,
    gatilho: "cpl_acima_meta",
    descricao: "Analytics apresenta resultados para Marketing e Tráfego",
  },
  {
    id: "alinhamento_conteudo",
    nome: "Alinhamento de Conteúdo",
    convocante: "ag-001",
    participantes: ["ag-001","ag-007","ag-015"],
    sala: "reuniao_01",
    sala_id: "meeting_room_01",
    sala_posicao: { x: 497, y: 86 },
    duracao_segundos: 35,
    intervalo_minutos: 7,
    gatilho: "calendario_vazio",
    descricao: "Marketing alinha Copy e Social para calendário",
  },
  {
    id: "briefing_executivo",
    nome: "Briefing Executivo",
    convocante: "ag-002",
    participantes: ["ag-002","ag-001","ag-020","ag-014"],
    sala: "reuniao_02",
    sala_id: "meeting_room_02",
    sala_posicao: { x: 626, y: 86 },
    duracao_segundos: 50,
    intervalo_minutos: 10,
    gatilho: "relatorio_semanal",
    descricao: "CEO recebe relatório consolidado de Marketing e Comercial",
  },
  {
    id: "pipeline_review",
    nome: "Review de Pipeline",
    convocante: "ag-021",
    participantes: ["ag-021","ag-022","ag-024"],
    sala: "reuniao_01",
    sala_id: "meeting_room_01",
    sala_posicao: { x: 497, y: 86 },
    duracao_segundos: 40,
    intervalo_minutos: 6,
    gatilho: "pipeline_desatualizado",
    descricao: "Gerente Vendas revisa pipeline com Closer e CRM",
  },
  {
    id: "alinhamento_comercial",
    nome: "Alinhamento Comercial",
    convocante: "ag-020",
    participantes: ["ag-020","ag-021","ag-025"],
    sala: "reuniao_02",
    sala_id: "meeting_room_02",
    sala_posicao: { x: 626, y: 86 },
    duracao_segundos: 35,
    intervalo_minutos: 8,
    gatilho: "meta_comercial_risco",
    descricao: "Dir. Comercial alinha Vendas e Atendimento",
  },
];

/* backward-compat alias */
export const REUNIOES_VALIDAS = REUNIOES;

export const SALAS = {
  reuniao_01: { x: 460, y: 105, width: 155, height: 110 },
  reuniao_02: { x: 625, y: 105, width: 155, height: 110 },
  lounge:     { x: 720, y: 75,  width: 95,  height: 85  },
  copa:       { x: 720, y: 50,  width: 95,  height: 30  },
};

export interface EtapaFluxo {
  agente: string;
  acao: string;
  duracao: number;
}

export interface Fluxo {
  id: string;
  nome: string;
  etapas: EtapaFluxo[];
  intervalo_minutos: number;
}

export interface GatilhoReuniao {
  id: string;
  condicao: string;
  reuniao_id: string;
  prioridade: "alta" | "media" | "baixa";
  descricao: string;
}

export const GATILHOS_REUNIAO: GatilhoReuniao[] = [
  {
    id: "cpl_acima_meta",
    condicao: "CPL > 20% acima da meta por 2 dias consecutivos",
    reuniao_id: "review_performance",
    prioridade: "alta",
    descricao: "CPL acima da meta dispara review urgente de performance",
  },
  {
    id: "lead_estrategico",
    condicao: "Lead com orçamento > R$80k recebido",
    reuniao_id: "alinhamento_comercial",
    prioridade: "alta",
    descricao: "Lead estratégico exige alinhamento imediato do time comercial",
  },
  {
    id: "nova_campanha",
    condicao: "Novo briefing de campanha aprovado",
    reuniao_id: "briefing_campanha",
    prioridade: "media",
    descricao: "Briefing aprovado convoca Copy, Design e Estratégia",
  },
  {
    id: "cliente_em_risco",
    condicao: "NPS do cliente < 6 ou sem atualização há 7 dias",
    reuniao_id: "alinhamento_comercial",
    prioridade: "alta",
    descricao: "Sinal de churn dispara reunião urgente de CS com Dir. Comercial",
  },
  {
    id: "meta_risco",
    condicao: "Meta mensal abaixo de 70% no dia 20",
    reuniao_id: "briefing_executivo",
    prioridade: "alta",
    descricao: "Meta em risco convoca briefing executivo com CEO",
  },
  {
    id: "relatorio_semanal",
    condicao: "Segunda-feira, 09:00 — início de semana",
    reuniao_id: "briefing_executivo",
    prioridade: "media",
    descricao: "Relatório semanal consolidado apresentado ao CEO toda segunda",
  },
];

export const FLUXOS: Fluxo[] = [
  {
    id: "lead_recebido",
    nome: "Recebimento e Triagem de Lead",
    etapas: [
      { agente: "ag-019", acao: "Lead recebido — verificando origem e projeto",               duracao: 3 },
      { agente: "ag-018", acao: "Triagem OK — qualificando projeto e orçamento",              duracao: 5 },
      { agente: "ag-025", acao: "Lead qualificado aprovado — distribuindo para Closer",       duracao: 3 },
      { agente: "ag-024", acao: "Lead registrado no CRM — pipeline atualizado",               duracao: 3 },
      { agente: "ag-022", acao: "Contato iniciado com lead — diagnóstico em andamento",       duracao: 5 },
    ],
    intervalo_minutos: 1,
  },
  {
    id: "followup_automatico",
    nome: "Follow-up Automático",
    etapas: [
      { agente: "ag-024", acao: "Lead sem resposta há 24h — iniciando follow-up automático", duracao: 4 },
      { agente: "ag-018", acao: "Mensagem de reativação enviada — aguardando resposta",       duracao: 4 },
      { agente: "ag-024", acao: "Follow-up registrado no CRM — lead reativado",               duracao: 3 },
    ],
    intervalo_minutos: 1,
  },
  {
    id: "campanha_completa",
    nome: "Criação de Campanha",
    etapas: [
      { agente: "ag-003", acao: "Criando plano de campanha para reformas residenciais...",    duracao: 8  },
      { agente: "ag-004", acao: "Elaborando briefing completo com objetivos e KPIs...",       duracao: 8  },
      { agente: "ag-006", acao: "Desenvolvendo copy persuasivo para Meta e Google...",        duracao: 10 },
      { agente: "ag-009", acao: "Criando criativos visuais para anúncios...",                 duracao: 10 },
      { agente: "ag-012", acao: "Subindo campanha no Google Ads — orçamento definido",        duracao: 6  },
      { agente: "ag-013", acao: "Ativando campanha no Meta Ads com segmentação precisa! 🚀",  duracao: 6  },
      { agente: "ag-014", acao: "Monitorando CPL e ROAS das primeiras horas...",              duracao: 8  },
      { agente: "ag-001", acao: "Campanha aprovada! CPL dentro da meta — excelente!",         duracao: 5  },
    ],
    intervalo_minutos: 5,
  },
  {
    id: "conteudo_organico",
    nome: "Produção de Conteúdo",
    etapas: [
      { agente: "ag-003", acao: "Planejando pauta de conteúdo sobre reformas e decoração...", duracao: 6 },
      { agente: "ag-007", acao: "Escrevendo posts e legendas para Instagram e LinkedIn...",   duracao: 8 },
      { agente: "ag-010", acao: "Criando artes e templates para os posts...",                 duracao: 8 },
      { agente: "ag-015", acao: "Agendando publicações da semana no calendário editorial...", duracao: 6 },
      { agente: "ag-016", acao: "Monitorando engajamento e respondendo comentários...",       duracao: 6 },
    ],
    intervalo_minutos: 3,
  },
  {
    id: "relatorio_executivo",
    nome: "Relatório Executivo",
    etapas: [
      { agente: "ag-014", acao: "Compilando dados: leads, CPL, ROAS, fechamentos...",        duracao: 8 },
      { agente: "ag-014", acao: "Relatório consolidado pronto — enviando para Marina...",    duracao: 4 },
      { agente: "ag-001", acao: "Analisando resultados de marketing e comercial...",          duracao: 6 },
      { agente: "ag-001", acao: "Apresentando ao CEO — semana com 23 leads, 8 qualificados", duracao: 4 },
      { agente: "ag-002", acao: "Ótimos números! Meta de leads atingida! 💪",                 duracao: 5 },
    ],
    intervalo_minutos: 5,
  },
  {
    id: "monitoramento_cs",
    nome: "Monitoramento de Clientes",
    etapas: [
      { agente: "ag-024", acao: "Verificando clientes sem atualização há mais de 5 dias",    duracao: 4 },
      { agente: "ag-023", acao: "Coletando NPS de cliente com obra em andamento",             duracao: 5 },
      { agente: "ag-023", acao: "NPS coletado — cliente satisfeito com andamento da reforma", duracao: 4 },
      { agente: "ag-025", acao: "Atendimento proativo registrado — fila zerada",              duracao: 3 },
    ],
    intervalo_minutos: 2,
  },
];

export const GOVERNANCA = {
  acoes_criticas: {
    aumentar_budget: {
      recomenda: ["ag-012","ag-013"],
      aprova: ["ag-001"],
      acima_de_valor: { valor: 5000, aprova: "ag-002" },
    },
    subir_campanha: {
      recomenda: ["ag-006","ag-009"],
      aprova: ["ag-001"],
    },
    fechar_proposta: {
      recomenda: ["ag-022"],
      aprova: ["ag-021"],
      acima_de_valor: { valor: 30000, aprova: "ag-020" },
      acima_de_valor_ceo: { valor: 100000, aprova: "ag-002" },
    },
    cancelar_cliente: {
      recomenda: ["ag-023","ag-025"],
      aprova: ["ag-020"],
      sempre_notifica: "ag-002",
    },
    distribuir_lead: {
      recomenda: ["ag-018"],
      aprova: ["ag-025"],
    },
    publicar_conteudo: {
      recomenda: ["ag-015","ag-016"],
      aprova: ["ag-001"],
    },
    mudanca_estrategia: {
      recomenda: ["ag-003"],
      aprova: ["ag-001"],
      sempre_notifica: "ag-002",
    },
    relatorio_usuario: {
      consolida: "ag-014",
      apresenta: "ag-002",
    },
  },
  protecoes: {
    ceo_so_convocado_por: ["ag-001","ag-020","ag-004","ag-014"],
    diretor_so_convocado_por_nivel: [1, 2, 3],
    atendente_nao_pode_aprovar: true,
    execucao_nao_age_sem_aprovacao: true,
  },
};

export const FLUXO_COMERCIAL: Fluxo[] = [
  {
    id: "lead_quente",
    nome: "Lead Quente Recebido",
    etapas: [
      { agente: "ag-019", acao: "Novo contato recebido — triando origem",                  duracao: 4  },
      { agente: "ag-018", acao: "Qualificando lead — verificando projeto e orçamento",     duracao: 8  },
      { agente: "ag-018", acao: "Lead qualificado! Agendando com Closer",                  duracao: 4  },
      { agente: "ag-022", acao: "Fazendo diagnóstico do projeto com o lead",               duracao: 10 },
      { agente: "ag-022", acao: "Proposta enviada — R$ 45k reforma residencial",           duracao: 6  },
      { agente: "ag-021", acao: "Revisando proposta antes do envio",                       duracao: 4  },
      { agente: "ag-022", acao: "Contrato fechado! Passando para CS",                      duracao: 4  },
      { agente: "ag-023", acao: "Iniciando onboarding do novo cliente",                    duracao: 6  },
      { agente: "ag-024", acao: "Atualizando CRM — deal fechado!",                         duracao: 4  },
      { agente: "ag-020", acao: "Nova receita registrada — meta avançando!",               duracao: 4  },
    ],
    intervalo_minutos: 5,
  },
  {
    id: "followup_morno",
    nome: "Follow-up Lead Morno",
    etapas: [
      { agente: "ag-024", acao: "Lead morno sem contato há 48h — iniciando follow-up",    duracao: 5  },
      { agente: "ag-018", acao: "Retomando contato com lead de reforma",                   duracao: 6  },
      { agente: "ag-018", acao: "Lead reaquecido — agendando reunião",                     duracao: 4  },
      { agente: "ag-021", acao: "Follow-up convertido — pipeline atualizado",              duracao: 4  },
    ],
    intervalo_minutos: 4,
  },
  {
    id: "pos_venda",
    nome: "Pós-venda e Retenção",
    etapas: [
      { agente: "ag-023", acao: "Verificando satisfação do cliente com parceiro",          duracao: 6  },
      { agente: "ag-023", acao: "NPS coletado — cliente satisfeito com andamento",         duracao: 4  },
      { agente: "ag-023", acao: "Oportunidade de upsell identificada — marcenaria",        duracao: 4  },
      { agente: "ag-022", acao: "Apresentando proposta de upsell para cliente",            duracao: 6  },
      { agente: "ag-020", acao: "Upsell aprovado — receita adicional gerada!",             duracao: 4  },
    ],
    intervalo_minutos: 6,
  },
];

export const FRASES: Record<string, Record<string, string[]>> = {
  analitico_formal: {
    trabalhando: [
      "Processando métricas da campanha...",
      "Analisando dados de conversão...",
      "Documentando resultados...",
      "Verificando KPIs do período...",
      "Atualizando pipeline com novos leads qualificados",
      "Identificando leads sem contato há mais de 48h",
      "Gerando relatório de funil para Gerente de Vendas",
      "Segmentando leads por tipo de projeto e orçamento",
    ],
    em_reuniao: [
      "Apresentando relatório de performance.",
      "Dados confirmam crescimento de 18%.",
      "Recomendo ajuste na segmentação.",
    ],
    comemorando: [
      "Meta atingida. Dentro do esperado.",
      "Eficiência: 94%. Resultado positivo.",
    ],
  },
  criativo_entusiasta: {
    trabalhando: [
      "Criando copy que vai CONVERTER! 🔥",
      "Ideia incrível para o anúncio...",
      "Desenvolvendo conceito visual...",
      "Esse headline vai bombar!",
    ],
    em_reuniao: [
      "Tenho uma ideia INCRÍVEL para a campanha!",
      "Vamos fazer algo que ninguém viu antes!",
      "Esse conceito vai viralizar! 🚀",
    ],
    comemorando: [
      "🎉 CAMPANHA NO AR! Vamos dominar!",
      "Meta batida! Bora para a próxima! 💪",
    ],
  },
  empatico_casual: {
    trabalhando: [
      "Atendendo cliente com atenção 😊",
      "Qualificando lead recebido...",
      "Alinhando expectativas do cliente...",
    ],
    em_reuniao: [
      "Como posso ajudar a equipe?",
      "Vamos resolver isso juntos!",
      "Ótima ideia! Vou apoiar.",
    ],
    comemorando: [
      "Que legal! Cliente super satisfeito! 😊",
      "Time incrível! Juntos somos mais fortes!",
    ],
  },
  competitivo_assertivo: {
    trabalhando: [
      "Otimizando performance agora!",
      "ROAS acima da meta. Escalando!",
      "Campanha rodando. Monitorando.",
      "Analisando pipeline comercial da semana",
      "Verificando taxa de conversão do Closer",
      "Acompanhando CAC e LTV dos clientes ativos",
      "Revisando meta de receita do mês",
      "Fazendo diagnóstico de projeto de reforma com lead",
      "Criando proposta personalizada de R$ 38k",
      "Tratando objeção de prazo com lead qualificado",
      "Finalizando contrato de marcenaria sob medida",
    ],
    em_reuniao: [
      "Precisamos aumentar o budget. Agora.",
      "Concorrente perdendo. Nossa chance!",
      "Resultado: +34% em 7 dias.",
      "Meta de fechamento em risco — precisamos agir",
      "CAC subindo — revisar qualidade dos leads",
      "Proposta de R$ 65k aguarda minha aprovação",
    ],
    comemorando: [
      "🏆 PRIMEIRO LUGAR! Concorrência destruída!",
      "ROAS 4.8x! Superamos a meta!",
      "Fechei! Contrato de R$ 52k assinado!",
      "Deal fechado — parceiro de arquitetura confirmado!",
      "Meta de fechamento da semana batida! 🏆",
    ],
  },
  competitivo_estrategico: {
    trabalhando: [
      "Revisando pipeline com Closer e CRM",
      "Verificando propostas pendentes de aprovação",
      "Acompanhando taxa de fechamento da semana",
      "Analisando motivos de perda das últimas negociações",
      "Planejando meta de vendas da próxima semana",
    ],
    em_reuniao: [
      "Pipeline precisa de atenção — 3 deals parados",
      "Taxa de fechamento abaixo da meta — ajustando",
      "Preciso de mais criativos para o Closer usar",
    ],
    comemorando: [
      "Pipeline bateu a meta do mês! 📈",
      "Semana mais forte do trimestre — seguindo!",
    ],
  },
  pragmatico_estrategico: {
    trabalhando: [
      "Executando plano conforme definido.",
      "Fase 1 concluída. Iniciando fase 2.",
      "Alinhando estratégia com objetivos.",
    ],
    em_reuniao: [
      "Proposta: focar em conversão primeiro.",
      "Dados indicam oportunidade em SP.",
      "Plano de 90 dias pronto para revisão.",
    ],
    comemorando: [
      "Estratégia validada. Próxima etapa.",
      "Objetivo alcançado. Ajustando meta.",
    ],
  },
  empatico_estrategico: {
    trabalhando: [
      "Equilibrando dados com intuição humana.",
      "Alinhando equipe com os objetivos.",
      "Garantindo que todos estejam na mesma página.",
      "Planejando próximos passos com cuidado.",
      "Acompanhando satisfação de cliente em obra",
      "Coletando NPS do cliente que fechou semana passada",
      "Verificando andamento da obra com parceiro",
      "Identificando oportunidade de upsell em marcenaria",
      "Monitorando cliente com sinal de insatisfação",
    ],
    em_reuniao: [
      "Como podemos crescer juntos aqui?",
      "Vamos ouvir todos antes de decidir.",
      "Cada perspectiva agrega valor ao plano.",
    ],
    comemorando: [
      "Time unido chega mais longe! 🎯",
      "Estratégia humana funcionou perfeitamente.",
    ],
    alerta: [
      "Cliente insatisfeito com prazo do parceiro — urgente",
      "NPS baixo detectado — risco de cancelamento",
      "Cliente sem atualização há 7 dias — verificar",
    ],
  },
  analitico_estrategico: {
    trabalhando: [
      "Mapeando pontos críticos do fluxo.",
      "Análise de longo prazo em andamento.",
      "Cruzando dados para decisão estratégica.",
      "Documentando insights do período.",
    ],
    em_reuniao: [
      "Os dados suportam essa direção.",
      "Recomendo análise antes de escalar.",
      "Tendência de crescimento confirmada.",
    ],
    comemorando: [
      "Previsão confirmada. Modelo validado.",
      "Resultado dentro do cenário projetado.",
    ],
  },
  pragmatico_assertivo: {
    trabalhando: [
      "Tarefa em execução. Sem desvios.",
      "Foco total na entrega.",
      "Otimizando processo agora.",
      "Próxima ação já definida.",
    ],
    em_reuniao: [
      "Vamos direto ao ponto.",
      "Decisão tomada. Executando.",
      "Sem rodeios: qual é o prazo?",
    ],
    comemorando: [
      "Entregue. Próxima tarefa.",
      "Resultado obtido conforme previsto. 💪",
    ],
  },
  empatico_assertivo: {
    trabalhando: [
      "Monitorando tempo de resposta dos atendentes",
      "Verificando fila de leads aguardando contato",
      "Aprovando distribuição de lead qualificado para parceiro",
      "Analisando qualidade do primeiro atendimento",
      "Garantindo que nenhum lead fique sem resposta",
    ],
    em_reuniao: [
      "Time de atendimento precisa de mais suporte",
      "Taxa de resposta abaixo dos 5 min — ajustando",
      "Lead qualificado sem retorno — investigando",
    ],
    comemorando: [
      "Atendimento zerou a fila! Excelente time! 🎉",
      "NPS do atendimento bateu 9.2 — resultado incrível!",
    ],
  },
  criativo_estrategico: {
    trabalhando: [
      "Conceito visual com propósito estratégico.",
      "Criatividade alinhada aos objetivos.",
      "Desenvolvendo ideia com visão de futuro.",
      "Inovação que converte.",
    ],
    em_reuniao: [
      "Tenho um conceito que vai além do esperado.",
      "A criatividade aqui serve à estratégia.",
      "Vamos criar algo que dure.",
    ],
    comemorando: [
      "Ideia poderosa e estratégica aprovada! 🚀",
      "Criatividade com resultado: missão cumprida.",
    ],
  },
  criativo_casual: {
    trabalhando: [
      "Fluindo com as ideias do dia...",
      "Criando no meu ritmo natural.",
      "Deixando a criatividade guiar.",
      "Peça nova tomando forma...",
    ],
    em_reuniao: [
      "Relaxa, vai ficar incrível!",
      "Tenho uma ideia bem diferente aqui.",
      "Vamos experimentar, né?",
    ],
    comemorando: [
      "Que resultado mais bacana! 😎",
      "Fluiu do jeito certo hoje!",
    ],
  },
  criativo_assertivo: {
    trabalhando: [
      "Conceito definido. Executando com confiança.",
      "Criatividade com decisão firme.",
      "Arte que comunica poder.",
      "Desenvolvendo com precisão criativa.",
    ],
    em_reuniao: [
      "Esse conceito vai dominar!",
      "Aprovação rápida — vamos entregar.",
      "Minha visão criativa é clara.",
    ],
    comemorando: [
      "Arte aprovada! Impacto garantido! 🔥",
      "Criatividade assertiva = resultado!",
    ],
  },
  analitico_assertivo: {
    trabalhando: [
      "Dados confirmam: otimização necessária.",
      "Métricas acima da meta. Escalando.",
      "Analisando com decisão rápida.",
      "ROAS monitorado. Ajustando lances.",
    ],
    em_reuniao: [
      "Os números justificam a ação.",
      "Dado confirma. Vamos avançar.",
      "Análise feita. Decisão: escalar.",
    ],
    comemorando: [
      "Meta superada! Dados comprovam. 📊",
      "Performance acima do previsto!",
    ],
  },
  empatico_entusiasta: {
    trabalhando: [
      "Atendendo com energia e cuidado! 😊",
      "Cada cliente merece o melhor!",
      "Conexão genuína em andamento...",
      "Transformando atendimento em experiência!",
    ],
    em_reuniao: [
      "Adoro trabalhar com esse time!",
      "Juntos somos muito mais fortes!",
      "Que energia incrível nessa reunião!",
    ],
    comemorando: [
      "Que conquista incrível! Juntos! 🎉",
      "Time de ouro! Orgulho total! 💙",
    ],
  },
};

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function getChavePerfil(humor: string, personalidade: string): string {
  return `${normalize(humor)}_${normalize(personalidade)}`;
}

export function getFrase(humor: string, personalidade: string, estado: string): string {
  const key = getChavePerfil(humor, personalidade);
  const map = FRASES[key] ?? FRASES["pragmatico_estrategico"];
  const arr = (map?.[estado] ?? map?.["trabalhando"]) as string[] | undefined;
  const list = arr ?? ["Processando..."];
  return list[Math.floor(Math.random() * list.length)];
}
