import type { SupabaseClient } from "@supabase/supabase-js";
import type { HarnessModeId } from "@/lib/harness/types";
import { concederGrantEscritaCrmSessao } from "@/lib/harness/stores/session-store";

export type HarnessPendingApproval = {
  id: string;
  tool_name: string;
  arguments: Record<string, unknown>;
  resumo_humano: string;
  nivel: "escrita_crm" | "integracao" | "artefato";
  criado_em?: string;
};

function tabelaInexistente(msg?: string): boolean {
  if (!msg) return false;
  const m = msg.toLowerCase();
  return (
    (m.includes("hub_harness_pending_writes") || m.includes("hub_harness_sessions")) &&
    (m.includes("does not exist") || m.includes("schema cache"))
  );
}

export async function criarPendingWriteCrm(
  supabase: SupabaseClient,
  params: {
    tenantId: string;
    agenteSlug: string;
    sessionId?: string | null;
    toolName: string;
    argumentos: Record<string, unknown>;
    resumoHumano: string;
    nivel?: HarnessPendingApproval["nivel"];
  }
): Promise<HarnessPendingApproval | null> {
  const payload = {
    tool_name: params.toolName,
    arguments: params.argumentos,
    resumo_humano: params.resumoHumano,
    nivel: params.nivel ?? "escrita_crm",
  };

  const { data, error } = await supabase
    .from("hub_harness_pending_writes")
    .insert({
      tenant_id: params.tenantId,
      agente_slug: params.agenteSlug,
      session_id: params.sessionId ?? null,
      tipo: "crm_write",
      payload,
      status: "pending",
    })
    .select("id, criado_em")
    .maybeSingle();

  if (error || !data?.id) {
    if (!tabelaInexistente(error?.message)) return null;
    return null;
  }

  const approval: HarnessPendingApproval = {
    id: data.id as string,
    tool_name: params.toolName,
    arguments: params.argumentos,
    resumo_humano: params.resumoHumano,
    nivel: payload.nivel as HarnessPendingApproval["nivel"],
    criado_em: data.criado_em as string | undefined,
  };

  if (params.sessionId) {
    await anexarPendingApprovalSessao(supabase, params.sessionId, approval);
  }

  return approval;
}

async function anexarPendingApprovalSessao(
  supabase: SupabaseClient,
  sessionId: string,
  approval: HarnessPendingApproval
): Promise<void> {
  const { data } = await supabase
    .from("hub_harness_sessions")
    .select("pending_approvals")
    .eq("id", sessionId)
    .maybeSingle();

  const fila = Array.isArray(data?.pending_approvals)
    ? (data.pending_approvals as HarnessPendingApproval[])
    : [];

  await supabase
    .from("hub_harness_sessions")
    .update({ pending_approvals: [...fila, approval] })
    .eq("id", sessionId);
}

export async function listarPendingWritesAgente(
  supabase: SupabaseClient,
  tenantId: string,
  agenteSlug: string
): Promise<HarnessPendingApproval[]> {
  const { data, error } = await supabase
    .from("hub_harness_pending_writes")
    .select("id, payload, criado_em")
    .eq("tenant_id", tenantId)
    .eq("agente_slug", agenteSlug)
    .eq("status", "pending")
    .order("criado_em", { ascending: false })
    .limit(12);

  if (error || !data) return [];

  return data.map((row) => {
    const p = (row.payload ?? {}) as Record<string, unknown>;
    return {
      id: row.id as string,
      tool_name: String(p.tool_name ?? ""),
      arguments: (p.arguments as Record<string, unknown>) ?? {},
      resumo_humano: String(p.resumo_humano ?? ""),
      nivel: (p.nivel as HarnessPendingApproval["nivel"]) ?? "escrita_crm",
      criado_em: row.criado_em as string | undefined,
    };
  });
}

export async function resolverPendingWrite(
  supabase: SupabaseClient,
  params: {
    approvalId: string;
    tenantId: string;
    agenteSlug: string;
    decisao: "aprovar" | "rejeitar";
    sessionId?: string | null;
    modoId?: HarnessModeId;
  }
): Promise<{ ok: boolean; tool_name?: string; argumentos?: Record<string, unknown>; erro?: string }> {
  const { data: row, error } = await supabase
    .from("hub_harness_pending_writes")
    .select("id, payload, status, agente_slug, tenant_id")
    .eq("id", params.approvalId)
    .eq("tenant_id", params.tenantId)
    .eq("agente_slug", params.agenteSlug)
    .eq("status", "pending")
    .maybeSingle();

  if (error || !row) {
    return { ok: false, erro: "aprovacao_nao_encontrada" };
  }

  const payload = (row.payload ?? {}) as Record<string, unknown>;
  const toolName = String(payload.tool_name ?? "");
  const argumentos = (payload.arguments as Record<string, unknown>) ?? {};

  if (params.decisao === "rejeitar") {
    await supabase
      .from("hub_harness_pending_writes")
      .update({ status: "rejected", resolvido_em: new Date().toISOString() })
      .eq("id", params.approvalId);
    if (params.sessionId) await limparPendingApprovalSessao(supabase, params.sessionId, params.approvalId);
    return { ok: true, tool_name: toolName, argumentos };
  }

  await supabase
    .from("hub_harness_pending_writes")
    .update({ status: "approved", resolvido_em: new Date().toISOString() })
    .eq("id", params.approvalId);

  if (params.sessionId) {
    await concederGrantEscritaCrmSessao(supabase, params.sessionId);
    await limparPendingApprovalSessao(supabase, params.sessionId, params.approvalId);
  }

  return { ok: true, tool_name: toolName, argumentos };
}

async function limparPendingApprovalSessao(
  supabase: SupabaseClient,
  sessionId: string,
  approvalId: string
): Promise<void> {
  const { data } = await supabase
    .from("hub_harness_sessions")
    .select("pending_approvals")
    .eq("id", sessionId)
    .maybeSingle();

  const fila = Array.isArray(data?.pending_approvals)
    ? (data.pending_approvals as HarnessPendingApproval[]).filter((a) => a.id !== approvalId)
    : [];

  await supabase.from("hub_harness_sessions").update({ pending_approvals: fila }).eq("id", sessionId);
}
