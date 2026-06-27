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
import { processarMensagemInboundWhatsapp } from "@/lib/whatsapp/inbound-message-processor";
import {
  mergeMetadataWhatsapp,
  montarPatchContatoWhatsapp,
  pushNameParaNomeExibicao,
} from "@/lib/crm/sincronizar-contato-whatsapp";
import { telefoneConversaId } from "@/lib/crm/isolamento-conversa-lead";
import { garantirCodigoLead, prepararRowHubLeadInsert } from "@/lib/crm/lead-cadastro";
import { gerarCodigoPessoa } from "@/lib/crm/pessoa-cadastro";
import { createWhatsappWebhookTrace } from "@/lib/observability/whatsapp-webhook-trace";
import { dispararProcessamentoJobsWhatsapp } from "@/lib/whatsapp/trigger-job-processor";
import { runWhatsappWorkerTick } from "@/lib/workers/whatsapp-job-worker";
import { supersedeJobsAntigosMesmoTelefone } from "@/lib/whatsapp/supersede-jobs-antigos";
import { ativarAtendimentoHumanoPorMensagemDoCelular } from "@/lib/whatsapp/human-handoff-from-device";
import {
  findLeadByGroupJid,
  isLeadGroupTransferActive,
} from "@/lib/whatsapp/lead-group-routing";
import { checkAndSetWebhookIdempotency } from "@/lib/redis/idempotency";
import { checkTenantRateLimit } from "@/lib/redis/rate-limit";
import { enqueueTenantLearnJob } from "@/lib/redis/learn-queue";

let warnedMissingWebhookSecret = false;
const WEBHOOK_DEDUPE_TTL_MS = 2 * 60 * 1000;
const webhookRecentKeys = new Map<string, number>();

function webhookRateLimitConfig(): { max: number; windowSec: number } | null {
  const maxRaw = process.env.WEBHOOK_RATE_LIMIT_MAX?.trim();
  if (!maxRaw) return null;
  const max = Number.parseInt(maxRaw, 10);
  if (!Number.isFinite(max) || max <= 0) return null;
  const windowSec = Number.parseInt(process.env.WEBHOOK_RATE_LIMIT_WINDOW_SEC || "60", 10);
  return { max, windowSec: Number.isFinite(windowSec) && windowSec > 0 ? windowSec : 60 };
}

function tenantIdFromLinhaWa(linhaWa: import("@/lib/whatsapp/resolver-linha-whatsapp").LinhaWhatsAppWebhook): string {
  if (linhaWa.kind === "agent_instance") return linhaWa.tenantId;
  return defaultTenantId();
}

type WebhookRedisGuardLog = {
  info: (event: string, fields?: Record<string, unknown>) => void;
  warn: (event: string, fields?: Record<string, unknown>) => void;
};

async function aplicarGuardasRedisWebhook(
  log: WebhookRedisGuardLog,
  opts: { tenantId: string; messageId: string }
): Promise<
  | { blocked: true; reason: string; httpStatus?: number }
  | { blocked: false }
> {
  const messageId = opts.messageId.trim();
  if (!messageId) return { blocked: false };

  try {
    const duplicate = await checkAndSetWebhookIdempotency(opts.tenantId, messageId);
    if (duplicate) {
      log.info("wa.webhook.duplicate_ignored_redis", {
        message_id: messageId,
        tenant_id: opts.tenantId,
      });
      return { blocked: true, reason: "duplicate_message_id_redis" };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log.warn("wa.webhook.redis_idempotency_failed", { error: msg.slice(0, 200) });
  }

  const rateCfg = webhookRateLimitConfig();
  if (rateCfg) {
    try {
      const rate = await checkTenantRateLimit(
        opts.tenantId,
        "whatsapp_webhook",
        rateCfg.max,
        rateCfg.windowSec
      );
      if (rate.limited) {
        log.warn("wa.webhook.rate_limited", {
          tenant_id: opts.tenantId,
          count: rate.count,
          retry_after_sec: rate.retryAfterSec,
        });
        return { blocked: true, reason: "rate_limited", httpStatus: 429 };
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log.warn("wa.webhook.redis_rate_limit_failed", { error: msg.slice(0, 200) });
    }
  }

  return { blocked: false };
}

function enfileirarRetroalimentacaoConversa(
  log: WebhookRedisGuardLog,
  opts: {
    tenantId: string;
    agenteSlug: string;
    leadId: string;
    snippet: string;
    origem?: string;
  }
): void {
  void enqueueTenantLearnJob({
    tenantId: opts.tenantId,
    agenteSlug: opts.agenteSlug,
    leadId: opts.leadId,
    snippet: opts.snippet.slice(0, 500),
    origem: opts.origem ?? "whatsapp_webhook",
  }).catch((e) => {
    const msg = e instanceof Error ? e.message : String(e);
    log.warn("wa.webhook.learn_queue_failed", { error: msg.slice(0, 200) });
  });
}

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

async function encontrarOuCriarPessoa(telefone: string, nome: string, origem: string, tenantId: string) {
  const supabase = db();

  let pessoaQuery = supabase.from("hub_pessoas").select("*").eq("telefone", telefone);
  pessoaQuery = pessoaQuery.eq("tenant_id", tenantId);
  const { data: pessoaExistente, error: pessoaErr } = await pessoaQuery.maybeSingle();

  if (pessoaErr && isMissingPgColumn(pessoaErr, "tenant_id")) {
    const { data: fallback } = await supabase
      .from("hub_pessoas")
      .select("*")
      .eq("telefone", telefone)
      .maybeSingle();
    if (fallback) return fallback;
  } else if (pessoaExistente) {
    return pessoaExistente;
  }

  const codigo = await gerarCodigoPessoa(supabase);

  const nomePessoa = pushNameParaNomeExibicao(nome) || nome?.trim() || "Lead WhatsApp";

  const row = {
    codigo,
    nome: nomePessoa,
    telefone,
    whatsapp_id: telefone,
    tipo: "lead",
    origem: origem || "whatsapp",
    tenant_id: tenantId,
  };

  let ins = await supabase.from("hub_pessoas").insert(row).select().single();
  if (ins.error && isMissingPgColumn(ins.error, "tenant_id")) {
    const { tenant_id: _t, ...semTenant } = row;
    ins = await supabase.from("hub_pessoas").insert(semTenant).select().single();
  }

  return ins.data ?? null;
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
    if (isMissingPgColumn(error, "message_id") || isMissingPgColumn(error, "canal")) {
      console.warn("[WEBHOOK] hub_msg_jobs sem coluna message_id/canal — execute migração hub_msg_jobs_repair_schema.");
      return false;
    }
    console.error("[WEBHOOK] Erro ao deduplicar message_id:", error.message);
    return false;
  }
  return Array.isArray(data) && data.length > 0;
}

async function encontrarOuCriarLead(
  telefone: string,
  nome: string,
  mercado: string,
  mensagem: string,
  tenantId: string
) {
  const supabase = db();
  const tel = telefoneConversaId(telefone);
  if (tel.length < 10) {
    return { lead: null, isNovo: false as const, pessoaId: null as string | null };
  }

  const pessoa = await encontrarOuCriarPessoa(tel, nome, "whatsapp", tenantId);

  let leadQuery = supabase.from("hub_leads_crm").select("*").eq("telefone", tel).eq("tenant_id", tenantId);
  let { data: leadExistente, error: leadFindErr } = await leadQuery.maybeSingle();
  if (leadFindErr && isMissingPgColumn(leadFindErr, "tenant_id")) {
    ({ data: leadExistente } = await supabase
      .from("hub_leads_crm")
      .select("*")
      .eq("telefone", tel)
      .maybeSingle());
  }

  if (leadExistente) {
    const waPatch = montarPatchContatoWhatsapp(leadExistente as Record<string, unknown>, {
      telefone: tel,
      pushName: nome,
      mercado,
    });
    const leadUpdate = {
      ...waPatch,
      pessoa_id: pessoa?.id ?? leadExistente.pessoa_id,
      tenant_id: leadExistente.tenant_id || tenantId,
      metadata: mergeMetadataWhatsapp(
        {
          ...(typeof leadExistente.metadata === "object" && leadExistente.metadata !== null
            ? (leadExistente.metadata as Record<string, unknown>)
            : {}),
          mercado,
          fase_atendimento: "conversa_ia",
        },
        { telefone: tel, pushName: nome, mercado }
      ),
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

    return {
      lead: leadFinal,
      isNovo: false,
      pessoaId: pessoa?.id ?? leadExistente.pessoa_id,
    };
  }

  const agenteResponsavel = mercado === "imobiliario" || mercado === "arquitetura" ? "atendente" : "sdr";

  const nomeLead = pushNameParaNomeExibicao(nome) || `Lead ${tel.slice(-4)}`;

  const pessoaCodigo =
    pessoa && typeof pessoa === "object" && "codigo" in pessoa && pessoa.codigo != null
      ? String(pessoa.codigo)
      : null;

  const rowNovoLead = await prepararRowHubLeadInsert(
    supabase,
    {
      nome: nomeLead,
      telefone: tel,
      origem: "whatsapp",
      estagio: "novo",
      score: 10,
      valor_estimado: 0,
      agente_responsavel: agenteResponsavel,
      pessoa_id: pessoa?.id ?? null,
      tenant_id: tenantId,
      metadata: mergeMetadataWhatsapp(
        {
          mercado,
          fase_atendimento: "conversa_ia",
          primeira_mensagem: mensagem.slice(0, 200),
        },
        { telefone: tel, pushName: nome, mercado }
      ),
    },
    { pessoa_codigo: pessoaCodigo }
  );

  const { data: novoLead, error } = await supabase
    .from("hub_leads_crm")
    .insert(rowNovoLead)
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
      tenant_id: tenantId,
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
type EnqueueWhatsappJobResult =
  | { status: "accepted" | "duplicate" }
  | { status: "schema_error"; error: string };

async function enqueueWhatsappJob(
  supabase: ReturnType<typeof db>,
  input: EnqueueWhatsappJobInput
): Promise<EnqueueWhatsappJobResult> {
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

  if (error) {
    if (
      isMissingPgColumn(error, "message_id") ||
      isMissingPgColumn(error, "canal") ||
      /hub_msg_jobs/i.test(error.message)
    ) {
      return {
        status: "schema_error",
        error: error.message,
      };
    }
    throw error;
  }
  if (data?.id) {
    await supersedeJobsAntigosMesmoTelefone(supabase, input.telefone, data.id);
  }
  return { status: data?.id ? "accepted" : "duplicate" };
}

async function processarWhatsappInlineSeFilaIndisponivel(
  supabase: ReturnType<typeof db>,
  trace: ReturnType<typeof createWhatsappWebhookTrace>,
  payload: Record<string, unknown>,
  lead: Record<string, unknown>,
  agenteSlug: string
): Promise<void> {
  const { data: agente } = await supabase
    .from("hub_agente_identidade")
    .select("*")
    .eq("agente_slug", agenteSlug)
    .maybeSingle();

  const instanceToken =
    typeof payload.instanceToken === "string" && payload.instanceToken.trim()
      ? payload.instanceToken.trim()
      : typeof agente?.uazapi_instance_token === "string"
        ? agente.uazapi_instance_token.trim()
        : null;

  await processarMensagemInboundWhatsapp({
    supabase,
    trace,
    lead,
    agente: (agente as Record<string, unknown> | null) ?? { agente_slug: agenteSlug },
    mensagemFinal: String(payload.mensagemFinal ?? ""),
    telefone: String(payload.telefone ?? ""),
    pushName: String(payload.pushName ?? ""),
    messageId: typeof payload.messageId === "string" ? payload.messageId : null,
    timestamp: String(payload.timestamp ?? new Date().toISOString()),
    mercado: String(payload.mercado ?? "geral"),
    instanceKey: typeof payload.instance === "string" ? payload.instance : null,
    isNovo: payload.isNovo === true,
    tipoMidia: String(payload.tipoMidia ?? "text"),
    menuChoiceId: typeof payload.menuChoiceId === "string" ? payload.menuChoiceId : null,
    waSendOpts: instanceToken ? { instanceToken } : {},
    isGroupTransfer: payload.isGroupTransfer === true,
    groupJid: typeof payload.groupJid === "string" ? payload.groupJid : null,
    fromMe: payload.fromMe === true,
    senderTelefone: typeof payload.senderTelefone === "string" ? payload.senderTelefone : null,
    tenantId:
      typeof payload.tenantId === "string" && payload.tenantId.trim()
        ? payload.tenantId.trim()
        : undefined,
  });
}

async function despacharJobWhatsappAposEnqueue(
  supabase: ReturnType<typeof db>,
  trace: ReturnType<typeof createWhatsappWebhookTrace>,
  enqueue: EnqueueWhatsappJobResult,
  ctx: {
    payload: Record<string, unknown>;
    lead: Record<string, unknown>;
    agenteSlug: string;
    telefone: string;
    messageId: string;
    learnJob?: {
      tenantId: string;
      agenteSlug: string;
      leadId: string;
      snippet: string;
    };
  }
): Promise<{ httpStatus: number; body: Record<string, unknown>; outcome: string }> {
  const { log } = trace;

  if (enqueue.status === "schema_error") {
    log.warn("wa.webhook.job_schema_fallback_inline", {
      error: enqueue.error.slice(0, 240),
      telefone: trace.maskTelefone(ctx.telefone),
      message_id: ctx.messageId,
    });
    try {
      await processarWhatsappInlineSeFilaIndisponivel(
        supabase,
        trace,
        ctx.payload,
        ctx.lead,
        ctx.agenteSlug
      );
      return {
        httpStatus: 200,
        body: {
          status: "processed_inline",
          reason: "hub_msg_jobs_schema_repair_required",
          queue: "inline_fallback",
          message_id: ctx.messageId,
        },
        outcome: "inline_fallback_ok",
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log.error("wa.webhook.inline_fallback_failed", { error: msg.slice(0, 300) });
      return {
        httpStatus: 500,
        body: {
          status: "erro",
          code: "HUB_MSG_JOBS_SCHEMA",
          erro: msg,
          hint: "Execute supabase/migrations/20260612110000_hub_msg_jobs_repair_schema.sql no Supabase.",
        },
        outcome: "inline_fallback_failed",
      };
    }
  }

  if (enqueue.status === "accepted") {
    if (ctx.learnJob) {
      enfileirarRetroalimentacaoConversa(log, ctx.learnJob);
    }
    if (process.env.WHATSAPP_JOB_PROCESSOR === "worker_only") {
      dispararProcessamentoJobsWhatsapp(log);
<<<<<<< HEAD
      // Rede de segurança: processa 1 job no web se worker/cron falhar
=======
      // Rede de segurança: processa pelo menos 1 job no web se worker/cron falhar
>>>>>>> 7b07445936348a14859d17bc60f8965a88da2553
      void runWhatsappWorkerTick()
        .then((result) => {
          log.info("wa.webhook.job_processor_inline_safety", {
            claimed: result.claimed,
            ok: !result.error,
            error: result.error ?? null,
          });
        })
        .catch((e) => {
          const msg = e instanceof Error ? e.message : String(e);
          log.warn("wa.webhook.job_processor_inline_safety_failed", { error: msg.slice(0, 200) });
        });
    } else {
      void runWhatsappWorkerTick()
        .then(async (result) => {
          log.info("wa.webhook.job_processor_inline", {
            claimed: result.claimed,
            ok: !result.error,
            error: result.error ?? null,
          });
          if (result.error && result.claimed === 0) {
            log.warn("wa.webhook.job_processor_inline_fallback", {
              error: result.error.slice(0, 240),
              telefone: trace.maskTelefone(ctx.telefone),
            });
            try {
              await processarWhatsappInlineSeFilaIndisponivel(
                supabase,
                trace,
                ctx.payload,
                ctx.lead,
                ctx.agenteSlug
              );
              log.info("wa.webhook.job_inline_fallback_ok", {
                telefone: trace.maskTelefone(ctx.telefone),
                message_id: ctx.messageId,
              });
            } catch (e) {
              const msg = e instanceof Error ? e.message : String(e);
              log.error("wa.webhook.job_inline_fallback_failed", { error: msg.slice(0, 300) });
            }
          }
        })
        .catch(async (e) => {
          const msg = e instanceof Error ? e.message : String(e);
          log.warn("wa.webhook.job_processor_inline_failed", { error: msg.slice(0, 200) });
          try {
            await processarWhatsappInlineSeFilaIndisponivel(
              supabase,
              trace,
              ctx.payload,
              ctx.lead,
              ctx.agenteSlug
            );
            log.info("wa.webhook.job_inline_fallback_ok", {
              telefone: trace.maskTelefone(ctx.telefone),
              message_id: ctx.messageId,
            });
          } catch (inlineErr) {
            const inlineMsg = inlineErr instanceof Error ? inlineErr.message : String(inlineErr);
            log.error("wa.webhook.job_inline_fallback_failed", { error: inlineMsg.slice(0, 300) });
          }
          dispararProcessamentoJobsWhatsapp(log);
        });
    }
  }

  return {
    httpStatus: 200,
    body: {
      status: enqueue.status,
      queue: "hub_msg_jobs",
      message_id: ctx.messageId,
    },
    outcome: enqueue.status === "duplicate" ? "duplicate_accepted" : "accepted_async",
  };
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
    if (inbound.kind === "outgoing_human") {
      const outbound = inbound.value;

      if (outbound.isGroup && outbound.groupJid) {
        const leadGrupo = await findLeadByGroupJid(supabase, outbound.groupJid);
        if (!leadGrupo || !isLeadGroupTransferActive(leadGrupo)) {
          log.info("wa.webhook.group_outgoing_ignored", {
            group_jid: outbound.groupJid,
            reason: leadGrupo ? "transfer_inactive" : "lead_not_found",
          });
          return trace.json({ status: "ignored", reason: "group_ignored" }, 200, "group_ignored");
        }

        const telefoneLead = telefoneConversaId(leadGrupo.telefone ?? "");
        if (telefoneLead.length < 10) {
          return trace.json({ status: "ignored", reason: "invalid_phone" }, 200, "invalid_phone");
        }

        const messageIdParaFila = (outbound.messageId || "").trim();
        if (!messageIdParaFila) {
          return trace.json({ status: "ignored", reason: "missing_message_id" }, 200, "missing_message_id");
        }

        const refs = extractWebhookInstanceRefs(body);
        const instanceKey = outbound.instance ?? refs.instanceId ?? normalizeWebhookInstanceId(body);
        const linhaWa = await resolverLinhaWhatsAppInbound(supabase, instanceKey, {
          instanceToken: refs.instanceToken,
          instanceName: refs.instanceName,
        });
        const agenteSlugHint =
          linhaWa.kind === "agent_instance"
            ? linhaWa.agenteSlug
            : typeof leadGrupo.agente_responsavel === "string" && leadGrupo.agente_responsavel.trim()
              ? leadGrupo.agente_responsavel.trim()
              : "sdr";
        const tenantId = tenantIdFromLinhaWa(linhaWa);
        const redisGuard = await aplicarGuardasRedisWebhook(log, {
          tenantId,
          messageId: messageIdParaFila,
        });
        if (redisGuard.blocked) {
          return trace.json(
            { status: "ignored", reason: redisGuard.reason },
            redisGuard.httpStatus ?? 200,
            redisGuard.reason === "rate_limited" ? "rate_limited" : "duplicate_ignored"
          );
        }

        if (marcarWebhookDedupe(messageIdParaFila, telefoneLead)) {
          return trace.json({ status: "ignored", reason: "duplicate_message_id_memory" }, 200, "duplicate_ignored");
        }
        if (await mensagemWebhookJaProcessada(supabase, { messageId: messageIdParaFila, telefone: telefoneLead })) {
          return trace.json({ status: "ignored", reason: "duplicate_message_id" }, 200, "duplicate_ignored");
        }

        const waSendOpts =
          linhaWa.kind === "agent_instance" ? { instanceToken: linhaWa.instanceToken as string } : {};

        const enqueuePayload = {
          telefone: telefoneLead,
          senderTelefone: outbound.telefone || null,
          pushName: outbound.pushName,
          mercado: identificarMercado(outbound.mensagemFinal),
          instance: instanceKey ?? null,
          instanceToken: waSendOpts.instanceToken ?? null,
          tipoMidia: outbound.tipoMidia,
          mensagemFinal: outbound.mensagemFinal,
          menuChoiceId: outbound.menuChoiceId ?? null,
          leadId: leadGrupo.id,
          pessoaId: leadGrupo.pessoa_id ?? null,
          isNovo: false,
          timestamp: outbound.timestamp,
          messageId: messageIdParaFila,
          agenteSlugHint,
          linhaKind: linhaWa.kind,
          hasInstanceToken: Boolean(waSendOpts.instanceToken),
          isGroupTransfer: true,
          groupJid: outbound.groupJid,
          fromMe: true,
          humano_responsavel: leadGrupo.humano_responsavel ?? null,
        };

        const enqueueResult = await enqueueWhatsappJob(supabase, {
          tenantId,
          telefone: telefoneLead,
          leadId: leadGrupo.id,
          agenteSlug: agenteSlugHint,
          messageId: messageIdParaFila,
          payload: enqueuePayload,
        });

        const dispatched = await despacharJobWhatsappAposEnqueue(supabase, trace, enqueueResult, {
          payload: enqueuePayload,
          lead: leadGrupo as Record<string, unknown>,
          agenteSlug: agenteSlugHint,
          telefone: telefoneLead,
          messageId: messageIdParaFila,
          learnJob: {
            tenantId,
            agenteSlug: agenteSlugHint,
            leadId: leadGrupo.id,
            snippet: outbound.mensagemFinal,
          },
        });

        return trace.json(
          { ...dispatched.body, lead_id: leadGrupo.id, group_transfer: true },
          dispatched.httpStatus,
          dispatched.outcome
        );
      }

      const telefoneLead = telefoneConversaId(outbound.telefone);
      if (telefoneLead.length < 10) {
        return trace.json({ status: "ignored", reason: "invalid_phone" }, 200, "invalid_phone");
      }

      const handoff = await ativarAtendimentoHumanoPorMensagemDoCelular(supabase, {
        telefone: telefoneLead,
        mensagem: outbound.mensagemFinal,
        messageId: outbound.messageId || null,
        timestamp: outbound.timestamp,
      });

      log.info("wa.webhook.human_takeover_from_device", {
        telefone: trace.maskTelefone(telefoneLead),
        ok: handoff.ok,
        lead_id: handoff.leadId ?? null,
        humano_slug: handoff.humanoSlug,
        jobs_cancelados: handoff.jobsCancelados,
        motivo: handoff.motivo ?? null,
        message_id: outbound.messageId || null,
      });

      return trace.json(
        {
          status: handoff.ok ? "human_takeover" : "human_takeover_skipped",
          lead_id: handoff.leadId ?? null,
          humano_slug: handoff.humanoSlug,
          jobs_cancelados: handoff.jobsCancelados,
          motivo: handoff.motivo ?? null,
        },
        200,
        handoff.ok ? "human_takeover_ok" : "human_takeover_skipped"
      );
    }
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

    const inboundRaw = inbound.value;

    if (inboundRaw.isGroup && inboundRaw.groupJid) {
      const leadGrupo = await findLeadByGroupJid(supabase, inboundRaw.groupJid);
      if (!leadGrupo || !isLeadGroupTransferActive(leadGrupo)) {
        log.info("wa.webhook.group_inbound_ignored", {
          group_jid: inboundRaw.groupJid,
          reason: leadGrupo ? "transfer_inactive" : "lead_not_found",
        });
        return trace.json({ status: "ignored", reason: "group_ignored" }, 200, "group_ignored");
      }

      const telefoneLead = telefoneConversaId(leadGrupo.telefone ?? "");
      if (telefoneLead.length < 10) {
        return trace.json({ status: "ignored", reason: "invalid_phone" }, 200, "invalid_phone");
      }

      const {
        pushName,
        messageId,
        timestamp,
        tipoMidia,
        mensagemFinal,
        menuChoiceId,
        instance,
      } = inboundRaw;

      const refs = extractWebhookInstanceRefs(body);
      const instanceKey = instance ?? refs.instanceId ?? normalizeWebhookInstanceId(body);
      const linhaWa = await resolverLinhaWhatsAppInbound(supabase, instanceKey, {
        instanceToken: refs.instanceToken,
        instanceName: refs.instanceName,
      });
      if (linhaWa.kind === "ignored") {
        log.warn("wa.webhook.group_resolver_ignored", {
          reason: linhaWa.reason,
          group_jid: inboundRaw.groupJid,
        });
        return trace.json({ status: "ignored", reason: linhaWa.reason }, 200, "resolver_ignored");
      }

      const waSendOpts =
        linhaWa.kind === "agent_instance" ? { instanceToken: linhaWa.instanceToken as string } : {};

      log.info("wa.webhook.group_message_inbound", {
        lead_id: leadGrupo.id,
        group_jid: inboundRaw.groupJid,
        sender: trace.maskTelefone(inboundRaw.telefone),
        message_id: messageId || null,
        preview: mensagemFinal.slice(0, 80),
      });

      const messageIdParaFila = (messageId || "").trim();
      if (!messageIdParaFila) {
        return trace.json({ status: "ignored", reason: "missing_message_id" }, 200, "missing_message_id");
      }

      const tenantId = tenantIdFromLinhaWa(linhaWa);
      const redisGuard = await aplicarGuardasRedisWebhook(log, {
        tenantId,
        messageId: messageIdParaFila,
      });
      if (redisGuard.blocked) {
        return trace.json(
          { status: "ignored", reason: redisGuard.reason },
          redisGuard.httpStatus ?? 200,
          redisGuard.reason === "rate_limited" ? "rate_limited" : "duplicate_ignored"
        );
      }

      if (marcarWebhookDedupe(messageIdParaFila, telefoneLead)) {
        return trace.json({ status: "ignored", reason: "duplicate_message_id_memory" }, 200, "duplicate_ignored");
      }
      if (await mensagemWebhookJaProcessada(supabase, { messageId: messageIdParaFila, telefone: telefoneLead })) {
        return trace.json({ status: "ignored", reason: "duplicate_message_id" }, 200, "duplicate_ignored");
      }

      const mercado = identificarMercado(mensagemFinal);
      const agenteSlugHint =
        linhaWa.kind === "agent_instance"
          ? linhaWa.agenteSlug
          : typeof leadGrupo.agente_responsavel === "string" && leadGrupo.agente_responsavel.trim()
            ? leadGrupo.agente_responsavel.trim()
            : "sdr";

      const enqueuePayload = {
        telefone: telefoneLead,
        senderTelefone: inboundRaw.telefone || null,
        pushName,
        mercado,
        instance: instanceKey ?? null,
        instanceToken: waSendOpts.instanceToken ?? null,
        tipoMidia,
        mensagemFinal,
        menuChoiceId: menuChoiceId ?? null,
        leadId: leadGrupo.id,
        pessoaId: leadGrupo.pessoa_id ?? null,
        isNovo: false,
        timestamp,
        messageId: messageIdParaFila,
        agenteSlugHint,
        linhaKind: linhaWa.kind,
        hasInstanceToken: Boolean(waSendOpts.instanceToken),
        isGroupTransfer: true,
        groupJid: inboundRaw.groupJid,
        fromMe: false,
        humano_responsavel: leadGrupo.humano_responsavel ?? null,
      };

      const enqueueResult = await enqueueWhatsappJob(supabase, {
        tenantId,
        telefone: telefoneLead,
        leadId: leadGrupo.id,
        agenteSlug: agenteSlugHint,
        messageId: messageIdParaFila,
        payload: enqueuePayload,
      });

      log.info("wa.webhook.group_job_enqueued", {
        enqueue_status: enqueueResult.status,
        lead_id: leadGrupo.id,
        group_jid: inboundRaw.groupJid,
        message_id: messageIdParaFila,
      });

      const dispatched = await despacharJobWhatsappAposEnqueue(supabase, trace, enqueueResult, {
        payload: enqueuePayload,
        lead: leadGrupo as Record<string, unknown>,
        agenteSlug: agenteSlugHint,
        telefone: telefoneLead,
        messageId: messageIdParaFila,
        learnJob: {
          tenantId,
          agenteSlug: agenteSlugHint,
          leadId: leadGrupo.id,
          snippet: mensagemFinal,
        },
      });

      return trace.json(
        {
          ...dispatched.body,
          lead_id: leadGrupo.id,
          mercado,
          agente_slug_hint: agenteSlugHint,
          group_transfer: true,
        },
        dispatched.httpStatus,
        dispatched.outcome
      );
    }

    const telefone = telefoneConversaId(inboundRaw.telefone);
    const {
      pushName,
      messageId,
      timestamp,
      tipoMidia,
      mensagemFinal,
      menuChoiceId,
      instance,
    } = inboundRaw;

    if (telefone.length < 10) {
      return trace.json({ status: "ignored", reason: "invalid_phone" }, 200, "invalid_phone");
    }

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

    const tenantId = tenantIdFromLinhaWa(linhaWa);

    log.info("wa.webhook.message_inbound", {
      telefone: trace.maskTelefone(telefone),
      push_name: pushName || null,
      message_id: messageId || null,
      preview: mensagemFinal.slice(0, 80),
      instance_id: instanceKey || null,
      linha_kind: linhaWa.kind,
      agente_slug: linhaWa.kind === "agent_instance" ? linhaWa.agenteSlug : null,
      tenant_id: tenantId,
    });

    const messageIdParaFila = (messageId || "").trim();
    if (!messageIdParaFila) {
      log.warn("wa.webhook.message_missing_id", { telefone: trace.maskTelefone(telefone) });
      return trace.json({ status: "ignored", reason: "missing_message_id" }, 200, "missing_message_id");
    }

    const redisGuard = await aplicarGuardasRedisWebhook(log, {
      tenantId,
      messageId: messageIdParaFila,
    });
    if (redisGuard.blocked) {
      return trace.json(
        { status: "ignored", reason: redisGuard.reason },
        redisGuard.httpStatus ?? 200,
        redisGuard.reason === "rate_limited" ? "rate_limited" : "duplicate_ignored"
      );
    }

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
          tenant_id: tenantId,
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

          const boas_vindas = `Olá${pushName ? `, ${pushName.split(" ")[0]}` : ""}! 👋\n\nQue ótimo que você tem interesse em ser parceiro da Waje!\n\nVou te enviar o link de cadastro em instantes. Um de nossos consultores também vai entrar em contato para explicar como funciona o programa.\n\nAté já! 🏆`;
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

    const { lead, isNovo, pessoaId } = await encontrarOuCriarLead(
      telefone,
      pushName,
      mercado,
      mensagemFinal,
      tenantId
    );

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
      menuChoiceId: menuChoiceId ?? null,
            leadId: lead.id,
      pessoaId: pessoaId ?? lead.pessoa_id ?? null,
      isNovo,
      timestamp,
      messageId: messageIdParaFila,
      tenantId,
      agenteSlugHint,
      linhaKind: linhaWa.kind,
      hasInstanceToken: Boolean(waSendOpts.instanceToken),
    };

    const enqueueResult = await enqueueWhatsappJob(supabase, {
      tenantId,
      telefone,
      leadId: lead.id as string,
      agenteSlug: agenteSlugHint,
      messageId: messageIdParaFila,
      payload: enqueuePayload,
    });

    log.info("wa.webhook.job_enqueued", {
      enqueue_status: enqueueResult.status,
      lead_id: lead.id,
      message_id: messageIdParaFila,
      agente_slug_hint: agenteSlugHint,
      mercado,
      is_novo: isNovo,
    });

    const dispatched = await despacharJobWhatsappAposEnqueue(supabase, trace, enqueueResult, {
      payload: enqueuePayload,
      lead: lead as Record<string, unknown>,
      agenteSlug: agenteSlugHint,
      telefone,
      messageId: messageIdParaFila,
      learnJob: {
        tenantId,
        agenteSlug: agenteSlugHint,
        leadId: lead.id as string,
        snippet: mensagemFinal,
      },
    });

    return trace.json(
      {
        ...dispatched.body,
        lead_id: lead.id,
        mercado,
        agente_slug_hint: agenteSlugHint,
        isNovo,
      },
      dispatched.httpStatus,
      dispatched.outcome
    );
  } catch (erro) {
    const errMsg = erro instanceof Error ? erro.message : String(erro);
    const errStack = erro instanceof Error ? erro.stack?.slice(0, 500) : undefined;
    log.error("wa.webhook.unhandled", { error: errMsg, stack: errStack });
    return trace.json({ status: "erro", erro: errMsg, code: "UNHANDLED" }, 500, "unhandled_error");
  }
}
