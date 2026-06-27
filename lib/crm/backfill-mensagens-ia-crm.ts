import type { SupabaseClient } from "@supabase/supabase-js";
import { insertFilaMensagemCompat } from "@/lib/crm/insert-fila-mensagem-compat";
import { parseConversaTurnos } from "@/lib/crm/lead-timeline";
import { defaultTenantId } from "@/lib/tenant-default";

async function filaSaidaExiste(
  supabase: SupabaseClient,
  leadId: string,
  conteudo: string,
  criadoEm?: string
): Promise<boolean> {
  const texto = conteudo.trim();
  if (!texto) return true;

  const { data } = await supabase
    .from("hub_fila_mensagens")
    .select("id, conteudo, criado_em, enviada_em")
    .eq("lead_id", leadId)
    .eq("direcao", "saida")
    .order("criado_em", { ascending: false })
    .limit(80);

  const alvoMs = criadoEm ? new Date(criadoEm).getTime() : NaN;

  for (const row of data ?? []) {
    const r = row as Record<string, unknown>;
    if (String(r.conteudo ?? "").trim() !== texto) continue;
    if (!Number.isFinite(alvoMs)) return true;
    const em = String(r.criado_em ?? r.enviada_em ?? "");
    const ms = new Date(em).getTime();
    if (!Number.isFinite(ms) || Math.abs(ms - alvoMs) < 120_000) return true;
  }
  return false;
}

async function inserirSaidaIa(
  supabase: SupabaseClient,
  params: {
    leadId: string;
    agenteSlug: string;
    conteudo: string;
    criadoEm: string;
    origem: string;
    tenantId?: string | null;
  }
): Promise<void> {
  const row: Record<string, unknown> = {
    lead_id: params.leadId,
    agente_id: params.agenteSlug,
    canal: "whatsapp",
    direcao: "saida",
    conteudo: params.conteudo.trim(),
    status: "enviado",
    criado_em: params.criadoEm,
    enviada_em: params.criadoEm,
    metadata: {
      feito_por_tipo: "ia",
      feito_por: "backfill",
      origem_backfill: params.origem,
    },
  };
  const tenantId = params.tenantId?.trim() || defaultTenantId();
  if (tenantId) row.tenant_id = tenantId;

  const { error } = await insertFilaMensagemCompat(supabase, row);
  if (error) {
    console.warn("[CRM][backfill-ia]", params.leadId, error.message);
  }
}

/** Garante que respostas da IA existam em hub_fila_mensagens (reparo idempotente). */
export async function backfillMensagensIaCrm(
  supabase: SupabaseClient,
  leadId: string,
  opts?: { agenteSlug?: string | null; tenantId?: string | null }
): Promise<{ inseridas: number }> {
  let inseridas = 0;
  const agenteFallback = opts?.agenteSlug?.trim() || "ia";

  const { data: leadRow } = await supabase
    .from("hub_leads_crm")
    .select("metadata, agente_responsavel, tenant_id")
    .eq("id", leadId)
    .maybeSingle();

  const agenteSlug =
    opts?.agenteSlug?.trim() ||
    (typeof leadRow?.agente_responsavel === "string" ? leadRow.agente_responsavel.trim() : "") ||
    agenteFallback;
  const tenantId =
    opts?.tenantId ??
    (typeof leadRow?.tenant_id === "string" ? leadRow.tenant_id : null);

  for (const turno of parseConversaTurnos(leadRow?.metadata)) {
    if (turno.role !== "assistant") continue;
    const conteudo = turno.content.trim();
    if (!conteudo) continue;
    const criadoEm = turno.at?.trim();
    if (!criadoEm) continue;
    if (await filaSaidaExiste(supabase, leadId, conteudo, criadoEm)) continue;
    await inserirSaidaIa(supabase, {
      leadId,
      agenteSlug,
      conteudo,
      criadoEm,
      origem: "conversa_turnos",
      tenantId,
    });
    inseridas += 1;
  }

  const { data: logs } = await supabase
    .from("hub_prompt_logs")
    .select("id, resposta_ia, agente_slug, criado_em")
    .eq("lead_id", leadId)
    .not("resposta_ia", "is", null)
    .order("criado_em", { ascending: true })
    .limit(120);

  for (const log of logs ?? []) {
    const row = log as Record<string, unknown>;
    const resposta = typeof row.resposta_ia === "string" ? row.resposta_ia.trim() : "";
    if (!resposta) continue;
    const criadoEm = typeof row.criado_em === "string" ? row.criado_em : new Date().toISOString();
    const slug =
      typeof row.agente_slug === "string" && row.agente_slug.trim()
        ? row.agente_slug.trim()
        : agenteSlug;
    if (await filaSaidaExiste(supabase, leadId, resposta, criadoEm)) continue;
    await inserirSaidaIa(supabase, {
      leadId,
      agenteSlug: slug,
      conteudo: resposta,
      criadoEm,
      origem: "hub_prompt_logs",
      tenantId,
    });
    inseridas += 1;
  }

  return { inseridas };
}

export async function persistirMensagemSaidaIaCrm(
  supabase: SupabaseClient,
  params: {
    leadId: string;
    agenteSlug: string;
    conteudo: string;
    tenantId?: string | null;
    motor?: string | null;
    status?: string;
  }
): Promise<void> {
  const texto = params.conteudo.trim();
  if (!texto) return;
  const agora = new Date().toISOString();
  if (await filaSaidaExiste(supabase, params.leadId, texto, agora)) return;

  const row: Record<string, unknown> = {
    lead_id: params.leadId,
    agente_id: params.agenteSlug,
    canal: "whatsapp",
    direcao: "saida",
    conteudo: texto,
    status: params.status ?? "enviado",
    criado_em: agora,
    enviada_em: agora,
    metadata: {
      feito_por_tipo: "ia",
      feito_por: params.agenteSlug,
      motor: params.motor ?? null,
    },
  };
  const tenantId = params.tenantId?.trim() || defaultTenantId();
  if (tenantId) row.tenant_id = tenantId;

  const { error } = await insertFilaMensagemCompat(supabase, row);
  if (error) console.warn("[CRM][persistir-saida-ia]", params.leadId, error.message);
}
