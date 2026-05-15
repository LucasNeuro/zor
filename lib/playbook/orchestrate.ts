import type { SupabaseClient } from "@supabase/supabase-js";
import { loadAgentPlaybookSnapshot } from "./agent-snapshot";
import { generateUploadAndLinkPlaybook } from "./persist";

export async function runPlaybookPipeline(
  supabase: SupabaseClient,
  agenteSlug: string
): Promise<
  | { ok: true; path: string; publicUrl: string; hash: string; mistral_appendix: boolean }
  | { ok: false; error: string }
> {
  const loaded = await loadAgentPlaybookSnapshot(supabase, agenteSlug);
  if ("error" in loaded) return { ok: false, error: loaded.error };
  return generateUploadAndLinkPlaybook(supabase, agenteSlug, loaded.snapshot, loaded.hash);
}
