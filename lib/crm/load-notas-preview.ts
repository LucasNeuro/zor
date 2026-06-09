import type { SupabaseClient } from "@supabase/supabase-js";
import type { NotaPreview } from "@/components/crm/CrmKanbanNotesSection";

const MAX_PER_ENTITY = 3;

/** Carrega as notas mais recentes por lead_id ou negocio_id. */
export async function loadNotasPreviewMap(
  supabase: SupabaseClient,
  opts: { leadIds?: string[]; negocioIds?: string[] }
): Promise<Map<string, NotaPreview[]>> {
  const map = new Map<string, NotaPreview[]>();
  const leadIds = opts.leadIds?.filter(Boolean) ?? [];
  const negocioIds = opts.negocioIds?.filter(Boolean) ?? [];

  if (!leadIds.length && !negocioIds.length) return map;

  const queries = [];
  if (leadIds.length) {
    queries.push(
      supabase
        .from("hub_notas")
        .select("id, lead_id, conteudo, criado_por, criado_em")
        .in("lead_id", leadIds)
        .order("criado_em", { ascending: false })
    );
  }
  if (negocioIds.length) {
    queries.push(
      supabase
        .from("hub_notas")
        .select("id, negocio_id, conteudo, criado_por, criado_em")
        .in("negocio_id", negocioIds)
        .order("criado_em", { ascending: false })
    );
  }

  const results = await Promise.all(queries);

  for (const { data } of results) {
    for (const row of data || []) {
      const r = row as Record<string, unknown>;
      const key =
        r.lead_id != null
          ? `lead:${String(r.lead_id)}`
          : r.negocio_id != null
            ? `negocio:${String(r.negocio_id)}`
            : null;
      if (!key) continue;
      const list = map.get(key) ?? [];
      if (list.length >= MAX_PER_ENTITY) continue;
      list.push({
        id: String(r.id),
        conteudo: String(r.conteudo ?? ""),
        criado_por: r.criado_por != null ? String(r.criado_por) : undefined,
        criado_em: r.criado_em != null ? String(r.criado_em) : undefined,
      });
      map.set(key, list);
    }
  }

  return map;
}

export function notasParaLead(map: Map<string, NotaPreview[]>, leadId: string): NotaPreview[] {
  return map.get(`lead:${leadId}`) ?? [];
}

export function notasParaNegocio(map: Map<string, NotaPreview[]>, negocioId: string): NotaPreview[] {
  return map.get(`negocio:${negocioId}`) ?? [];
}
