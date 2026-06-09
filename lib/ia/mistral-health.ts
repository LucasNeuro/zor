const MISTRAL_MODELS_URL = "https://api.mistral.ai/v1/models";

export function mistralApiKey(): string | null {
  const key = process.env.MISTRAL_API_KEY?.replace(/\r/g, "").trim();
  return key || null;
}

export function mistralKeyFingerprint(key?: string | null): string {
  const k = key ?? mistralApiKey();
  if (!k) return "(ausente)";
  if (k.length < 8) return "****";
  return `${k.slice(0, 4)}…${k.slice(-4)}`;
}

/** Mensagem para utilizador quando a Mistral devolve 401. */
export function mistral401UserMessage(): string {
  const fp = mistralKeyFingerprint();
  return (
    `A Mistral rejeitou a chave no servidor (${fp}). ` +
    `Isto bloqueia a IA da aplicação (cargos, agentes, WhatsApp). ` +
    `No painel Mistral, verifique o aviso laranja em Chaves de API: se aparecer «último pagamento falhou», ` +
    `vá em Admin → Faturamento, regularize faturas pendentes e actualize o cartão — ter saldo (ex.: US$ 10) ` +
    `não basta se a última cobrança falhou. Depois: API Keys → «Copiar chave» → MISTRAL_API_KEY no .env → ` +
    `npm run verify:mistral (OK) → reinicie npm run dev.`
  );
}

export type MistralPingResult =
  | { ok: true; fingerprint: string; httpStatus: number }
  | { ok: false; fingerprint: string; httpStatus: number; detail: string };

/** Ping leve à API Mistral (lista de modelos). */
export async function pingMistralApi(): Promise<MistralPingResult> {
  const key = mistralApiKey();
  const fingerprint = mistralKeyFingerprint(key);
  if (!key) {
    return { ok: false, fingerprint, httpStatus: 0, detail: "MISTRAL_API_KEY não configurada no .env." };
  }

  try {
    const res = await fetch(MISTRAL_MODELS_URL, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (res.ok) {
      return { ok: true, fingerprint, httpStatus: res.status };
    }
    const body = await res.text().catch(() => "");
    const detail =
      res.status === 401
        ? mistral401UserMessage()
        : body.trim().slice(0, 280) || `HTTP ${res.status}`;
    return { ok: false, fingerprint, httpStatus: res.status, detail };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      fingerprint,
      httpStatus: -1,
      detail: `Erro de rede ao contactar api.mistral.ai: ${msg}`,
    };
  }
}
