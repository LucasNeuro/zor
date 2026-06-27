/** Chamadas HTTP à API UAZAPI (headers `admintoken` vs `token`). */

function uazapiPathPrefix(): string {
  const p = process.env.UAZAPI_PATH_PREFIX?.trim() || "";
  if (!p) return "";
  const norm = p.replace(/\/+$/, "");
  return norm.startsWith("/") ? norm : `/${norm}`;
}

/** Origem + caminho tentados (sem query) — útil para mensagens de diagnóstico no CRM. */
export type UazapiPedidoMeta = { origin: string; pathname: string };

function montarUrlUazapi(base: string, path: string): string {
  const prefix = uazapiPathPrefix();
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${prefix}${p}`;
}

export function uazapiBaseUrlNormalizado(): string | null {
  let b = process.env.UAZAPI_BASE_URL?.trim();
  if (!b) return null;
  b = b.replace(/\/+$/, "");
  /** Painel costuma ser `https://subdominio.uazapi.com`; alguns `.env` trazem `/api` extra e recebem 404 em `/api/instance/create`. */
  b = b.replace(/\/api\/?$/, "");
  return b;
}

export function extrairMensagemErroUazapi(data: unknown, status: number): string {
  if (typeof data === "string") {
    const t = data.trim();
    if (t) return t.length > 600 ? `${t.slice(0, 600)}…` : t;
  }
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;

    const errorKey = typeof o.error_key === "string" ? o.error_key.trim() : "";
    const msgPt =
      typeof o.message_ptbr === "string" && o.message_ptbr.trim()
        ? o.message_ptbr.trim()
        : typeof o.provider_message_ptbr === "string" && o.provider_message_ptbr.trim()
          ? o.provider_message_ptbr.trim()
          : "";

    if (errorKey === "WHATSAPP_REACHOUT_TIMELOCK") {
      const details =
        o.details && typeof o.details === "object" && !Array.isArray(o.details)
          ? (o.details as Record<string, unknown>)
          : null;
      const timelock =
        details?.reachout_timelock &&
        typeof details.reachout_timelock === "object" &&
        !Array.isArray(details.reachout_timelock)
          ? (details.reachout_timelock as Record<string, unknown>)
          : null;
      const untilRaw = typeof timelock?.until === "string" ? timelock.until : "";
      let untilLabel = "";
      if (untilRaw) {
        const d = new Date(untilRaw);
        if (!Number.isNaN(d.getTime())) {
          untilLabel = new Intl.DateTimeFormat("pt-BR", {
            timeZone: "America/Sao_Paulo",
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }).format(d);
        }
      }
      const base =
        msgPt ||
        "O WhatsApp bloqueou este envio: restrição temporária para iniciar conversas (volume ou qualidade).";
      return untilLabel
        ? `${base} Limite até ${untilLabel} (horário de Brasília). Peça ao cliente enviar uma mensagem primeiro ou aguarde.`
        : `${base} Peça ao cliente enviar uma mensagem no WhatsApp antes de responder pelo CRM.`;
    }

    if (msgPt) return msgPt;

    for (const k of ["message", "error", "detail", "response", "info", "provider_message"]) {
      const v = o[k];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  }
  return `HTTP ${status}`;
}

export type UazapiJsonResult<T = unknown> =
  | { ok: true; status: number; data: T }
  | {
      ok: false;
      status: number;
      data: T | undefined;
      error: string;
      request?: UazapiPedidoMeta;
    };

export async function uazapiFetchJson<T = unknown>(
  path: string,
  options: {
    method?: string;
    /** Header `admintoken` — create/list/delete admin ops */
    admin?: boolean;
    /** Header `token` — operações da instância */
    instanceToken?: string;
    body?: unknown;
  }
): Promise<UazapiJsonResult<T>> {
  const base = uazapiBaseUrlNormalizado();
  if (!base) {
    return { ok: false, status: 0, data: undefined, error: "UAZAPI_BASE_URL não configurado" };
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (options.admin) {
    const adm = process.env.UAZAPI_ADMIN_TOKEN?.trim();
    if (!adm) {
      return { ok: false, status: 0, data: undefined, error: "UAZAPI_ADMIN_TOKEN não configurado" };
    }
    headers.admintoken = adm;
  }

  if (options.instanceToken?.trim()) {
    headers.token = options.instanceToken.trim();
  }

  const url = montarUrlUazapi(base, path);
  let requestMeta: UazapiPedidoMeta | undefined;
  try {
    const u = new URL(url);
    requestMeta = { origin: u.origin, pathname: u.pathname };
  } catch {
    /* ignore */
  }

  const init: RequestInit = {
    method: options.method || "GET",
    headers,
  };

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(options.body);
  }

  try {
    const res = await fetch(url, init);
    const ct = res.headers.get("content-type") || "";
    let data: unknown;
    try {
      if (ct.includes("application/json")) {
        data = await res.json();
      } else {
        const t = await res.text();
        data = t ? t : undefined;
      }
    } catch {
      data = undefined;
    }

    if (!res.ok) {
      const msg = extrairMensagemErroUazapi(data, res.status);
      const hint404 =
        res.status === 404
          ? " Verifique UAZAPI_BASE_URL (ex.: https://SUBDOMINIO.uazapi.com, sem /api no fim) e UAZAPI_ADMIN_TOKEN no painel."
          : "";
      const hint401 =
        res.status === 401
          ? " Token inválido ou expirado: confira UAZAPI_BASE_URL (ex.: https://fitbot.uazapi.com) e o token da instância (hub_agente_identidade.uazapi_instance_token ou UAZAPI_INSTANCE_TOKEN no Render)."
          : "";
      return {
        ok: false,
        status: res.status,
        data: data as T,
        error: msg + hint404 + hint401,
        request: requestMeta,
      };
    }

    return { ok: true, status: res.status, data: data as T };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      data: undefined,
      error: e instanceof Error ? e.message : "Erro de rede UAZAPI",
      request: requestMeta,
    };
  }
}
