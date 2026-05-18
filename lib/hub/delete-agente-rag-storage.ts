import type { SupabaseClient } from "@supabase/supabase-js";
import { RAG_BUCKET } from "@/lib/hub/rag";

function ignorable(msg: string): boolean {
  return /does not exist|schema cache|not found/i.test(msg);
}

/** Remove ficheiros RAG do Storage antes/depois do DELETE no banco (paths conhecidos). */
export async function apagarStorageRagAgente(
  supabase: SupabaseClient,
  agenteSlug: string,
  objectPaths?: string[]
): Promise<void> {
  const paths = new Set<string>();
  for (const p of objectPaths ?? []) {
    const t = p?.trim();
    if (t) paths.add(t);
  }

  const { data: docs, error } = await supabase
    .from("hub_agente_rag_documentos")
    .select("bucket_id, object_path")
    .eq("agente_slug", agenteSlug);

  if (!error && Array.isArray(docs)) {
    for (const d of docs) {
      const path = typeof d.object_path === "string" ? d.object_path.trim() : "";
      if (path) paths.add(path);
    }
  } else if (error && !ignorable(error.message)) {
    console.warn("[agente-delete] listar RAG DB:", error.message);
  }

  const buckets = new Map<string, string[]>();
  for (const path of paths) {
    const bucket = RAG_BUCKET;
    const list = buckets.get(bucket) ?? [];
    list.push(path);
    buckets.set(bucket, list);
  }

  for (const [bucket, list] of buckets) {
    if (!list.length) continue;
    const { error: stErr } = await supabase.storage.from(bucket).remove(list);
    if (stErr && !ignorable(stErr.message)) {
      console.warn("[agente-delete] storage RAG", bucket, stErr.message);
    }
  }
}
