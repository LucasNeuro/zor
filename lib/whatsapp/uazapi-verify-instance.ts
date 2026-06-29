import { uazapiFetchJson } from "@/lib/whatsapp/uazapi-http";
import { pickInstanceFromResponse } from "@/lib/whatsapp/uazapi-instance-status";

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
  if (payload && typeof payload === "object" && Array.isArray((payload as { data?: unknown }).data)) {
    return ((payload as { data: unknown[] }).data ?? []).filter(
      (r) => r && typeof r === "object"
    ) as Record<string, unknown>[];
  }
  return [];
}

function rowNome(r: Record<string, unknown>): string {
  if (typeof r.name === "string" && r.name.trim()) return r.name.trim();
  if (typeof r.instanceName === "string" && r.instanceName.trim()) return r.instanceName.trim();
  return "";
}

function rowId(r: Record<string, unknown>): string {
  if (typeof r.id === "string" && r.id.trim()) return r.id.trim();
  if (typeof r._id === "string" && r._id.trim()) return r._id.trim();
  return "";
}

function rowToken(r: Record<string, unknown>): string {
  if (typeof r.token === "string" && r.token.trim()) return r.token.trim();
  return "";
}

/** Confirma existência via token da instância (mais fiável que listar todas). */
async function verificarPorTokenInstancia(
  token: string
): Promise<{ ok: true; encontrada: boolean; nome?: string; id?: string } | { ok: false; error: string }> {
  const st = await uazapiFetchJson<Record<string, unknown>>("/instance/status", {
    method: "GET",
    instanceToken: token,
  });
  if (st.ok) {
    const inst = pickInstanceFromResponse(st.data);
    return {
      ok: true,
      encontrada: true,
      nome: inst && typeof inst.name === "string" ? inst.name.trim() : undefined,
      id: inst && typeof inst.id === "string" ? inst.id.trim() : undefined,
    };
  }
  if (st.status === 404 || st.status === 401) {
    return { ok: true, encontrada: false };
  }
  return { ok: false, error: st.error || "Falha ao validar instância no servidor WhatsApp." };
}

/** Lista admin — o que o painel UAZAPI mostra. */
export async function instanciaNaListaAdminUazapi(
  ref: UazapiInstanceRef
): Promise<{ ok: true; encontrada: boolean; nome?: string; id?: string; token?: string } | { ok: false; error: string }> {
  const list = await uazapiFetchJson<unknown>("/instance/all", { method: "GET", admin: true });
  if (!list.ok) {
    return { ok: false, error: list.error || "Falha ao listar instâncias no servidor WhatsApp." };
  }

  const rows = parseInstanceRows(list.data);
  const idNeedle = ref.instanceId?.trim().toLowerCase() || "";
  const nameNeedle = ref.instanceName?.trim().toLowerCase() || "";
  const tokenNeedle = ref.instanceToken?.trim() || "";

  for (const r of rows) {
    const id = rowId(r);
    const name = rowNome(r);
    const token = rowToken(r);
    const match =
      (idNeedle && id.toLowerCase() === idNeedle) ||
      (nameNeedle && name.toLowerCase() === nameNeedle) ||
      (tokenNeedle && token === tokenNeedle);
    if (match) {
      return {
        ok: true,
        encontrada: true,
        nome: name || undefined,
        id: id || undefined,
        token: token || undefined,
      };
    }
  }

  return { ok: true, encontrada: false };
}

/** Confirma se a instância existe no painel UAZAPI (lista admin + fallback por token). */
export async function verificarInstanciaNoUazapi(
  ref: UazapiInstanceRef
): Promise<{ ok: true; encontrada: boolean; nome?: string; id?: string } | { ok: false; error: string }> {
  const naLista = await instanciaNaListaAdminUazapi(ref);
  if (!naLista.ok) return naLista;
  if (naLista.encontrada) {
    return { ok: true, encontrada: true, nome: naLista.nome, id: naLista.id };
  }

  const tokenNeedle = ref.instanceToken?.trim() || "";
  if (!tokenNeedle) {
    return { ok: true, encontrada: false };
  }

  const porToken = await verificarPorTokenInstancia(tokenNeedle);
  if (!porToken.ok) return porToken;
  return porToken;
}

export function nomeInstanciaGestorUazapi(tenantId: string): string {
  const short = tenantId.replace(/-/g, "").slice(0, 8).toLowerCase();
  return `waje-gestor-${short}`.slice(0, 80);
}

export function instanciaGestorNomeValido(
  nomeInstancia: string | null | undefined,
  tenantId: string
): boolean {
  const expected = nomeInstanciaGestorUazapi(tenantId).toLowerCase();
  const got = (nomeInstancia || "").trim().toLowerCase();
  return Boolean(got) && got === expected;
}
