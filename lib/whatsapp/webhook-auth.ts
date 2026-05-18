/** Nome do query param na URL do webhook (UAZAPI repassa na chamada POST). */
export function webhookSecretQueryParam(): string {
  return (process.env.WEBHOOK_SECRET_QUERY_PARAM || "wh").trim() || "wh";
}

/** URL pública do webhook; inclui segredo na query quando WEBHOOK_SECRET está definido. */
export function buildPublicWebhookUrl(origin: string, secret?: string | null): string {
  const base = `${origin.replace(/\/+$/, "")}/api/whatsapp/webhook`;
  const s = secret?.trim();
  if (!s) return base;
  const qp = webhookSecretQueryParam();
  return `${base}?${encodeURIComponent(qp)}=${encodeURIComponent(s)}`;
}
