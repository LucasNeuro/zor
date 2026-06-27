import type { SupabaseClient } from "@supabase/supabase-js";
import type { ParsedInboundEmail } from "@/lib/email/inbound-parser";
import { resolverAgentePorDestinatariosInbound } from "@/lib/email/resolve-agente-por-email";
import { sendGmailEmail } from "@/lib/email/gmail-send";
import type { AgenteEmailRow } from "@/lib/email/resolve-agente-por-email";
import { processarMensagem } from "@/lib/ia/engine";
import { identificarMercado } from "@/lib/ia/agentes-config";
import { defaultTenantId, isMissingPgColumn } from "@/lib/tenant-default";
import { garantirCodigoLead, prepararRowHubLeadInsert } from "@/lib/crm/lead-cadastro";
import { gerarCodigoPessoa } from "@/lib/crm/pessoa-cadastro";
import {
  ensureConversaAtiva,
  gravarMensagemEntradaConversa,
  gravarParMensagensConversa,
} from "@/lib/crm/conversa-canal";
import { humanoBloqueiaRespostaIa } from "@/lib/crm/resolve-crm-actor";

export type ProcessInboundEmailResult =
  | {
      ok: true;
      status: "processed" | "ignored" | "duplicate";
      lead_id?: string;
      agente_slug?: string;
      reason?: string;
      gmail_message_id?: string;
    }
  | { ok: false; error: string; status?: number };

async function encontrarOuCriarPessoaPorEmail(
  supabase: SupabaseClient,
  email: string,
  nome: string | null
) {
  const { data: pessoaExistente } = await supabase
    .from("hub_pessoas")
    .select("*")
    .ilike("email", email)
    .maybeSingle();

  if (pessoaExistente) return pessoaExistente;

  const codigo = await gerarCodigoPessoa(supabase);
  const nomePessoa = nome?.trim() || `Lead ${email.split("@")[0] || "Email"}`;

  const { data: novaPessoa } = await supabase
    .from("hub_pessoas")
    .insert({
      codigo,
      nome: nomePessoa,
      email,
      tipo: "lead",
      origem: "email",
    })
    .select()
    .single();

  return novaPessoa;
}

async function encontrarOuCriarLeadPorEmail(
  supabase: SupabaseClient,
  opts: {
    email: string;
    nome: string | null;
    mercado: string;
    mensagem: string;
    agenteSlug: string;
    tenantId: string;
  }
) {
  const { data: leadExistente } = await supabase
    .from("hub_leads_crm")
    .select("*")
    .ilike("email", opts.email)
    .maybeSingle();

  if (leadExistente) {
    const leadUpdate: Record<string, unknown> = {
      agente_responsavel: opts.agenteSlug,
      tenant_id: leadExistente.tenant_id || opts.tenantId,
      metadata: {
        ...(typeof leadExistente.metadata === "object" && leadExistente.metadata !== null
          ? (leadExistente.metadata as Record<string, unknown>)
          : {}),
        mercado: opts.mercado,
        fase_atendimento: "conversa_ia",
        canal: "email",
      },
    };

    let upd = await supabase.from("hub_leads_crm").update(leadUpdate).eq("id", leadExistente.id);
    if (upd.error && isMissingPgColumn(upd.error, "tenant_id")) {
      const { tenant_id: _t, ...semTenant } = leadUpdate;
      upd = await supabase.from("hub_leads_crm").update(semTenant).eq("id", leadExistente.id);
    }

    const { data: leadAtualizado } = await supabase
      .from("hub_leads_crm")
      .select("*")
      .eq("id", leadExistente.id)
      .maybeSingle();

    const leadFinal = leadAtualizado ?? leadExistente;
    await garantirCodigoLead(supabase, {
      id: leadFinal.id as string,
      codigo: (leadFinal as { codigo?: string | null }).codigo,
    });

    return { lead: leadFinal, isNovo: false as const };
  }

  const pessoa = await encontrarOuCriarPessoaPorEmail(supabase, opts.email, opts.nome);
  const nomeLead = opts.nome?.trim() || `Lead ${opts.email.split("@")[0] || "Email"}`;

  const pessoaCodigo =
    pessoa && typeof pessoa === "object" && "codigo" in pessoa && pessoa.codigo != null
      ? String(pessoa.codigo)
      : null;

  const rowNovoLead = await prepararRowHubLeadInsert(
    supabase,
    {
      nome: nomeLead,
      telefone: null,
      email: opts.email,
      origem: "email",
      estagio: "novo",
      score: 10,
      valor_estimado: 0,
      agente_responsavel: opts.agenteSlug,
      pessoa_id: pessoa?.id ?? null,
      tenant_id: opts.tenantId,
      metadata: {
        mercado: opts.mercado,
        fase_atendimento: "conversa_ia",
        canal: "email",
        primeira_mensagem: opts.mensagem.slice(0, 200),
      },
    },
    { pessoa_codigo: pessoaCodigo }
  );

  const { data: novoLead, error } = await supabase
    .from("hub_leads_crm")
    .insert(rowNovoLead)
    .select()
    .single();

  if (error || !novoLead) {
    console.error("[email/inbound] Erro ao criar lead:", error);
    return { lead: null, isNovo: false as const };
  }

  await supabase.from("hub_atividades").insert({
    lead_id: novoLead.id,
    tipo: "mensagem",
    descricao: `Contacto e-mail iniciado — mercado: ${opts.mercado}`,
    feito_por: "sistema",
    feito_por_tipo: "ia",
    metadata: { email: opts.email, mercado: opts.mercado, primeira_mensagem: true },
  });

  return { lead: novoLead, isNovo: true as const };
}

async function mensagemEmailJaProcessada(
  supabase: SupabaseClient,
  opts: { dedupeId?: string | null; email: string }
): Promise<boolean> {
  const mid = opts.dedupeId?.trim();
  if (!mid) return false;

  const { data, error } = await supabase
    .from("hub_msg_jobs")
    .select("id")
    .eq("canal", "email")
    .eq("message_id", mid)
    .eq("telefone", opts.email)
    .limit(1);

  if (error) {
    if (isMissingPgColumn(error, "canal") || /hub_msg_jobs/i.test(error.message)) {
      return false;
    }
    console.error("[email/inbound] dedupe:", error.message);
    return false;
  }

  return Array.isArray(data) && data.length > 0;
}

async function gravarEmailInboundSemIa(
  supabase: SupabaseClient,
  opts: {
    inbound: ParsedInboundEmail;
    lead: Record<string, unknown>;
    agenteSlug: string;
    tenantId: string;
    dedupeId?: string | null;
    provider?: string;
  }
): Promise<ProcessInboundEmailResult> {
  const leadId = String(opts.lead.id);
  const humano = typeof opts.lead.humano_responsavel === "string" ? opts.lead.humano_responsavel.trim() : "";

  const conversaId = await ensureConversaAtiva(supabase, {
    leadId,
    canal: "email",
    tenantId: opts.tenantId,
    pessoaId: (opts.lead.pessoa_id as string | null) ?? null,
    preview: opts.inbound.text,
  });

  if (conversaId) {
    await gravarMensagemEntradaConversa(supabase, {
      conversaId,
      leadId,
      tenantId: opts.tenantId,
      canal: "email",
      conteudo: opts.inbound.text,
      emailSubject: opts.inbound.subject,
      emailMessageId: opts.inbound.messageId,
      metadados: {
        from: opts.inbound.fromEmail,
        resend_email_id: opts.inbound.resendEmailId ?? null,
        gmail_message_id: opts.inbound.gmailMessageId,
        provider: opts.provider ?? "oauth_google",
        skip_ia: true,
        humano_responsavel: humano || null,
      },
    });
  }

  const dedupeId = opts.dedupeId?.trim();
  if (dedupeId) {
    const jobRow = {
      tenant_id: opts.tenantId,
      canal: "email",
      telefone: opts.inbound.fromEmail,
      lead_id: opts.lead.id,
      agente_slug: opts.agenteSlug,
      message_id: dedupeId,
      payload: {
        from: opts.inbound.fromEmail,
        subject: opts.inbound.subject,
        skip_ia: true,
        humano_responsavel: humano || null,
      },
    };
    const { error: jobErr } = await supabase
      .from("hub_msg_jobs")
      .upsert(jobRow, { onConflict: "canal,message_id", ignoreDuplicates: true });
    if (jobErr && !isMissingPgColumn(jobErr)) {
      console.warn("[email/inbound] hub_msg_jobs (sem IA):", jobErr.message);
    }
  }

  const agora = new Date().toISOString();
  await supabase
    .from("hub_leads_crm")
    .update({ ultimo_contato: agora, atualizado_em: agora })
    .eq("id", leadId);

  try {
    await supabase.from("hub_atividades").insert({
      lead_id: leadId,
      tipo: "email",
      descricao: `E-mail recebido — humano (${humano}) a atender — IA não acionada.`,
      feito_por: "sistema",
      feito_por_tipo: "ia",
      tenant_id: opts.tenantId,
      metadata: {
        skip_ia: true,
        humano_responsavel: humano,
        subject: opts.inbound.subject,
        from: opts.inbound.fromEmail,
      },
    });
  } catch (e) {
    console.warn("[email/inbound] atividade sem IA:", e);
  }

  return {
    ok: true,
    status: "processed",
    lead_id: leadId,
    agente_slug: opts.agenteSlug,
    reason: "humano_responsavel_ativo",
  };
}

function gmailDedupeId(inbound: ParsedInboundEmail): string | null {
  if (inbound.gmailMessageId?.trim()) return `gmail:${inbound.gmailMessageId.trim()}`;
  if (inbound.messageId?.trim()) return inbound.messageId.trim();
  return null;
}

async function registrarEmailSyncState(
  supabase: SupabaseClient,
  opts: {
    tenantId: string;
    integracaoRowId: string;
    gmailMessageId: string;
    rfcMessageId?: string | null;
    agenteSlug: string;
    leadId?: string | null;
  }
): Promise<void> {
  const gmailId = opts.gmailMessageId.trim();
  if (!gmailId) return;

  const { error } = await supabase.from("hub_email_sync_state").upsert(
    {
      tenant_id: opts.tenantId,
      integracao_id: opts.integracaoRowId,
      gmail_message_id: gmailId,
      rfc_message_id: opts.rfcMessageId?.trim() || null,
      agente_slug: opts.agenteSlug,
      lead_id: opts.leadId ?? null,
      processado_em: new Date().toISOString(),
    },
    { onConflict: "integracao_id,gmail_message_id", ignoreDuplicates: true }
  );

  if (error && !isMissingPgColumn(error, "hub_email_sync_state")) {
    console.warn("[email/oauth-inbound] hub_email_sync_state:", error.message);
  }
}

/** Processa e-mail inbound Gmail OAuth: lead + IA + resposta via Gmail API. */
export async function processOAuthInboundEmail(
  supabase: SupabaseClient,
  inbound: ParsedInboundEmail,
  opts: {
    agente: AgenteEmailRow;
    integracaoRowId: string;
    bearerToken: string;
    mailboxEmail?: string | null;
  }
): Promise<ProcessInboundEmailResult> {
  const inboundMsg = inbound;
  if (!inboundMsg.text.trim()) {
    return { ok: false, error: "E-mail recebido sem corpo utilizável", status: 422 };
  }

  const agente = opts.agente;
  const agenteSlug = agente.agente_slug;
  const tenantId =
    (typeof agente.tenant_id === "string" && agente.tenant_id.trim()) || defaultTenantId();

  const dedupeId = gmailDedupeId(inboundMsg);
  if (await mensagemEmailJaProcessada(supabase, { dedupeId, email: inboundMsg.fromEmail })) {
    return { ok: true, status: "duplicate", agente_slug: agenteSlug, reason: "duplicate_message_id" };
  }

  const mercado = identificarMercado(inboundMsg.text);
  const { lead, isNovo } = await encontrarOuCriarLeadPorEmail(supabase, {
    email: inboundMsg.fromEmail,
    nome: inboundMsg.fromName,
    mercado,
    mensagem: inboundMsg.text,
    agenteSlug,
    tenantId,
  });

  if (!lead) {
    return { ok: false, error: "Falha ao criar ou atualizar lead", status: 500 };
  }

  if (humanoBloqueiaRespostaIa(lead as { humano_responsavel?: string | null; metadata?: unknown })) {
    const skip = await gravarEmailInboundSemIa(supabase, {
      inbound: inboundMsg,
      lead: lead as Record<string, unknown>,
      agenteSlug,
      tenantId,
      dedupeId,
      provider: "oauth_google",
    });
    if (inboundMsg.gmailMessageId?.trim()) {
      await registrarEmailSyncState(supabase, {
        tenantId,
        integracaoRowId: opts.integracaoRowId,
        gmailMessageId: inboundMsg.gmailMessageId,
        rfcMessageId: inboundMsg.messageId,
        agenteSlug,
        leadId: lead.id as string,
      });
    }
    return skip;
  }

  const resultado = await processarMensagem({
    leadId: lead.id as string,
    mensagem: inboundMsg.text,
    canal: "email",
    nome: inboundMsg.fromName || undefined,
    agenteSlugHint: agenteSlug,
    tenantId,
    metadata: {
      email: inboundMsg.fromEmail,
      subject: inboundMsg.subject,
      message_id: inboundMsg.messageId,
      gmail_message_id: inboundMsg.gmailMessageId,
      is_novo: isNovo,
    },
  });

  if (!resultado.sucesso || !resultado.resposta?.trim()) {
    return {
      ok: false,
      error: resultado.erro || "IA não devolveu resposta",
      status: 502,
    };
  }

  const replySubject = inboundMsg.subject.startsWith("Re:")
    ? inboundMsg.subject
    : `Re: ${inboundMsg.subject}`;

  const fromEmail =
    agente.email_from?.trim() ||
    opts.mailboxEmail?.trim() ||
    agente.email_inbound?.trim() ||
    null;

  const refs = [inboundMsg.references, inboundMsg.messageId].filter(Boolean).join(" ").trim() || undefined;

  const send = await sendGmailEmail({
    bearerToken: opts.bearerToken,
    to: inboundMsg.fromEmail,
    subject: replySubject,
    text: resultado.resposta,
    from: fromEmail,
    fromName: agente.email_from_name,
    inReplyTo: inboundMsg.messageId,
    references: refs,
    threadId: inboundMsg.gmailThreadId,
  });

  if (!send.ok) {
    return { ok: false, error: send.error, status: 502 };
  }

  const conversaId = await ensureConversaAtiva(supabase, {
    leadId: lead.id as string,
    canal: "email",
    tenantId,
    pessoaId: (lead.pessoa_id as string | null) ?? null,
    preview: resultado.resposta,
  });

  if (conversaId) {
    await gravarParMensagensConversa(supabase, {
      conversaId,
      leadId: lead.id as string,
      tenantId,
      canal: "email",
      entrada: {
        conteudo: inboundMsg.text,
        emailSubject: inboundMsg.subject,
        emailMessageId: inboundMsg.messageId,
        metadados: {
          from: inboundMsg.fromEmail,
          gmail_message_id: inboundMsg.gmailMessageId,
          provider: "oauth_google",
        },
      },
      saida: {
        conteudo: resultado.resposta,
        remetente: "ia",
        agenteId: agenteSlug,
        emailSubject: replySubject,
        emailMessageId: send.id ?? null,
        emailInReplyTo: inboundMsg.messageId,
        emailStatus: "enviado",
        metadados: { gmail_message_id: send.id ?? null, provider: "oauth_google" },
      },
    });
  }

  if (dedupeId) {
    const jobRow = {
      tenant_id: tenantId,
      canal: "email",
      telefone: inboundMsg.fromEmail,
      lead_id: lead.id,
      agente_slug: agenteSlug,
      message_id: dedupeId,
      payload: {
        from: inboundMsg.fromEmail,
        subject: inboundMsg.subject,
        to: inboundMsg.toAddresses,
        gmail_message_id: inboundMsg.gmailMessageId,
        rfc_message_id: inboundMsg.messageId,
        gmail_send_id: send.id ?? null,
        provider: "oauth_google",
      },
    };
    const { error: jobErr } = await supabase
      .from("hub_msg_jobs")
      .upsert(jobRow, { onConflict: "canal,message_id", ignoreDuplicates: true });
    if (jobErr && !isMissingPgColumn(jobErr)) {
      console.warn("[email/oauth-inbound] hub_msg_jobs:", jobErr.message);
    }
  }

  if (inboundMsg.gmailMessageId?.trim()) {
    await registrarEmailSyncState(supabase, {
      tenantId,
      integracaoRowId: opts.integracaoRowId,
      gmailMessageId: inboundMsg.gmailMessageId,
      rfcMessageId: inboundMsg.messageId,
      agenteSlug,
      leadId: lead.id as string,
    });
  }

  return {
    ok: true,
    status: "processed",
    lead_id: lead.id as string,
    agente_slug: agenteSlug,
  };
}
