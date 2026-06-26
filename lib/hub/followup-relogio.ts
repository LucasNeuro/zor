import type { SupabaseClient } from "@supabase/supabase-js";

/** Converte timestamp WhatsApp/ISO em Date válida. */
export function parseFollowupTimestamp(isoOrDate: string | Date | null | undefined): Date | null {
  if (isoOrDate == null || isoOrDate === "") return null;
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Minutos desde a última mensagem **do cliente** (`ultima_msg_cliente_em`).
 * Retorna null quando o relógio não está disponível (lead sem msg inbound registrada).
 */
export function minutosSilencioDesdeUltimaMsgCliente(
  ultimaMsgClienteEm: string | null | undefined,
  agoraMs: number
): number | null {
  const d = parseFollowupTimestamp(ultimaMsgClienteEm);
  if (!d) return null;
  return Math.max(0, (agoraMs - d.getTime()) / 60_000);
}

/**
 * Preenche `ultima_msg_cliente_em` a partir da última mensagem inbound na fila (leads legados).
 * Não usa `ultimo_contato` nem respostas do bot — só direção entrada.
 */
export async function backfillUltimaMsgClienteEm(
  supabase: SupabaseClient,
  leadId: string
): Promise<string | null> {
  const { data: row, error } = await supabase
    .from("hub_fila_mensagens")
    .select("enviada_em, criado_em")
    .eq("lead_id", leadId)
    .eq("direcao", "entrada")
    .order("enviada_em", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error || !row) return null;

  const iso =
    (typeof row.enviada_em === "string" && row.enviada_em.trim()) ||
    (typeof row.criado_em === "string" && row.criado_em.trim()) ||
    null;
  if (!iso || !parseFollowupTimestamp(iso)) return null;

  try {
    await supabase.from("hub_leads_crm").update({ ultima_msg_cliente_em: iso }).eq("id", leadId);
  } catch {
    return iso;
  }

  return iso;
}
