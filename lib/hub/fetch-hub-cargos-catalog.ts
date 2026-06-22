import { hubApiHeaders } from "@/lib/internal-api-headers-client";

/** Linha típica de `hub_cargos_catalogo` no cliente — campos opcionais. */
export type HubCargoCatalogRow = Record<string, unknown> & { slug?: string };

export async function fetchHubCargosCatalog(): Promise<
  { ok: true; cargos: HubCargoCatalogRow[] } | { ok: false; error: string }
> {
  const r = await fetch("/api/hub/cargos?all=true", {
    headers: await hubApiHeaders(),
    credentials: "same-origin",
  });
  const data = (await r.json().catch(() => ({}))) as unknown;
  if (!r.ok) {
    const msg =
      data && typeof data === "object" && "error" in data && typeof (data as { error?: unknown }).error === "string"
        ? (data as { error: string }).error
        : `Erro ${r.status}`;
    return { ok: false, error: msg };
  }
  if (Array.isArray(data)) return { ok: true, cargos: data as HubCargoCatalogRow[] };
  if (
    data &&
    typeof data === "object" &&
    "cargos" in data &&
    Array.isArray((data as { cargos?: unknown }).cargos)
  ) {
    return { ok: true, cargos: (data as { cargos: HubCargoCatalogRow[] }).cargos };
  }
  return { ok: false, error: "Resposta inesperada ao carregar cargos." };
}
