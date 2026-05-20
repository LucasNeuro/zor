import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual } from "crypto";
import { identificarMercado, identificarIntencao } from "@/lib/ia/agentes-config";
import { whatsappSendText } from "@/lib/whatsapp/whatsapp-send";
import { resolverLinhaWhatsAppInbound } from "@/lib/whatsapp/resolver-linha-whatsapp";
import {
  extractWebhookInstanceRefs,
  normalizeWebhookInstanceId,
  parseWhatsappWebhookBody,
} from "@/lib/whatsapp/webhook-inbound";
import { webhookSecretQueryParam } from "@/lib/whatsapp/webhook-auth";
import { defaultTenantId, isMissingPgColumn } from "@/lib/tenant-default";
import { createWhatsappWebhookTrace } from "@/lib/observability/whatsapp-webhook-trace";
import { dispararProcessamentoJobsWhatsapp } from "@/lib/whatsapp/trigger-job-processor";
import { supersedeJobsAntigosMesmoTelefone } from "@/lib/whatsapp/supersede-jobs-antigos";

let warnedMissingWebhookSecret = false;
const WEBHOOK_DEDUPE_TTL_MS = 2 * 60 * 1000;
const webhookRecentKeys = new Map<string, number>();

function limparDedupeExpirados(nowMs: number) {
  for (const [k, ts] of webhookRecentKeys.entries()) {
    if (nowMs - ts > WEBHOOK_DEDUPE_TTL_MS) webhookRecentKeys.delete(k);
  }
}

function marcarWebhookDedupe(messageId: string | null | undefined, telefone: string): boolean {
  const mid = messageId?.trim();
  if (!mid) return false;
  const now = Date.now();
  limparDedupeExpirados(now);
  const key = `${telefone}|${mid}`;
  if (webhookRecentKeys.has(key)) return true;
  webhookRecentKeys.set(key, now);
  return false;
}

function timingSafeStringEqual(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "utf8");
    const bb = Buffer.from(b, "utf8");
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

/** Verifica origem do webhook quando WEBHOOK_SECRET está definido (HMAC ou segredo em header/Bearer). */
function webhookAutenticado(request: NextRequest, rawBody: string, secret: string): boolean {
  const sig =
    request.headers.get("x-hub-signature-256") ||
    request.headers.get("x-signature");

  if (sig) {
    const expectedHex = createHmac("sha256", secret).update(rawBody).digest("hex");
    let incoming = sig.trim();
    if (incoming.startsWith("sha256=")) incoming = incoming.slice(7);
    try {
      const a = Buffer.from(incoming, "hex");
      const b = Buffer.from(expectedHex, "hex");
      if (a.length === b.length && a.length > 0) return timingSafeEqual(a, b);
    } catch {
      /* fallthrough */
    }
  }

  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7).trim();
    if (timingSafeStringEqual(token, secret)) return true;
  }

  const headerName = (process.env.WEBHOOK_SECRET_HEADER || "x-webhook-secret").toLowerCase();
  for (const [key, value] of request.headers.entries()) {
    if (key.toLowerCase() === headerName && timingSafeStringEqual((value || "").trim(), secret)) {
      return true;
    }
  }

  const qp = webhookSecretQueryParam().toLowerCase();
  const fromQuery = request.nextUrl.searchParams.get(qp)?.trim();
  if (fromQuery && timingSafeStringEqual(fromQuery, secret)) return true;

  return false;
}

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

async function encontrarOuCriarPessoa(telefone: string, nome: string, origem: string) {
  const supabase = db();

  const { data: pessoaExistente } = await supabase
    .from("hub_pessoas")
    .select("*")
    .eq("telefone", telefone)
    .maybeSingle();

  if (pessoaExistente) return pessoaExistente;

  const { count } = await supabase
    .from("hub_pessoas")
    .select("*", { count: "exact", head: true });
  const seq = String((count || 0) + 1).padStart(4, "0");
  const codigo = `PES-${new Date().getFullYear()}-${seq}`;

  const { data: novaPessoa } = await supabase
    .from("hub_pessoas")
    .insert({
      codigo,
      nome: nome || `Lead WhatsApp`,
      telefone,
      whatsapp_id: telefone,
      tipo: "lead",
      origem: origem || "whatsapp",
    })
    .select()
    .single();

  return novaPessoa;
}

async function enviarMensagemWhatsApp(
  telefone: string,
  mensagem: string,
  opts?: { instanceToken?: string | null }
) {
  const r = await whatsappSendText(telefone, mensagem, { instanceToken: opts?.instanceToken });
  if (!r.ok) {
    console.error("[WEBHOOK] Erro ao enviar mensagem:", r.provider, r.error, r.status, r.body);
    return {
      ok: false as const,
      provider: r.provider ?? null,
      status: r.status ?? null,
      error: r.error,
      body: r.body ?? null,
    };
  }
  return {
    ok: true as const,
    provider: r.provider,
    status: r.status,
    body: r.body ?? null,
  };
}

async function mensagemWebhookJaProcessada(
  supabase: ReturnType<typeof db>,
  opts: { messageId?: string | null; telefone: string }
): Promise<boolean> {
  const mid = opts.messageId?.trim();
  if (!mid) return false;

  const { data, error } = await supabase
    .from("hub_msg_jobs")
    .select("id")
    .eq("canal", "whatsapp")
    .eq("message_id", mid)
    .eq("telefone", opts.telefone)
    .limit(1);

  if (error) {
    console.error("[WEBHOOK] Erro ao deduplicar message_id:", error.message);
    return false;
  }
  return Array.isArray(data) && data.length > 0;
}

async function encontrarOuCriarLead(telefone: string, nome: string, mercado: string, mensagem: string) {
  const supabase = db();

  const pessoa = await encontrarOuCriarPessoa(telefone, nome, "whatsapp");

  const { data: leadExistente } = await supabase
    .from("hub_leads_crm")
    .select("*")
    .eq("telefone", telefone)
    .maybeSingle();

  if (leadExistente) {
    const leadUpdate = {
      atualizado_em: new Date().toISOString(),
      ultimo_contato: new Date().toISOString(),
      pessoa_id: pessoa?.id ?? leadExistente.pessoa_id,
      tenant_id: leadExistente.tenant_id || defaultTenantId(),
    };
    let upd = await supabase.from("hub_leads_crm").update(leadUpdate).eq("id", leadExistente.id);
    if (upd.error && isMissingPgColumn(upd.error, "tenant_id")) {
      const { tenant_id: _t, ...semTenant } = leadUpdate;
      upd = await supabase.from("hub_leads_crm").update(semTenant).eq("id", leadExistente.id);
    }

    return { lead: leadExistente, isNovo: false, pessoaId: pessoa?.id ?? leadExistente.pessoa_id };
  }

  const agenteResponsavel = mercado === "imobiliario" || mercado === "arquitetura" ? "atendente" : "sdr";

  const { data: novoLead, error } = await supabase
    .from("hub_leads_crm")
    .insert({
      nome: nome || `Lead ${telefone.slice(-4)}`,
      telefone,
      origem: "whatsapp",
      estagio: "novo",
      score: 10,
      valor_estimado: 0,
      agente_responsavel: agenteResponsavel,
      pessoa_id: pessoa?.id ?? null,
      tenant_id: defaultTenantId(),
      metadata: {
        mercado,
        fase_atendimento: "conversa_ia",
        primeira_mensagem: mensagem.slice(0, 200),
      },
    })
    .select()
    .single();

  if (error || !novoLead) {
    console.error("[WEBHOOK] Erro ao criar lead:", error);
    return { lead: null, isNovo: false as const, pessoaId: null as string | null };
  }

  await supabase.from("hub_atividades").insert({
      lead_id: novoLead.id,
      tipo: "mensagem",
    descricao: `Contacto WhatsApp iniciado — mercado: ${mercado}`,
      feito_por: "sistema",
      feito_por_tipo: "ia",
      metadata: { telefone, mercado, primeira_mensagem: true },
  });

  return { lead: novoLead, isNovo: true, pessoaId: pessoa?.id ?? null };
}

type EnqueueWhatsappJobInput = {
  tenantId: string;
  telefone: string;
  leadId: string;
  agenteSlug: string;
  messageId: string;
  payload: Record<string, unknown>;
};

/**
 * Enfileira no hub_msg_jobs para processamento assíncrono pelo worker.
 * O processamento legado in-request foi removido da rota.
 */
async function enqueueWhatsappJob(
  supabase: ReturnType<typeof db>,
  input: EnqueueWhatsappJobInput
): Promise<"accepted" | "duplicate"> {
  const jobRow = {
    tenant_id: input.tenantId,
      canal: "whatsapp",
    telefone: input.telefone,
    lead_id: input.leadId,
    agente_slug: input.agenteSlug,
    message_id: input.messageId,
    payload: input.payload,
  };

  const { data, error } = await supabase
    .from("hub_msg_jobs")
    .upsert(jobRow, { onConflict: "canal,message_id", ignoreDuplicates: true })
    .select("id")
    .maybeSingle();

  if (error) throw error;
  if (data?.id) {
    await supersedeJobsAntigosMesmoTelefone(supabase, input.telefone, data.id);
  }
  return data?.id ? "accepted" : "duplicate";
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const hub_mode      = searchParams.get("hub.mode");
  const hub_token     = searchParams.get("hub.verify_token");
  const hub_challenge = searchParams.get("hub.challenge");

  if (hub_mode === "subscribe") {
    const expected = process.env.WHATSAPP_VERIFY_TOKEN;
    if (expected && hub_token === expected && hub_challenge) {
      return new NextResponse(hub_challenge, { status: 200 });
    }
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ status: "ok", service: "obra10plus-webhook", version: "2.0" });
}

export async function POST(request: NextRequest) {
  const trace = createWhatsappWebhookTrace(request);
  const { log } = trace;

  try {
    const rawBody = await request.text();
    log.info("wa.webhook.body_read", { body_bytes: rawBody.length });

    const skipVerify = process.env.NODE_ENV !== "production" && process.env.WEBHOOK_SKIP_SIGNATURE_VERIFY === "true";
    const secret = process.env.WEBHOOK_SECRET?.trim();

    if (process.env.NODE_ENV === "production" && !secret) {
      log.error("wa.webhook.config_missing", { field: "WEBHOOK_SECRET" });
      return trace.json({ error: "Webhook não configurado" }, 500, "config_missing");
    }

    if (secret && !skipVerify) {
      if (!webhookAutenticado(request, rawBody, secret)) {
        log.warn("wa.webhook.auth_failed", {
          has_signature_header: Boolean(
            request.headers.get("x-hub-signature-256") || request.headers.get("x-signature")
          ),
          has_bearer: Boolean(request.headers.get("authorization")?.startsWith("Bearer ")),
          has_query_wh: request.nextUrl.searchParams.has(webhookSecretQueryParam()),
        });
        return trace.json(
          {
            error: "Não autorizado",
            code: "WEBHOOK_AUTH_FAILED",
            message:
              "Falha na verificação do webhook (HMAC SHA-256 ou credencial Bearer/cabeçalho não confere com WEBHOOK_SECRET).",
          },
          401,
          "auth_failed"
        );
      }
      log.info("wa.webhook.auth_ok");
    } else if (!secret && !skipVerify) {
      if (!warnedMissingWebhookSecret) {
        warnedMissingWebhookSecret = true;
        log.warn("wa.webhook.auth_disabled", {
          hint: "Defina WEBHOOK_SECRET ou use WEBHOOK_SKIP_SIGNATURE_VERIFY=true só em dev",
        });
      }
    } else if (skipVerify) {
      log.warn("wa.webhook.auth_skipped_dev");
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return trace.json({ error: "JSON inválido" }, 400, "invalid_json");
    }

    const supabase = db();

    const inbound = parseWhatsappWebhookBody(body);
    if (inbound.kind === "ignored") {
      log.info("wa.webhook.parse_ignored", {
        reason: inbound.status,
        event:
          typeof body.event === "string"
            ? body.event
            : typeof body.EventType === "string"
              ? body.EventType
              : undefined,
        top_keys: Object.keys(body).slice(0, 24),
        data_kind: Array.isArray(body.data) ? "array" : typeof body.data,
      });
      return trace.json({ status: inbound.status }, 200, "parse_ignored");
    }
    if (inbound.kind === "unknown_event") {
      log.info("wa.webhook.unknown_event", { event: inbound.event });
      return trace.json({ status: "ignored", event: inbound.event }, 200, "unknown_event");
    }

    const {
      telefone,
      pushName,
      messageId,
      timestamp,
      tipoMidia,
      mensagemFinal,
      instance,
    } = inbound.value;

    const refs = extractWebhookInstanceRefs(body);
    const instanceKey = instance ?? refs.instanceId ?? normalizeWebhookInstanceId(body);
    const linhaWa = await resolverLinhaWhatsAppInbound(supabase, instanceKey, {
      instanceToken: refs.instanceToken,
      instanceName: refs.instanceName,
    });
    if (linhaWa.kind === "ignored") {
      log.warn("wa.webhook.resolver_ignored", {
        reason: linhaWa.reason,
        instance_id: instanceKey || null,
        has_instance_token: Boolean(refs.instanceToken),
      });
      return trace.json({ status: "ignored", reason: linhaWa.reason }, 200, "resolver_ignored", {
        reason: linhaWa.reason,
      });
    }

    const waSendOpts =
      linhaWa.kind === "agent_instance"
        ? { instanceToken: linhaWa.instanceToken as string }
        : {};

    log.info("wa.webhook.message_inbound", {
      telefone: trace.maskTelefone(telefone),
      push_name: pushName || null,
      message_id: messageId || null,
      preview: mensagemFinal.slice(0, 80),
      instance_id: instanceKey || null,
      linha_kind: linhaWa.kind,
      agente_slug: linhaWa.kind === "agent_instance" ? linhaWa.agenteSlug : null,
    });

    if (marcarWebhookDedupe(messageId, telefone)) {
      log.info("wa.webhook.duplicate_ignored_memory", {
        telefone: trace.maskTelefone(telefone),
        message_id: messageId || null,
      });
      return trace.json({ status: "ignored", reason: "duplicate_message_id_memory" }, 200, "duplicate_ignored");
    }

    if (await mensagemWebhookJaProcessada(supabase, { messageId, telefone })) {
      log.info("wa.webhook.duplicate_ignored", {
        telefone: trace.maskTelefone(telefone),
        message_id: messageId || null,
      });
      return trace.json({ status: "ignored", reason: "duplicate_message_id" }, 200, "duplicate_ignored");
    }

    const intencao = identificarIntencao(mensagemFinal);
    const mercado = identificarMercado(mensagemFinal);

    // Roteamento para parceiro
    if (intencao === "parceiro") {
      const telLimpo = telefone.replace(/\D/g, "");
      const { data: parceiroExistente } = await supabase
        .from("hub_parceiros")
        .select("id, nome, status, modulo_atual")
        .eq("telefone", telLimpo)
        .maybeSingle();

      if (!parceiroExistente) {
        const parceiroRow = {
          nome: pushName || `Parceiro ${telLimpo.slice(-4)}`,
          telefone: telLimpo,
          status: "captacao",
          tenant_id: defaultTenantId(),
        };
        let parIns = await supabase.from("hub_parceiros").insert(parceiroRow).select("id").single();
        if (parIns.error && isMissingPgColumn(parIns.error, "tenant_id")) {
          const { tenant_id: _t, ...semTenant } = parceiroRow;
          parIns = await supabase.from("hub_parceiros").insert(semTenant).select("id").single();
        }
        const { data: novoParceiro } = parIns;

        if (novoParceiro) {
          await supabase.from("hub_parceiros_captacao").insert({
            parceiro_id: novoParceiro.id,
            estagio: "interessado",
            origem: "whatsapp",
            canal: "whatsapp",
          });
          await supabase.from("hub_parceiros_log").insert({
            parceiro_id: novoParceiro.id,
            evento: "captado_via_whatsapp",
            descricao: `Parceiro captado via WhatsApp — mensagem: "${mensagemFinal.slice(0, 100)}"`,
            feito_por: "webhook",
            feito_por_tipo: "sistema",
            dados: { telefone: telLimpo, pushName, mensagem: mensagemFinal.slice(0, 200) },
          });

          const boas_vindas = `Olá${pushName ? `, ${pushName.split(" ")[0]}` : ""}! 👋\n\nQue ótimo que você tem interesse em ser parceiro da Obra10+!\n\nVou te enviar o link de cadastro em instantes. Um de nossos consultores também vai entrar em contato para explicar como funciona o programa.\n\nAté já! 🏆`;
          await enviarMensagemWhatsApp(telefone, boas_vindas, waSendOpts);
        }
      }

      await supabase.from("hub_alertas").insert({
        agente_slug: "diretor_geral_ia",
        tipo: "importante",
        titulo: "Novo interesse de parceiro via WhatsApp",
        mensagem: `${pushName || telefone} perguntou sobre parceria: "${mensagemFinal.slice(0, 80)}"`,
        lead_id: null,
        dados: { telefone, pushName, mensagem: mensagemFinal },
      });

      return trace.json({ status: "ok", intencao: "parceiro", telefone: trace.maskTelefone(telefone) }, 200, "parceiro_ok");
    }

    const { lead, isNovo, pessoaId } = await encontrarOuCriarLead(telefone, pushName, mercado, mensagemFinal);

    if (!lead) {
      log.error("wa.webhook.lead_failed", { telefone: trace.maskTelefone(telefone), mercado });
      return trace.json({ status: "erro", erro: "Falha ao criar lead", code: "LEAD_CREATE_FAILED" }, 500, "lead_failed");
    }

    log.info("wa.webhook.lead_ok", { lead_id: lead.id, is_novo: isNovo, mercado });

    let agenteResponsavelLead =
      typeof lead.agente_responsavel === "string" && lead.agente_responsavel.trim()
        ? lead.agente_responsavel.trim()
        : "sdr";

    if (linhaWa.kind === "agent_instance") {
      agenteResponsavelLead = linhaWa.agenteSlug;
      await supabase.from("hub_leads_crm").update({ agente_responsavel: linhaWa.agenteSlug }).eq("id", lead.id);
    }

    const agenteSlugHint = linhaWa.kind === "agent_instance" ? linhaWa.agenteSlug : agenteResponsavelLead;
    const messageIdParaFila = (messageId || "").trim();
    if (!messageIdParaFila) {
      log.warn("wa.webhook.message_missing_id", { telefone: trace.maskTelefone(telefone) });
      return trace.json({ status: "ignored", reason: "missing_message_id" }, 200, "missing_message_id");
    }

    if (isNovo) {
      try {
        const { data: contatos } = await supabase
          .from("hub_contatos_notificacao")
          .select("telefone, receber_novo_lead, canal")
          .eq("ativo", true)
          .eq("receber_novo_lead", true);

        if (contatos && contatos.length > 0) {
          const msg = `🔔 *Novo lead recebido!*\n\n*Nome:* ${pushName || telefone}\n*Mercado:* ${mercado}\n*Mensagem:* ${mensagemFinal.slice(0, 100)}\n\nAcesse o CRM para acompanhar.`;
          await Promise.allSettled(
            contatos
              .filter(c => c.canal === "whatsapp" || c.canal === "ambos")
              .map((c) => enviarMensagemWhatsApp(c.telefone, msg, waSendOpts))
          );
        }
      } catch (e) { console.error("[WEBHOOK] Erro notificação:", e); }
    }

    const enqueuePayload = {
            telefone,
            pushName,
            mercado,
      instance: instanceKey ?? null,
      instanceToken: waSendOpts.instanceToken ?? null,
            tipoMidia,
      mensagemFinal,
            leadId: lead.id,
      pessoaId: pessoaId ?? lead.pessoa_id ?? null,
      isNovo,
      timestamp,
      messageId: messageIdParaFila,
      agenteSlugHint,
      linhaKind: linhaWa.kind,
      hasInstanceToken: Boolean(waSendOpts.instanceToken),
    };

    const enqueueStatus = await enqueueWhatsappJob(supabase, {
      tenantId: defaultTenantId(),
            telefone,
      leadId: lead.id as string,
      agenteSlug: agenteSlugHint,
      messageId: messageIdParaFila,
      payload: enqueuePayload,
    });

    log.info("wa.webhook.job_enqueued", {
      enqueue_status: enqueueStatus,
      lead_id: lead.id,
      message_id: messageIdParaFila,
      agente_slug_hint: agenteSlugHint,
      mercado,
      is_novo: isNovo,
    });

    if (enqueueStatus === "accepted") {
      dispararProcessamentoJobsWhatsapp(log);
    }

    return trace.json(
      {
        status: enqueueStatus,
        lead_id: lead.id,
        mercado,
        agente_slug_hint: agenteSlugHint,
        isNovo,
        queue: "hub_msg_jobs",
        message_id: messageIdParaFila,
      },
      200,
      enqueueStatus === "duplicate" ? "duplicate_accepted" : "accepted_async"
    );
  } catch (erro) {
    const errMsg = erro instanceof Error ? erro.message : "Erro desconhecido";
    log.error("wa.webhook.unhandled", { error: errMsg });
    return trace.json({ status: "erro", erro: errMsg, code: "UNHANDLED" }, 500, "unhandled_error");
  }
}
