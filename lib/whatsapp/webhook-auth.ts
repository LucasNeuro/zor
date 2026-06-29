/** Nome do query param na URL do webhook (UAZAPI repassa na chamada POST). */
export function webhookSecretQueryParam(): string {
  return (process.env.WEBHOOK_SECRET_QUERY_PARAM || "wh").trim() || "wh";
}

function buildPublicWebhookUrlAtPath(
  origin: string,
  path: string,
  secret?: string | null
): string {
  const base = `${origin.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
  const s = secret?.trim();
  if (!s) return base;
  const qp = webhookSecretQueryParam();
  return `${base}?${encodeURIComponent(qp)}=${encodeURIComponent(s)}`;
}

/** Webhook global / externo (agentes comerciais — Dany, SDR, etc.). */
export function buildPublicWebhookUrl(origin: string, secret?: string | null): string {
  return buildPublicWebhookUrlAtPath(origin, "/api/whatsapp/webhook", secret);
}

/** Webhook por instância — linha WhatsApp interna do empresário (gestor). */
export function buildPublicGestorWebhookUrl(origin: string, secret?: string | null): string {
  return buildPublicWebhookUrlAtPath(origin, "/api/whatsapp/webhook/gestor", secret);
}
