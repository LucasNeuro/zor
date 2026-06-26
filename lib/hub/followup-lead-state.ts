import type { SupabaseClient } from "@supabase/supabase-js";
import { parseFollowupTimestamp } from "@/lib/hub/followup-relogio";

/** Reinicia cadência quando o cliente envia mensagem (relógio + passo). */
export async function resetFollowupAoReceberMensagemCliente(
  supabase: SupabaseClient,
  leadId: string,
  options?: { pausado?: boolean },
  quando: Date | string = new Date()
): Promise<void> {
  const d = parseFollowupTimestamp(quando) ?? new Date();
  const iso = d.toISOString();
  const patch: Record<string, unknown> = {
    ultima_msg_cliente_em: iso,
    ultimo_contato: iso,
  };
  if (!options?.pausado) {
    patch.followup_passo = 0;
    patch.followup_pausado = false;
    patch.ultimo_followup = null;
    patch.proximo_followup = null;
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

/** Reativa follow-up em todos os leads elegíveis do agente (sem humano, não encerrados). */
export async function reativarFollowupLeadsAgente(
  supabase: SupabaseClient,
  agenteSlug: string
): Promise<number> {
  try {
    const { data, error } = await supabase
      .from("hub_leads_crm")
      .update({ followup_pausado: false })
      .eq("agente_responsavel", agenteSlug)
      .is("humano_responsavel", null)
      .not("estagio", "in", '("ganho","perdido","arquivado")')
      .not("telefone", "is", null)
      .eq("followup_pausado", true)
      .select("id");

    if (error) {
      console.warn("[followup] reativar leads:", error.message);
      return 0;
    }
    return data?.length ?? 0;
  } catch (e) {
    console.warn("[followup] reativar leads:", e);
    return 0;
  }
}
