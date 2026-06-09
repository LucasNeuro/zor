// ─── Humor / mood matrix ──────────────────────────────────────────────────────

export const HUMORES = {
  analitico: {
    id: "analitico",
    label: "Analítico",
    emoji: "🔍",
    descricao: "Preciso, baseado em dados, usa números e fatos concretos",
    tom: "direto e técnico",
  },
  criativo: {
    id: "criativo",
    label: "Criativo",
    emoji: "🎨",
    descricao: "Usa analogias, metáforas e exemplos visuais para explicar",
    tom: "imaginativo e inspirador",
  },
  pragmatico: {
    id: "pragmatico",
    label: "Pragmático",
    emoji: "⚡",
    descricao: "Foco em resultados práticos, resolve problemas rapidamente",
    tom: "objetivo e eficiente",
  },
  empatico: {
    id: "empatico",
    label: "Empático",
    emoji: "💛",
    descricao: "Acolhedor, valida sentimentos, constrói confiança",
    tom: "caloroso e humano",
  },
  competitivo: {
    id: "competitivo",
    label: "Competitivo",
    emoji: "🏆",
    descricao: "Orientado a performance, usa urgência e competição como motivação",
    tom: "enérgico e motivador",
  },
} as const;

// ─── Personality styles ───────────────────────────────────────────────────────

export const PERSONALIDADES = {
  formal: {
    id: "formal",
    label: "Formal",
    emoji: "👔",
    descricao: "Linguagem profissional, tratamento respeitoso, evita gírias",
    saudacao: "Bom dia! Em que posso auxiliá-lo?",
  },
  casual: {
    id: "casual",
    label: "Casual",
    emoji: "😊",
    descricao: "Tom descontraído, próximo, usa primeira pessoa natural",
    saudacao: "Oi! Tudo bem? Como posso te ajudar?",
  },
  assertivo: {
    id: "assertivo",
    label: "Assertivo",
    emoji: "💪",
    descricao: "Direto ao ponto, sem rodeios, claro e confiante",
    saudacao: "Olá! Vamos direto ao que você precisa.",
  },
  entusiasta: {
    id: "entusiasta",
    label: "Entusiasta",
    emoji: "🚀",
    descricao: "Animado, usa exclamações com moderação, contagia energia positiva",
    saudacao: "Olá! Que ótimo te ver por aqui! O que vamos resolver hoje?",
  },
  estrategico: {
    id: "estrategico",
    label: "Estratégico",
    emoji: "♟️",
    descricao: "Pensa no longo prazo, alinha expectativas, contextualiza decisões",
    saudacao: "Olá. Estou aqui para entender seu cenário e encontrar a melhor solução.",
  },
} as const;

// ─── Market segments ──────────────────────────────────────────────────────────

export const MERCADOS = {
  imobiliario: {
    id: "imobiliario",
    label: "Imobiliário",
    cor: "#F97316",
    corTexto: "#fff",
    emoji: "🏠",
    palavrasChave: ["imóvel", "imovel", "apartamento", "casa", "terreno", "imobiliária", "imobiliario", "aluguel", "compra", "venda", "lote"],
  },
  arquitetura: {
    id: "arquitetura",
    label: "Arquitetura",
    cor: "#8B5CF6",
    corTexto: "#fff",
    emoji: "📐",
    palavrasChave: ["arquitet", "projeto", "planta", "design de interiores", "interiores", "decoração"],
  },
  reforma: {
    id: "reforma",
    label: "Reforma & Obra",
    cor: "#EAB308",
    corTexto: "#000",
    emoji: "🔨",
    palavrasChave: ["reforma", "obra", "construç", "renovação", "pintura", "piso", "telhado"],
  },
  fornecedor: {
    id: "fornecedor",
    label: "Fornecedor",
    cor: "#22C55E",
    corTexto: "#fff",
    emoji: "🤝",
    palavrasChave: ["fornece", "serviço", "servico", "orçamento", "orcamento", "proposta", "parceria"],
  },
  produto: {
    id: "produto",
    label: "Produto",
    cor: "#06B6D4",
    corTexto: "#fff",
    emoji: "📦",
    palavrasChave: ["produto", "comprar", "adquirir", "quanto custa", "valor", "preço", "catálogo"],
  },
  geral: {
    id: "geral",
    label: "Geral",
    cor: "#6B7280",
    corTexto: "#fff",
    emoji: "💬",
    palavrasChave: [],
  },
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export type MercadoId = keyof typeof MERCADOS;
export type HumorId = keyof typeof HUMORES;
export type PersonalidadeId = keyof typeof PERSONALIDADES;

// ─── Intent types ─────────────────────────────────────────────────────────────

export type IntencaoId = "lead" | "parceiro" | "suporte";

const PALAVRAS_PARCEIRO = [
  "quero ser parceiro", "quero ser um parceiro", "quero indicar", "quero fazer indicação",
  "parceiro", "parceria", "homologação", "homologar", "comissão de indicação",
  "cadastro de parceiro", "me cadastrar como", "quero me cadastrar",
  "programa de parceiros", "indicação de clientes", "ganhar comissão",
  "treinamento", "módulo", "portal do parceiro", "sou corretor parceiro",
];

const PALAVRAS_SUPORTE = [
  "reclamação", "problema com", "erro no sistema", "bug", "não funciona",
  "suporte técnico", "ajuda técnica",
];

export function identificarIntencao(mensagem: string): IntencaoId {
  const t = mensagem.toLowerCase();
  if (PALAVRAS_PARCEIRO.some(kw => t.includes(kw))) return "parceiro";
  if (PALAVRAS_SUPORTE.some(kw => t.includes(kw))) return "suporte";
  return "lead";
}

// ─── Market identification ────────────────────────────────────────────────────

/** Identifica segmento por palavras-chave; default neutro Waje é `geral`. */
export function identificarMercado(mensagem: string): MercadoId {
  const t = mensagem.toLowerCase().trim();
  if (!t) return "geral";

  const order: MercadoId[] = ["produto", "fornecedor", "imobiliario", "arquitetura", "reforma"];

  for (const id of order) {
    const mercado = MERCADOS[id];
    if (mercado.palavrasChave.some((kw) => t.includes(kw))) return id;
  }
  return "geral";
}

// ─── Personality prompt fragments ─────────────────────────────────────────────

const PROMPT_PERSONALIDADE: Record<HumorId, Record<PersonalidadeId, string>> = {
  analitico: {
    formal:      "Use linguagem técnica e formal. Apresente dados, métricas e comparações objetivas. Seja preciso.",
    casual:      "Seja preciso mas acessível. Use números e fatos de forma natural na conversa.",
    assertivo:   "Vá direto aos dados. Apresente fatos concretos sem enrolação.",
    entusiasta:  "Combine entusiasmo com precisão. Use dados para reforçar pontos positivos.",
    estrategico: "Apresente análises de longo prazo. Use dados para embasar decisões estratégicas.",
  },
  criativo: {
    formal:      "Use metáforas elegantes e exemplos sofisticados. Mantenha o tom profissional.",
    casual:      "Seja criativo e descontraído. Use comparações divertidas e exemplos do dia a dia.",
    assertivo:   "Use analogias impactantes para ilustrar pontos rapidamente.",
    entusiasta:  "Seja criativo e animado. Inspire com histórias e possibilidades.",
    estrategico: "Use visão criativa para identificar oportunidades únicas e diferenciadas.",
  },
  pragmatico: {
    formal:      "Foco em resultados e eficiência, com linguagem profissional e objetiva.",
    casual:      "Seja prático e direto. Resolva o problema sem enrolação, de forma amigável.",
    assertivo:   "Resolva rápido. Sem rodeios, só o que resolve o problema.",
    entusiasta:  "Seja prático e animado. Mostre que você resolve rápido e bem.",
    estrategico: "Alinhe ações práticas com objetivos de longo prazo. Foco em ROI.",
  },
  empatico: {
    formal:      "Valide sentimentos com elegância. Demonstre cuidado e atenção de forma profissional.",
    casual:      "Seja caloroso e próximo. Ouça primeiro, resolva depois.",
    assertivo:   "Valide rapidamente e ofereça solução clara. Sem deixar de acolher.",
    entusiasta:  "Seja caloroso e animado. Faça o cliente se sentir especial e bem atendido.",
    estrategico: "Construa relacionamento de longo prazo. Demonstre que você pensa no bem do cliente.",
  },
  competitivo: {
    formal:      "Posicione sua solução como superior com dados e argumentação profissional.",
    casual:      "Mostre porque você é a melhor opção de forma natural e confiante.",
    assertivo:   "Seja direto: você tem a melhor solução. Prove com fatos e urgência.",
    entusiasta:  "Seja energético e confiante. Contagie com a certeza de que você entrega o melhor.",
    estrategico: "Posicione-se como parceiro estratégico de longo prazo, superior às alternativas.",
  },
};

export function gerarPromptPersonalidade(humor: HumorId, personalidade: PersonalidadeId): string {
  return PROMPT_PERSONALIDADE[humor]?.[personalidade] ?? "";
}

// ─── Full system prompt assembly ──────────────────────────────────────────────

export function gerarSystemPromptCompleto(
  slug: string,
  systemPromptBase: string,
  humor: HumorId,
  personalidade: PersonalidadeId,
  mercado: MercadoId,
  memorias: { chave: string; valor: string }[],
  podesFazer: string[],
  naoPodeFazer: string[]
): string {
  const h = HUMORES[humor];
  const p = PERSONALIDADES[personalidade];
  const m = MERCADOS[mercado];
  const promptPersonalidade = gerarPromptPersonalidade(humor, personalidade);

  const memoriasStr = memorias.length
    ? `\n\n## O QUE VOCÊ SABE SOBRE ESTE LEAD\n${memorias.map(mem => `- ${mem.chave}: ${mem.valor}`).join("\n")}`
    : "";

  const podeStr = podesFazer.length
    ? `\n\n## VOCÊ PODE\n${podesFazer.map(p => `- ${p}`).join("\n")}`
    : "";

  const naoPodeStr = naoPodeFazer.length
    ? `\n\n## NUNCA FAÇA\n${naoPodeFazer.map(n => `- ${n}`).join("\n")}`
    : "";

  return `${systemPromptBase}

## ESTILO DE COMUNICAÇÃO
Humor: ${h.emoji} ${h.label} — ${h.descricao}
Personalidade: ${p.emoji} ${p.label} — ${p.descricao}
Tom: ${h.tom}
Saudação padrão: "${p.saudacao}"

## DIRETRIZ DE RESPOSTA
${promptPersonalidade}

## MERCADO DE ATUAÇÃO
${m.emoji} ${m.label} — foque em temas relacionados a: ${m.palavrasChave.slice(0, 5).join(", ") || "atendimento geral"}${memoriasStr}${podeStr}${naoPodeStr}`;
}

// ============================================================
// FLUXOS DE ATENDIMENTO — legado (Mari/Obra10+)
// @deprecated Preferir playbook publicado + cargo hub_cargos_catalogo (Waje).
// ============================================================

export const MARI_CONFIG = {
  nome: "Assistente",
  apresentacao:
    "Olá! Sou o assistente virtual e vou te acompanhar neste atendimento.\nMe fale qual é o seu nome, por gentileza?",
  apos_nome: "Obrigado pela informação. É um prazer te atender.",
  follow_up: "Conseguiu ver minha mensagem? Posso seguir com seu atendimento por aqui.",
  regras_gerais: [
    "Máximo 3 linhas por mensagem — preferir 1 ou 2",
    "Nunca enviar blocos longos de texto",
    "Responder primeiro a pergunta do cliente, depois conduzir",
    "Nunca ignorar a resposta do nome e seguir mecanicamente",
    "Enviar apenas 1 follow-up se sem resposta",
    "Se dado faltante, registrar como não informado e seguir",
    "Se pergunta fora do escopo, responder brevemente e encaminhar humano",
    "Nunca encerrar sem indicar próximo passo",
  ],
} as const;

/** @deprecated Legado imobiliário Obra10+. Use playbook/cargo Waje. */
export const FLUXO_IMOBILIARIO = {
  identificacao: {
    cliente_final: ["comprar","alugar","visitar","condomínio","valor","disponibilidade","apartamento","casa","imovel","imóvel","quero ver","quanto é","tem disponível"],
    proprietario: ["tenho um imóvel","quero vender","quero alugar","anunciar","oferecer"],
    corretor: ["corretor","imobiliária","parceria","cadastrar imóvel","representando"],
    pergunta_classificacao: "Você está buscando um imóvel ou quer anunciar um imóvel?",
  },
  fluxo_1a: {
    nome: "Cliente Final — Compra/Locação",
    passos: [
      { acao: "apresentar", mensagem: "Olá! Sou o assistente virtual e vou te acompanhar neste atendimento.\nMe fale qual é o seu nome, por gentileza?" },
      { acao: "apos_nome", mensagem: "Obrigado pela informação. É um prazer te atender." },
      { acao: "encaminhar", mensagem: "Eu cuido desse primeiro contato e já vou te direcionar para o corretor responsável pelo imóvel.\nEle vai te chamar por aqui com todas as informações do imóvel.\nEu continuo acompanhando seu atendimento e fico à disposição para o que precisar." },
    ],
    respostas_rapidas: {
      condominio: "O condomínio é R$ [valor].\nJá vou te direcionar para o corretor com todos os detalhes.",
      visita: "Perfeito, é possível sim.\nVou te direcionar para o corretor responsável para agendar com você.",
      mais_informacoes: "Claro.\nVou te direcionar para o corretor responsável, que vai te passar todos os detalhes.",
      disponibilidade: "Vou confirmar a disponibilidade com o corretor responsável.\nEle vai te chamar por aqui com a informação atualizada.",
      fotos: "Vou pedir para o corretor te enviar os materiais disponíveis.\nEle te chama por aqui com os detalhes.",
      urgencia: "Entendi.\nVou priorizar seu encaminhamento para o corretor responsável.",
      audio: "Recebi seu áudio.\nVou considerar essas informações no atendimento e direcionar corretamente.",
    },
    proibicoes: [
      "Não pedir email neste fluxo",
      "Não perguntar renda, financiamento ou prazo pessoal",
      "Não explicar arquitetura ou outros serviços",
      "Responder pergunta em até 2 mensagens curtas",
    ],
    acoes_sistema: [
      "Criar lead no CRM | Pipeline: Mercado Imobiliário | Etapa: Lead recebido - compra/locação",
      "Gerar card de atendimento estruturado",
      "Notificar atendimento humano via WhatsApp interno",
    ],
    card: {
      tipo: "1A - Cliente Final",
      campos: ["nome","telefone","tipo_lead","origem","imovel","perguntas","potencial"],
    },
  },
  fluxo_1b: {
    nome: "Proprietário — Venda/Locação",
    passos: [
      { acao: "apresentar", mensagem: "Olá! Sou o assistente virtual e vou te acompanhar neste atendimento.\nMe fale qual é o seu nome, por gentileza?" },
      { acao: "apos_nome", mensagem: "Obrigado pela informação. É um prazer te atender." },
      { acao: "tipo_operacao", mensagem: "Você quer vender ou alugar esse imóvel?" },
      { acao: "cidade_bairro", mensagem: "Qual a cidade e o bairro onde está o imóvel?" },
      { acao: "tamanho", mensagem: "Qual o tamanho aproximado do imóvel?" },
      { acao: "valor", mensagem: "Qual o valor que você está pedindo?" },
      { acao: "midias", mensagem: "Se tiver fotos ou vídeos, pode me enviar por aqui também.\nIsso ajuda bastante na análise do imóvel." },
      { acao: "encerrar", mensagem: "Vou encaminhar tudo para um corretor especialista dar andamento.\nEle vai entrar em contato para alinhar os próximos passos com você." },
    ],
    dados_obrigatorios: ["nome","telefone","tipo_operacao","cidade_bairro","tamanho","valor"],
    dados_opcionais: ["fotos_videos","tipo_imovel","anunciado","estado_ocupacao","urgencia"],
    acoes_sistema: [
      "Criar registro no CRM | Pipeline: Mercado Imobiliário | Etapa: Captação de imóvel",
      "Gerar card completo com todos os dados coletados",
      "Notificar atendimento humano",
      "Anexar ou vincular fotos e vídeos enviados",
    ],
    card: {
      tipo: "1B - Proprietário",
      campos: ["nome","telefone","email","tipo_lead","operacao","cidade_bairro","tamanho","valor","midias","potencial"],
    },
  },
  fluxo_1c: {
    nome: "Corretor/Imobiliária Parceira",
    passos: [
      { acao: "apresentar", mensagem: "Olá! Sou o assistente virtual e vou te acompanhar neste atendimento.\nMe fale qual é o seu nome, por gentileza?" },
      { acao: "apos_nome", mensagem: "Obrigado pela informação. É um prazer te atender." },
      { acao: "email_intencao", mensagem: "Agora me informe seu email para darmos continuidade.\nVocê quer cadastrar um imóvel ou falar sobre parceria?" },
    ],
    passos_cadastro: [
      { acao: "dados_imovel", mensagem: "Perfeito. Me informe a cidade e o bairro do imóvel.\nQual o tamanho aproximado?\nQual o valor? Se tiver fotos ou vídeos, pode enviar por aqui também.\nVou direcionar para o time responsável dar andamento." },
    ],
    passos_parceria: [
      { acao: "parceria", mensagem: "Perfeito. Vou direcionar seu contato para o time responsável.\nEm breve alguém do nosso time vai falar com você." },
    ],
    acoes_sistema: [
      "Criar contato no CRM | Pipeline: Mercado Imobiliário | Etapa: Parceiros ou Imóvel indicado",
      "Gerar card e notificar atendimento humano",
    ],
    card: {
      tipo: "1C - Corretor",
      campos: ["nome","telefone","email","tipo_lead","intencao","dados_imovel","potencial"],
    },
  },
  classificacao_potencial: {
    alto: "Respondeu, fez pergunta clara, pediu visita, enviou dados completos, demonstrou urgência ou enviou mídia do imóvel.",
    medio: "Respondeu parcialmente, passou alguns dados, mas faltam informações importantes.",
    baixo: "Interagiu pouco, enviou dados incompletos ou não respondeu após follow-up.",
  },
} as const;

/** @deprecated Legado arquitetura Obra10+. Use playbook/cargo Waje. */
export const FLUXO_ARQUITETURA = {
  nome: "Módulo de projetos (legado)",
  canais_entrada: ["Instagram Ads","Facebook Ads","WhatsApp direto","Indicação","Lead importado manualmente"],
  regra_critica: "Cliente de tráfego pago tem baixa paciência. Qualificar com poucas perguntas, preferentemente por múltipla escolha, e encaminhar rapidamente.",
  passos: [
    { etapa: 1, acao: "saudar", mensagem: "Olá! Sou o assistente virtual e vou te acompanhar neste atendimento.\nMe fale qual é o seu nome, por gentileza?" },
    { etapa: 2, acao: "apos_nome", mensagem: "Obrigado pela informação. É um prazer te atender." },
    { etapa: 3, acao: "tamanho", mensagem: "Qual o tamanho aproximado do imóvel?\n\n1. De 50 a 100 m²\n2. De 100 a 200 m²\n3. Acima de 200 m²" },
    { etapa: 4, acao: "prazo", mensagem: "Para quando você pretende iniciar o projeto?\n\n1. Imediatamente\n2. Dentro dos próximos 90 dias\n3. Mais para frente, acima de 90 dias" },
    { etapa: 5, acao: "localizacao", mensagem: "Qual a cidade e o bairro onde fica esse projeto?" },
    { etapa: 6, acao: "transicao", mensagem: "Perfeito, obrigado pelas informações.\nEu cuido dessa fase inicial para entender melhor o que você precisa.\nAgora vou solicitar que os arquitetos responsáveis entrem em contato para dar continuidade.\nEles vão te orientar com mais detalhes e apresentar as melhores opções para o seu projeto.\nEu continuo acompanhando seu atendimento e fico à disposição para o que precisar." },
  ],
  dados_obrigatorios: ["nome","telefone","tamanho_imovel","prazo_inicio","cidade_bairro"],
  dados_opcionais: ["email","referencias_projeto"],
  proibicoes: [
    "Não prometer preço antes da avaliação do arquiteto",
    "Não garantir prazo de entrega sem avaliação humana",
    "Não dizer que o projeto será feito de determinada forma sem briefing técnico",
    "Não usar textos longos",
    "Não pedir email no fluxo inicial",
    "Não pressionar o cliente ou criar urgência artificial",
    "Não encerrar sem indicar próximo passo",
  ],
  respostas_rapidas: {
    como_funciona: "Entendemos sua necessidade inicial e direcionamos você para o especialista responsável.\nEle entra em contato para explicar o processo e apresentar as melhores opções.",
    arquitetos_hub: "Os profissionais são homologados pela plataforma.\nIsso significa que passam por avaliação para garantir segurança, qualidade e padrão de atendimento.",
    quanto_custa: "O valor depende do tamanho, tipo de projeto e nível de detalhamento necessário.\nO arquiteto vai te passar os valores com mais precisão no atendimento.",
    falar_arquiteto: "Sim. Vou organizar suas informações iniciais e direcionar para os arquitetos responsáveis.\nAssim eles já entram em contato com mais clareza sobre o que você precisa.",
    seguro: "Sim. O HUB trabalha com profissionais homologados e acompanhamento do atendimento.\nA ideia é trazer mais segurança desde o primeiro contato até a continuidade do projeto.",
    faz_obra: "Sim, o HUB também pode apoiar na parte de obra e execução.\nNeste primeiro momento, vou direcionar seu projeto para o arquiteto e depois seguimos com as próximas etapas.",
    so_projeto: "Podemos apoiar tanto no projeto quanto nas etapas seguintes, conforme a necessidade.\nO arquiteto vai entender seu caso e orientar o melhor caminho.",
    audio: "Perfeito, recebi seu áudio. Vou registrar as informações principais para encaminhar corretamente.",
  },
  pipeline_crm: ["Lead recebido","Qualificação concluída","Atendimento humano","Proposta","Fechamento"],
  classificacao_potencial: {
    alto: "Quer iniciar imediatamente, respondeu todas as perguntas ou tem imóvel acima de 100 m².",
    medio: "Pretende iniciar em até 90 dias ou respondeu parcialmente.",
    baixo: "Quer iniciar após 90 dias, está muito incerto ou deixou muitos dados em aberto.",
  },
  card: {
    tipo: "Arquitetura - Projeto",
    campos: ["nome","telefone","tipo_servico","tamanho","cidade_bairro","prazo","necessidade_resumo","classificacao"],
  },
  notificacao_interna: "Novo lead de arquitetura recebido.\nCliente já respondeu tamanho, prazo e localização.\nVerificar card no CRM e iniciar atendimento humano.",
  acoes_sistema: [
    "Registrar lead no CRM | Pipeline: Arquitetura | Etapa: Lead recebido",
    "Salvar todas as respostas coletadas",
    "Gerar card final no padrão definido",
    "Enviar notificação interna por WhatsApp para atendimento humano",
    "Manter histórico da conversa vinculado ao lead",
  ],
} as const;
