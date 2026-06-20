import { X509Certificate } from "node:crypto";

export type CoraEnvironment = "production" | "stage";

const BASE_URLS: Record<CoraEnvironment, { token: string; api: string }> = {
  stage: {
    token: "https://matls-clients.api.stage.cora.com.br/token",
    api: "https://matls-clients.api.stage.cora.com.br",
  },
  production: {
    token: "https://matls-clients.api.cora.com.br/token",
    api: "https://matls-clients.api.cora.com.br",
  },
};

function extractClientIdFromCertPem(cert: string): string | null {
  try {
    const subject = new X509Certificate(cert).subject;
    const m = subject.match(/CN\s*=\s*(int-[A-Za-z0-9]+)/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

/** Falha cedo se CORA_CLIENT_ID ≠ CN do certificado (par de credenciais misturado). */
export function validarParCredenciaisCora(clientId: string, cert: string): void {
  const fromCert = extractClientIdFromCertPem(cert);
  if (fromCert && fromCert !== clientId) {
    throw new Error(
      `CORA_CLIENT_ID (${clientId}) não corresponde ao certificado (${fromCert}). ` +
        "Baixe cert_key_cora_production_*.zip no Cora Web (ONNZE) e configure client_id + cert + key do mesmo zip no Render.",
    );
  }
}

export function clientIdDoCertificadoCora(certPem: string | undefined): string | null {
  const cert = normalizePem(certPem);
  return cert ? extractClientIdFromCertPem(cert) : null;
}

function normalizePem(value: string | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  return raw.includes("\\n") ? raw.replace(/\\n/g, "\n") : raw;
}

export function coraConfigurado(): boolean {
  return Boolean(
    process.env.CORA_CLIENT_ID?.trim() &&
      normalizePem(process.env.CORA_CERT_PEM) &&
      normalizePem(process.env.CORA_PRIVATE_KEY_PEM),
  );
}

export function getCoraConfig() {
  const clientId = process.env.CORA_CLIENT_ID?.trim();
  const cert = normalizePem(process.env.CORA_CERT_PEM);
  const key = normalizePem(process.env.CORA_PRIVATE_KEY_PEM);
  const envRaw = (process.env.CORA_ENV ?? "production").trim().toLowerCase();
  const env: CoraEnvironment = envRaw === "stage" ? "stage" : "production";

  if (!clientId || !cert || !key) {
    throw new Error(
      "Cora não configurada. Defina CORA_CLIENT_ID, CORA_CERT_PEM e CORA_PRIVATE_KEY_PEM.",
    );
  }

  validarParCredenciaisCora(clientId, cert);

  return {
    clientId,
    cert,
    key,
    env,
    urls: BASE_URLS[env],
  };
}
