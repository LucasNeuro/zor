import { uazapiFetchJson } from "@/lib/whatsapp/uazapi-http";

export type UazapiRemoteDeleteResult =
  | { ok: true; deleted: boolean }
  | { ok: false; error: string };

/** Remove a instância no servidor UAZAPI (libera slot no plano). */
export async function deleteUazapiInstanceRemotely(
  instanceToken: string | null | undefined
): Promise<UazapiRemoteDeleteResult> {
  const token = instanceToken?.trim();
  if (!token) {
    return { ok: true, deleted: false };
  }

  const out = await uazapiFetchJson<Record<string, unknown>>("/instance", {
    method: "DELETE",
    instanceToken: token,
  });

  if (out.ok || out.status === 404) {
    return { ok: true, deleted: true };
  }

  return { ok: false, error: out.error };
}
