/** Cliente: integrações configuráveis do tenant (credenciais para ferramentas externas). */

export type HubIntegracaoTipoAuth = "api_key" | "bearer" | "webhook_generico";

export type HubIntegracaoRow = {
  id: string;
  tenant_id?: string;
  integracao_id: string;
  nome: string;
  tipo_auth: HubIntegracaoTipoAuth;
  api_key?: string | null;
  bearer_token?: string | null;
  webhook_url?: string | null;
  ativo?: boolean;
  criado_em?: string;
  atualizado_em?: string;
};

export type HubIntegracaoPayload = {
  integracao_id: string;
  nome: string;
  tipo_auth: HubIntegracaoTipoAuth;
  api_key?: string | null;
  bearer_token?: string | null;
  webhook_url?: string | null;
  ativo?: boolean;
};

function parseList(data: unknown): HubIntegracaoRow[] {
  if (Array.isArray(data)) return data as HubIntegracaoRow[];
  if (data && typeof data === "object" && Array.isArray((data as { integracoes?: unknown }).integracoes)) {
    return (data as { integracoes: HubIntegracaoRow[] }).integracoes;
  }
  return [];
}

function parseError(data: unknown, fallback: string): string {
  if (data && typeof data === "object" && "error" in data && typeof (data as { error?: string }).error === "string") {
    return (data as { error: string }).error;
  }
  return fallback;
}

export async function fetchHubIntegracoes(headers: HeadersInit): Promise<HubIntegracaoRow[]> {
  const res = await fetch("/api/hub/integracoes", { headers });
  const data: unknown = await res.json().catch(() => null);
  if (res.status === 404) return [];
  if (!res.ok) {
    throw new Error(parseError(data, "Falha ao carregar integrações."));
  }
  return parseList(data);
}

export async function saveHubIntegracao(
  headers: HeadersInit,
  payload: HubIntegracaoPayload,
  id?: string | null
): Promise<HubIntegracaoRow> {
  const url = id ? `/api/hub/integracoes/${encodeURIComponent(id)}` : "/api/hub/integracoes";
  const res = await fetch(url, {
    method: id ? "PATCH" : "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(parseError(data, "Falha ao guardar integração."));
  }
  if (data && typeof data === "object" && "integracao" in data) {
    return (data as { integracao: HubIntegracaoRow }).integracao;
  }
  return data as HubIntegracaoRow;
}

export async function deleteHubIntegracao(headers: HeadersInit, id: string): Promise<void> {
  const res = await fetch(`/api/hub/integracoes/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers,
  });
  if (res.ok) return;
  const data: unknown = await res.json().catch(() => null);
  throw new Error(parseError(data, "Falha ao eliminar integração."));
}
