export interface EvolutionSendTextResultOk {
  ok: true;
  status: number;
  body?: unknown;
}

export interface EvolutionSendTextResultErr {
  ok: false;
  status?: number;
  body?: unknown;
  error: string;
}

export type EvolutionSendTextResult = EvolutionSendTextResultOk | EvolutionSendTextResultErr;

/**
 * POST Evolution API sendText para a instância configurada em ambiente.
 */
export async function evolutionSendText(numero: string, text: string): Promise<EvolutionSendTextResult> {
  const base = process.env.EVOLUTION_API_URL?.trim();
  const key = process.env.EVOLUTION_API_KEY?.trim();
  const instance = (process.env.EVOLUTION_INSTANCE || "obra10plus").trim() || "obra10plus";

  if (!base || !key) {
    return { ok: false, error: "EVOLUTION_API_URL ou EVOLUTION_API_KEY não configurados" };
  }

  const urlBase = base.replace(/\/+$/, "");
  const url = `${urlBase}/message/sendText/${instance}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: key,
      },
      body: JSON.stringify({ number: numero, text }),
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
      return {
        ok: false,
        status: res.status,
        body,
        error: `HTTP ${res.status}`,
      };
    }

    return { ok: true, status: res.status, body };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Erro ao chamar Evolution",
    };
  }
}
