import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingPgColumn } from "@/lib/tenant-default";

const COLUNAS_FILA_OPCIONAIS = [
  "nome_arquivo",
  "tipo_conteudo",
  "tipo_midia",
  "url_midia",
  "whatsapp_message_id",
  "conversa_id",
  "tenant_id",
] as const;

function colunaAusenteNaMensagem(message: string, col: string): boolean {
  const m = message.toLowerCase();
  const c = col.toLowerCase();
  return m.includes(c) && (m.includes("schema cache") || m.includes("column") || m.includes("could not find"));
}

/**
 * Insere em hub_fila_mensagens removendo colunas que ainda não existem no Supabase (schema cache).
 * Campos de mídia permanecem em `metadata` quando colunas top-level faltam.
 */
export async function insertFilaMensagemCompat(
  supabase: SupabaseClient,
  row: Record<string, unknown>
): Promise<{ error: { message: string } | null }> {
  let current: Record<string, unknown> = { ...row };

  for (let attempt = 0; attempt <= COLUNAS_FILA_OPCIONAIS.length; attempt++) {
    const { error } = await supabase.from("hub_fila_mensagens").insert(current);
    if (!error) return { error: null };

    if (!isMissingPgColumn(error)) {
      return { error: { message: error.message } };
    }

    const msg = error.message ?? "";
    let stripped = false;
    for (const col of COLUNAS_FILA_OPCIONAIS) {
      if (col in current && colunaAusenteNaMensagem(msg, col)) {
        const next = { ...current };
        delete next[col];
        current = next;
        stripped = true;
        break;
      }
    }

    if (!stripped) {
      return { error: { message: error.message } };
    }
  }

  return { error: { message: "Não foi possível gravar hub_fila_mensagens após compat." } };
}
