import type { SupabaseClient } from "@supabase/supabase-js";
import { apagarStorageRagAgente } from "@/lib/hub/delete-agente-rag-storage";
import { PLAYBOOK_BUCKET, playbookAgentFolderPath, playbookObjectPath } from "@/lib/playbook/persist";

function ignorable(msg: string): boolean {
  return /does not exist|schema cache/i.test(msg);
}

type RpcDeleteAgenteResult = { ok?: boolean; error?: string };

/** Apaga satélites do agente + identidade via RPC; depois Storage (playbook + RAG). */
export async function deleteAgenteHubCompleto(
  supabase: SupabaseClient,
  slug: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: ident, error: identErr } = await supabase
    .from("hub_agente_identidade")
    .select("id, agente_slug, tenant_id, playbook_object_path")
    .eq("agente_slug", slug)
    .maybeSingle();

  if (identErr && !ignorable(identErr.message)) {
    return { ok: false, error: identErr.message };
  }
  if (!ident) {
    return { ok: false, error: "Agente não encontrado" };
  }

  const tenantId = ident.tenant_id != null ? String(ident.tenant_id) : null;

  const ragPaths: string[] = [];
  const { data: ragDocs } = await supabase
    .from("hub_agente_rag_documentos")
    .select("object_path")
    .eq("agente_slug", slug);
  if (Array.isArray(ragDocs)) {
    for (const d of ragDocs) {
      if (typeof d.object_path === "string" && d.object_path.trim()) {
        ragPaths.push(d.object_path.trim());
      }
    }
  }

  const paths = new Set<string>();
  if (ident.playbook_object_path) paths.add(String(ident.playbook_object_path).trim());
  paths.add(playbookObjectPath(tenantId, slug));
  paths.add(playbookObjectPath(null, slug));
  const folderCandidates = [
    playbookAgentFolderPath(tenantId, slug),
    playbookAgentFolderPath(null, slug),
  ];
  for (const folder of folderCandidates) {
    const listed = await supabase.storage.from(PLAYBOOK_BUCKET).list(folder, { limit: 100 });
    if (listed.error && !ignorable(listed.error.message)) {
      console.warn("[agente-delete] list pasta playbook", folder, listed.error.message);
      continue;
    }
    for (const item of listed.data || []) {
      const name = String(item.name || "").trim();
      if (!name) continue;
      paths.add(`${folder}/${name}`);
    }
  }

  const { data: rpcRaw, error: rpcErr } = await supabase.rpc("hub_delete_agente_cascade", {
    p_agente_slug: slug,
  });

  if (rpcErr) {
    return { ok: false, error: rpcErr.message };
  }

  const rpcData = rpcRaw as RpcDeleteAgenteResult | null;
  if (!rpcData || rpcData.ok !== true) {
    return {
      ok: false,
      error: typeof rpcData?.error === "string" ? rpcData.error : "Falha ao apagar agente no banco.",
    };
  }

  await apagarStorageRagAgente(supabase, slug, ragPaths);

  for (const p of paths) {
    if (!p) continue;
    const { error: stErr } = await supabase.storage.from(PLAYBOOK_BUCKET).remove([p]);
    if (stErr && !ignorable(stErr.message)) {
      console.warn("[agente-delete] storage playbook", p, stErr.message);
    }
  }

  return { ok: true };
}
