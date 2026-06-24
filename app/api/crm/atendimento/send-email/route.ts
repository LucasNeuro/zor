import { NextRequest, NextResponse } from "next/server";
import {
  humanoResponsavelFromActor,
  resolveActorFromRequest,
} from "@/lib/crm/resolve-crm-actor";
import {
  ensureConversaAtiva,
  gravarMensagemSaidaConversa,
} from "@/lib/crm/conversa-canal";
import { defaultTenantId } from "@/lib/tenant-default";
import { normalizarEnderecoEmail } from "@/lib/email/inbound-parser";
import { sendEmailViaAgente } from "@/lib/email/send-via-agente";
import {
  EMAIL_CHANNEL_DISABLED_CODE,
  EMAIL_CHANNEL_DISABLED_MESSAGE,
  isEmailChannelEnabled,
} from "@/lib/feature-flags";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";

export async function POST(request: NextRequest) {
  try {
    const configErr = crmConfigError();
    if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

    if (!isEmailChannelEnabled()) {
      return NextResponse.json(
        { error: EMAIL_CHANNEL_DISABLED_MESSAGE, code: EMAIL_CHANNEL_DISABLED_CODE },
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

    const supabase = crmDb();
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

    let agenteRow: {
      email_from: string | null;
      email_from_name: string | null;
      email_inbound: string | null;
      email_provider: string | null;
      email_integracao_id: string | null;
      modo_operacao: string | null;
      email_ativo: boolean | null;
    } | null = null;

    if (agenteSlug) {
      const { data: agente } = await supabase
        .from("hub_agente_identidade")
        .select(
          "email_from, email_from_name, email_inbound, email_provider, email_integracao_id, modo_operacao, email_ativo"
        )
        .eq("agente_slug", agenteSlug)
        .maybeSingle();
      if (agente?.modo_operacao === "canal_email" && agente.email_ativo !== false) {
        agenteRow = agente;
      }
    }

    if (!agenteRow) {
      return NextResponse.json(
        { error: "Nenhum agente de e-mail activo associado a este lead." },
        { status: 409 }
      );
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
    let gmailThreadId: string | null = null;

    if (conversas?.id) {
      const { data: ultima } = await supabase
        .from("hub_mensagens")
        .select("email_subject, email_message_id, metadados")
        .eq("conversa_id", conversas.id)
        .order("enviada_em", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      lastSubject = typeof ultima?.email_subject === "string" ? ultima.email_subject : null;
      lastMessageId = typeof ultima?.email_message_id === "string" ? ultima.email_message_id : null;
      const meta =
        ultima?.metadados && typeof ultima.metadados === "object" && !Array.isArray(ultima.metadados)
          ? (ultima.metadados as Record<string, unknown>)
          : {};
      gmailThreadId =
        typeof meta.gmail_thread_id === "string" ? meta.gmail_thread_id : null;
    }

    const subjectInput = body.subject?.trim();
    const subject = subjectInput
      ? subjectInput
      : lastSubject
        ? lastSubject.startsWith("Re:")
          ? lastSubject
          : `Re: ${lastSubject}`
        : `Atendimento — ${typeof lead.nome === "string" ? lead.nome : "lead"}`;

    const origin = request.nextUrl.origin;
    const send = await sendEmailViaAgente(
      supabase,
      tenantId,
      agenteRow,
      {
        to: destino,
        subject,
        text: texto,
        inReplyTo: lastMessageId,
        references: lastMessageId,
        threadId: gmailThreadId,
        replyTo: agenteRow.email_inbound,
      },
      { origin }
    );

    if (!send.ok) {
      return NextResponse.json(
        { error: send.error, provider: send.provider ?? null, detail: send.body ?? null },
        { status: send.status && send.status >= 400 ? send.status : 502 }
      );
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
        metadata: {
          provider: send.provider,
          gmail_thread_id: send.threadId ?? null,
        },
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
      metadata: { origem: "crm_atendimento_email", subject, provider: send.provider },
    });

    await supabase
      .from("hub_leads_crm")
      .update({ ultimo_contato: agora, atualizado_em: agora })
      .eq("id", leadId);

    return NextResponse.json({
      ok: true,
      to: destino,
      subject,
      provider: send.provider,
      message_id: send.id ?? null,
      gmail_thread_id: send.threadId ?? null,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
