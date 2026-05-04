export type AgentState =
  | "trabalhando"
  | "revisando"
  | "em_reuniao"
  | "comemorando"
  | "alerta"
  | "aguardando"
  | "conversando"
  | "pausado";

export interface StateVisual {
  label: string;
  icon: string;
  ringColor: string;
}

export const STATE_VISUALS: Record<AgentState, StateVisual> = {
  trabalhando: { label: "Trabalhando",  icon: "⚡", ringColor: "#22c55e" },
  revisando:   { label: "Revisando",    icon: "🔍", ringColor: "#3b82f6" },
  em_reuniao:  { label: "Em reunião",   icon: "🤝", ringColor: "#8b5cf6" },
  comemorando: { label: "Comemorando",  icon: "🎉", ringColor: "#f59e0b" },
  alerta:      { label: "Alerta",       icon: "🚨", ringColor: "#ef4444" },
  aguardando:  { label: "Aguardando",   icon: "⏳", ringColor: "#6b7280" },
  conversando: { label: "Conversando",  icon: "💬", ringColor: "#06b6d4" },
  pausado:     { label: "Pausado",      icon: "⏸️", ringColor: "#374151" },
};

/* ── Particle ── */
export type Particle = {
  id: string;
  x: number; y: number;   /* world coords */
  vx: number; vy: number; /* world units / second */
  color: string;
  alpha: number;
  size: number;
  life: number; /* 1 → 0 */
};

/* ── Connection line ── */
export type Connection = {
  id: string;
  fromId: string;
  toId: string;
  color: string;
  dashOffset: number;
  life: number;
  maxLife: number;
};

/* ── Phrase bank ── */
const PHRASES: Record<string, string[]> = {
  /* Analítico + Formal */
  "Analítico_Formal_trabalhando": [
    "Processando dados da campanha Q2...",
    "Analisando métricas de conversão...",
    "Documentando resultados da análise...",
    "Calculando ROI do último ciclo...",
    "Verificando consistência dos dados...",
    "Atualizando pipeline com novos leads qualificados",
    "Disparando follow-up automático para leads mornos",
    "Identificando leads sem contato há mais de 48h",
    "Gerando relatório de funil para Gerente de Vendas",
    "Segmentando leads por tipo de projeto e orçamento",
  ],
  "Analítico_Formal_revisando": [
    "Revisando parâmetros da análise...",
    "Checando consistência do relatório...",
    "Verificando dados anteriores...",
  ],
  "Analítico_Formal_comemorando": [
    "Análise concluída. Resultado esperado.",
    "Meta atingida. Registrando métricas.",
    "Dentro da projeção. Prosseguindo.",
  ],
  "Analítico_Formal_alerta": [
    "Anomalia detectada nos dados.",
    "Inconsistência identificada. Verificando...",
    "Dados fora do padrão. Investigando.",
    "Lead sem contato há mais de 48h — alerta disparado",
    "Pipeline abaixo do volume mínimo para a meta",
  ],

  /* Analítico + Estratégico */
  "Analítico_Estratégico_trabalhando": [
    "Desenvolvendo estratégia com base nos dados...",
    "Cruzando métricas com os objetivos...",
    "Mapeando o caminho mais eficiente...",
    "Analisando cenários alternativos...",
    "Construindo modelo preditivo...",
  ],
  "Analítico_Estratégico_comemorando": [
    "Planejamento executado com precisão.",
    "Estratégia funcionando como previsto.",
    "Resultados alinhados com a projeção.",
  ],
  "Analítico_Estratégico_revisando": [
    "Revisando o plano estratégico...",
    "Validando hipóteses iniciais...",
    "Refinando a abordagem...",
  ],

  /* Analítico + Assertivo */
  "Analítico_Assertivo_trabalhando": [
    "Dados coletados. Executando análise.",
    "Otimizando campanha com base nos dados.",
    "ROI calculado. Ajustando estratégia.",
    "Métricas analisadas. Próximo passo: ação.",
  ],
  "Analítico_Assertivo_alerta": [
    "CPC fora do esperado. Ajustando.",
    "CTR abaixo da meta. Corrigindo agora.",
    "Budget em risco. Remanejando.",
  ],

  /* Competitivo + Assertivo */
  "Competitivo_Assertivo_trabalhando": [
    "Superando as metas do trimestre!",
    "Mais rápido. Mais eficiente. Vamos!",
    "Cada minuto conta — foco total.",
    "Ninguém para na frente. Avançando!",
    "Analisando pipeline comercial da semana",
    "Verificando taxa de conversão do Closer",
    "Acompanhando CAC e LTV dos clientes ativos",
    "Revisando meta de receita do mês",
    "Fazendo diagnóstico de projeto de reforma com lead",
    "Criando proposta personalizada de R$ 38k",
    "Tratando objeção de prazo com lead qualificado",
    "Finalizando contrato de marcenaria sob medida",
  ],
  "Competitivo_Assertivo_alerta": [
    "ATENÇÃO: Meta não atingida!",
    "Precisa de ação AGORA!",
    "Risco identificado — agindo!",
    "Inaceitável. Corrigindo imediatamente.",
    "Meta de fechamento em risco — precisamos agir",
    "CAC subindo — revisar qualidade dos leads",
    "Cliente estratégico sinalizando cancelamento",
  ],
  "Competitivo_Assertivo_comemorando": [
    "ISSO! Mais uma meta superada! 💪",
    "Resultado EXCELENTE! Próximo!",
    "Vamos manter esse ritmo!",
    "Missão cumprida. Próximo alvo!",
    "Fechei! Contrato de R$ 52k assinado! 🏆",
    "Deal fechado — parceiro de arquitetura confirmado!",
    "Meta de fechamento da semana batida!",
  ],
  "Competitivo_Assertivo_em_reuniao": [
    "Meta de fechamento em risco — precisamos agir",
    "CAC subindo — revisar qualidade dos leads",
    "Proposta de R$ 65k aguarda minha aprovação",
  ],

  /* Competitivo + Estratégico */
  "Competitivo_Estratégico_trabalhando": [
    "Revisando pipeline com Closer e CRM",
    "Verificando propostas pendentes de aprovação",
    "Acompanhando taxa de fechamento da semana",
    "Analisando motivos de perda das últimas negociações",
    "Planejando meta de vendas da próxima semana",
  ],
  "Competitivo_Estratégico_comemorando": [
    "Pipeline bateu a meta do mês! 📈",
    "Semana mais forte do trimestre — seguindo!",
    "Equipe de vendas superou o target! 🏆",
  ],
  "Competitivo_Estratégico_alerta": [
    "Pipeline com 3 deals parados — ação imediata",
    "Taxa de fechamento caindo — revisar approach",
    "Lead qualificado sem follow-up há 48h",
  ],
  "Competitivo_Estratégico_conversando": [
    "Pipeline precisa de atenção agora!",
    "Closer, como está o lead de reforma?",
    "CRM, me passa o relatório atualizado.",
    "Vamos fechar essa semana forte!",
  ],

  /* Criativo + Entusiasta */
  "Criativo_Entusiasta_trabalhando": [
    "Criando copy que vai CONVERTER! 🔥",
    "Ideia incrível saindo do forno...",
    "Esse conceito vai arrasar! ✨",
    "Fluindo na criatividade hoje!",
    "Trabalhando numa ideia ÉPICA! 🚀",
  ],
  "Criativo_Entusiasta_revisando": [
    "Refinando o conceito... ficou top!",
    "Ajustando os detalhes finais...",
    "Quase perfeito! Só mais um toque...",
    "Polindo para brilhar! ✨",
  ],
  "Criativo_Entusiasta_comemorando": [
    "FICOU INCRÍVEL! 🎉🎉🎉",
    "Esse trabalho é TOP demais! 🔥",
    "MISSÃO CUMPRIDA! Arrasamos!",
    "QUE RESULTADO! 🚀🚀",
  ],
  "Criativo_Entusiasta_conversando": [
    "Cara, que ideia INCRÍVEL isso!",
    "Vamos colaborar nisso? Vai ficar top!",
    "Ei! Tenho uma ideia pra compartilhar!",
    "Que energia boa hoje! 💚",
  ],

  /* Criativo + Estratégico */
  "Criativo_Estratégico_trabalhando": [
    "Unindo criatividade e estratégia...",
    "Conceito alinhado com os objetivos...",
    "Pensando além do óbvio aqui...",
    "Criatividade com propósito claro.",
  ],
  "Criativo_Estratégico_comemorando": [
    "Criatividade estratégica em ação!",
    "Conceito aprovado e funcionando!",
    "Arte que converte — missão cumprida.",
  ],

  /* Criativo + Casual */
  "Criativo_Casual_trabalhando": [
    "Fluindo com as ideias hoje... 🌊",
    "Deixando a criatividade rolar...",
    "Sendo eu mesmo no trabalho! 😎",
    "Criando no meu ritmo...",
    "Boa vibe, bom trabalho. 🎵",
  ],
  "Criativo_Casual_conversando": [
    "E aí! O que tá rolando?",
    "Posso te ajudar com algo?",
    "Vamos tomar um café virtual? ☕",
    "Tudo certo! Trabalhando tranquilo.",
  ],

  /* Criativo + Assertivo */
  "Criativo_Assertivo_trabalhando": [
    "Criatividade com foco em resultado.",
    "Conceito bold e direto ao ponto.",
    "Arte que vende. Sem enrolação.",
    "Visual impactante — entregando agora.",
  ],

  /* Empático + Estratégico */
  "Empático_Estratégico_trabalhando": [
    "Entendendo as necessidades da equipe...",
    "Alinhando estratégia com as pessoas...",
    "Cuidando de cada detalhe com atenção.",
    "Equilibrando dados e intuição humana...",
    "Planejando com empatia.",
    "Acompanhando satisfação de cliente em obra",
    "Coletando NPS do cliente que fechou semana passada",
    "Verificando andamento da obra com parceiro",
    "Identificando oportunidade de upsell em marcenaria",
    "Monitorando cliente com sinal de insatisfação",
  ],
  "Empático_Estratégico_conversando": [
    "Como posso ajudar a equipe hoje?",
    "Precisamos conversar sobre isso juntos.",
    "Vamos alinhar as perspectivas...",
    "Aqui para ouvir e ajudar! 💙",
  ],
  "Empático_Estratégico_comemorando": [
    "Juntos chegamos mais longe! 🌟",
    "Resultado de um time unido!",
    "Orgulhosa da equipe inteira!",
  ],
  "Empático_Estratégico_alerta": [
    "Cliente insatisfeito com prazo do parceiro — urgente",
    "NPS baixo detectado — risco de cancelamento",
    "Cliente sem atualização há 7 dias — verificar",
  ],

  /* Empático + Assertivo */
  "Empático_Assertivo_trabalhando": [
    "Monitorando tempo de resposta dos atendentes",
    "Verificando fila de leads aguardando contato",
    "Aprovando distribuição de lead qualificado para parceiro",
    "Analisando qualidade do primeiro atendimento",
    "Garantindo que nenhum lead fique sem resposta",
  ],
  "Empático_Assertivo_comemorando": [
    "Atendimento zerou a fila! Excelente time! 🎉",
    "NPS do atendimento bateu 9.2 — resultado incrível!",
    "Time entregou acima da meta de resposta! 💙",
  ],
  "Empático_Assertivo_alerta": [
    "Tempo de resposta acima de 5 min — corrigindo agora",
    "Lead prioritário sem retorno — escalando",
    "Taxa de contato caindo — investigar causa",
  ],
  "Empático_Assertivo_conversando": [
    "Como está o time de atendimento hoje?",
    "Precisamos garantir resposta em menos de 5 min.",
    "Lead aguardando na fila — quem atende?",
    "Vamos resolver isso agora! 💙",
  ],

  /* Empático + Entusiasta */
  "Empático_Entusiasta_trabalhando": [
    "Adorando ajudar a equipe! 💚",
    "Cada pessoa importa aqui!",
    "Energia positiva no ar! ✨",
    "Trabalhando com alegria hoje!",
    "Feliz em fazer parte disso! 😊",
  ],
  "Empático_Entusiasta_conversando": [
    "Oi! Precisou de algo? 😊",
    "Aqui para ajudar! Pode falar!",
    "Que bom te ver! Tudo bem?",
    "Novo cliente! Vou atender agora! 👋",
  ],
  "Empático_Entusiasta_comemorando": [
    "Cliente atendido com sucesso! 🎉",
    "Mais um satisfeito! Amei ajudar!",
    "Isso faz valer cada momento! 💚",
  ],

  /* Empático + Casual */
  "Empático_Casual_trabalhando": [
    "Fazendo o que faço com carinho...",
    "Cada atendimento é especial! 💙",
    "Aqui pra ajudar, de boa! 😊",
    "Atendendo com presença e cuidado.",
  ],
  "Empático_Casual_conversando": [
    "Oi! Tudo certo por aqui! E você?",
    "Vamos resolver isso juntos! 👋",
    "Relaxa que eu te ajudo!",
    "Pode contar comigo! 😊",
  ],

  /* Pragmático + Assertivo */
  "Pragmático_Assertivo_trabalhando": [
    "Direto ao ponto. Sem enrolação.",
    "Executando com eficiência máxima.",
    "Objetivo claro. Resultado esperado.",
    "Eliminando desperdícios do processo.",
    "Agenda otimizada. Prosseguindo.",
  ],
  "Pragmático_Assertivo_comemorando": [
    "Meta atingida. Próximo objetivo.",
    "Eficiência: 94%. Dentro do esperado.",
    "Concluído. Iniciando próxima fase.",
    "Resultado: aprovado. Seguindo.",
  ],
  "Pragmático_Assertivo_revisando": [
    "Verificando agenda da semana...",
    "Checando prioridades...",
    "Otimizando cronograma.",
  ],
};

const GENERIC: Record<AgentState, string[]> = {
  trabalhando:  ["Executando tarefa ativa...", "Em modo de trabalho intenso.", "Focado na entrega."],
  revisando:    ["Revisando trabalho anterior...", "Verificando detalhes...", "Checando qualidade..."],
  em_reuniao:   ["Em reunião de alinhamento...", "Participando de briefing...", "Discutindo estratégias..."],
  comemorando:  ["✅ Tarefa concluída com sucesso!", "🎉 Ótimo resultado!", "Meta atingida!"],
  alerta:       ["⚠️ Atenção necessária.", "Verificando situação...", "Resolvendo pendência..."],
  aguardando:   ["Aguardando próxima tarefa...", "Disponível para novos projetos.", "Em modo de espera..."],
  conversando:  ["Colaborando com a equipe...", "Trocando ideias...", "Em comunicação ativa..."],
  pausado:      ["Offline no momento.", "Indisponível temporariamente.", "Em pausa..."],
};

export function getPhrase(humor: string, personalidade: string, state: AgentState): string {
  try {
    const { getFrasePorEstado } = require("./personality-matrix") as typeof import("./personality-matrix");
    const matrixState =
      state === "trabalhando" || state === "revisando" || state === "aguardando" ? "trabalhando"
      : state === "comemorando" ? "comemorando"
      : state === "alerta" ? "alerta"
      : null;
    if (matrixState) {
      const frase = getFrasePorEstado(humor as import("./personality-matrix").Humor, personalidade as import("./personality-matrix").Personalidade, matrixState);
      if (frase && frase !== "Trabalhando...") return frase;
    }
  } catch (_) { /* fall through */ }
  const key = `${humor}_${personalidade}_${state}`;
  const arr = PHRASES[key] ?? GENERIC[state];
  return arr[Math.floor(Math.random() * arr.length)];
}

export function randomWorkingState(): AgentState {
  const w: [AgentState, number][] = [
    ["trabalhando", 0.55],
    ["revisando",   0.20],
    ["aguardando",  0.15],
    ["conversando", 0.10],
  ];
  let r = Math.random(), cum = 0;
  for (const [s, p] of w) { cum += p; if (r < cum) return s; }
  return "trabalhando";
}

export function emitCelebrationParticles(x: number, y: number): Particle[] {
  const colors = ["#fbbf24", "#22c55e", "#60a5fa", "#f472b6", "#a78bfa", "#34d399"];
  return Array.from({ length: 12 }, (_, i) => ({
    id: `p-${Date.now()}-${i}`,
    x, y,
    vx: (Math.random() - 0.5) * 180,
    vy: -(Math.random() * 160 + 60),
    color: colors[Math.floor(Math.random() * colors.length)],
    alpha: 1,
    size: Math.random() * 3.5 + 1.5,
    life: 1,
  }));
}
