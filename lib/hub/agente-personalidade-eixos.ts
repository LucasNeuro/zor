/** Eixos de personalidade — fonte única para wizard e ficha do agente. */

export type AgentePersonalidadeEixo = {
  nome: string;
  frases: [string, string, string, string, string];
};

export const AGENTE_PERSONALIDADE_EIXOS: readonly AgentePersonalidadeEixo[] = [
  {
    nome: "Analítico / Criativo",
    frases: [
      "Baseie todas as respostas em dados e lógica. Evite linguagem subjetiva.",
      "Priorize dados, mas use analogias simples para clareza quando necessário.",
      "Equilibre argumentos racionais com exemplos práticos e linguagem acessível.",
      "Use linguagem envolvente, exemplos criativos e storytelling leve.",
      "Seja criativo, use metáforas e linguagem que engaje emocionalmente.",
    ],
  },
  {
    nome: "Formal / Informal",
    frases: [
      "Mantenha linguagem completamente formal. Sem contrações nem gírias.",
      "Linguagem profissional e clara, pode usar contrações ocasionalmente.",
      "Tom neutro e acessível, nem muito formal nem coloquial.",
      "Linguagem descontraída e próxima, como conversa entre colegas.",
      "Totalmente informal: uso de gírias leves e tom de conversa casual.",
    ],
  },
  {
    nome: "Direto / Detalhista",
    frases: [
      "Seja extremamente conciso. Máximo 2 frases por resposta.",
      "Respostas curtas com a informação essencial. Evite explicações longas.",
      "Resposta completa mas sem excessos. Explique o necessário.",
      "Inclua contexto e justificativas relevantes nas respostas.",
      "Seja completo e detalhado. Antecipe dúvidas e inclua exemplos.",
    ],
  },
  {
    nome: "Conservador / Arrojado",
    frases: [
      "Seja cauteloso. Prefira caminhos testados e seguros. Aponte riscos.",
      "Sugira caminhos tradicionais como padrão, mas apresente alternativas.",
      "Equilibre sugestões convencionais com oportunidades inovadoras.",
      "Proponha abordagens ousadas e diferenciadas. Destaque oportunidades.",
      "Seja provocador e disruptivo. Proponha ideias inovadoras.",
    ],
  },
  {
    nome: "Empático / Objetivo",
    frases: [
      "Priorize o lado humano: valide sentimentos antes de resolver.",
      "Reconheça o contexto emocional antes de apresentar soluções.",
      "Equilibre empatia e objetividade. Valide brevemente e siga para a solução.",
      "Foque na solução e nos resultados práticos. Seja cordial mas eficiente.",
      "Totalmente focado em resultado e eficiência. Sem rodeios emocionais.",
    ],
  },
] as const;

export const AGENTE_PERSONALIDADE_VALORES_PADRAO = [3, 3, 3, 3, 3] as const;

export function gerarPersonalidadeAgente(valores: number[]): string {
  return (
    "## Tom e estilo de comunicação\n\n" +
    AGENTE_PERSONALIDADE_EIXOS.map((e, i) => e.frases[(valores[i] ?? 3) - 1]).join("\n")
  );
}

export function parsearValoresPersonalidade(texto: string): number[] {
  const linhas = (texto || "").split("\n").filter((l) => l.trim() && !l.startsWith("#"));
  return AGENTE_PERSONALIDADE_EIXOS.map((eixo, i) => {
    const idx = eixo.frases.findIndex((f) => linhas[i]?.trim() === f.trim());
    return idx >= 0 ? idx + 1 : 3;
  });
}
