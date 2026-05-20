import type { SupabaseClient } from "@supabase/supabase-js";

function normalizarTexto(t: string): string {
  return t.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 160);
}

/** Evita processar job se outro com o mesmo message_id já terminou ou há mensagem mais nova na fila. */
export async function avaliarJobDuplicado(
  supabase: SupabaseClient,
  job: { id: string; telefone: string; message_id: string; created_at?: string | null }
): Promise<{ ignorar: boolean; motivo?: string }> {
  const mid = job.message_id?.trim();
  if (mid) {
    const { data: jaDone } = await supabase
      .from("hub_msg_jobs")
      .select("id")
      .eq("canal", "whatsapp")
      .eq("message_id", mid)
      .eq("status", "done")
      .neq("id", job.id)
      .limit(1);
    if (jaDone?.length) {
      return { ignorar: true, motivo: "message_id_ja_processado" };
    }
  }

  return { ignorar: false };
}

/** Evita enviar a mesma resposta da IA duas vezes seguidas no WhatsApp. */
export async function respostaIaJaEnviadaRecente(
  supabase: SupabaseClient,
  leadId: string,
  textoResposta: string,
  janelaSegundos = 120
): Promise<boolean> {
  const desde = new Date(Date.now() - janelaSegundos * 1000).toISOString();
  const alvo = normalizarTexto(textoResposta);
  if (!alvo) return false;

  const { data: msgs } = await supabase
    .from("hub_mensagens")
    .select("conteudo, enviada_em")
    .eq("lead_id", leadId)
    .eq("remetente", "ia")
    .gte("enviada_em", desde)
    .order("enviada_em", { ascending: false })
    .limit(5);

  if (!msgs?.length) return false;
  return msgs.some((m) => normalizarTexto(String(m.conteudo || "")) === alvo);
}
