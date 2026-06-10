/** Configuração global Resend (tenant-wide; não por agente). */

export function resendApiKey(): string | null {
  const k = process.env.RESEND_API_KEY?.trim();
  return k || null;
}

export function resendConfigured(): boolean {
  return Boolean(resendApiKey());
}

/** Remetente padrão global (`Nome <email@domínio>` ou só email). */
export function resendDefaultFromEmail(): string | null {
  const v = process.env.RESEND_FROM_EMAIL?.trim();
  return v || null;
}

export function emailInboundWebhookSecret(): string | null {
  const s = process.env.EMAIL_INBOUND_WEBHOOK_SECRET?.trim();
  return s || null;
}
