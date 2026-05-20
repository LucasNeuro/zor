/** Condução fluida das perguntas obrigatórias do cargo (hub_cargos_catalogo) — uma por mensagem, sem checklist. */

export type TurnoMinimo = { role: "user" | "assistant"; content: string };

function palavrasChavePergunta(pergunta: string): string[] {
  return pergunta
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 4)
    .slice(0, 8);
}

/** Heurística: a pergunta já foi feita pelo assistente nesta conversa? */
export function perguntaEssencialJaFeita(pergunta: string, turnos: TurnoMinimo[]): boolean {
  const keys = palavrasChavePergunta(pergunta);
  if (keys.length === 0) return false;
  const textoAssistente = turnos
    .filter((t) => t.role === "assistant")
    .map((t) => t.content.toLowerCase())
    .join(" ");
  const hits = keys.filter((k) => textoAssistente.includes(k)).length;
  return hits >= Math.min(2, keys.length);
}

export function obterProximaPerguntaEssencial(
  perguntas: string[],
  turnos: TurnoMinimo[],
  ordem: "inicio" | "final"
): string | null {
  if (!perguntas.length) return null;

  const assistentes = turnos.filter((t) => t.role === "assistant").length;
  const usuarios = turnos.filter((t) => t.role === "user").length;

  if (ordem === "final" && (assistentes < 1 || usuarios < 2)) {
    return null;
  }

  for (const p of perguntas) {
    if (!perguntaEssencialJaFeita(p, turnos)) return p.trim();
  }
  return null;
}

export function substituirPlaceholdersSaudacao(saudacao: string, nomeAgente: string): string {
  const nome = nomeAgente.trim() || "Maria";
  return saudacao
    .replace(/\[Nome\]/gi, nome)
    .replace(/\[nome\]/g, nome)
    .trim();
}

export function blocoPerguntasEssenciaisCargo(params: {
  usarPerguntas: boolean;
  perguntas: string[];
  ordem: "inicio" | "final";
  saudacao?: string;
  nomeAgente: string;
  comprimentoPadrao?: string;
  conversaEmAndamento: boolean;
  proximaPergunta: string | null;
}): string[] {
  const linhas: string[] = [];
  if (!params.usarPerguntas || params.perguntas.length === 0) return linhas;

  linhas.push(
    "- Qualificação do cargo: conduza as perguntas obrigatórias **uma de cada vez**, com tom de WhatsApp natural."
  );
  linhas.push(
    "- **Nunca** liste, numere ou diga «pergunta 1 de 5», «sequência de perguntas» ou «roteiro de qualificação»."
  );
  linhas.push("- Integre cada pergunta na conversa (ex.: após o cliente dizer a profissão, pergunte o objetivo do projeto).");

  if (!params.conversaEmAndamento) {
    if (params.saudacao) {
      linhas.push(
        `- **Só na 1ª mensagem** — tom desta saudação (adapte com naturalidade, não copie literal): «${substituirPlaceholdersSaudacao(params.saudacao, params.nomeAgente)}»`
      );
    }
    if (params.comprimentoPadrao) {
      linhas.push(`- Comprimento: ${params.comprimentoPadrao}`);
    }
    if (params.ordem === "inicio" && params.proximaPergunta) {
      linhas.push(
        "- Se a saudação já tiver pergunta de nome, **não** repita na mesma mensagem; na **próxima** resposta use a pergunta indicada abaixo."
      );
    }
  } else {
    linhas.push("- Conversa em andamento: **sem** nova saudação, **sem** reapresentação.");
    linhas.push("- Responda primeiro ao que o cliente acabou de dizer; depois, se couber, **uma** pergunta nova.");
  }

  if (params.proximaPergunta) {
    linhas.push(
      `- Pergunta obrigatória **desta vez** (parafraseie; não leia como formulário): «${params.proximaPergunta}»`
    );
    linhas.push(
      "- Se o cliente informou nome, profissão ou pedido (obra, orçamento, reforma): reconheça em uma frase e em seguida faça só esta pergunta."
    );
  } else if (params.conversaEmAndamento && params.ordem === "final") {
    linhas.push("- Se faltar dado do cargo, pode fechar com uma pergunta pendente — ainda uma só por mensagem.");
  }

  return linhas;
}
