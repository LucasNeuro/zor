/** Configuração global Resend (tenant-wide; não por agente). */

import { normalizarEnderecoEmail } from "@/lib/email/inbound-parser";

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

/** Endereço puro extraído de `RESEND_FROM_EMAIL`. */
export function resendDefaultFromAddress(): string | null {
  return normalizarEnderecoEmail(resendDefaultFromEmail());
}

/** Domínio verificado sugerido para `email_from` do agente. */
export function resendDomainHint(): string | null {
  const addr = resendDefaultFromAddress();
  if (!addr) return null;
  const domain = addr.split("@")[1]?.trim().toLowerCase();
  return domain || null;
}

const DOMINIOS_PESSOAIS = new Set([
  "gmail.com",
  "googlemail.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "yahoo.com",
  "icloud.com",
  "me.com",
  "proton.me",
  "protonmail.com",
]);

/** Resend só envia de domínios verificados — bloqueia Gmail/Hotmail etc. no from do agente. */
export function emailFromPermitidoParaResend(email: string): { ok: true } | { ok: false; error: string } {
  const addr = normalizarEnderecoEmail(email);
  if (!addr) {
    return { ok: false, error: "E-mail de envio inválido." };
  }
  const domain = addr.split("@")[1]?.trim().toLowerCase();
  if (!domain) {
    return { ok: false, error: "E-mail de envio inválido." };
  }
  if (DOMINIOS_PESSOAIS.has(domain)) {
    return {
      ok: false,
      error:
        `O remetente «${addr}» é caixa pessoal (${domain}). ` +
        "Use um e-mail do domínio verificado no Resend (ex.: lucas.marcondes@clicvendy.com.br).",
    };
  }
  return { ok: true };
}

export function emailInboundWebhookSecret(): string | null {
  const s = process.env.EMAIL_INBOUND_WEBHOOK_SECRET?.trim();
  return s || null;
}
