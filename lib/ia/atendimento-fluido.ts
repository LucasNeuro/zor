import type { SupabaseClient } from "@supabase/supabase-js";
import type { TurnoMinimo } from "@/lib/ia/perguntas-essenciais-cargo";
import { parseAtividadeMs } from "@/lib/ia/sessao-conversa-ttl";

/** Requalificar nome/dados só após esta janela (ms). Env: HUB_LEAD_RETORNO_REQUALIFICAR_DIAS */
export function leadRetornoRequalificarMs(): number {
  const raw = process.env.HUB_LEAD_RETORNO_REQUALIFICAR_DIAS?.trim();
  const dias = raw ? Number.parseFloat(raw) : 7;
  if (!Number.isFinite(dias) || dias <= 0) return 7 * 24 * 60 * 60 * 1000;
  return Math.min(90, Math.max(1, dias)) * 24 * 60 * 60 * 1000;
}

const ESTAGIOS_NEGOCIO_ABERTO = new Set([
  "novo",
  "qualificando",
  "qualificado",
  "proposta",
  "negociando",
  "fechamento",
  "aberto",
  "em_andamento",
  "pendente",
]);

const ESTAGIOS_NEGOCIO_FECHADO = new Set(["ganho", "perdido", "cancelado", "concluido", "fechado"]);

export type ContextoLeadCrmPrompt = {
  leadId: string;
  nome: string | null;
  telefone: string | null;
  estagio: string | null;
  interesse: string | null;
  ultimoContato: string | null;
  ultimaMensagem: string | null;
  negociosAbertos: number;
  negociosFechados: number;
  negociosResumo: string[];
  evitarRepetirQualificacao: boolean;
  permiteRequalificar: boolean;
};

export function leadRetornoPermiteRequalificar(params: {
  ultimoContatoIso?: string | null;
  negociosAbertos: number;
  todosNegociosConcluidos: boolean;
}): boolean {
  const ultimo = parseAtividadeMs(params.ultimoContatoIso);
  const maisDeUmaSemana =
    ultimo > 0 && Date.now() - ultimo > leadRetornoRequalificarMs();
  return maisDeUmaSemana || (params.todosNegociosConcluidos && params.negociosAbertos === 0);
}

export async function carregarContextoLeadCrmParaPrompt(
  supabase: SupabaseClient,
  leadId: string
): Promise<ContextoLeadCrmPrompt | null> {
  return carregarContextoLeadCrmParaPromptDb(supabase, leadId);
}

async function carregarContextoLeadCrmParaPromptDb(
  supabase: SupabaseClient,
  leadId: string
): Promise<ContextoLeadCrmPrompt | null> {
  const { data: lead } = await supabase
    .from("hub_leads_crm")
    .select(
      "id, nome, telefone, estagio, interesse_principal, ultimo_contato, ultima_mensagem, atualizado_em"
    )
    .eq("id", leadId)
    .maybeSingle();

  if (!lead?.id) return null;

  const { data: negocios } = await supabase
    .from("hub_negocios")
    .select("titulo, estagio, valor, atualizado_em")
    .eq("lead_id", leadId)
    .order("atualizado_em", { ascending: false })
    .limit(8);

  const rows = negocios ?? [];
  let abertos = 0;
  let fechados = 0;
  const resumo: string[] = [];

  for (const n of rows as Array<Record<string, unknown>>) {
    const est = String(n.estagio ?? "").trim().toLowerCase();
    if (ESTAGIOS_NEGOCIO_FECHADO.has(est)) fechados += 1;
    else if (!est || ESTAGIOS_NEGOCIO_ABERTO.has(est)) abertos += 1;
    else abertos += 1;
    const titulo = String(n.titulo ?? "Negócio").trim();
    resumo.push(`${titulo} (${est || "aberto"})`);
  }

  const ultimoContato =
    (typeof lead.ultimo_contato === "string" && lead.ultimo_contato) ||
    (typeof lead.atualizado_em === "string" ? lead.atualizado_em : null);

  const todosConcluidos = rows.length > 0 && abertos === 0;
  const permiteRequalificar = leadRetornoPermiteRequalificar({
    ultimoContatoIso: ultimoContato,
    negociosAbertos: abertos,
    todosNegociosConcluidos: todosConcluidos,
  });

  return {
    leadId: String(lead.id),
    nome: typeof lead.nome === "string" ? lead.nome.trim() || null : null,
    telefone: typeof lead.telefone === "string" ? lead.telefone : null,
    estagio: typeof lead.estagio === "string" ? lead.estagio : null,
    interesse:
      typeof lead.interesse_principal === "string" ? lead.interesse_principal : null,
    ultimoContato,
    ultimaMensagem:
      typeof lead.ultima_mensagem === "string" ? lead.ultima_mensagem.slice(0, 300) : null,
    negociosAbertos: abertos,
    negociosFechados: fechados,
    negociosResumo: resumo,
    evitarRepetirQualificacao: !permiteRequalificar,
    permiteRequalificar,
  };
}

export function formatarBlocoContextoLeadCrm(ctx: ContextoLeadCrmPrompt): string {
  const linhas = [
    "═══ CLIENTE NO CRM (use antes de repetir perguntas) ═══",
    ctx.nome
      ? `- Nome gravado: **${ctx.nome}** — use na conversa; se o cliente corrigir o nome, a correção prevalece (actualize com **hub_atualizar_lead**).`
      : "- Nome ainda não confirmado no CRM.",
    ctx.telefone ? `- Telefone: ${ctx.telefone}` : null,
    ctx.estagio ? `- Estágio no funil: ${ctx.estagio}` : null,
    ctx.interesse ? `- Interesse registrado: ${ctx.interesse}` : null,
    ctx.ultimaMensagem ? `- Última mensagem registrada: «${ctx.ultimaMensagem}»` : null,
    ctx.ultimoContato ? `- Último contacto: ${ctx.ultimoContato}` : null,
    ctx.negociosResumo.length
      ? `- Negócios: ${ctx.negociosResumo.join("; ")} (${ctx.negociosAbertos} aberto(s))`
      : "- Sem negócios vinculados ainda.",
  ].filter(Boolean) as string[];

  if (ctx.evitarRepetirQualificacao) {
    linhas.push(
      "",
      "**Lead em retorno recente:** não repita saudação longa, nome, nem perguntas já respondidas nesta conversa ou no CRM.",
      "Reconheça o que o cliente disse, atualize o CRM com **hub_atualizar_lead** se surgir dado novo, e avance (orçamento, agendamento, solução)."
    );
  } else {
    linhas.push(
      "",
      "**Retorno após pausa longa ou ciclo concluído:** pode cumprimentar de forma leve e confirmar só o que mudou — sem checklist robótico."
    );
  }

  linhas.push(
    "- Ferramentas: **hub_lead_resumo** e **hub_atualizar_lead** para ler/gravar — não invente dados."
  );

  return linhas.join("\n");
}

/** Pré-texto compartilhado: produção WhatsApp + simulação de canal (mesmo raciocínio). */
export const WHATSAPP_CANAL_PREAMBLE = `### ATENDIMENTO WHATSAPP (funcionário IA)
- **Raciocínio primeiro:** responda ao que o cliente disse; fluxo e playbook são **guia**, não script fixo.
- Use **DOCUMENTOS DA EMPRESA**, **catálogo**, **playbook**, **CRM** e **ferramentas** — Mistral é só o motor de linguagem.
- Se pedirem **cardápio**, **preço** ou **pedido**, use a base de conhecimento **antes** de insistir em endereço ou checklist.
- Lead retornante: não repita nome nem perguntas já respondidas; avance o pedido.
- Respostas naturais e curtas (2–4 linhas); quando houver preço ou item na base, informe de forma clara.`;

export function blocoRaciocinioAtendimentoFluido(canalWhatsapp: boolean): string {
  const linhas = [
    "═══ RACIOCÍNIO DO ATENDIMENTO (prioridade sobre roteiro) ═══",
    "Você é um **funcionário IA** com autonomia de linguagem — o fluxo WhatsApp, cargo e perguntas essenciais são **ferramentas de guia**, não script fixo.",
    "",
    "**Decida nesta ordem:**",
    "1. O que o cliente **acabou de dizer** (e o histórico) — responda isso primeiro.",
    "2. **DOCUMENTOS DA EMPRESA** / catálogo — cardápio, preço, horário, política, pratos.",
    "3. **CRM** (bloco acima + ferramentas) — nome, interesse, negócios já gravados.",
    "4. **Roteiro/fluxo** — só para o que **ainda falta** e não foi dito; pule passos já cobertos.",
    "",
    "**Proibido:**",
    "- Repetir pergunta se o cliente já respondeu (mesmo com outras palavras: «quebrou a tela» = defeito informado).",
    "- Ignorar pedido de **cardápio**, **menu** ou **preço** para só pedir endereço ou qualificação.",
    "- Ignorar «já disse» / «falei isso» — peça desculpas breves e avance.",
    "- Seguir checklist quando já tem dados para orçar ou resolver.",
    "- Mencionar passo, motor, simulação ou «pergunta obrigatória».",
  ];

  if (canalWhatsapp) {
    linhas.push(
      "",
      "**WhatsApp:** 1–3 linhas; no máximo **uma** pergunta nova por mensagem — e só se realmente faltar dado.",
      "Se tiver ferramentas disponíveis, use **hub_atualizar_lead** ao captar nome, defeito, modelo, orçamento — na mesma resposta, sem anunciar."
    );
  }

  return linhas.join("\n");
}

function palavrasChaveTema(texto: string): string[] {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3);
}

/** Cliente já deu informação que cobre o tema da pergunta do cargo. */
export function perguntaEssencialJaCobertaPeloCliente(
  pergunta: string,
  turnos: TurnoMinimo[]
): boolean {
  const keys = palavrasChaveTema(pergunta);
  if (!keys.length) return false;
  const textoUser = turnos
    .filter((t) => t.role === "user")
    .map((t) => t.content.toLowerCase())
    .join(" ");

  const hits = keys.filter((k) => textoUser.includes(k)).length;
  if (hits >= Math.min(2, keys.length)) return true;

  const temasDefeito = /\b(defeito|problema|quebrou|quebrado|tela|tela quebrada|nao liga|molhou)\b/;
  const perguntaDefeito = /\b(defeito|problema|comportamento|apresentar|quando começou)\b/i.test(
    pergunta
  );
  if (perguntaDefeito && temasDefeito.test(textoUser)) return true;

  const perguntaNome = /\bnome\b/i.test(pergunta);
  if (perguntaNome && textoUser.length > 8) {
    const palavrasUser = turnos.filter((t) => t.role === "user").map((t) => t.content.trim());
    if (palavrasUser.some((m) => /^[A-Za-zÀ-ÿ]{2,}(?:\s+[A-Za-zÀ-ÿ]{2,}){0,3}$/.test(m))) return true;
  }

  return false;
}

export function clienteExpressouFrustracaoRepeticao(turnos: TurnoMinimo[]): boolean {
  const ultimas = turnos.filter((t) => t.role === "user").slice(-2);
  const texto = ultimas.map((t) => t.content.toLowerCase()).join(" ");
  return /\b(ja disse|já disse|falei|repete|de novo|ja falei|já falei|falei isso)\b/.test(texto);
}

export function extrairResumoProblemaCliente(turnos: TurnoMinimo[]): string | null {
  const users = turnos.filter((t) => t.role === "user").map((t) => t.content.trim());
  const relevantes = users.filter((m) =>
    /\b(tela|quebrou|defeito|nao liga|molhou|trinca|bateria|carrega|xiaomi|iphone|samsung|motorola|poco|azul)\b/i.test(
      m
    )
  );
  if (!relevantes.length) return null;
  return relevantes.slice(-3).join(" | ").slice(0, 400);
}
