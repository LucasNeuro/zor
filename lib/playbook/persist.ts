import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentPlaybookSnapshotV1 } from "./agent-snapshot";
import { renderDeterministicPlaybookMd } from "./render-deterministic";
import { mistralGenerateAgnoAppendix } from "./mistral-appendix";

export const PLAYBOOK_BUCKET = "hub-agent-playbooks";

export function safePlaybookSlug(agenteSlug: string): string {
  return agenteSlug.replace(/[^a-z0-9_-]/gi, "_").slice(0, 80);
}

export function playbookAgentFolderPath(
  tenantId: string | null | undefined,
  agenteSlug: string
): string {
  const t = (tenantId && String(tenantId).trim()) || "default";
  return `${t}/${safePlaybookSlug(agenteSlug)}`;
}

export function playbookObjectPath(tenantId: string | null | undefined, agenteSlug: string): string {
  return `${playbookAgentFolderPath(tenantId, agenteSlug)}/playbook.md`;
}

function isIgnorableStorageError(message: string): boolean {
  return /not found|does not exist|no such object|schema cache/i.test(message);
}

async function removeStoragePaths(
  supabase: SupabaseClient,
  paths: string[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  const uniq = Array.from(new Set(paths.map((p) => String(p || "").trim()).filter(Boolean)));
  if (!uniq.length) return { ok: true };
  const { error } = await supabase.storage.from(PLAYBOOK_BUCKET).remove(uniq);
  if (!error || isIgnorableStorageError(error.message)) return { ok: true };
  return { ok: false, error: error.message };
}

export async function cleanupPlaybookFolderForAgent(
  supabase: SupabaseClient,
  tenantId: string | null | undefined,
  agenteSlug: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const folder = playbookAgentFolderPath(tenantId, agenteSlug);
  const list = await supabase.storage.from(PLAYBOOK_BUCKET).list(folder, { limit: 100 });
  if (list.error) {
    if (isIgnorableStorageError(list.error.message)) return { ok: true };
    return { ok: false, error: list.error.message };
  }
  const names = (list.data || [])
    .map((f) => String((f as { name?: string }).name || "").trim())
    .filter(Boolean);
  const fullPaths = names.map((n) => `${folder}/${n}`);
  return removeStoragePaths(supabase, fullPaths);
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

  const cleanup = await cleanupPlaybookFolderForAgent(supabase, tenantId, agenteSlug);
  if (!cleanup.ok) {
    console.warn("[playbook] cleanup folder falhou", { bucket: PLAYBOOK_BUCKET, path, error: cleanup.error });
  }

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
