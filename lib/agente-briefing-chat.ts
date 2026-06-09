import type { SupabaseClient } from "@supabase/supabase-js";
import { completarChatPreferindoMistral } from "@/lib/ia/llm-completion";
import { construirPrompt } from "@/lib/ia/prompt-builder";

const MAX_SNAPSHOT_ACOES = 35;
const MAX_SNAPSHOT_CICLO_LOG = 60;
const MAX_SNAPSHOT_PROMPTS = 20;

export const BRIEFING_SYSTEM_PREAMBLE = `Você está no MODO BRIEFING INTERNO do CRM Waje (equipe), em conversa com um colega humano.
Regras absolutas:
- Use apenas os dados fornecidos no bloco "DADOS_OPERACIONAIS (somente leitura)" para falar sobre execuções, leads e ciclos. Se algo não aparecer lá, diga que não há registro — não invente.
- Esse bloco são **extractos internos de apoio** (ficheiros de registo no sistema), **não** são "ferramentas" do modelo nem botões que o colega possa clicar. Não os apresente como lista de ferramentas com nomes técnicos de tabela; diga apenas que tem acesso a dados de revisão interna.
- **Ferramentas Hub / Mistral** (resumo de lead, memórias, registo de nota, etc.) **não são invocadas neste painel**. Elas só correm na **engine em produção**, quando há **sessão com lead** (ex.: WhatsApp ou Hub). Aqui não há chamadas ao servidor como na conversa ao vivo — apenas interpretação do que já foi gravado nos extractos.
- Você NÃO está atendendo cliente final. NÃO simule WhatsApp, NÃO prometa envio de mensagens, NÃO altere CRM. Apenas explique, resuma e oriente revisão humana.
- Cite nomes de leads quando aparecerem nos dados (contexto interno autorizado).
- Seja objetivo e útil para operação: status, últimos erros, o que revisar em Ciclos IA / logs.
`;

/** Pré-texto para o modo que espelha o system prompt de produção (prompt-builder), sem snapshot operacional. */
export const SIMULACAO_CANAL_PREAMBLE = `### MODO SIMULAÇÃO DE CANAL (teste no CRM Waje)
Responda como faria ao **cliente ou lead** no canal ao vivo, seguindo **estritamente** as camadas de identidade, conhecimento e regras que vêm abaixo (equivalente ao que a engine usa).
- Não diga que está em briefing interno, revisão operacional ou "somente leitura de logs".
- **Neste painel não há sessão de lead nem chamadas reais a ferramentas Hub** (Mistral function calls). É só texto: não afirme ter gravado no CRM, enviado WhatsApp ou executado ferramentas. Para ver ferramentas a actuar, use uma **conversa real** com lead em sessão (canal configurado).
- Mantenha tom, limites e playbook como em produção.`;

export type BriefingModoSessao = "briefing_interno" | "simulacao_canal";

export type BriefingMensagemLinha = {
  papel: "user" | "assistant";
  conteudo: string;
};

function trunc(s: string, n: number): string {
  const t = (s || "").trim();
  if (t.length <= n) return t;
  return `${t.slice(0, n)}…`;
}

export async function montarSnapshotOperacionalReadOnly(
  supabase: SupabaseClient,
  agenteSlug: string,
  agenteNome: string
): Promise<string> {
  const blocos: string[] = [];
  blocos.push(`Agente: ${agenteNome} (${agenteSlug})`);
  blocos.push(`Gerado em (UTC aproximado do servidor): ${new Date().toISOString()}`);

  try {
    const { data: ciclos } = await supabase
      .from("hub_ciclos_ia")
      .select("nome, tipo, ativo, ultimo_ciclo, ultimo_status, total_execucoes, intervalo_minutos, cron_expressao")
      .eq("agente_slug", agenteSlug)
      .order("nome");
    if (ciclos?.length) {
      blocos.push("\n## Ciclos IA (cadastro)");
      for (const c of ciclos as Record<string, unknown>[]) {
        blocos.push(
          `- ${c.nome} | tipo=${c.tipo} | ativo=${c.ativo} | último_status=${c.ultimo_status ?? "—"} | exec=${c.total_execucoes ?? 0} | último_ciclo=${c.ultimo_ciclo ?? "—"}`
        );
      }
    } else {
      blocos.push("\n## Ciclos IA: nenhum registro para este slug.");
    }
  } catch {
    blocos.push("\n## Ciclos IA: falha ao ler.");
  }

  try {
    const { data: logs } = await supabase
      .from("hub_ciclos_log")
      .select("status, erro, iniciado_em, tokens_usados, custo_brl, acoes_tomadas")
      .eq("agente_slug", agenteSlug)
      .order("iniciado_em", { ascending: false })
      .limit(MAX_SNAPSHOT_CICLO_LOG);
    if (logs?.length) {
      blocos.push("\n## Histórico de corridas automáticas (últimas execuções)");
      for (const row of logs as Record<string, unknown>[]) {
        const ac = row.acoes_tomadas && typeof row.acoes_tomadas === "object" ? JSON.stringify(row.acoes_tomadas) : "";
        blocos.push(
          `- ${row.iniciado_em} | ${row.status} | tok=${row.tokens_usados ?? "—"} | R$=${row.custo_brl ?? "—"} | erro=${row.erro ? trunc(String(row.erro), 120) : "—"} | acoes=${trunc(ac, 200)}`
        );
      }
    } else {
      blocos.push("\n## Histórico de corridas: ainda sem linhas (normal antes da 1ª execução).");
    }
  } catch {
    blocos.push("\n## Histórico de corridas: falha ao ler.");
  }

  try {
    const { data: acoes } = await supabase
      .from("hub_acoes_ia")
      .select("id, tipo, descricao, lead_id, sucesso, erro, criado_em")
      .eq("agente_slug", agenteSlug)
      .order("criado_em", { ascending: false })
      .limit(MAX_SNAPSHOT_ACOES);

    const leadIds = [...new Set((acoes || []).map((a: { lead_id?: string }) => a.lead_id).filter(Boolean))] as string[];
    let nomesPorLead: Record<string, string> = {};
    if (leadIds.length > 0) {
      const { data: leads } = await supabase.from("hub_leads_crm").select("id, nome").in("id", leadIds);
      if (leads) {
        nomesPorLead = Object.fromEntries(leads.map((l: { id: string; nome: string }) => [l.id, l.nome]));
      }
    }

    if (acoes?.length) {
      blocos.push("\n## Últimas acções registadas pela IA para leads");
      for (const a of acoes as { tipo?: string; descricao?: string; lead_id?: string; sucesso?: boolean; erro?: string; criado_em?: string }[]) {
        const nomeLead = a.lead_id ? nomesPorLead[a.lead_id] || `(lead ${String(a.lead_id).slice(0, 8)}…)` : "—";
        blocos.push(
          `- ${a.criado_em} | ${a.tipo} | sucesso=${a.sucesso} | lead=${nomeLead} | ${trunc(String(a.descricao || ""), 160)} | erro=${a.erro ? trunc(String(a.erro), 80) : "—"}`
        );
      }
    } else {
      blocos.push("\n## Acções IA: sem linhas recentes.");
    }
  } catch {
    blocos.push("\n## Acções IA: falha ao ler.");
  }

  try {
    const { data: prompts } = await supabase
      .from("hub_prompt_logs")
      .select("criado_em, mensagem_usuario, modelo_usado, lead_id, tokens_input, tokens_output, custo_estimado_brl")
      .eq("agente_slug", agenteSlug)
      .order("criado_em", { ascending: false })
      .limit(MAX_SNAPSHOT_PROMPTS);
    if (prompts?.length) {
      blocos.push("\n## Últimas interações da engine com clientes (trechos)");
      for (const p of prompts as Record<string, unknown>[]) {
        blocos.push(
          `- ${p.criado_em} | modelo=${p.modelo_usado ?? "—"} | lead_id=${p.lead_id ?? "—"} | tok in/out=${p.tokens_input ?? "—"}/${p.tokens_output ?? "—"} | usr=${trunc(String(p.mensagem_usuario || ""), 100)}`
        );
      }
    } else {
      blocos.push("\n## Logs de pedidos ao modelo: sem linhas para este agente.");
    }
  } catch {
    blocos.push("\n## Logs de pedidos ao modelo: falha ao ler (schema ou permissões).");
  }

  return `### DADOS_OPERACIONAIS (somente leitura)\n${blocos.join("\n")}`;
}

function calcularCustoBrl(modelo: string, input: number, output: number): { brl: number; usd: number } {
  const inM = input / 1_000_000;
  const outM = output / 1_000_000;
  let usd = 0;
  const m = modelo.toLowerCase();
  if (m.includes("mistral") || m.includes("mixtral") || m.includes("ministral")) {
    usd = inM * 0.2 + outM * 0.6;
    return { usd, brl: usd * 5.5 };
  }
  if (m.includes("haiku")) usd = inM * 1 + outM * 5;
  else if (m.includes("sonnet")) usd = inM * 3 + outM * 15;
  else if (m.includes("opus")) usd = inM * 15 + outM * 75;
  else usd = inM * 3 + outM * 15;
  return { usd, brl: usd * 5.5 };
}

export async function executarBriefingReply(params: {
  modelo: string;
  agenteNome: string;
  agenteSlug: string;
  cargo?: string;
  promptBaseTrecho?: string;
  snapshot: string;
  historico: BriefingMensagemLinha[];
  mensagemUsuario: string;
  memoriasAgenteBloco?: string;
}): Promise<{ texto: string; modelo: string; tokens_input: number; tokens_output: number; custo_brl: number }> {
  const identity = [
    `Identidade do agente (para tom de voz): nome=${params.agenteNome}, slug=${params.agenteSlug}`,
    params.cargo ? `Cargo: ${params.cargo}` : null,
    params.promptBaseTrecho ? `Trecho do system prompt base (referência): ${trunc(params.promptBaseTrecho, 1200)}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const system = [
    BRIEFING_SYSTEM_PREAMBLE,
    identity,
    params.memoriasAgenteBloco?.trim() || null,
    params.snapshot,
  ]
    .filter(Boolean)
    .join("\n\n");

  const mensagens: Array<{ role: "user" | "assistant"; content: string }> = [];
  const anterior = [...params.historico];
  for (const m of anterior) {
    if (m.papel === "user") mensagens.push({ role: "user", content: m.conteudo });
    else mensagens.push({ role: "assistant", content: m.conteudo });
  }
  mensagens.push({ role: "user", content: params.mensagemUsuario });

  const out = await completarChatPreferindoMistral({
    systemPrompt: system,
    mensagens,
    modeloFromDb: params.modelo,
    maxTokens: 2048,
  });
  if (!out.ok) throw new Error(out.erro);

  const { brl } = calcularCustoBrl(out.modeloLog, out.tokensEntrada, out.tokensSaida);
  return {
    texto: out.texto,
    modelo: out.modeloLog,
    tokens_input: out.tokensEntrada,
    tokens_output: out.tokensSaida,
    custo_brl: brl,
  };
}

/** Mesma pilha textual que produção (`construirPrompt`), sem dados de hub_ciclos_log / ações. */
export async function executarSimulacaoCanalReply(params: {
  agenteSlug: string;
  historico: BriefingMensagemLinha[];
  mensagemUsuario: string;
}): Promise<{ texto: string; modelo: string; tokens_input: number; tokens_output: number; custo_brl: number }> {
  const turnosConversa = params.historico.map((m) => ({
    role: (m.papel === "user" ? "user" : "assistant") as "user" | "assistant",
    content: m.conteudo,
  }));

  const pc = await construirPrompt({
    agenteSlug: params.agenteSlug,
    canal: "whatsapp",
    turnosAnteriores: params.historico.length,
    mensagemAtual: params.mensagemUsuario,
    turnosConversa: [...turnosConversa, { role: "user", content: params.mensagemUsuario }],
  });
  if (!pc) {
    throw new Error(
      "Não foi possível montar o prompt do agente. Verifique se o modelo está ativo em hub_agente_identidade."
    );
  }

  const system = `${SIMULACAO_CANAL_PREAMBLE}\n\n${pc.systemPrompt}`;

  const mensagens: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (const m of params.historico) {
    if (m.papel === "user") mensagens.push({ role: "user", content: m.conteudo });
    else mensagens.push({ role: "assistant", content: m.conteudo });
  }
  mensagens.push({ role: "user", content: params.mensagemUsuario });

  const out = await completarChatPreferindoMistral({
    systemPrompt: system,
    mensagens,
    modeloFromDb: pc.modelo,
    maxTokens: 2048,
  });
  if (!out.ok) throw new Error(out.erro);

  const { brl } = calcularCustoBrl(out.modeloLog, out.tokensEntrada, out.tokensSaida);
  return {
    texto: out.texto,
    modelo: out.modeloLog,
    tokens_input: out.tokensEntrada,
    tokens_output: out.tokensSaida,
    custo_brl: brl,
  };
}