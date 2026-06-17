/** Condução fluida das perguntas obrigatórias do cargo (hub_cargos_catalogo) — uma por mensagem, sem checklist. */

import {
  clienteExpressouFrustracaoRepeticao,
  perguntaEssencialJaCobertaPeloCliente,
} from "@/lib/ia/atendimento-fluido";

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
  ordem: "inicio" | "final",
  opts?: { evitarRepetirQualificacao?: boolean }
): string | null {
  if (!perguntas.length) return null;
  if (clienteExpressouFrustracaoRepeticao(turnos)) return null;

  const assistentes = turnos.filter((t) => t.role === "assistant").length;
  const usuarios = turnos.filter((t) => t.role === "user").length;

  if (ordem === "final" && (assistentes < 1 || usuarios < 2)) {
    return null;
  }

  for (const p of perguntas) {
    if (perguntaEssencialJaFeita(p, turnos)) continue;
    if (perguntaEssencialJaCobertaPeloCliente(p, turnos)) continue;
    if (opts?.evitarRepetirQualificacao && /\bnome\b/i.test(p)) {
      const nomeNoUser = turnos.some(
        (t) =>
          t.role === "user" &&
          /^[A-Za-zÀ-ÿ]{2,}(?:\s+[A-Za-zÀ-ÿ]{2,}){0,3}$/.test(t.content.trim())
      );
      if (nomeNoUser) continue;
    }
    return p.trim();
  }
  return null;
}

export function substituirPlaceholdersSaudacao(
  saudacao: string,
  nomeAgente: string,
  nomeEmpresa?: string | null
): string {
  const nome = nomeAgente.trim() || "Maria";
  const empresa = nomeEmpresa?.trim() || "";
  return saudacao
    .replace(/\[Seu\s*Nome\]/gi, nome)
    .replace(/\[Nome\]/gi, nome)
    .replace(/\[nome\]/g, nome)
    .replace(/\[Nome\s*da\s*Empresa\]/gi, empresa || "nossa empresa")
    .replace(/\[Empresa\]/gi, empresa || "nossa empresa")
    .replace(/\[empresa\]/g, empresa || "nossa empresa")
    .trim();
}

/** Saudação já convida resposta (ex.: «como posso ajudar?») — não empilhar outra pergunta na 1ª mensagem. */
export function saudacaoJaTemPergunta(saudacao: string): boolean {
  const s = saudacao.trim();
  if (!s) return false;
  if (/\?\s*$/.test(s)) return true;
  return /\b(como posso|em que posso|posso te ajudar|posso ajudar|o que você precisa|o que precisa)\b/i.test(s);
}

export function blocoPerguntasEssenciaisCargo(params: {
  usarPerguntas: boolean;
  perguntas: string[];
  ordem: "inicio" | "final";
  saudacao?: string;
  nomeAgente: string;
  nomeEmpresa?: string | null;
  comprimentoPadrao?: string;
  conversaEmAndamento: boolean;
  proximaPergunta: string | null;
  evitarRepetirQualificacao?: boolean;
}): string[] {
  const linhas: string[] = [];
  if (!params.usarPerguntas || params.perguntas.length === 0) return linhas;

  linhas.push(
    "- Qualificação do cargo: **sugestões** de temas a cobrir — **não** é checklist obrigatório se o cliente já informou."
  );
  linhas.push(
    "- **Nunca** liste, numere ou diga «pergunta 1 de 5», «sequência de perguntas» ou «roteiro de qualificação»."
  );
  linhas.push(
    "- Se o cliente já disse modelo, defeito, nome ou pedido: **reconheça** e **pule** perguntas redundantes; avance para orçamento/solução."
  );

  if (params.evitarRepetirQualificacao) {
    linhas.push(
      "- Lead retornante no CRM: **não** repita nome nem dados já gravados; use **hub_atualizar_lead** só para informação nova."
    );
  }

  if (!params.conversaEmAndamento) {
    if (params.saudacao) {
      linhas.push(
        `- **Só na 1ª mensagem** — tom desta saudação (adapte com naturalidade, não copie literal): «${substituirPlaceholdersSaudacao(params.saudacao, params.nomeAgente, params.nomeEmpresa)}»`
      );
    }
    if (params.comprimentoPadrao) {
      linhas.push(`- Comprimento: ${params.comprimentoPadrao}`);
    }
    if (params.ordem === "inicio" && params.proximaPergunta) {
      const saudacaoComPergunta = params.saudacao ? saudacaoJaTemPergunta(params.saudacao) : false;
      if (saudacaoComPergunta) {
        linhas.push(
          "- A saudação já traz pergunta aberta — na próxima resposta, **só** pergunte se ainda faltar o tema abaixo."
        );
      } else {
        linhas.push(
          "- Na 1ª mensagem, saudação curta; **só** pergunte o tema abaixo se o cliente ainda não tiver dito."
        );
      }
    }
  } else {
    linhas.push("- Conversa em andamento: **sem** nova saudação, **sem** reapresentação.");
    linhas.push("- Responda primeiro ao que o cliente acabou de dizer; depois, **no máximo uma** pergunta — só se faltar dado.");
  }

  if (params.proximaPergunta) {
    linhas.push(
      `- **Sugestão de tema** (pule se já respondido): «${params.proximaPergunta}»`
    );
    linhas.push(
      "- Se o cliente demonstrar irritação («já disse»): peça desculpas em uma linha e **não** repita a pergunta."
    );
  } else if (params.conversaEmAndamento && params.ordem === "final") {
    linhas.push("- Se faltar dado do cargo, pode fechar com uma pergunta pendente — ainda uma só por mensagem.");
  }

  return linhas;
}
