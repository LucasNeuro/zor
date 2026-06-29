import { uazapiFetchJson } from "@/lib/whatsapp/uazapi-http";

export type UazapiInstanceRef = {
  instanceToken?: string | null;
  instanceId?: string | null;
  instanceName?: string | null;
};

function parseInstanceRows(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload.filter((r) => r && typeof r === "object") as Record<string, unknown>[];
  if (payload && typeof payload === "object" && Array.isArray((payload as { instances?: unknown }).instances)) {
    return ((payload as { instances: unknown[] }).instances ?? []).filter(
      (r) => r && typeof r === "object"
    ) as Record<string, unknown>[];
  }
  return [];
}

/** Confirma se a instância existe no painel UAZAPI (GET /instance/all admin). */
export async function verificarInstanciaNoUazapi(
  ref: UazapiInstanceRef
): Promise<{ ok: true; encontrada: boolean; nome?: string; id?: string } | { ok: false; error: string }> {
  const list = await uazapiFetchJson<unknown>("/instance/all", { method: "GET", admin: true });
  if (!list.ok) {
    return { ok: false, error: list.error || "Falha ao listar instâncias UAZAPI." };
  }

  const rows = parseInstanceRows(list.data);
  const idNeedle = ref.instanceId?.trim().toLowerCase() || "";
  const nameNeedle = ref.instanceName?.trim().toLowerCase() || "";
  const tokenNeedle = ref.instanceToken?.trim() || "";

  for (const r of rows) {
    const id = typeof r.id === "string" ? r.id.trim() : "";
    const name = typeof r.name === "string" ? r.name.trim() : "";
    const token = typeof r.token === "string" ? r.token.trim() : "";
    const match =
      (idNeedle && id.toLowerCase() === idNeedle) ||
      (nameNeedle && name.toLowerCase() === nameNeedle) ||
      (tokenNeedle && token === tokenNeedle);
    if (match) {
      return { ok: true, encontrada: true, nome: name || undefined, id: id || undefined };
    }
  }

  return { ok: true, encontrada: false };
}

export function nomeInstanciaGestorUazapi(tenantId: string): string {
  const short = tenantId.replace(/-/g, "").slice(0, 8).toLowerCase();
  return `waje-gestor-${short}`.slice(0, 80);
}
