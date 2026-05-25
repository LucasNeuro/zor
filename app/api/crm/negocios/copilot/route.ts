import { NextRequest, NextResponse } from "next/server";
import { mistralChatCompletion } from "@/lib/ia/mistral-chat";

type ChatRole = "user" | "assistant";

type CopilotMessage = {
  role: ChatRole;
  content: string;
};

type DraftPayload = {
  titulo?: string;
  prefixo_mercado?: string;
  etapa?: string;
  valor_estimado?: string | number | null;
  data_previsao_fechamento?: string | null;
  lead_ids?: string[];
  pessoa_ids?: string[];
  empresa_ids?: string[];
  parceiro_ids?: string[];
  pipeline_id?: string | null;
};

function draftSummary(draft: DraftPayload) {
  const titulo = String(draft.titulo || "").trim() || "não definido";
  const mercado = String(draft.prefixo_mercado || "").trim() || "não definido";
  const etapa = String(draft.etapa || "").trim() || "não definida";
  const valor = draft.valor_estimado != null && String(draft.valor_estimado).trim()
    ? String(draft.valor_estimado).trim()
    : "não definido";
  const previsao = String(draft.data_previsao_fechamento || "").trim() || "não definida";
  const leadCount = Array.isArray(draft.lead_ids) ? draft.lead_ids.length : 0;
  const pessoaCount = Array.isArray(draft.pessoa_ids) ? draft.pessoa_ids.length : 0;
  const empresaCount = Array.isArray(draft.empresa_ids) ? draft.empresa_ids.length : 0;
  const parceiroCount = Array.isArray(draft.parceiro_ids) ? draft.parceiro_ids.length : 0;
  return [
    `Título: ${titulo}`,
    `Mercado: ${mercado}`,
    `Etapa: ${etapa}`,
    `Valor estimado: ${valor}`,
    `Previsão: ${previsao}`,
    `Leads vinculados: ${leadCount}`,
    `Pessoas vinculadas: ${pessoaCount}`,
    `Empresas vinculadas: ${empresaCount}`,
    `Parceiros vinculados: ${parceiroCount}`,
    `Pipeline: ${draft.pipeline_id ? "definido" : "global/indefinido"}`,
  ].join("\n");
}

function fallbackReply(question: string, draft: DraftPayload): string {
  const titulo = String(draft.titulo || "").trim();
  const mercado = String(draft.prefixo_mercado || "").trim() || "IMB";
  const etapa = String(draft.etapa || "").trim() || "novo";
  const leadCount = Array.isArray(draft.lead_ids) ? draft.lead_ids.length : 0;
  const pessoaCount = Array.isArray(draft.pessoa_ids) ? draft.pessoa_ids.length : 0;
  const empresaCount = Array.isArray(draft.empresa_ids) ? draft.empresa_ids.length : 0;
  const parceiroCount = Array.isArray(draft.parceiro_ids) ? draft.parceiro_ids.length : 0;
  const valor = String(draft.valor_estimado || "").trim();
  const previsao = String(draft.data_previsao_fechamento || "").trim();
  const q = question.toLowerCase();

  const pendencias: string[] = [];
  if (!titulo) pendencias.push("definir um título claro para o negócio");
  if (!valor) pendencias.push("estimar o valor financeiro");
  if (!previsao) pendencias.push("informar uma previsão de fechamento");
  if (leadCount + pessoaCount + empresaCount + parceiroCount === 0) {
    pendencias.push("vincular pelo menos um envolvido para rastreio");
  }
  if (pessoaCount === 0 && leadCount === 0) {
    pendencias.push("ligar um lead ou contacto principal");
  }

  if (q.includes("titulo") || q.includes("nome")) {
    return [
      "Sugestões de título para este negócio:",
      `1. ${mercado} · ${titulo || "Novo negócio"} · ${etapa}`,
      `2. ${mercado} · Oportunidade comercial${valor ? ` · R$ ${valor}` : ""}`,
      `3. ${mercado} · Projeto com ${Math.max(1, pessoaCount + empresaCount + parceiroCount)} frente(s) envolvida(s)`,
      "",
      "Dica: use mercado + objectivo + referência do cliente/obra para facilitar rastreio.",
    ].join("\n");
  }

  if (q.includes("falta") || q.includes("pend") || q.includes("revis")) {
    return pendencias.length
      ? `Para este draft ficar forte, eu sugiro:\n- ${pendencias.join("\n- ")}\n\nPróximo melhor passo: completar os envolvidos e depois validar valor/previsão.`
      : "O draft já está bem preenchido. Próximo melhor passo: revisar os envolvidos principais e salvar o negócio.";
  }

  if (q.includes("envolv") || q.includes("vincul") || q.includes("rastrei")) {
    return [
      "Para rastreio completo, pense no negócio em camadas:",
      "- Lead: origem comercial da oportunidade",
      "- Pessoa: contacto principal / decisor",
      "- Empresa: cliente, fornecedor ou PJ responsável",
      "- Parceiro: corretor, indicador, engenheiro, arquitecto ou parceiro de rede",
      "",
      `Hoje o draft está com ${leadCount} lead(s), ${pessoaCount} pessoa(s), ${empresaCount} empresa(s) e ${parceiroCount} parceiro(s).`,
    ].join("\n");
  }

  return [
    "Vou te ajudar a fechar este negócio com qualidade.",
    pendencias.length
      ? `Pelo draft atual, eu priorizaria:\n- ${pendencias.join("\n- ")}`
      : "O draft já tem os campos centrais preenchidos.",
    "",
    "Se quiser, peça por exemplo:",
    '- "sugira um título melhor"',
    '- "o que está faltando?"',
    '- "quais envolvidos devo vincular?"',
  ].join("\n");
}

export async function POST(request: NextRequest) {
  let body: { messages?: CopilotMessage[]; draft?: DraftPayload };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const messages = Array.isArray(body.messages)
    ? body.messages
        .filter((m): m is CopilotMessage => {
          return (
            !!m &&
            (m.role === "user" || m.role === "assistant") &&
            typeof m.content === "string" &&
            m.content.trim().length > 0
          );
        })
        .slice(-12)
    : [];
  const draft = body.draft || {};
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser) {
    return NextResponse.json({ error: "Mensagem do utilizador é obrigatória." }, { status: 400 });
  }

  const system = [
    "Você é o Copiloto IA do wizard de criação de negócios do CRM Obra10.",
    "Fale sempre em português do Brasil, de forma prática, curta e orientada a vendas/operação.",
    "Ajude o usuário a preencher o negócio com qualidade: título, mercado, etapa, valor, previsão e envolvidos.",
    "Nunca invente IDs, nomes de registros ou dados que não estejam no draft.",
    "Quando faltar informação, faça perguntas diretas e sugira próximos passos.",
    "Considere que um negócio pode ter múltiplos envolvidos: lead, pessoa, empresa e parceiro.",
    "Priorize rastreio e clareza operacional.",
    "",
    "Resumo atual do draft:",
    draftSummary(draft),
  ].join("\n");

  const mistralModel = process.env.MISTRAL_MODEL?.trim() || "mistral-small-latest";
  const ai = await mistralChatCompletion({
    model: mistralModel,
    system,
    messages,
    temperature: 0.35,
    maxTokens: 700,
  });

  if (ai.ok) {
    return NextResponse.json({ reply: ai.text, provider: "mistral", model: ai.model });
  }

  return NextResponse.json({
    reply: fallbackReply(lastUser.content, draft),
    provider: "fallback",
    detail: ai.error,
  });
}
