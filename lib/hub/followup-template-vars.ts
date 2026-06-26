import type { SupabaseClient } from "@supabase/supabase-js";
import {
  lerEmpresaCadastralTenant,
  nomeComercialEmpresa,
} from "@/lib/hub/tenant-empresa-cadastral";

export type FollowupTemplateContext = {
  agente: string;
  empresaParaTenant: (tenantId?: string | null) => Promise<string>;
};

/** Resolve nome do agente e empresa por tenant (cache em memória no tick). */
export async function criarContextoTemplateFollowup(
  supabase: SupabaseClient,
  agenteSlug: string,
  tenantIdDefault: string | null
): Promise<FollowupTemplateContext> {
  const slug = agenteSlug.trim();
  const { data: agenteRow } = await supabase
    .from("hub_agente_identidade")
    .select("nome")
    .eq("agente_slug", slug)
    .maybeSingle();

  const agente =
    typeof agenteRow?.nome === "string" && agenteRow.nome.trim()
      ? agenteRow.nome.trim()
      : slug;

  const empresaCache = new Map<string, string>();

  async function empresaParaTenant(tenantId?: string | null): Promise<string> {
    const tid = tenantId?.trim() || tenantIdDefault?.trim();
    if (!tid) return "";
    const cached = empresaCache.get(tid);
    if (cached !== undefined) return cached;

    const { cadastral, nome_exibicao } = await lerEmpresaCadastralTenant(supabase, tid);
    const nome = nomeComercialEmpresa(cadastral, nome_exibicao);
    empresaCache.set(tid, nome);
    return nome;
  }

  if (tenantIdDefault?.trim()) {
    await empresaParaTenant(tenantIdDefault);
  }

  return { agente, empresaParaTenant };
}
