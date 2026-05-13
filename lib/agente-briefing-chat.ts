import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";

const MAX_SNAPSHOT_ACOES = 35;
const MAX_SNAPSHOT_CICLO_LOG = 60;
const MAX_SNAPSHOT_PROMPTS = 20;

export const BRIEFING_SYSTEM_PREAMBLE = `Você está no MODO BRIEFING INTERNO do CRM Obra10 (equipe), em conversa com um colega humano.
Regras absolutas:
- Use apenas os dados fornecidos no bloco "DADOS_OPERACIONAIS (somente leitura)" para falar sobre execuções, leads e ciclos. Se algo não aparecer lá, diga que não há registro — não invente.
- Você NÃO está atendendo cliente final. NÃO simule WhatsApp, NÃO prometa envio de mensagens, NÃO altere CRM. Apenas explique, resuma e oriente revisão humana.
- Cite nomes de leads quando aparecerem nos dados (contexto interno autorizado).
- Seja objetivo e útil para operação: status, últimos erros, o que revisar em Ciclos IA / logs.
`;

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
      blocos.push("\n## Últimas execuções hub_ciclos_log");
      for (const row of logs as Record<string, unknown>[]) {
        const ac = row.acoes_tomadas && typeof row.acoes_tomadas === "object" ? JSON.stringify(row.acoes_tomadas) : "";
        blocos.push(
          `- ${row.iniciado_em} | ${row.status} | tok=${row.tokens_usados ?? "—"} | R$=${row.custo_brl ?? "—"} | erro=${row.erro ? trunc(String(row.erro), 120) : "—"} | acoes=${trunc(ac, 200)}`
        );
      }
    } else {
      blocos.push("\n## hub_ciclos_log: sem linhas (normal antes da 1ª execução).");
    }
  } catch {
    blocos.push("\n## hub_ciclos_log: falha ao ler.");
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
      blocos.push("\n## Últimas ações hub_acoes_ia");
      for (const a of acoes as { tipo?: string; descricao?: string; lead_id?: string; sucesso?: boolean; erro?: string; criado_em?: string }[]) {
        const nomeLead = a.lead_id ? nomesPorLead[a.lead_id] || `(lead ${String(a.lead_id).slice(0, 8)}…)` : "—";
        blocos.push(
          `- ${a.criado_em} | ${a.tipo} | sucesso=${a.sucesso} | lead=${nomeLead} | ${trunc(String(a.descricao || ""), 160)} | erro=${a.erro ? trunc(String(a.erro), 80) : "—"}`
        );
      }
    } else {
      blocos.push("\n## hub_acoes_ia: sem linhas.");
    }
  } catch {
    blocos.push("\n## hub_acoes_ia: falha ao ler.");
  }

  try {
    const { data: prompts } = await supabase
      .from("hub_prompt_logs")
      .select("criado_em, mensagem_usuario, modelo_usado, lead_id, tokens_input, tokens_output, custo_estimado_brl")
      .eq("agente_slug", agenteSlug)
      .order("criado_em", { ascending: false })
      .limit(MAX_SNAPSHOT_PROMPTS);
    if (prompts?.length) {
      blocos.push("\n## Últimas respostas engine hub_prompt_logs (trechos)");
      for (const p of prompts as Record<string, unknown>[]) {
        blocos.push(
          `- ${p.criado_em} | modelo=${p.modelo_usado ?? "—"} | lead_id=${p.lead_id ?? "—"} | tok in/out=${p.tokens_input ?? "—"}/${p.tokens_output ?? "—"} | usr=${trunc(String(p.mensagem_usuario || ""), 100)}`
        );
      }
    } else {
      blocos.push("\n## hub_prompt_logs: sem linhas para este agente_slug.");
    }
  } catch {
    blocos.push("\n## hub_prompt_logs: falha ao ler (ou coluna divergente no banco).");
  }

  return `### DADOS_OPERACIONAIS (somente leitura)\n${blocos.join("\n")}`;
}

function calcularCustoBrl(modelo: string, input: number, output: number): { brl: number; usd: number } {
  const inM = input / 1_000_000;
  const outM = output / 1_000_000;
  let usd = 0;
  const m = modelo.toLowerCase();
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
}): Promise<{ texto: string; modelo: string; tokens_input: number; tokens_output: number; custo_brl: number }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY não configurada");

  const identity = [
    `Identidade do agente (para tom de voz): nome=${params.agenteNome}, slug=${params.agenteSlug}`,
    params.cargo ? `Cargo: ${params.cargo}` : null,
    params.promptBaseTrecho ? `Trecho do system prompt base (referência): ${trunc(params.promptBaseTrecho, 1200)}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const system = `${BRIEFING_SYSTEM_PREAMBLE}\n\n${identity}\n\n${params.snapshot}`;

  const mensagens: Array<{ role: "user" | "assistant"; content: string }> = [];
  const anterior = [...params.historico];
  for (const m of anterior) {
    if (m.papel === "user") mensagens.push({ role: "user", content: m.conteudo });
    else mensagens.push({ role: "assistant", content: m.conteudo });
  }
  mensagens.push({ role: "user", content: params.mensagemUsuario });

  const anthropic = new Anthropic({ apiKey });
  const resposta = await anthropic.messages.create({
    model: params.modelo,
    max_tokens: 2048,
    system,
    messages: mensagens,
  });

  const texto =
    resposta.content[0]?.type === "text" ? resposta.content[0].text : "";
  const tokens_input = resposta.usage.input_tokens;
  const tokens_output = resposta.usage.output_tokens;
  const { brl } = calcularCustoBrl(params.modelo, tokens_input, tokens_output);
  return { texto, modelo: params.modelo, tokens_input, tokens_output, custo_brl: brl };
}