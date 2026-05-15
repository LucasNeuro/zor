import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentPlaybookSnapshotV1 } from "./agent-snapshot";
import { renderDeterministicPlaybookMd } from "./render-deterministic";
import { mistralGenerateAgnoAppendix } from "./mistral-appendix";

export const PLAYBOOK_BUCKET = "hub-agent-playbooks";

export function playbookObjectPath(tenantId: string | null | undefined, agenteSlug: string): string {
  const t = (tenantId && String(tenantId).trim()) || "default";
  const safeSlug = agenteSlug.replace(/[^a-z0-9_-]/gi, "_").slice(0, 80);
  return `${t}/${safeSlug}.md`;
}

export async function generateUploadAndLinkPlaybook(
  supabase: SupabaseClient,
  agenteSlug: string,
  snapshot: AgentPlaybookSnapshotV1,
  sourceHash: string
): Promise<
  | { ok: true; path: string; publicUrl: string; hash: string; mistral_appendix: boolean }
  | { ok: false; error: string }
> {
  const id = snapshot.identity;
  const nome = id ? String(id.nome ?? agenteSlug) : agenteSlug;
  const tenantId = id ? (id.tenant_id as string | undefined) : undefined;

  let bodyMd = renderDeterministicPlaybookMd(snapshot, sourceHash);
  let mistralUsed = false;

  const appendix = await mistralGenerateAgnoAppendix(bodyMd, nome, agenteSlug);
  if (appendix) {
    mistralUsed = true;
    bodyMd += "\n\n<!-- AGNO_APPENDIX_START -->\n\n" + appendix.replace(/^\s*<!-- AGNO_APPENDIX_START -->\s*/i, "");
  } else {
    bodyMd +=
      "\n\n<!-- AGNO_APPENDIX_START -->\n\n## Apêndice Agno (AgentOS / SDK)\n\n" +
      "*Configure `MISTRAL_API_KEY` no servidor para gerar este apêndice automaticamente.* " +
      "Ver [Build your first agent](https://docs.agno.com/first-agent). " +
      "Use o corpo deste ficheiro como base de `instructions` num `agno.agent.Agent`, sem contradizer JSON e listas literais acima.\n";
  }

  const path = playbookObjectPath(tenantId, agenteSlug);
  const buf = Buffer.from(bodyMd, "utf8");

  // Tem de coincidir com `allowed_mime_types` do bucket (ver migração); variantes com charset falhavam o upload.
  const { error: upErr } = await supabase.storage.from(PLAYBOOK_BUCKET).upload(path, buf, {
    contentType: "text/markdown",
    upsert: true,
  });

  if (upErr) {
    console.error("[playbook] upload falhou", { bucket: PLAYBOOK_BUCKET, path, message: upErr.message });
    return { ok: false, error: upErr.message };
  }

  console.info("[playbook] upload OK", PLAYBOOK_BUCKET, path);

  const { data: pub } = supabase.storage.from(PLAYBOOK_BUCKET).getPublicUrl(path);
  const publicUrl = pub.publicUrl;

  const { error: dbErr } = await supabase
    .from("hub_agente_identidade")
    .update({
      playbook_object_path: path,
      playbook_public_url: publicUrl,
      playbook_generated_at: new Date().toISOString(),
      playbook_source_hash: sourceHash,
    })
    .eq("agente_slug", agenteSlug);

  if (dbErr) {
    console.error("[playbook] hub update", dbErr);
    return { ok: false, error: dbErr.message };
  }

  return { ok: true, path, publicUrl, hash: sourceHash, mistral_appendix: mistralUsed };
}
