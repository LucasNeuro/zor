import type { SupabaseClient } from "@supabase/supabase-js";
import { gerarCodigoSequencial, HUB_PREFIXO_CODIGO } from "@/lib/crm/codigos-rastreio";

/** Código único do parceiro na rede (mesmo padrão de PES-/EMP-). */
export async function gerarCodigoParceiro(supabase: SupabaseClient): Promise<string> {
  return gerarCodigoSequencial(supabase, "hub_parceiros", HUB_PREFIXO_CODIGO.parceiro);
}
