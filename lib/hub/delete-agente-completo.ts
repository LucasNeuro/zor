import type { SupabaseClient } from "@supabase/supabase-js";
import { invalidateTenantCachePrefix } from "@/lib/cache/tenant-cache";
import { apagarStorageRagAgente } from "@/lib/hub/delete-agente-rag-storage";
import { purgeOrphanHubCiclos } from "@/lib/hub/purge-orphan-hub-ciclos";
import { PLAYBOOK_BUCKET, playbookAgentFolderPath, playbookObjectPath } from "@/lib/playbook/persist";
import { deleteUazapiInstanceForAgent } from "@/lib/whatsapp/uazapi-delete-instance";
import { uazapiFetchJson } from "@/lib/whatsapp/uazapi-http";

function ignorable(msg: string): boolean {
  return /does not exist|schema cache|could not find/i.test(msg);
}

type RpcDeleteAgenteResult = { ok?: boolean; error?: string };

type IdentRow = {
  id: string;
  agente_slug?: string;
  tenant_id?: string | null;
  playbook_object_path?: string | null;
  uazapi_instance_token?: string | null;
  uazapi_instance_id?: string | null;
  uazapi_instance_name?: string | null;
};

/** Carrega identidade com colunas mínimas — evita falso 404 quando migrações antigas faltam colunas. */
async function carregarIdentidadeAgente(
  supabase: SupabaseClient,
  slug: string
): Promise<{ row: IdentRow | null; error: string | null }> {
  const selects = [
    "id, agente_slug, tenant_id, playbook_object_path, uazapi_instance_token, uazapi_instance_id, uazapi_instance_name",
    "id, agente_slug, tenant_id, playbook_object_path, uazapi_instance_token",
    "id, agente_slug, tenant_id, playbook_object_path",
    "id, agente_slug, tenant_id",
    "id, agente_slug",
    "*",
  ];

  let lastErr: string | null = null;
  for (const cols of selects) {
    const { data, error } = await supabase
      .from("hub_agente_identidade")
      .select(cols)
      .eq("agente_slug", slug)
      .maybeSingle();

    if (error) {
      lastErr = error.message;
      if (ignorable(error.message)) continue;
      return { row: null, error: error.message };
    }
    if (data) {
      const row = data as unknown as IdentRow;
      if (typeof row.id === "string") {
        return { row, error: null };
      }
    }
  }

  if (lastErr) {
    return { row: null, error: lastErr };
  }
  return { row: null, error: null };
}

function erroRpcNaoInstalado(msg: string): boolean {
  return /hub_delete_agente_cascade|PGRST202|42883|function.*does not exist/i.test(msg);
}

async function apagarFollowupStorageAgente(
  supabase: SupabaseClient,
  tenantId: string | null,
  slug: string
): Promise<void> {
  const prefixes = [
    tenantId ? `${tenantId}/${slug}` : null,
    slug,
  ].filter((p): p is string => Boolean(p));

  for (const prefix of prefixes) {
    const listed = await supabase.storage.from("agent-followup").list(prefix, { limit: 200 });
    if (listed.error && !ignorable(listed.error.message)) {
      console.warn("[agente-delete] list followup storage", prefix, listed.error.message);
      continue;
    }
    const paths = (listed.data || [])
      .map((item) => {
        const name = String(item.name || "").trim();
        return name ? `${prefix}/${name}` : "";
      })
      .filter(Boolean);
    if (paths.length > 0) {
      const { error } = await supabase.storage.from("agent-followup").remove(paths);
      if (error && !ignorable(error.message)) {
        console.warn("[agente-delete] remove followup storage", error.message);
      }
    }
  }
}

/** Apaga satélites do agente + identidade via RPC; depois Storage (playbook + RAG). */
export async function deleteAgenteHubCompleto(
  supabase: SupabaseClient,
  slug: string
): Promise<
  | { ok: true; uazapi_remote_deleted?: boolean; uazapi_delete_warning?: string }
  | { ok: false; error: string }
> {
  const trimmed = slug.trim();
  if (!trimmed) {
    return { ok: false, error: "agente_slug inválido" };
  }

  const { row: ident, error: identLoadErr } = await carregarIdentidadeAgente(supabase, trimmed);

  if (identLoadErr) {
    return { ok: false, error: identLoadErr };
  }
  if (!ident) {
    return { ok: false, error: "Agente não encontrado" };
  }

  const tenantId = ident.tenant_id != null ? String(ident.tenant_id) : null;

  let uazapiRemoteDeleted = false;
  let uazapiDeleteWarning: string | undefined;

  const tokenInst =
    typeof ident.uazapi_instance_token === "string" ? ident.uazapi_instance_token.trim() : "";
  if (tokenInst) {
    const disc = await uazapiFetchJson<Record<string, unknown>>("/instance/disconnect", {
      method: "POST",
      instanceToken: tokenInst,
    });
    if (!disc.ok) {
      console.warn("[agente-delete] uazapi disconnect", trimmed, disc.error);
    }
  }

  const uazapiDel = await deleteUazapiInstanceForAgent({
    instanceToken: ident.uazapi_instance_token,
    instanceId: ident.uazapi_instance_id,
    instanceName: ident.uazapi_instance_name,
  });
  if (uazapiDel.ok) {
    uazapiRemoteDeleted = uazapiDel.deleted;
  } else {
    uazapiDeleteWarning = uazapiDel.error;
    console.warn("[agente-delete] uazapi instance", trimmed, uazapiDel.error);
  }

  const ragPaths: string[] = [];
  const { data: ragDocs, error: ragErr } = await supabase
    .from("hub_agente_rag_documentos")
    .select("object_path")
    .eq("agente_slug", trimmed);

  if (ragErr && !ignorable(ragErr.message)) {
    console.warn("[agente-delete] rag documentos", ragErr.message);
  } else if (Array.isArray(ragDocs)) {
    for (const d of ragDocs) {
      if (typeof d.object_path === "string" && d.object_path.trim()) {
        ragPaths.push(d.object_path.trim());
      }
    }
  }

  const paths = new Set<string>();
  if (ident.playbook_object_path) paths.add(String(ident.playbook_object_path).trim());
  paths.add(playbookObjectPath(tenantId, trimmed));
  paths.add(playbookObjectPath(null, trimmed));
  const folderCandidates = [
    playbookAgentFolderPath(tenantId, trimmed),
    playbookAgentFolderPath(null, trimmed),
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
    p_agente_slug: trimmed,
  });

  if (rpcErr) {
    if (erroRpcNaoInstalado(rpcErr.message)) {
      return {
        ok: false,
        error:
          "Exclusão em cascata não está instalada no Supabase. Aplique a migração 20260724120000_hub_delete_agente_cascade_v3.sql e tente novamente.",
      };
    }
    return { ok: false, error: rpcErr.message };
  }

  const rpcData = rpcRaw as RpcDeleteAgenteResult | null;
  if (!rpcData || rpcData.ok !== true) {
    const rpcMsg = typeof rpcData?.error === "string" ? rpcData.error : "Falha ao apagar agente no banco.";
    if (erroRpcNaoInstalado(rpcMsg)) {
      return {
        ok: false,
        error:
          "Exclusão em cascata não está instalada no Supabase. Aplique a migração 20260724120000_hub_delete_agente_cascade_v3.sql e tente novamente.",
      };
    }
    return { ok: false, error: rpcMsg };
  }

  await apagarStorageRagAgente(supabase, trimmed, ragPaths);
  await apagarFollowupStorageAgente(supabase, tenantId, trimmed);

  for (const p of paths) {
    if (!p) continue;
    const { error: stErr } = await supabase.storage.from(PLAYBOOK_BUCKET).remove([p]);
    if (stErr && !ignorable(stErr.message)) {
      console.warn("[agente-delete] storage playbook", p, stErr.message);
    }
  }

  if (tenantId) {
    await invalidateTenantCachePrefix(tenantId, "agentes:");
  }
  await purgeOrphanHubCiclos(supabase);

  return {
    ok: true,
    ...(uazapiRemoteDeleted ? { uazapi_remote_deleted: true } : {}),
    ...(uazapiDeleteWarning ? { uazapi_delete_warning: uazapiDeleteWarning } : {}),
  };
}
