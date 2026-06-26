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
): Promise<boolean> {
  const { data, error } = await supabase
    .from("hub_followup_envio")
    .select("id")
    .eq("lead_id", leadId)
    .eq("passo_id", passoId)
    .maybeSingle();

  if (error) {
    console.warn("[followup-ledger] followupPassoJaEnviado:", error.message);
    return false;
  }
  return data != null;
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
