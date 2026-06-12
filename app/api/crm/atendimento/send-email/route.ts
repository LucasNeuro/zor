import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  humanoResponsavelFromActor,
  resolveActorFromRequest,
} from "@/lib/crm/resolve-crm-actor";
import {
  ensureConversaAtiva,
  gravarMensagemSaidaConversa,
} from "@/lib/crm/conversa-canal";
import { sendEmail } from "@/lib/email/resend-send";
import { resendConfigured } from "@/lib/email/resend-config";
import { defaultTenantId } from "@/lib/tenant-default";
import { normalizarEnderecoEmail } from "@/lib/email/inbound-parser";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  try {
    if (!resendConfigured()) {
      return NextResponse.json(
        { error: "Resend não configurado: defina RESEND_API_KEY" },
        { status: 503 }
      );
    }

    let body: { leadId?: string; texto?: string; subject?: string };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
    }

    const leadId = body.leadId?.trim();
    const texto = body.texto?.trim();
    if (!leadId || !texto) {
      return NextResponse.json({ error: "leadId e texto são obrigatórios" }, { status: 400 });
    }

    const supabase = db();
    const actor = await resolveActorFromRequest(supabase, request.headers);
    const feitoPor = humanoResponsavelFromActor(actor);
    const tenantId = defaultTenantId();

    const { data: lead, error: leadErr } = await supabase
      .from("hub_leads_crm")
      .select("id, email, humano_responsavel, agente_responsavel, pessoa_id, nome")
      .eq("id", leadId)
      .maybeSingle();

    if (leadErr) return NextResponse.json({ error: leadErr.message }, { status: 500 });
    if (!lead) return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });

    const humano = typeof lead.humano_responsavel === "string" ? lead.humano_responsavel.trim() : "";
    if (!humano) {
      return NextResponse.json(
        { error: "Assuma o atendimento antes de enviar e-mail ao lead." },
        { status: 403 }
      );
    }

    const destino = normalizarEnderecoEmail(lead.email || "");
    if (!destino) {
      return NextResponse.json({ error: "Lead sem e-mail válido" }, { status: 400 });
    }

    const agenteSlug =
      typeof lead.agente_responsavel === "string" ? lead.agente_responsavel.trim() : "";
    let emailFrom: string | null = null;
    let emailFromName: string | null = null;
    let replyTo: string | null = null;

    if (agenteSlug) {
      const { data: agente } = await supabase
        .from("hub_agente_identidade")
        .select("email_from, email_from_name, email_inbound, modo_operacao, email_ativo")
        .eq("agente_slug", agenteSlug)
        .maybeSingle();
      if (agente?.modo_operacao === "canal_email" && agente.email_ativo !== false) {
        emailFrom = typeof agente.email_from === "string" ? agente.email_from : null;
        emailFromName = typeof agente.email_from_name === "string" ? agente.email_from_name : null;
        replyTo = typeof agente.email_inbound === "string" ? agente.email_inbound : null;
      }
    }

    const { data: conversas } = await supabase
      .from("hub_conversas")
      .select("id")
      .eq("lead_id", leadId)
      .eq("canal", "email")
      .is("encerrada_em", null)
      .maybeSingle();

    let lastSubject: string | null = null;
    let lastMessageId: string | null = null;

    if (conversas?.id) {
      const { data: ultima } = await supabase
        .from("hub_mensagens")
        .select("email_subject, email_message_id")
        .eq("conversa_id", conversas.id)
        .order("enviada_em", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      lastSubject = typeof ultima?.email_subject === "string" ? ultima.email_subject : null;
      lastMessageId = typeof ultima?.email_message_id === "string" ? ultima.email_message_id : null;
    }

    const subjectInput = body.subject?.trim();
    const subject = subjectInput
      ? subjectInput
      : lastSubject
        ? lastSubject.startsWith("Re:")
          ? lastSubject
          : `Re: ${lastSubject}`
        : `Atendimento — ${typeof lead.nome === "string" ? lead.nome : "lead"}`;

    const send = await sendEmail({
      to: destino,
      subject,
      text: texto,
      from: emailFrom,
      fromName: emailFromName,
      inReplyTo: lastMessageId,
      references: lastMessageId,
      replyTo: replyTo || undefined,
    });

    if (!send.ok) {
      return NextResponse.json({ error: send.error, resend: send.body ?? null }, { status: 502 });
    }

    const conversaId = await ensureConversaAtiva(supabase, {
      leadId,
      canal: "email",
      tenantId,
      pessoaId: (lead.pessoa_id as string | null) ?? null,
      preview: texto,
    });

    if (conversaId) {
      await gravarMensagemSaidaConversa(supabase, {
        conversaId,
        leadId,
        tenantId,
        canal: "email",
        conteudo: texto,
        feitoPor,
        emailSubject: subject,
        emailMessageId: send.id ?? null,
        emailInReplyTo: lastMessageId,
        emailStatus: "enviado",
      });
    }

    const agora = new Date().toISOString();
    await supabase.from("hub_atividades").insert({
      lead_id: leadId,
      tipo: "email",
      descricao: texto.slice(0, 500),
      feito_por: feitoPor,
      feito_por_tipo: "humano",
      tenant_id: tenantId,
      metadata: { origem: "crm_atendimento_email", subject },
    });

    await supabase
      .from("hub_leads_crm")
      .update({ ultimo_contato: agora, atualizado_em: agora })
      .eq("id", leadId);

    return NextResponse.json({ ok: true, to: destino, subject, resend_id: send.id ?? null });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
