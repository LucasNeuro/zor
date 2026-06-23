import type { SupabaseClient } from "@supabase/supabase-js";

/** Reinicia cadência quando o cliente envia mensagem (relógio + passo). */
export async function resetFollowupAoReceberMensagemCliente(
  supabase: SupabaseClient,
  leadId: string,
  options?: { pausado?: boolean },
  quando: Date = new Date()
): Promise<void> {
  const iso = quando.toISOString();
  const patch: Record<string, unknown> = {
    ultima_msg_cliente_em: iso,
    ultimo_contato: iso,
  };
  if (!options?.pausado) {
    patch.followup_passo = 0;
    patch.followup_pausado = false;
  }
  try {
    await supabase.from("hub_leads_crm").update(patch).eq("id", leadId);
  } catch (e) {
    console.warn("[followup] reset lead:", e);
  }
}

/** Pausa follow-up quando humano assume o lead. */
export async function pausarFollowupLead(
  supabase: SupabaseClient,
  leadId: string
): Promise<void> {
  try {
    await supabase.from("hub_leads_crm").update({ followup_pausado: true }).eq("id", leadId);
  } catch (e) {
    console.warn("[followup] pausar lead:", e);
  }
}
