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

  return {
    clientId,
    cert,
    key,
    env,
    urls: BASE_URLS[env],
  };
}
