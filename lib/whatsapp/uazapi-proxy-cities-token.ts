import { uazapiFetchJson } from "@/lib/whatsapp/uazapi-http";

export type UazapiProxyCitiesTokenSource = "agent_instance" | "bootstrap_env" | "server_instance";

export type UazapiProxyCitiesTokenResult =
  | { ok: true; token: string; source: UazapiProxyCitiesTokenSource }
  | { ok: false; error: string; status: number };

function extrairTokenInstancia(item: unknown): string {
  if (!item || typeof item !== "object") return "";
  const o = item as Record<string, unknown>;
  const inst =
    o.instance && typeof o.instance === "object" ? (o.instance as Record<string, unknown>) : o;
  const t = inst.token;
  return typeof t === "string" ? t.trim() : "";
}

/** UAZAPI: GET /proxy-managed/cities exige header `token` de instância — admin token devolve Invalid token. */
export async function resolverTokenCatalogoProxyCidades(
  agentInstanceToken: string
): Promise<UazapiProxyCitiesTokenResult> {
  const tokenInst = agentInstanceToken.trim();
  if (tokenInst) {
    return { ok: true, token: tokenInst, source: "agent_instance" };
  }

  const bootstrap =
    process.env.UAZAPI_BOOTSTRAP_INSTANCE_TOKEN?.trim() ||
    process.env.UAZAPI_INSTANCE_TOKEN?.trim() ||
    "";
  if (bootstrap) {
    const probe = await uazapiFetchJson<Record<string, unknown>>("/proxy-managed/cities?country=br", {
      method: "GET",
      instanceToken: bootstrap,
    });
    if (probe.ok) {
      return { ok: true, token: bootstrap, source: "bootstrap_env" };
    }
  }

  const admin = process.env.UAZAPI_ADMIN_TOKEN?.trim();
  if (!admin) {
    return {
      ok: false,
      status: 503,
      error:
        "Configure UAZAPI_ADMIN_TOKEN no servidor e use «Criar instância UAZAPI» neste agente. A lista de cidades exige token de instância.",
    };
  }

  const list = await uazapiFetchJson<unknown>("/instance/all", { method: "GET", admin: true });
  if (list.ok) {
    const raw = list.data;
    const arr = Array.isArray(raw)
      ? raw
      : raw && typeof raw === "object" && Array.isArray((raw as { instances?: unknown[] }).instances)
        ? (raw as { instances: unknown[] }).instances
        : [];
    for (const item of arr) {
      const t = extrairTokenInstancia(item);
      if (t) return { ok: true, token: t, source: "server_instance" };
    }
  }

  return {
    ok: false,
    status: 409,
    error:
      "Crie primeiro a instância UAZAPI (botão «Criar instância» no rodapé). Depois a lista de cidades será carregada automaticamente.",
  };
}
