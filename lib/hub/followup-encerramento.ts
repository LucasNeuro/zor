import type { SupabaseClient } from "@supabase/supabase-js";
import { gerarTextoIa } from "@/lib/hub/gerar-texto-ia";
import { limparLedgerCadenciaLead } from "@/lib/hub/followup-ledger";
import { parseFollowupTimestamp } from "@/lib/hub/followup-relogio";
import type { LeadGcalReserva } from "@/lib/hub/google-calendar-lead";

export type FollowupEncerramentoMotivo =
  | "agradecimento_cliente"
  | "resposta_agente_despedida"
  | "reserva_calendario"
  | "playbook_concluido"
  | "ia_encerramento"
  | "heuristica_encerramento"
  | "limite_total_envios";

export type ClassificacaoFollowupCliente = "encerramento" | "continuar";

const SYSTEM_CLIENTE = `Classificador de intenção para follow-up WhatsApp (CRM B2B).
Decide se a mensagem do CLIENTE ENCERRA o atendimento ou CONTINUA pedindo algo.

ENCERRAMENTO: agradecimento, despedida, confirmação de que está tudo ok, "obrigado", "valeu", "até logo", "perfeito" após agente já ter resolvido/agendado.
CONTINUAR: nova dúvida, pedido, pergunta, negociação, reclamação, pedido de informação.

Use o contexto da última mensagem do agente.
Responda APENAS JSON válido, sem markdown:
{"classificacao":"encerramento"|"continuar","motivo":"frase curta","confianca":0.0}`;

const SYSTEM_AGENTE = `Classificador de encerramento de atendimento WhatsApp.
A resposta do AGENTE encerra o atendimento (despedida, confirmação de agendamento, link de calendar/meet enviado com despedida, "até logo", "até já")?

Responda APENAS JSON:
{"encerramento":true|false,"motivo":"frase curta","confianca":0.0}`;

function normalizarTexto(v: string): string {
  return v.replace(/\s+/g, " ").trim();
}

function parseJsonRespostaIa<T extends Record<string, unknown>>(raw: string): T | null {
  const t = raw.trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(t.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

/** Reserva futura (ou recente) no metadata do lead — follow-up não deve insistir. */
export function leadTemReservaCalendarioFutura(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return false;
  const reservas = (metadata as Record<string, unknown>).google_calendar_reservas;
  if (!Array.isArray(reservas) || reservas.length === 0) return false;
  const limitePassado = Date.now() - 2 * 60 * 60 * 1000;
  return reservas.some((r) => {
    if (!r || typeof r !== "object") return false;
    const inicio = (r as LeadGcalReserva).inicio;
    if (!inicio?.trim()) return true;
    const t = new Date(inicio).getTime();
    return Number.isNaN(t) || t >= limitePassado;
  });
}

/** Heurística rápida — fallback quando IA indisponível. */
export function heuristicaClassificacaoCliente(
  mensagem: string,
  ultimaAgente?: string | null
): ClassificacaoFollowupCliente | null {
  const t = normalizarTexto(mensagem).toLowerCase();
  if (!t) return null;

  const continua =
    t.includes("?") ||
    /\b(duvida|dúvida|ajuda|preciso|quero|gostaria|quanto|valor|preço|preco|como funciona|pode me|tem como|ainda tenho)\b/i.test(
      t
    ) ||
    t.length > 120;
  if (continua) return "continuar";

  const agenteDespediu =
    ultimaAgente &&
    /\b(at[eé]\s+(logo|já|mais|breve)|google\.com\/calendar|meet\.google|demonstra[cç][aã]o agendada)\b/i.test(
      ultimaAgente
    );

  const encerraCurto =
    /^(obrigad[oa]|valeu|vlw|ok+|blz|beleza|perfeito|show|top|maravilha|certo|combinado|t[aá] bom|t[aá] ok)[!.?\s]*$/i.test(
      t
    ) ||
    /^(at[eé]|ate)\s*(logo|mais|j[aá]|breve)[!.?\s]*$/i.test(t) ||
    /^tmj[!.?\s]*$/i.test(t);

  if (encerraCurto || (agenteDespediu && t.length <= 60 && !continua)) {
    return "encerramento";
  }

  return null;
}

export function heuristicaEncerramentoRespostaAgente(
  resposta: string,
  toolCalls?: Array<{ nome: string; ok: boolean }>
): boolean {
  const criouEvento = (toolCalls ?? []).some(
    (t) => t.ok && /hub_int_gcal_criar_evento/i.test(t.nome)
  );
  if (criouEvento) return true;

  const t = normalizarTexto(resposta);
  if (!t) return false;

  const tNorm = t
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();

  const temLinkAgenda =
    tNorm.includes("calendar.google") || tNorm.includes("meet.google");
  const despedida =
    /\bate (logo|ja|mais|breve)\b/.test(tNorm) ||
    /\bate ja\b/.test(tNorm) ||
    tNorm.includes("qualquer duvida antes") ||
    tNorm.includes("demonstracao agendada");

  return (temLinkAgenda && despedida) || despedida;
}

export async function classificarMensagemClienteFollowupIa(params: {
  mensagemCliente: string;
  ultimaMensagemAgente?: string | null;
}): Promise<{
  classificacao: ClassificacaoFollowupCliente;
  motivo: string;
  confianca: number;
  fonte: "ia" | "heuristica";
}> {
  const heur = heuristicaClassificacaoCliente(
    params.mensagemCliente,
    params.ultimaMensagemAgente
  );
  if (heur === "continuar") {
    return { classificacao: "continuar", motivo: "heuristica_continuar", confianca: 0.85, fonte: "heuristica" };
  }

  const user = [
    params.ultimaMensagemAgente?.trim()
      ? `Última mensagem do agente:\n"""${params.ultimaMensagemAgente.trim().slice(0, 600)}"""`
      : "Última mensagem do agente: (desconhecida)",
    `\nMensagem do cliente:\n"""${params.mensagemCliente.trim().slice(0, 400)}"""`,
  ].join("\n");

  const out = await gerarTextoIa({ user, system: SYSTEM_CLIENTE, maxTokens: 120 });
  if (out.ok) {
    const parsed = parseJsonRespostaIa<{
      classificacao?: string;
      motivo?: string;
      confianca?: number;
    }>(out.texto);
    const cls = parsed?.classificacao === "encerramento" ? "encerramento" : "continuar";
    const conf = typeof parsed?.confianca === "number" ? parsed.confianca : 0.7;
    if (conf >= 0.55) {
      return {
        classificacao: cls,
        motivo: typeof parsed?.motivo === "string" ? parsed.motivo : "ia",
        confianca: conf,
        fonte: "ia",
      };
    }
  }

  if (heur === "encerramento") {
    return {
      classificacao: "encerramento",
      motivo: "heuristica_encerramento",
      confianca: 0.75,
      fonte: "heuristica",
    };
  }

  return { classificacao: "continuar", motivo: "default_continuar", confianca: 0.5, fonte: "heuristica" };
}

export async function classificarEncerramentoRespostaAgenteIa(
  respostaAgente: string
): Promise<{ encerramento: boolean; motivo: string; confianca: number; fonte: "ia" | "heuristica" }> {
  if (heuristicaEncerramentoRespostaAgente(respostaAgente)) {
    return { encerramento: true, motivo: "heuristica_despedida", confianca: 0.9, fonte: "heuristica" };
  }

  const out = await gerarTextoIa({
    user: `Resposta do agente:\n"""${respostaAgente.trim().slice(0, 800)}"""`,
    system: SYSTEM_AGENTE,
    maxTokens: 100,
  });

  if (out.ok) {
    const parsed = parseJsonRespostaIa<{
      encerramento?: boolean;
      motivo?: string;
      confianca?: number;
    }>(out.texto);
    if (typeof parsed?.encerramento === "boolean") {
      const conf = typeof parsed.confianca === "number" ? parsed.confianca : 0.7;
      if (conf >= 0.55) {
        return {
          encerramento: parsed.encerramento,
          motivo: typeof parsed.motivo === "string" ? parsed.motivo : "ia",
          confianca: conf,
          fonte: "ia",
        };
      }
    }
  }

  return { encerramento: false, motivo: "nao_encerramento", confianca: 0.5, fonte: "heuristica" };
}

async function obterUltimaMensagemAgenteLead(
  supabase: SupabaseClient,
  leadId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("hub_fila_mensagens")
    .select("conteudo, metadata")
    .eq("lead_id", leadId)
    .eq("direcao", "saida")
    .order("criado_em", { ascending: false })
    .limit(5);

  for (const row of data ?? []) {
    const meta =
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {};
    if (meta.tipo === "followup_automatico") continue;
    const c = typeof row.conteudo === "string" ? row.conteudo.trim() : "";
    if (c) return c;
  }
  return null;
}

async function mergeMetadataEncerramento(
  supabase: SupabaseClient,
  leadId: string,
  motivo: FollowupEncerramentoMotivo,
  detalhe?: string
): Promise<Record<string, unknown>> {
  const { data } = await supabase.from("hub_leads_crm").select("metadata").eq("id", leadId).maybeSingle();
  const prev =
    data?.metadata && typeof data.metadata === "object" && !Array.isArray(data.metadata)
      ? { ...(data.metadata as Record<string, unknown>) }
      : {};
  return {
    ...prev,
    followup_encerrado_em: new Date().toISOString(),
    followup_encerrado_motivo: motivo,
    ...(detalhe ? { followup_encerrado_detalhe: detalhe.slice(0, 200) } : {}),
  };
}

/** Pausa follow-up e limpa cadência — conversa encerrada com sucesso. */
export async function pausarFollowupPorEncerramento(
  supabase: SupabaseClient,
  leadId: string,
  options: {
    motivo: FollowupEncerramentoMotivo;
    detalhe?: string;
    agente_slug?: string;
  }
): Promise<void> {
  const metadata = await mergeMetadataEncerramento(
    supabase,
    leadId,
    options.motivo,
    options.detalhe
  );
  await limparLedgerCadenciaLead(supabase, leadId, options.agente_slug);
  try {
    await supabase
      .from("hub_leads_crm")
      .update({
        followup_pausado: true,
        followup_passo: 0,
        ultimo_followup: null,
        proximo_followup: null,
        metadata,
      })
      .eq("id", leadId);
  } catch (e) {
    console.warn("[followup-encerramento] pausar:", e);
  }
}

/** Reinicia cadência — cliente voltou com nova intenção. */
export async function reativarCadenciaFollowupCliente(
  supabase: SupabaseClient,
  leadId: string,
  options?: { agente_slug?: string },
  quando: Date | string = new Date()
): Promise<void> {
  const d = parseFollowupTimestamp(quando) ?? new Date();
  const iso = d.toISOString();
  const { data } = await supabase.from("hub_leads_crm").select("metadata").eq("id", leadId).maybeSingle();
  const prev =
    data?.metadata && typeof data.metadata === "object" && !Array.isArray(data.metadata)
      ? { ...(data.metadata as Record<string, unknown>) }
      : {};
  delete prev.followup_encerrado_em;
  delete prev.followup_encerrado_motivo;
  delete prev.followup_encerrado_detalhe;

  await limparLedgerCadenciaLead(supabase, leadId, options?.agente_slug);
  try {
    await supabase
      .from("hub_leads_crm")
      .update({
        ultima_msg_cliente_em: iso,
        ultimo_contato: iso,
        followup_pausado: false,
        followup_passo: 0,
        ultimo_followup: null,
        proximo_followup: null,
        metadata: prev,
      })
      .eq("id", leadId);
  } catch (e) {
    console.warn("[followup-encerramento] reativar cadência:", e);
  }
}

/** Atualiza relógio sem reiniciar cadência (humano/grupo). */
export async function atualizarContatoClienteSemCadencia(
  supabase: SupabaseClient,
  leadId: string,
  quando: Date | string = new Date()
): Promise<void> {
  const d = parseFollowupTimestamp(quando) ?? new Date();
  const iso = d.toISOString();
  try {
    await supabase
      .from("hub_leads_crm")
      .update({ ultima_msg_cliente_em: iso, ultimo_contato: iso })
      .eq("id", leadId);
  } catch (e) {
    console.warn("[followup-encerramento] atualizar contato:", e);
  }
}

/** Inbound do cliente — IA decide encerrar (pausa) ou continuar (reinicia cadência). */
export async function processarFollowupInboundMensagemCliente(
  supabase: SupabaseClient,
  leadId: string,
  mensagemCliente: string,
  options?: {
    pausado?: boolean;
    agente_slug?: string;
    metadata?: unknown;
  },
  quando: Date | string = new Date()
): Promise<void> {
  if (options?.pausado) {
    await atualizarContatoClienteSemCadencia(supabase, leadId, quando);
    return;
  }

  if (leadTemReservaCalendarioFutura(options?.metadata)) {
    await pausarFollowupPorEncerramento(supabase, leadId, {
      motivo: "reserva_calendario",
      agente_slug: options?.agente_slug,
      detalhe: "reserva activa no lead",
    });
    await atualizarContatoClienteSemCadencia(supabase, leadId, quando);
    return;
  }

  const ultimaAgente = await obterUltimaMensagemAgenteLead(supabase, leadId);
  const classificacao = await classificarMensagemClienteFollowupIa({
    mensagemCliente,
    ultimaMensagemAgente: ultimaAgente,
  });

  if (classificacao.classificacao === "encerramento") {
    await pausarFollowupPorEncerramento(supabase, leadId, {
      motivo:
        classificacao.fonte === "ia" ? "ia_encerramento" : "agradecimento_cliente",
      detalhe: classificacao.motivo,
      agente_slug: options?.agente_slug,
    });
    const d = parseFollowupTimestamp(quando) ?? new Date();
    try {
      await supabase
        .from("hub_leads_crm")
        .update({
          ultima_msg_cliente_em: d.toISOString(),
          ultimo_contato: d.toISOString(),
        })
        .eq("id", leadId);
    } catch {
      /* ok */
    }
    return;
  }

  await reativarCadenciaFollowupCliente(supabase, leadId, options, quando);
}

/** Após resposta da IA — pausa se despedida ou calendar criado. */
export async function processarFollowupAposRespostaAgente(
  supabase: SupabaseClient,
  params: {
    leadId: string;
    agenteSlug?: string;
    respostaAgente: string;
    toolCallsExecutadas?: Array<{ nome: string; ok: boolean }>;
  }
): Promise<void> {
  const criouCalendario = (params.toolCallsExecutadas ?? []).some(
    (t) => t.ok && /hub_int_gcal_criar_evento/i.test(t.nome)
  );
  if (criouCalendario) {
    await pausarFollowupPorEncerramento(supabase, params.leadId, {
      motivo: "reserva_calendario",
      agente_slug: params.agenteSlug,
      detalhe: "evento criado neste turno",
    });
    return;
  }

  const heur = heuristicaEncerramentoRespostaAgente(
    params.respostaAgente,
    params.toolCallsExecutadas
  );
  const classificacao = heur
    ? { encerramento: true, motivo: "heuristica_despedida", confianca: 0.9, fonte: "heuristica" as const }
    : await classificarEncerramentoRespostaAgenteIa(params.respostaAgente);

  if (classificacao.encerramento && classificacao.confianca >= 0.55) {
    await pausarFollowupPorEncerramento(supabase, params.leadId, {
      motivo: "resposta_agente_despedida",
      detalhe: classificacao.motivo,
      agente_slug: params.agenteSlug,
    });
  }
}
