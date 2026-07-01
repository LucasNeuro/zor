import type { SupabaseClient } from "@supabase/supabase-js";

export type HarnessTokenUsage = {
  tokens_input: number;
  tokens_output: number;
  turnos: number;
  custo_brl_acumulado: number;
  aprovacoes_solicitadas: number;
  aprovacoes_aprovadas: number;
  aprovacoes_rejeitadas: number;
};

function emptyUsage(): HarnessTokenUsage {
  return {
    tokens_input: 0,
    tokens_output: 0,
    turnos: 0,
    custo_brl_acumulado: 0,
    aprovacoes_solicitadas: 0,
    aprovacoes_aprovadas: 0,
    aprovacoes_rejeitadas: 0,
  };
}

function tabelaInexistente(msg?: string): boolean {
  if (!msg) return false;
  const m = msg.toLowerCase();
  return m.includes("hub_harness_sessions") && (m.includes("does not exist") || m.includes("schema cache"));
}

export async function acumularMetricasSessaoHarness(
  supabase: SupabaseClient,
  sessionId: string,
  delta: {
    tokens_input?: number;
    tokens_output?: number;
    custo_brl?: number;
    aprovacao_solicitada?: boolean;
    aprovacao_aprovada?: boolean;
    aprovacao_rejeitada?: boolean;
  }
): Promise<void> {
  const { data, error } = await supabase
    .from("hub_harness_sessions")
    .select("token_usage")
    .eq("id", sessionId)
    .maybeSingle();

  if (error && !tabelaInexistente(error.message)) return;

  const prev = (data?.token_usage ?? {}) as Partial<HarnessTokenUsage>;
  const base = { ...emptyUsage(), ...prev };

  const next: HarnessTokenUsage = {
    tokens_input: base.tokens_input + (delta.tokens_input ?? 0),
    tokens_output: base.tokens_output + (delta.tokens_output ?? 0),
    turnos: base.turnos + 1,
    custo_brl_acumulado: base.custo_brl_acumulado + (delta.custo_brl ?? 0),
    aprovacoes_solicitadas: base.aprovacoes_solicitadas + (delta.aprovacao_solicitada ? 1 : 0),
    aprovacoes_aprovadas: base.aprovacoes_aprovadas + (delta.aprovacao_aprovada ? 1 : 0),
    aprovacoes_rejeitadas: base.aprovacoes_rejeitadas + (delta.aprovacao_rejeitada ? 1 : 0),
  };

  await supabase
    .from("hub_harness_sessions")
    .update({ token_usage: next, atualizado_em: new Date().toISOString() })
    .eq("id", sessionId);
}

export async function obterMetricasAgenteHarness(
  supabase: SupabaseClient,
  tenantId: string,
  agenteSlug: string
): Promise<{
  sessoes: number;
  tokens_input: number;
  tokens_output: number;
  turnos: number;
  custo_brl: number;
  aprovacoes_pendentes: number;
  skills_ativas: number;
}> {
  const [sessoesRes, pendingRes, skillsRes] = await Promise.all([
    supabase
      .from("hub_harness_sessions")
      .select("token_usage")
      .eq("tenant_id", tenantId)
      .eq("agente_slug", agenteSlug)
      .limit(200),
    supabase
      .from("hub_harness_pending_writes")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("agente_slug", agenteSlug)
      .eq("status", "pending"),
    supabase
      .from("hub_agente_skills")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("agente_slug", agenteSlug)
      .eq("ativo", true),
  ]);

  let tokens_input = 0;
  let tokens_output = 0;
  let turnos = 0;
  let custo_brl = 0;

  for (const row of sessoesRes.data ?? []) {
    const u = (row.token_usage ?? {}) as Partial<HarnessTokenUsage>;
    tokens_input += u.tokens_input ?? 0;
    tokens_output += u.tokens_output ?? 0;
    turnos += u.turnos ?? 0;
    custo_brl += u.custo_brl_acumulado ?? 0;
  }

  return {
    sessoes: sessoesRes.data?.length ?? 0,
    tokens_input,
    tokens_output,
    turnos,
    custo_brl: Math.round(custo_brl * 100) / 100,
    aprovacoes_pendentes: pendingRes.count ?? 0,
    skills_ativas: skillsRes.count ?? 0,
  };
}
