import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHubLogger, type HubLogger } from "@/lib/observability/hub-log";
import { defaultTenantId } from "@/lib/tenant-default";
import { avaliarJobDuplicado } from "@/lib/whatsapp/anti-duplicata-resposta";
import { processarMensagemInboundWhatsapp } from "@/lib/whatsapp/inbound-message-processor";
import { resolverLinhaWhatsAppInbound } from "@/lib/whatsapp/resolver-linha-whatsapp";

type JobStatus = "pending" | "processing" | "done" | "retry" | "dead";

type HubMsgJob = {
  id: string;
  tenant_id?: string | null;
  canal: string;
  telefone: string;
  lead_id?: string | null;
  agente_slug?: string | null;
  message_id: string;
  payload?: Record<string, unknown> | null;
  status: JobStatus;
  attempts: number;
  max_attempts: number;
  created_at?: string | null;
};

function workerEnvInt(name: string, fallback: number, min = 1, max = Number.MAX_SAFE_INTEGER): number {
  const raw = Number.parseInt(String(process.env[name] || ""), 10);
  if (!Number.isFinite(raw)) return fallback;
  return Math.max(min, Math.min(max, raw));
}

export function workerPollMs(): number {
  return workerEnvInt("WORKER_POLL_MS", 2000, 250, 60000);
}

export function workerBatchSize(): number {
  return workerEnvInt("WORKER_BATCH_SIZE", 10, 1, 100);
}

export function workerConcurrency(): number {
  return workerEnvInt("WORKER_CONCURRENCY", 1, 1, 20);
}

function workerMaxJitterMs(): number {
  return workerEnvInt("WORKER_JITTER_MS", 400, 0, 10_000);
}

function workerId(): string {
  const hostname = process.env.RENDER_INSTANCE_ID || process.env.HOSTNAME || "local";
  return `wa-worker-${hostname}-${process.pid}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function supabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) {
    throw new Error("Supabase env ausente: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key);
}

function isTransientErrorMessage(raw: string): boolean {
  const m = raw.toLowerCase();
  return (
    m.includes("timeout") ||
    m.includes("timed out") ||
    m.includes("http 503") ||
    m.includes("http 504") ||
    m.includes("http 429") ||
    m.includes("service unavailable") ||
    m.includes("fetch failed") ||
    m.includes("network") ||
    m.includes("econnreset") ||
    m.includes("etimedout") ||
    m.includes("eai_again")
  );
}

function retryDelayMs(attempts: number): number {
  const base = 1500;
  const capped = Math.min(attempts, 8);
  return Math.min(120_000, base * 2 ** Math.max(0, capped - 1));
}

function parsePayload(job: HubMsgJob): Record<string, unknown> {
  if (job.payload && typeof job.payload === "object" && !Array.isArray(job.payload)) {
    return job.payload;
  }
  return {};
}

function toStr(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function toBool(v: unknown): boolean {
  return v === true;
}

function toNullableStr(v: unknown): string | null {
  const s = toStr(v).trim();
  return s ? s : null;
}

type ReconstructedContext = {
  telefone: string;
  pushName: string;
  messageId: string | null;
  timestamp: string;
  tipoMidia: string;
  mensagemFinal: string;
  menuChoiceId: string | null;
  mercado: string;
  instanceKey: string | null;
  isNovo: boolean;
  isGroupTransfer: boolean;
  groupJid: string | null;
  fromMe: boolean;
  senderTelefone: string | null;
  lead: {
    id: string;
    telefone?: string | null;
    pessoa_id?: string | null;
    humano_responsavel?: string | null;
    agente_responsavel?: string | null;
  };
  agente: { agente_slug: string } | null;
  waSendOpts?: { instanceToken?: string | null };
};

function reconstruirContexto(job: HubMsgJob): ReconstructedContext {
  const payload = parsePayload(job);
  const leadId = toStr(payload.leadId) || (job.lead_id || "");
  if (!leadId) {
    throw new Error("payload sem leadId");
  }

  const agenteSlugHint = toStr(payload.agenteSlugHint) || (job.agente_slug || "sdr");
  const instanceToken = toStr(payload.instanceToken);
  const telefone = toStr(payload.telefone) || job.telefone;
  const messageId = toStr(payload.messageId) || job.message_id;
  const timestamp = toStr(payload.timestamp) || new Date().toISOString();
  const tipoMidia = toStr(payload.tipoMidia) || "texto";
  const mensagemFinal = toStr(payload.mensagemFinal);
  const menuChoiceId = toNullableStr(payload.menuChoiceId);
  const mercado = toStr(payload.mercado) || "geral";
  const pushName = toStr(payload.pushName);

  if (!telefone || !mensagemFinal) {
    throw new Error("payload inválido: telefone/mensagem ausentes");
  }

  return {
    telefone,
    pushName,
    messageId: toNullableStr(messageId),
    timestamp,
    tipoMidia,
    mensagemFinal,
    menuChoiceId,
    mercado,
    instanceKey: toNullableStr(payload.instance),
    isNovo: toBool(payload.isNovo),
    isGroupTransfer: toBool(payload.isGroupTransfer),
    groupJid: toNullableStr(payload.groupJid),
    fromMe: toBool(payload.fromMe),
    senderTelefone: toNullableStr(payload.senderTelefone),
    lead: {
      id: leadId,
      pessoa_id: toNullableStr(payload.pessoaId),
      humano_responsavel: toNullableStr(payload.humano_responsavel),
      agente_responsavel: agenteSlugHint,
    },
    agente: agenteSlugHint ? { agente_slug: agenteSlugHint } : null,
    waSendOpts: instanceToken ? { instanceToken } : undefined,
  };
}

async function updateJobStatus(
  supabase: SupabaseClient,
  job: HubMsgJob,
  patch: Partial<{
    status: JobStatus;
    available_at: string;
    last_error: string | null;
    locked_at: string | null;
    locked_by: string | null;
  }>
): Promise<void> {
  const { error } = await supabase.from("hub_msg_jobs").update(patch).eq("id", job.id);
  if (error) throw new Error(`falha update job ${job.id}: ${error.message}`);
}

async function claimBatch(
  supabase: SupabaseClient,
  worker: string,
  batchSize: number
): Promise<HubMsgJob[]> {
  const { data, error } = await supabase.rpc("hub_msg_jobs_claim_batch", {
    p_worker_id: worker,
    p_limit: batchSize,
  });
  if (error) throw new Error(`falha claim batch: ${error.message}`);
  return (Array.isArray(data) ? data : []) as HubMsgJob[];
}

/** Jobs presos em processing (ex.: crash) voltam a retry para não bloquear o telefone no claim. */
async function recuperarJobsProcessingExpirados(
  supabase: SupabaseClient,
  maxMinutos = 8
): Promise<number> {
  const limite = new Date(Date.now() - maxMinutos * 60_000).toISOString();
  const { data, error } = await supabase
    .from("hub_msg_jobs")
    .update({
      status: "retry",
      last_error: "processing_expirado_recuperado",
      locked_at: null,
      locked_by: null,
      available_at: new Date().toISOString(),
    })
    .eq("status", "processing")
    .lt("locked_at", limite)
    .select("id");

  if (error) {
    console.warn("[WORKER] recuperar processing expirados:", error.message);
    return 0;
  }
  return Array.isArray(data) ? data.length : 0;
}

async function tokenInstanciaPorAgente(
  supabase: SupabaseClient,
  agenteSlug: string
): Promise<{ token: string | null; ident: Record<string, unknown> | null }> {
  const slug = agenteSlug.trim();
  if (!slug) return { token: null, ident: null };
  const { data, error } = await supabase
    .from("hub_agente_identidade")
    .select("uazapi_instance_token, cargo, area, instrucao_modo, playbook_object_path, playbook_public_url")
    .eq("agente_slug", slug)
    .maybeSingle();
  if (error) {
    console.warn("[WORKER] token por agente:", error.message);
    return { token: null, ident: null };
  }
  const token = typeof data?.uazapi_instance_token === "string" ? data.uazapi_instance_token.trim() : "";
  return { token: token || null, ident: (data as Record<string, unknown> | null) ?? null };
}

async function processJob(supabase: SupabaseClient, job: HubMsgJob, log: HubLogger): Promise<void> {
  const contexto = reconstruirContexto(job);

  if (!contexto.waSendOpts?.instanceToken) {
    const slug = contexto.agente?.agente_slug || job.agente_slug || "";
    const { token, ident } = await tokenInstanciaPorAgente(supabase, slug);
    if (token) {
      contexto.waSendOpts = { instanceToken: token };
    }
    if (ident && contexto.agente) {
      contexto.agente = { ...contexto.agente, ...ident };
    } else if (ident && slug) {
      contexto.agente = { agente_slug: slug, ...ident };
    }
  }

  if (contexto.instanceKey) {
    try {
      const linha = await resolverLinhaWhatsAppInbound(supabase, contexto.instanceKey, {});
      if (linha.kind === "agent_instance") {
        if (!contexto.waSendOpts?.instanceToken) {
          contexto.waSendOpts = { instanceToken: linha.instanceToken };
        }
        if (!contexto.agente || !contexto.agente.agente_slug) {
          contexto.agente = { agente_slug: linha.agenteSlug };
        }
        if (!contexto.lead.agente_responsavel) {
          contexto.lead.agente_responsavel = linha.agenteSlug;
        }
      }
    } catch (e) {
      log.warn("wa.worker.instance_resolve_failed", {
        job_id: job.id,
        instance: contexto.instanceKey,
        error: e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200),
      });
    }
  }

  const dup = await avaliarJobDuplicado(supabase, {
    id: job.id,
    telefone: job.telefone,
    message_id: job.message_id,
    created_at: job.created_at,
  });
  if (dup.ignorar) {
    await updateJobStatus(supabase, job, {
      status: "done",
      last_error: dup.motivo ?? "duplicata_ignorada",
      locked_at: null,
      locked_by: null,
    });
    log.info("wa.worker.job_skip_duplicate", {
      job_id: job.id,
      telefone: contexto.telefone,
      motivo: dup.motivo,
    });
    return;
  }

  const { data: leadRow } = await supabase
    .from("hub_leads_crm")
    .select("pessoa_id, telefone, humano_responsavel, agente_responsavel")
    .eq("id", contexto.lead.id)
    .maybeSingle();
  if (leadRow?.pessoa_id) contexto.lead.pessoa_id = String(leadRow.pessoa_id);
  if (leadRow?.telefone) contexto.lead.telefone = String(leadRow.telefone);
  if (leadRow?.humano_responsavel && !contexto.lead.humano_responsavel) {
    contexto.lead.humano_responsavel = String(leadRow.humano_responsavel);
  }
  if (leadRow?.agente_responsavel && !contexto.lead.agente_responsavel) {
    contexto.lead.agente_responsavel = String(leadRow.agente_responsavel);
  }

  const { validarLeadTelefoneSessao } = await import("@/lib/crm/isolamento-conversa-lead");
  const isolamento = await validarLeadTelefoneSessao(supabase, contexto.lead.id, contexto.telefone);
  if (!isolamento.ok) {
    await updateJobStatus(supabase, job, {
      status: "dead",
      last_error: `${isolamento.codigo}: ${isolamento.detalhe}`.slice(0, 2000),
      locked_at: null,
      locked_by: null,
    });
    log.error("wa.worker.isolamento_lead", {
      job_id: job.id,
      lead_id: contexto.lead.id,
      codigo: isolamento.codigo,
    });
    return;
  }

  try {
    await processarMensagemInboundWhatsapp({
      supabase,
      trace: {
        log,
        maskTelefone: (t) => (t ? `***${t.replace(/\D/g, "").slice(-4)}` : undefined),
      },
      lead: contexto.lead,
      agente: contexto.agente,
      mensagemFinal: contexto.mensagemFinal,
      menuChoiceId: contexto.menuChoiceId,
      telefone: contexto.telefone,
      pushName: contexto.pushName,
      messageId: contexto.messageId,
      timestamp: contexto.timestamp,
      mercado: contexto.mercado,
      instanceKey: contexto.instanceKey,
      isNovo: contexto.isNovo,
      tipoMidia: contexto.tipoMidia,
      waSendOpts: contexto.waSendOpts,
      isGroupTransfer: contexto.isGroupTransfer,
      groupJid: contexto.groupJid,
      fromMe: contexto.fromMe,
      senderTelefone: contexto.senderTelefone,
    });

    await updateJobStatus(supabase, job, {
      status: "done",
      last_error: null,
      locked_at: null,
      locked_by: null,
    });
    log.info("wa.worker.job_done", { job_id: job.id, attempts: job.attempts, telefone: contexto.telefone });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const transient = isTransientErrorMessage(msg);
    const shouldDead = job.attempts >= job.max_attempts || !transient;

    if (shouldDead) {
      await updateJobStatus(supabase, job, {
        status: "dead",
        last_error: msg.slice(0, 2000),
        locked_at: null,
        locked_by: null,
      });
      log.error("wa.worker.job_dead", {
        job_id: job.id,
        attempts: job.attempts,
        max_attempts: job.max_attempts,
        error: msg.slice(0, 260),
      });
      return;
    }

    const delayMs = retryDelayMs(job.attempts);
    await updateJobStatus(supabase, job, {
      status: "retry",
      available_at: new Date(Date.now() + delayMs).toISOString(),
      last_error: msg.slice(0, 2000),
      locked_at: null,
      locked_by: null,
    });
    log.warn("wa.worker.job_retry", {
      job_id: job.id,
      attempts: job.attempts,
      max_attempts: job.max_attempts,
      delay_ms: delayMs,
      error: msg.slice(0, 260),
    });
  }
}

async function processBatch(
  supabase: SupabaseClient,
  jobs: HubMsgJob[],
  concurrency: number,
  rootLog: HubLogger
): Promise<void> {
  if (jobs.length === 0) return;

  const byPhone = new Map<string, HubMsgJob[]>();
  for (const job of jobs) {
    const key = job.telefone.trim() || job.id;
    const list = byPhone.get(key) ?? [];
    list.push(job);
    byPhone.set(key, list);
  }

  const phoneQueues = [...byPhone.values()];
  const slots = Math.min(concurrency, phoneQueues.length);
  let nextQueue = 0;

  const workers = Array.from({ length: slots }, async (_, i) => {
    while (true) {
      const idx = nextQueue++;
      if (idx >= phoneQueues.length) return;
      const queue = phoneQueues[idx]!;
      for (const job of queue) {
        const log = rootLog.child({
          worker_slot: i + 1,
          job_id: job.id,
          tenant_id: job.tenant_id || defaultTenantId(),
          telefone: job.telefone,
        });
        await processJob(supabase, job, log);
      }
    }
  });
  await Promise.all(workers);
}

/** Um ciclo: claim + processa lote (usado pelo cron HTTP e pelo worker contínuo). */
export async function runWhatsappWorkerTick(): Promise<{
  claimed: number;
  worker_id: string;
  error?: string;
}> {
  const supabase = supabaseAdmin();
  const id = workerId();
  const batchSize = workerBatchSize();
  const concurrency = workerConcurrency();
  const log = createHubLogger("whatsapp_worker", {
    worker_id: id,
    batch_size: batchSize,
    concurrency,
    mode: "tick",
  });

  try {
    await recuperarJobsProcessingExpirados(supabase);
    const jobs = await claimBatch(supabase, id, batchSize);
    if (jobs.length > 0) {
      log.info("wa.worker.claimed_batch", { size: jobs.length });
      await processBatch(supabase, jobs, concurrency, log);
    }
    return { claimed: jobs.length, worker_id: id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log.error("wa.worker.tick_error", { error: msg.slice(0, 260) });
    return { claimed: 0, worker_id: id, error: msg.slice(0, 500) };
  }
}

export async function runWhatsappWorker(): Promise<never> {
  const pollMs = workerPollMs();
  const jitterMax = workerMaxJitterMs();
  const log = createHubLogger("whatsapp_worker", {
    poll_ms: pollMs,
    batch_size: workerBatchSize(),
    concurrency: workerConcurrency(),
    mode: "loop",
  });

  log.info("wa.worker.started", {
    node_env: process.env.NODE_ENV || "development",
    mistral_timeout_ms: process.env.MISTRAL_CHAT_TIMEOUT_MS || null,
    mistral_retries: process.env.MISTRAL_CHAT_RETRIES || null,
  });

  while (true) {
    const result = await runWhatsappWorkerTick();
    if (result.claimed === 0 && !result.error) {
      const jitter = jitterMax > 0 ? Math.floor(Math.random() * jitterMax) : 0;
      await sleep(pollMs + jitter);
    } else if (result.error) {
      await sleep(Math.max(1500, Math.floor(pollMs / 2)));
    }
  }
}
