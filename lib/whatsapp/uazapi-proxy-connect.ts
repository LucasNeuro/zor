/** Proxy regional UAZAPI (Brasil) — por agente no hub, não variável global fixa. */

export type UazapiProxyConnectFields = {
  proxy_managed_country?: string;
  proxy_managed_state?: string;
  proxy_managed_city?: string;
};

export type UazapiProxyStoredRow = {
  uazapi_proxy_country?: string | null;
  uazapi_proxy_state?: string | null;
  uazapi_proxy_city?: string | null;
};

export function proxyFromStoredRow(row: UazapiProxyStoredRow | null | undefined): UazapiProxyConnectFields | null {
  const city = row?.uazapi_proxy_city?.trim();
  if (!city) return null;
  const out: UazapiProxyConnectFields = {
    proxy_managed_country: (row?.uazapi_proxy_country?.trim() || "br").toLowerCase(),
    proxy_managed_city: city.toLowerCase(),
  };
  const state = row?.uazapi_proxy_state?.trim();
  if (state) out.proxy_managed_state = state.toLowerCase();
  return out;
}

export function proxyFromRequestBody(body: {
  proxy_managed_country?: string;
  proxy_managed_state?: string;
  proxy_managed_city?: string;
}): UazapiProxyConnectFields | null {
  const city = body.proxy_managed_city?.trim();
  if (!city) return null;
  const out: UazapiProxyConnectFields = {
    proxy_managed_country: (body.proxy_managed_country?.trim() || "br").toLowerCase(),
    proxy_managed_city: city.toLowerCase(),
  };
  const state = body.proxy_managed_state?.trim();
  if (state) out.proxy_managed_state = state.toLowerCase();
  return out;
}

/** Body do pedido sobrepõe o gravado no agente. */
export function mergeUazapiProxyFields(opts: {
  body?: UazapiProxyConnectFields | null;
  stored?: UazapiProxyConnectFields | null;
}): UazapiProxyConnectFields | null {
  const stored = opts.stored;
  const body = opts.body;
  const city = body?.proxy_managed_city?.trim() || stored?.proxy_managed_city?.trim();
  if (!city) return null;

  const country = (
    body?.proxy_managed_country?.trim() ||
    stored?.proxy_managed_country?.trim() ||
    "br"
  ).toLowerCase();
  const state = body?.proxy_managed_state?.trim() || stored?.proxy_managed_state?.trim();

  const out: UazapiProxyConnectFields = {
    proxy_managed_country: country,
    proxy_managed_city: city.toLowerCase(),
  };
  if (state) out.proxy_managed_state = state.toLowerCase();
  return out;
}

export function uazapiProxyConfigured(proxy: UazapiProxyConnectFields | null | undefined): boolean {
  return Boolean(proxy?.proxy_managed_city?.trim());
}

export function buildUazapiInstanceConnectBody(opts: {
  browser?: string;
  phone?: string;
  systemName?: string;
  proxy?: UazapiProxyConnectFields | null;
}): Record<string, unknown> {
  /** `firefox` costuma ser mais estável que `auto`/`chrome` em novas sessões (doc UAZAPI). */
  const browser = (opts.browser || "firefox").trim() || "firefox";
  const payload: Record<string, unknown> = { browser };

  const phone = opts.phone?.replace(/\D/g, "") ?? "";
  if (phone.length >= 10) payload.phone = phone;

  const systemName = opts.systemName?.trim();
  if (systemName) payload.systemName = systemName.slice(0, 80);

  const proxy = opts.proxy;
  if (proxy) {
    if (proxy.proxy_managed_country) payload.proxy_managed_country = proxy.proxy_managed_country;
    if (proxy.proxy_managed_state) payload.proxy_managed_state = proxy.proxy_managed_state;
    if (proxy.proxy_managed_city) payload.proxy_managed_city = proxy.proxy_managed_city;
  }

  return payload;
}

export function persistPatchFromProxy(proxy: UazapiProxyConnectFields): Record<string, string> {
  const patch: Record<string, string> = {
    uazapi_proxy_country: proxy.proxy_managed_country || "br",
    uazapi_proxy_city: proxy.proxy_managed_city!,
  };
  if (proxy.proxy_managed_state) patch.uazapi_proxy_state = proxy.proxy_managed_state;
  return patch;
}

export const UAZAPI_PROXY_SETUP_HINT =
  "Selecione e guarde a cidade do proxy (região do número WhatsApp) antes de «QR / pareamento». Cada agente pode ter uma cidade diferente.";

/** UAZAPI OpenAPI: código de pareamento expira em ~5 min (QR ~2 min). */
export const UAZAPI_PAIRCODE_VALID_MS = 300_000;

/** Avisa quando o DDI 55 parece faltar o 9 do celular (12 dígitos). */
export function avisoTelefoneBrPareamento(digits: string): string | null {
  const d = digits.replace(/\D/g, "");
  if (!d.startsWith("55") || d.length !== 12) return null;
  const rest = d.slice(4);
  if (rest.length === 8 && !rest.startsWith("9")) {
    const ddd = d.slice(2, 4);
    return `Celular no Brasil costuma ter 13 dígitos (ex.: 55${ddd}9${rest}). Confira se o número está completo.`;
  }
  return null;
}
