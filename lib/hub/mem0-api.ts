import type { SupabaseClient } from "@supabase/supabase-js";
import { mem0PlataformaConfigurada, resolverMem0ApiKeyEnv } from "@/lib/hub/mem0-env";

const MEM0_API_BASE = "https://api.mem0.ai";
const HTTP_TIMEOUT_MS = 25_000;

export type Mem0SearchHit = {
  id?: string;
  memory?: string;
  text?: string;
  score?: number;
};

/** Chave Mem0 — só MEM0_API_KEY no ambiente (plataforma). */
export async function resolverMem0ApiKey(
  _supabase?: SupabaseClient,
  _tenantId?: string
): Promise<string | null> {
  return resolverMem0ApiKeyEnv();
}

export { mem0PlataformaConfigurada };

async function mem0Fetch(
  apiKey: string,
  path: string,
  body: Record<string, unknown>
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), HTTP_TIMEOUT_MS);
  try {
    const res = await fetch(`${MEM0_API_BASE}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const text = await res.text();
    let parsed: unknown = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      /* texto */
    }
    return { ok: res.ok, status: res.status, body: parsed };
  } finally {
    clearTimeout(t);
  }
}

export function normalizarMem0SearchResults(body: unknown): Mem0SearchHit[] {
  if (!body || typeof body !== "object") return [];
  const root = body as Record<string, unknown>;
  const arr =
    (Array.isArray(root.results) && root.results) ||
    (Array.isArray(root.memories) && root.memories) ||
    (Array.isArray(body) && body) ||
    [];
  const out: Mem0SearchHit[] = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const memory =
      (typeof row.memory === "string" && row.memory) ||
      (typeof row.text === "string" && row.text) ||
      (typeof row.content === "string" && row.content) ||
      "";
    if (!memory.trim()) continue;
    out.push({
      id: typeof row.id === "string" ? row.id : undefined,
      memory: memory.trim(),
      score: typeof row.score === "number" ? row.score : undefined,
    });
  }
  return out;
}

export async function mem0SearchMemories(params: {
  apiKey: string;
  query: string;
  userId: string;
  agentId?: string;
  limit?: number;
}): Promise<{ ok: boolean; hits: Mem0SearchHit[]; erro?: string; status?: number }> {
  const filters: Record<string, unknown> = { user_id: params.userId };
  if (params.agentId?.trim()) {
    filters.agent_id = params.agentId.trim();
  }
  const res = await mem0Fetch(params.apiKey, "/v3/memories/search/", {
    query: params.query.slice(0, 500),
    filters,
    limit: Math.min(12, Math.max(1, params.limit ?? 6)),
  });
  if (!res.ok) {
    const det =
      res.body && typeof res.body === "object" && "detail" in (res.body as object)
        ? String((res.body as { detail?: unknown }).detail)
        : typeof res.body === "string"
          ? res.body.slice(0, 200)
          : "mem0_search_falhou";
    return { ok: false, hits: [], erro: det, status: res.status };
  }
  return { ok: true, hits: normalizarMem0SearchResults(res.body) };
}

export async function mem0AddConversation(params: {
  apiKey: string;
  userId: string;
  agentId?: string;
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  metadata?: Record<string, unknown>;
}): Promise<{ ok: boolean; erro?: string; status?: number }> {
  const res = await mem0Fetch(params.apiKey, "/v3/memories/add/", {
    messages: params.messages.map((m) => ({
      role: m.role,
      content: m.content.slice(0, 4000),
    })),
    user_id: params.userId,
    ...(params.agentId?.trim() ? { agent_id: params.agentId.trim() } : {}),
    ...(params.metadata && Object.keys(params.metadata).length > 0 ? { metadata: params.metadata } : {}),
    infer: true,
  });
  if (!res.ok) {
    const det =
      res.body && typeof res.body === "object" && "detail" in (res.body as object)
        ? String((res.body as { detail?: unknown }).detail)
        : "mem0_add_falhou";
    return { ok: false, erro: det, status: res.status };
  }
  return { ok: true };
}

export async function mem0Ping(apiKey: string): Promise<{ ok: boolean; erro?: string }> {
  const res = await mem0SearchMemories({
    apiKey,
    query: "teste conexão",
    userId: "__hub_ping__",
    limit: 1,
  });
  if (res.ok) return { ok: true };
  if (res.status === 401 || res.status === 403) {
    return { ok: false, erro: "API key Mem0 inválida ou sem permissão." };
  }
  return { ok: false, erro: res.erro ?? "Falha ao contactar Mem0." };
}
