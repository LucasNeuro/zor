import type { SupabaseClient } from "@supabase/supabase-js";
import { TZ_FOLLOWUP_PADRAO } from "@/lib/hub/followup-janela";

export type FollowupEnvioLedgerRow = {
  id: string;
  lead_id: string;
  passo_id: string;
  agente_slug: string;
  passo_ordem: number;
  tenant_id: string | null;
  enviado_em: string;
};

/** Verifica se o passo já foi enviado para este lead (ledger). */
export async function followupPassoJaEnviado(
  supabase: SupabaseClient,
  leadId: string,
  passoId: string
): Promise<{ jaEnviado: boolean; ledgerOk: boolean }> {
  const { data, error } = await supabase
    .from("hub_followup_envio")
    .select("id")
    .eq("lead_id", leadId)
    .eq("passo_id", passoId)
    .maybeSingle();

  if (error) {
    console.warn("[followup-ledger] followupPassoJaEnviado:", error.message);
    return { jaEnviado: false, ledgerOk: false };
  }
  return { jaEnviado: data != null, ledgerOk: true };
}

/**
 * Conta passos consecutivos já enviados (ledger = fonte de verdade).
 * Impede reenvio em cada slot horário quando followup_passo estiver dessincronizado.
 */
export async function estadoCadenciaFromLedger(
  supabase: SupabaseClient,
  leadId: string,
  passosAtivos: Array<{ id: string }>
): Promise<{
  enviadosCount: number;
  ledgerOk: boolean;
  todosEnviados: boolean;
  passoIdsEnviados: Set<string>;
}> {
  if (passosAtivos.length === 0) {
    return { enviadosCount: 0, ledgerOk: true, todosEnviados: true, passoIdsEnviados: new Set() };
  }

  const { data, error } = await supabase
    .from("hub_followup_envio")
    .select("passo_id")
    .eq("lead_id", leadId);

  if (error) {
    console.warn("[followup-ledger] estadoCadenciaFromLedger:", error.message);
    return { enviadosCount: 0, ledgerOk: false, todosEnviados: false, passoIdsEnviados: new Set() };
  }

  const passoIdsEnviados = new Set(
    (data || [])
      .map((r) => (typeof r.passo_id === "string" ? r.passo_id : ""))
      .filter(Boolean)
  );

  let enviadosCount = 0;
  for (const p of passosAtivos) {
    if (passoIdsEnviados.has(p.id)) enviadosCount += 1;
    else break;
  }

  return {
    enviadosCount,
    ledgerOk: true,
    todosEnviados: enviadosCount >= passosAtivos.length,
    passoIdsEnviados,
  };
}

/** Sincroniza followup_passo no lead com o ledger (best-effort). */
export async function sincronizarFollowupPassoComLedger(
  supabase: SupabaseClient,
  leadId: string,
  enviadosCount: number,
  atualNoLead: number | null | undefined
): Promise<void> {
  const atual = atualNoLead ?? 0;
  if (atual === enviadosCount) return;
  try {
    await supabase.from("hub_leads_crm").update({ followup_passo: enviadosCount }).eq("id", leadId);
  } catch (e) {
    console.warn("[followup-ledger] sincronizarFollowupPassoComLedger:", e);
  }
}

/** Registra envio bem-sucedido no ledger (idempotente via UNIQUE). */
export async function registrarFollowupEnvio(
  supabase: SupabaseClient,
  params: {
    lead_id: string;
    passo_id: string;
    agente_slug: string;
    passo_ordem: number;
    tenant_id?: string | null;
    enviado_em?: string;
  }
): Promise<{ ok: boolean; erro?: string }> {
  const { error } = await supabase.from("hub_followup_envio").upsert(
    {
      lead_id: params.lead_id,
      passo_id: params.passo_id,
      agente_slug: params.agente_slug,
      passo_ordem: params.passo_ordem,
      tenant_id: params.tenant_id ?? null,
      enviado_em: params.enviado_em ?? new Date().toISOString(),
    },
    { onConflict: "lead_id,passo_id", ignoreDuplicates: true }
  );

  if (error) return { ok: false, erro: error.message };
  return { ok: true };
}

/** Remove registros do ledger ao reiniciar cadência (cliente respondeu). */
export async function limparLedgerCadenciaLead(
  supabase: SupabaseClient,
  leadId: string,
  agenteSlug?: string
): Promise<void> {
  try {
    let q = supabase.from("hub_followup_envio").delete().eq("lead_id", leadId);
    if (agenteSlug?.trim()) {
      q = q.eq("agente_slug", agenteSlug.trim());
    }
    await q;
  } catch (e) {
    console.warn("[followup-ledger] limparLedgerCadenciaLead:", e);
  }
}

/** Conta envios automáticos do lead hoje (fuso configurado). */
export async function contarEnviosFollowupHoje(
  supabase: SupabaseClient,
  leadId: string,
  agenteSlug: string,
  timeZone = TZ_FOLLOWUP_PADRAO
): Promise<number> {
  const inicioDia = inicioDiaLocalIso(timeZone);
  const { count, error } = await supabase
    .from("hub_followup_envio")
    .select("id", { count: "exact", head: true })
    .eq("lead_id", leadId)
    .eq("agente_slug", agenteSlug)
    .gte("enviado_em", inicioDia);

  if (error) {
    console.warn("[followup-ledger] contarEnviosFollowupHoje:", error.message);
    return 0;
  }
  return count ?? 0;
}

/** Lista passos já enviados para um lead (painel/diagnóstico). */
export async function listarEnviosLedgerLead(
  supabase: SupabaseClient,
  leadId: string
): Promise<FollowupEnvioLedgerRow[]> {
  const { data, error } = await supabase
    .from("hub_followup_envio")
    .select("*")
    .eq("lead_id", leadId)
    .order("enviado_em", { ascending: true });

  if (error) {
    console.warn("[followup-ledger] listarEnviosLedgerLead:", error.message);
    return [];
  }
  return (data || []) as FollowupEnvioLedgerRow[];
}

function inicioDiaLocalIso(timeZone: string): string {
  const agora = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(agora);
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return new Date(`${y}-${m}-${d}T00:00:00`).toISOString();
}
