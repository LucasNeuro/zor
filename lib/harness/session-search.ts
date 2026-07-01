import type { SupabaseClient } from "@supabase/supabase-js";

export type HarnessSessionSearchHit = {
  sessao_id: string;
  papel: string;
  trecho: string;
  criado_em?: string;
  rank?: number;
};

/**
 * Pesquisa conversas briefing do agente (FTS quando disponível; fallback ILIKE).
 */
export async function pesquisarSessoesBriefingAgente(
  supabase: SupabaseClient,
  params: {
    agenteSlug: string;
    query: string;
    limite?: number;
  }
): Promise<HarnessSessionSearchHit[]> {
  const query = params.query.trim();
  const limite = Math.min(16, Math.max(1, params.limite ?? 8));
  if (!query) return [];

  const { data: ftsRows, error: ftsErr } = await supabase.rpc("hub_briefing_mensagem_search", {
    p_agente_slug: params.agenteSlug,
    p_query: query,
    p_limite: limite,
  });

  if (!ftsErr && Array.isArray(ftsRows) && ftsRows.length > 0) {
    return ftsRows.map((r: Record<string, unknown>) => ({
      sessao_id: String(r.sessao_id ?? ""),
      papel: String(r.papel ?? ""),
      trecho: String(r.trecho ?? r.conteudo ?? "").slice(0, 400),
      criado_em: typeof r.criado_em === "string" ? r.criado_em : undefined,
      rank: typeof r.rank === "number" ? r.rank : undefined,
    }));
  }

  const { data: sessoes } = await supabase
    .from("hub_crm_agente_briefing_sessao")
    .select("id")
    .eq("agente_slug", params.agenteSlug)
    .order("atualizado_em", { ascending: false })
    .limit(24);

  const ids = (sessoes ?? []).map((s) => s.id as string);
  if (!ids.length) return [];

  const q = query.toLowerCase();
  const { data: msgs } = await supabase
    .from("hub_crm_agente_briefing_mensagem")
    .select("sessao_id, papel, conteudo, criado_em")
    .in("sessao_id", ids)
    .ilike("conteudo", `%${query.replace(/[%_]/g, "")}%`)
    .order("criado_em", { ascending: false })
    .limit(limite * 3);

  return (msgs ?? [])
    .filter((m) => typeof m.conteudo === "string")
    .slice(0, limite)
    .map((m) => ({
      sessao_id: m.sessao_id as string,
      papel: String(m.papel ?? ""),
      trecho: String(m.conteudo).slice(0, 400),
      criado_em: m.criado_em as string | undefined,
    }));
}
