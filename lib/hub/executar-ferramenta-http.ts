import type {
  HubFerramentaExternaRow,
  HubIntegracaoCredenciaisRow,
  HubIntegracaoRow,
} from "@/lib/hub/ferramentas-externas-db";

const HTTP_TIMEOUT_MS = 30_000;
const MAX_RESPONSE_BYTES = 512_000;

export type ExecutarHttpFerramentaInput = {
  ferramenta: HubFerramentaExternaRow;
  integracao: HubIntegracaoRow;
  credenciais: HubIntegracaoCredenciaisRow | null;
  args: Record<string, unknown>;
};

function substituirPlaceholders(template: string, args: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const v = args[key];
    if (v === undefined || v === null) return "";
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
  });
}

function normalizarHeaders(
  raw: Record<string, unknown>,
  args: Record<string, unknown>
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v !== "string") continue;
    out[k] = substituirPlaceholders(v, args);
  }
  return out;
}

function aplicarAuthHeaders(
  headers: Record<string, string>,
  credenciais: HubIntegracaoCredenciaisRow | null
): Record<string, string> {
  if (!credenciais) return headers;
  const cred =
    credenciais.credenciais && typeof credenciais.credenciais === "object" && !Array.isArray(credenciais.credenciais)
      ? (credenciais.credenciais as Record<string, unknown>)
      : {};

  if (credenciais.tipo_auth === "bearer") {
    const token = typeof cred.bearer_token === "string" ? cred.bearer_token.trim() : "";
    if (token) headers.Authorization = `Bearer ${token}`;
  } else if (credenciais.tipo_auth === "api_key") {
    const key = typeof cred.api_key === "string" ? cred.api_key.trim() : "";
    const headerName =
      typeof cred.api_key_header === "string" && cred.api_key_header.trim()
        ? cred.api_key_header.trim()
        : "X-API-Key";
    if (key) headers[headerName] = key;
  }

  return headers;
}

function extrairAllowedHosts(config: Record<string, unknown>): string[] | null {
  const raw = config.allowed_hosts;
  if (!Array.isArray(raw)) return null;
  const hosts = raw
    .map((h) => (typeof h === "string" ? h.trim().toLowerCase() : ""))
    .filter((h) => h.length > 0);
  return hosts.length > 0 ? hosts : null;
}

function hostPermitido(url: URL, allowedHosts: string[] | null): boolean {
  if (!allowedHosts) return true;
  const host = url.hostname.toLowerCase();
  return allowedHosts.some((h) => host === h || host.endsWith(`.${h}`));
}

function truncarResposta(texto: string): string {
  if (texto.length <= MAX_RESPONSE_BYTES) return texto;
  return `${texto.slice(0, MAX_RESPONSE_BYTES)}…[truncado]`;
}

/** Executa chamada HTTP configurada para ferramenta externa; devolve JSON string para o modelo. */
export async function executarFerramentaHttp(input: ExecutarHttpFerramentaInput): Promise<string> {
  const { ferramenta, integracao, credenciais, args } = input;

  if (integracao.integracao_id !== "webhook_generico") {
    return JSON.stringify({
      erro: "integracao_em_breve",
      integracao_id: integracao.integracao_id,
      detalhe: "Só webhook_generico está disponível no MVP.",
    });
  }

  if (integracao.status !== "ativo") {
    return JSON.stringify({
      erro: "integracao_inativa",
      status: integracao.status,
    });
  }

  const urlStr = substituirPlaceholders(ferramenta.url_template, args).trim();
  if (!urlStr) {
    return JSON.stringify({ erro: "url_template_vazia" });
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(urlStr);
  } catch {
    return JSON.stringify({ erro: "url_invalida", url: urlStr.slice(0, 200) });
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    return JSON.stringify({ erro: "protocolo_nao_permitido", protocolo: parsedUrl.protocol });
  }

  const config =
    integracao.config && typeof integracao.config === "object" && !Array.isArray(integracao.config)
      ? (integracao.config as Record<string, unknown>)
      : {};
  const allowedHosts = extrairAllowedHosts(config);
  if (!hostPermitido(parsedUrl, allowedHosts)) {
    return JSON.stringify({
      erro: "host_nao_permitido",
      host: parsedUrl.hostname,
      allowed_hosts: allowedHosts,
    });
  }

  const headersRaw =
    ferramenta.headers_template &&
    typeof ferramenta.headers_template === "object" &&
    !Array.isArray(ferramenta.headers_template)
      ? (ferramenta.headers_template as Record<string, unknown>)
      : {};
  const headers = aplicarAuthHeaders(normalizarHeaders(headersRaw, args), credenciais);

  const metodo = ferramenta.metodo_http.toUpperCase();
  const init: RequestInit = {
    method: metodo,
    headers,
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  };

  if (metodo !== "GET" && metodo !== "DELETE" && ferramenta.body_template) {
    const body = substituirPlaceholders(ferramenta.body_template, args);
    if (!headers["Content-Type"] && !headers["content-type"]) {
      headers["Content-Type"] = "application/json";
    }
    init.body = body;
  }

  const inicio = Date.now();
  try {
    const res = await fetch(parsedUrl.toString(), init);
    const contentType = res.headers.get("content-type") || "";
    const texto = truncarResposta(await res.text());
    const latenciaMs = Date.now() - inicio;

    let corpo: unknown = texto;
    if (contentType.includes("application/json") && texto.trim()) {
      try {
        corpo = JSON.parse(texto);
      } catch {
        corpo = texto;
      }
    }

    return JSON.stringify({
      ok: res.ok,
      status: res.status,
      latencia_ms: latenciaMs,
      ferramenta: ferramenta.ferramenta_key,
      metodo,
      url: parsedUrl.origin + parsedUrl.pathname,
      corpo,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro_http";
    const timeout = msg.toLowerCase().includes("timeout") || msg.toLowerCase().includes("aborted");
    return JSON.stringify({
      ok: false,
      erro: timeout ? "timeout" : "fetch_falhou",
      detalhe: msg,
      ferramenta: ferramenta.ferramenta_key,
    });
  }
}
