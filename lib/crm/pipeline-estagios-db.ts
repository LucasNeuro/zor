import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingPgColumn } from "@/lib/tenant-default";

type UpdateResult = { data: unknown; error: { message: string; code?: string } | null };

/** PATCH em hub_pipeline_estagios — tolera DB sem coluna atualizado_em. */
export async function patchPipelineEstagio(
  supabase: SupabaseClient,
  pipelineId: string,
  slug: string,
  fields: Record<string, unknown>
): Promise<UpdateResult> {
  const withTs = { ...fields, atualizado_em: new Date().toISOString() };
  let res = await supabase
    .from("hub_pipeline_estagios")
    .update(withTs)
    .eq("pipeline_id", pipelineId)
    .eq("slug", slug)
    .select()
    .maybeSingle();

  if (res.error && isMissingPgColumn(res.error, "atualizado_em")) {
    res = await supabase
      .from("hub_pipeline_estagios")
      .update(fields)
      .eq("pipeline_id", pipelineId)
      .eq("slug", slug)
      .select()
      .maybeSingle();
  }

  return res;
}

export async function patchPipelineEstagioOrdem(
  supabase: SupabaseClient,
  pipelineId: string,
  slug: string,
  ordem: number
): Promise<{ error: { message: string; code?: string } | null }> {
  let res = await supabase
    .from("hub_pipeline_estagios")
    .update({ ordem, atualizado_em: new Date().toISOString() })
    .eq("pipeline_id", pipelineId)
    .eq("slug", slug);

  if (res.error && isMissingPgColumn(res.error, "atualizado_em")) {
    res = await supabase
      .from("hub_pipeline_estagios")
      .update({ ordem })
      .eq("pipeline_id", pipelineId)
      .eq("slug", slug);
  }

  return { error: res.error };
}
