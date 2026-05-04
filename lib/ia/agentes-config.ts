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

// ─── Market identification ────────────────────────────────────────────────────

export function identificarMercado(mensagem: string): MercadoId {
  const t = mensagem.toLowerCase();
  const order: MercadoId[] = ["imobiliario", "arquitetura", "reforma", "fornecedor", "produto"];

  for (const id of order) {
    const mercado = MERCADOS[id];
    if (mercado.palavrasChave.some(kw => t.includes(kw))) return id;
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
