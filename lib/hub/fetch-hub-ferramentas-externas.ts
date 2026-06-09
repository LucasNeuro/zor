/** Cliente: ferramentas externas (HTTP via integração) do tenant. */

export type HubFerramentaExternaMetodo = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type HubFerramentaExternaPolitica = "leitura" | "escrita";

export type HubFerramentaExternaRow = {
  id: string;
  tenant_id?: string;
  ferramenta_key: string;
  titulo: string;
  descricao_curta?: string | null;
  descricao_modelo: string;
  integracao_id: string;
  metodo_http: HubFerramentaExternaMetodo;
  url_template: string;
  headers_template?: Record<string, string> | null;
  body_template?: string | null;
  parametros_schema: Record<string, unknown>;
  politica: HubFerramentaExternaPolitica;
  ativo: boolean;
  criado_em?: string;
  atualizado_em?: string;
};

export type ConexaoInlineClientPayload = {
  tipo_auth: "none" | "api_key" | "bearer";
  bearer_token?: string | null;
  api_key?: string | null;
  api_key_header?: string | null;
  allowed_hosts?: string[] | string | null;
};

export type HubFerramentaExternaPayload = {
  titulo: string;
  slug_curto?: string;
  descricao_curta?: string | null;
  descricao_modelo: string;
  /** UUID hub_integracoes (opcional se enviar conexao). */
  integracao_id?: string;
  integracao_row_id?: string;
  conexao?: ConexaoInlineClientPayload;
  metodo_http: HubFerramentaExternaMetodo;
  url_template: string;
  headers_template?: Record<string, string> | null;
  body_template?: string | null;
  parametros_schema?: Record<string, unknown>;
  politica?: HubFerramentaExternaPolitica;
  ativo?: boolean;
};

export const DEFAULT_PARAMETROS_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {},
  required: [],
  additionalProperties: false,
};

function parseList(data: unknown): HubFerramentaExternaRow[] {
  if (Array.isArray(data)) return data as HubFerramentaExternaRow[];
  if (data && typeof data === "object" && Array.isArray((data as { ferramentas?: unknown }).ferramentas)) {
    return (data as { ferramentas: HubFerramentaExternaRow[] }).ferramentas;
  }
  return [];
}

function parseError(data: unknown, fallback: string): string {
  if (data && typeof data === "object" && "error" in data && typeof (data as { error?: string }).error === "string") {
    return (data as { error: string }).error;
  }
  return fallback;
}

export function slugifyFerramentaExternaSlug(raw: string): string {
  const s = raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 48);
  return s;
}

export function ferramentaKeyExternaFromSlug(slugCurto: string): string {
  const s = slugifyFerramentaExternaSlug(slugCurto);
  if (s.length < 2) return "";
  return `hub_ext_${s}`;
}

export function slugCurtoFromExternaKey(key: string): string {
  const k = String(key || "");
  return k.startsWith("hub_ext_") ? k.slice("hub_ext_".length) : k;
}

export async function fetchHubFerramentasExternas(headers: HeadersInit, all = false): Promise<HubFerramentaExternaRow[]> {
  const q = all ? "?all=true" : "";
  const res = await fetch(`/api/hub/ferramentas-externas${q}`, { headers });
  const data: unknown = await res.json().catch(() => null);
  if (res.status === 404) return [];
  if (!res.ok) {
    throw new Error(parseError(data, "Falha ao carregar ferramentas externas."));
  }
  return parseList(data);
}

export async function saveHubFerramentaExterna(
  headers: HeadersInit,
  payload: HubFerramentaExternaPayload,
  id?: string | null
): Promise<HubFerramentaExternaRow> {
  const url = id ? `/api/hub/ferramentas-externas/${encodeURIComponent(id)}` : "/api/hub/ferramentas-externas";
  const res = await fetch(url, {
    method: id ? "PATCH" : "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(parseError(data, "Falha ao guardar ferramenta externa."));
  }
  if (data && typeof data === "object" && "ferramenta" in data) {
    return (data as { ferramenta: HubFerramentaExternaRow }).ferramenta;
  }
  return data as HubFerramentaExternaRow;
}

export async function deleteHubFerramentaExterna(headers: HeadersInit, id: string): Promise<void> {
  const res = await fetch(`/api/hub/ferramentas-externas/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers,
  });
  if (res.ok) return;
  const data: unknown = await res.json().catch(() => null);
  throw new Error(parseError(data, "Falha ao eliminar ferramenta externa."));
}
