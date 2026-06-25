import { uazapiFetchJson } from "@/lib/whatsapp/uazapi-http";

export type UazapiRemoteDeleteResult =
  | { ok: true; deleted: boolean }
  | { ok: false; error: string };

export type UazapiInstanceRef = {
  instanceToken?: string | null;
  instanceId?: string | null;
  instanceName?: string | null;
};

function pickInstanceTokenFromAdminList(
  payload: unknown,
  ref: { instanceId?: string; instanceName?: string }
): string | null {
  const rows = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && Array.isArray((payload as { instances?: unknown }).instances)
      ? (payload as { instances: unknown[] }).instances
      : [];

  const idNeedle = ref.instanceId?.trim().toLowerCase() || "";
  const nameNeedle = ref.instanceName?.trim().toLowerCase() || "";

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const id = typeof r.id === "string" ? r.id.trim().toLowerCase() : "";
    const name = typeof r.name === "string" ? r.name.trim().toLowerCase() : "";
    const token = typeof r.token === "string" ? r.token.trim() : "";
    if (!token) continue;
    if (idNeedle && id === idNeedle) return token;
    if (nameNeedle && name === nameNeedle) return token;
  }
  return null;
}

async function deleteUazapiWithToken(token: string): Promise<UazapiRemoteDeleteResult> {
  const out = await uazapiFetchJson<Record<string, unknown>>("/instance", {
    method: "DELETE",
    instanceToken: token,
  });
  if (out.ok || out.status === 404) {
    return { ok: true, deleted: true };
  }
  return { ok: false, error: out.error };
}

/** Remove a instância no servidor UAZAPI (libera slot no plano). */
export async function deleteUazapiInstanceRemotely(
  instanceToken: string | null | undefined
): Promise<UazapiRemoteDeleteResult> {
  const token = instanceToken?.trim();
  if (!token) {
    return { ok: true, deleted: false };
  }
  return deleteUazapiWithToken(token);
}

/** Tenta apagar por token; se ausente, resolve token via admin (/instance/all) por id ou nome. */
export async function deleteUazapiInstanceForAgent(
  ref: UazapiInstanceRef
): Promise<UazapiRemoteDeleteResult> {
  const direct = ref.instanceToken?.trim();
  if (direct) {
    return deleteUazapiWithToken(direct);
  }

  const instanceId = ref.instanceId?.trim() || "";
  const instanceName = ref.instanceName?.trim() || "";
  if (!instanceId && !instanceName) {
    return { ok: true, deleted: false };
  }

  const list = await uazapiFetchJson<unknown>("/instance/all", { method: "GET", admin: true });
  if (!list.ok) {
    return { ok: false, error: list.error || "Falha ao listar instâncias UAZAPI (admin)." };
  }

  const resolved = pickInstanceTokenFromAdminList(list.data, { instanceId, instanceName });
  if (!resolved) {
    return { ok: true, deleted: false };
  }
  return deleteUazapiWithToken(resolved);
}
