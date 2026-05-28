import { internalApiHeaders } from "@/lib/internal-api-headers";

export type PatchLeadResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; error: string; status: number };

export async function patchLeadCrm(
  leadId: string,
  body: Record<string, unknown> & { _estagio_anterior?: string }
): Promise<PatchLeadResult> {
  const res = await fetch(`/api/crm/leads/${encodeURIComponent(leadId)}`, {
    method: "PATCH",
    credentials: "include",
    headers: { ...internalApiHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = typeof json?.error === "string" ? json.error : `Erro ${res.status}`;
    return { ok: false, error: err, status: res.status };
  }
  return { ok: true, data: (json.data ?? json) as Record<string, unknown> };
}
