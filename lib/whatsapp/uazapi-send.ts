export type UazapiSendTextResult =
  | { ok: true; status: number; body?: unknown }
  | { ok: false; status?: number; body?: unknown; error: string };

/**
 * POST /send/text — header `token` = token da instância (não o admin).
 * @see docs/uazapi-openapi-spec
 */
export async function uazapiSendText(numero: string, text: string): Promise<UazapiSendTextResult> {
  const base = process.env.UAZAPI_BASE_URL?.trim();
  const token = process.env.UAZAPI_INSTANCE_TOKEN?.trim();

  if (!base || !token) {
    return { ok: false, error: "UAZAPI_BASE_URL ou UAZAPI_INSTANCE_TOKEN não configurados" };
  }

  const urlBase = base.replace(/\/+$/, "");
  const url = `${urlBase}/send/text`;
  const number = numero.replace(/\D/g, "");

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        token,
      },
      body: JSON.stringify({ number, text }),
    });

    const ct = res.headers.get("content-type") || "";
    let body: unknown;
    try {
      if (ct.includes("application/json")) {
        body = await res.json();
      } else {
        const t = await res.text();
        body = t || undefined;
      }
    } catch {
      body = undefined;
    }

    if (!res.ok) {
      return { ok: false, status: res.status, body, error: `HTTP ${res.status}` };
    }

    return { ok: true, status: res.status, body };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Erro ao chamar UAZAPI",
    };
  }
}
