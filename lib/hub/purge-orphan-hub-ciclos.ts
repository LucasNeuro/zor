import type { SupabaseClient } from "@supabase/supabase-js";

type PurgeRpcResult = { ok?: boolean; deleted?: number; error?: string };

/** Remove ciclos cujo agente já não existe (limpeza pós-exclusão incompleta). */
export async function purgeOrphanHubCiclos(
  supabase: SupabaseClient
): Promise<{ deleted: number; error?: string }> {
  const { data, error } = await supabase.rpc("hub_purge_orphan_ciclos");
  if (error) {
    if (/hub_purge_orphan_ciclos|PGRST202|42883|function.*does not exist/i.test(error.message)) {
      return purgeOrphanHubCiclosFallback(supabase);
    }
    return { deleted: 0, error: error.message };
  }

  const row = data as PurgeRpcResult | null;
  if (row?.ok === false) {
    return { deleted: 0, error: typeof row.error === "string" ? row.error : "Falha ao limpar ciclos órfãos." };
  }
  return { deleted: Number(row?.deleted) || 0 };
}

async function purgeOrphanHubCiclosFallback(
  supabase: SupabaseClient
): Promise<{ deleted: number; error?: string }> {
  const { data: agentes, error: agErr } = await supabase.from("hub_agente_identidade").select("agente_slug");
  if (agErr) return { deleted: 0, error: agErr.message };

  const slugs = new Set(
    (agentes ?? [])
      .map((r) => (typeof r.agente_slug === "string" ? r.agente_slug.trim() : ""))
      .filter(Boolean)
  );

  const { data: ciclos, error: cErr } = await supabase.from("hub_ciclos_ia").select("id, agente_slug");
  if (cErr) return { deleted: 0, error: cErr.message };

  const orphanIds = (ciclos ?? [])
    .filter((c) => {
      const slug = typeof c.agente_slug === "string" ? c.agente_slug.trim() : "";
      return slug && !slugs.has(slug);
    })
    .map((c) => c.id as string);

  if (orphanIds.length === 0) return { deleted: 0 };

  await supabase.from("hub_ciclos_log").delete().in("ciclo_id", orphanIds);
  const { error: delErr } = await supabase.from("hub_ciclos_ia").delete().in("id", orphanIds);
  if (delErr) return { deleted: 0, error: delErr.message };
  return { deleted: orphanIds.length };
}
