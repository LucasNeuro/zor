import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Quando chega mensagem nova no mesmo telefone, encerra jobs antigos pending/retry
 * para só a mensagem mais recente ser respondida (evita trava e fila presa).
 */
export async function supersedeJobsAntigosMesmoTelefone(
  supabase: SupabaseClient,
  telefone: string,
  jobIdManter: string
): Promise<number> {
  const tel = telefone.trim();
  if (!tel || !jobIdManter) return 0;

  const { data, error } = await supabase
    .from("hub_msg_jobs")
    .update({
      status: "done",
      last_error: "superseded_by_newer_message",
      locked_at: null,
      locked_by: null,
    })
    .eq("canal", "whatsapp")
    .eq("telefone", tel)
    .in("status", ["pending", "retry", "processing"])
    .neq("id", jobIdManter)
    .select("id");

  if (error) {
    console.warn("[WEBHOOK] supersede jobs antigos:", error.message);
    return 0;
  }
  return Array.isArray(data) ? data.length : 0;
}
