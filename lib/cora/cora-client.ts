import https from "node:https";
import { randomUUID } from "node:crypto";
import { getCoraConfig } from "@/lib/cora/cora-config";

type TokenCache = { accessToken: string; expiresAt: number };
let tokenCache: TokenCache | null = null;

function coraHttpsAgent(cert: string, key: string) {
  return new https.Agent({ cert, key, rejectUnauthorized: true });
}

async function coraFetch(
  url: string,
  init: RequestInit & { agent: https.Agent },
): Promise<Response> {
  const { agent, ...rest } = init;
  // Node fetch supports `dispatcher` in newer versions; use https.request fallback via undici is complex.
  // Next.js 15+ uses native fetch with custom agent via experimental or we use https directly.
  const u = new URL(url);
  const body = rest.body ? String(rest.body) : undefined;
  const headers = rest.headers as Record<string, string> | undefined;

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: u.hostname,
        port: u.port || 443,
        path: `${u.pathname}${u.search}`,
        method: rest.method ?? "GET",
        headers: body ? { "Content-Length": Buffer.byteLength(body), ...headers } : headers,
        agent,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          resolve(
            new Response(text, {
              status: res.statusCode ?? 500,
              headers: res.headers as HeadersInit,
            }),
          );
        });
      },
    );
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

export async function obterCoraAccessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.accessToken;
  }

  const cfg = getCoraConfig();
  const agent = coraHttpsAgent(cfg.cert, cfg.key);
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: cfg.clientId,
  }).toString();

  const res = await coraFetch(cfg.urls.token, {
    method: "POST",
    agent,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const json = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
  };

  if (!res.ok || !json.access_token) {
    throw new Error(json.error ?? `Falha ao obter token Cora (${res.status}).`);
  }

  tokenCache = {
    accessToken: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 86_400) * 1000,
  };
  return json.access_token;
}

export type CoraEmitirBoletoInput = {
  code: string;
  customer: {
    name: string;
    email: string;
    document: { identity: string; type: "CPF" | "CNPJ" };
    address: {
      street: string;
      number: string;
      district: string;
      city: string;
      state: string;
      complement?: string;
      zip_code: string;
    };
  };
  services: { name: string; description: string; amount: number }[];
  payment_terms: {
    due_date: string;
    fine?: { amount: number };
    interest?: { rate: number };
  };
  payment_forms?: string[];
};

export type CoraBoletoEmitido = {
  id: string;
  status: string;
  total_amount: number;
  document_url?: string;
  bank_slip?: { url?: string };
  pix?: { emv?: string; url?: string };
};

export async function emitirBoletoCora(
  input: CoraEmitirBoletoInput,
  idempotencyKey = randomUUID(),
): Promise<CoraBoletoEmitido> {
  const cfg = getCoraConfig();
  const agent = coraHttpsAgent(cfg.cert, cfg.key);
  const token = await obterCoraAccessToken();

  const res = await coraFetch(`${cfg.urls.api}/v2/invoices`, {
    method: "POST",
    agent,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(input),
  });

  const json = (await res.json()) as CoraBoletoEmitido & { message?: string; error?: string };
  if (!res.ok) {
    throw new Error(json.message ?? json.error ?? `Cora invoice falhou (${res.status}).`);
  }
  return json;
}

/** Baixa PDF/documento da Cora (mTLS + Bearer; fallback HTTP simples). */
export async function baixarArquivoCora(url: string): Promise<Buffer> {
  const cfg = getCoraConfig();
  const agent = coraHttpsAgent(cfg.cert, cfg.key);
  const token = await obterCoraAccessToken();

  const res = await coraFetch(url, {
    method: "GET",
    agent,
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.ok) {
    return Buffer.from(await res.arrayBuffer());
  }

  const plain = await fetch(url);
  if (!plain.ok) {
    throw new Error(`Falha ao baixar boleto Cora (${res.status} / ${plain.status}).`);
  }
  return Buffer.from(await plain.arrayBuffer());
}

export async function cancelarCobrancaCora(invoiceId: string): Promise<void> {
  const cfg = getCoraConfig();
  const agent = coraHttpsAgent(cfg.cert, cfg.key);
  const token = await obterCoraAccessToken();

  const res = await coraFetch(`${cfg.urls.api}/v2/invoices/${encodeURIComponent(invoiceId)}`, {
    method: "DELETE",
    agent,
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 204 || res.ok) return;

  const json = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
  throw new Error(json.message ?? json.error ?? `Falha ao cancelar cobrança Cora (${res.status}).`);
}
