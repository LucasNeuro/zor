import type { SupabaseClient } from "@supabase/supabase-js";
import type { ParsedInboundEmail } from "@/lib/email/inbound-parser";
import { stripHtmlBasicoFromInbound } from "@/lib/email/inbound-parser";
import { resolverAgentePorDestinatariosInbound } from "@/lib/email/resolve-agente-por-email";
import { fetchResendReceivedEmail } from "@/lib/email/resend-receiving";
import { sendEmail } from "@/lib/email/resend-send";
import { processarMensagem } from "@/lib/ia/engine";
import { identificarMercado } from "@/lib/ia/agentes-config";
import { defaultTenantId, isMissingPgColumn } from "@/lib/tenant-default";
import { garantirCodigoLead, prepararRowHubLeadInsert } from "@/lib/crm/lead-cadastro";
import { gerarCodigoPessoa } from "@/lib/crm/pessoa-cadastro";

export type ProcessInboundEmailResult =
  | {
      ok: true;
      status: "processed" | "ignored" | "duplicate";
      lead_id?: string;
      agente_slug?: string;
      reason?: string;
      resend_id?: string;
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
      origem: "outro",
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

async function enriquecerInboundComResendApi(
  inbound: ParsedInboundEmail
): Promise<ParsedInboundEmail | { error: string }> {
  if (inbound.text.trim()) return inbound;
  const emailId = inbound.resendEmailId?.trim();
  if (!emailId) {
    return { error: "Corpo vazio e sem email_id para buscar na API Resend" };
  }

  const fetched = await fetchResendReceivedEmail(emailId);
  if (!fetched.ok) {
    return { error: fetched.error };
  }

  const { email } = fetched;
  const text =
    (email.text || "").trim() ||
    (email.html ? stripHtmlBasicoFromInbound(email.html) : "") ||
    "";

  if (!text.trim()) {
    return { error: "E-mail recebido sem corpo utilizável na API Resend" };
  }

  return {
    ...inbound,
    text,
    html: inbound.html || email.html,
    subject: inbound.subject || email.subject || inbound.subject,
    messageId: inbound.messageId || email.messageId,
    inReplyTo: inbound.inReplyTo || email.inReplyTo,
    references: inbound.references || email.references,
  };
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

/** Processa e-mail inbound: lead + IA + resposta Resend. */
export async function processInboundEmail(
  supabase: SupabaseClient,
  inboundIn: ParsedInboundEmail
): Promise<ProcessInboundEmailResult> {
  const enriched = await enriquecerInboundComResendApi(inboundIn);
  if ("error" in enriched) {
    return { ok: false, error: enriched.error, status: 422 };
  }
  const inbound = enriched;

  const match = await resolverAgentePorDestinatariosInbound(supabase, inbound.toAddresses);
  if (!match) {
    return { ok: true, status: "ignored", reason: "agent_not_found" };
  }

  const { agente } = match;
  const agenteSlug = agente.agente_slug;
  const tenantId =
    (typeof agente.tenant_id === "string" && agente.tenant_id.trim()) || defaultTenantId();

  const dedupeId = inbound.resendEmailId || inbound.messageId;
  if (await mensagemEmailJaProcessada(supabase, { dedupeId, email: inbound.fromEmail })) {
    return { ok: true, status: "duplicate", agente_slug: agenteSlug, reason: "duplicate_message_id" };
  }

  const mercado = identificarMercado(inbound.text);
  const { lead, isNovo } = await encontrarOuCriarLeadPorEmail(supabase, {
    email: inbound.fromEmail,
    nome: inbound.fromName,
    mercado,
    mensagem: inbound.text,
    agenteSlug,
    tenantId,
  });

  if (!lead) {
    return { ok: false, error: "Falha ao criar ou atualizar lead", status: 500 };
  }

  const resultado = await processarMensagem({
    leadId: lead.id as string,
    mensagem: inbound.text,
    canal: "email",
    nome: inbound.fromName || undefined,
    agenteSlugHint: agenteSlug,
    tenantId,
    metadata: {
      email: inbound.fromEmail,
      subject: inbound.subject,
      message_id: inbound.messageId,
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

  const replySubject = inbound.subject.startsWith("Re:")
    ? inbound.subject
    : `Re: ${inbound.subject}`;

  const send = await sendEmail({
    to: inbound.fromEmail,
    subject: replySubject,
    text: resultado.resposta,
    from: agente.email_from,
    fromName: agente.email_from_name,
    inReplyTo: inbound.messageId,
    references: inbound.references || inbound.messageId,
    replyTo: agente.email_inbound || undefined,
  });

  if (!send.ok) {
    return { ok: false, error: send.error, status: send.status || 502 };
  }

  if (dedupeId) {
    const jobRow = {
      tenant_id: tenantId,
      canal: "email",
      telefone: inbound.fromEmail,
      lead_id: lead.id,
      agente_slug: agenteSlug,
      message_id: dedupeId,
      payload: {
        from: inbound.fromEmail,
        subject: inbound.subject,
        to: inbound.toAddresses,
        resend_email_id: inbound.resendEmailId,
        rfc_message_id: inbound.messageId,
        resend_id: send.id ?? null,
      },
    };
    const { error: jobErr } = await supabase
      .from("hub_msg_jobs")
      .upsert(jobRow, { onConflict: "canal,message_id", ignoreDuplicates: true });
    if (jobErr && !isMissingPgColumn(jobErr)) {
      console.warn("[email/inbound] hub_msg_jobs:", jobErr.message);
    }
  }

  return {
    ok: true,
    status: "processed",
    lead_id: lead.id as string,
    agente_slug: agenteSlug,
    resend_id: send.id,
  };
}
