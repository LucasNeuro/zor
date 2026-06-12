import { resendConfigured } from "@/lib/email/resend-config";
import { googleOAuthConfigured } from "@/lib/email/oauth-google";

export type EmailProviderMode = "resend" | "oauth_google";

export type AgenteEmailProviderFields = {
  email_provider?: string | null;
  email_integracao_id?: string | null;
};

/** Modo de envio/receção do agente (Resend global vs Gmail OAuth do tenant). */
export function resolveEmailProviderForAgente(agente: AgenteEmailProviderFields): EmailProviderMode {
  if (agente.email_provider === "oauth_google" && agente.email_integracao_id) {
    return "oauth_google";
  }
  return "resend";
}

export function emailProviderAvailable(mode: EmailProviderMode, origin?: string): boolean {
  if (mode === "oauth_google") return googleOAuthConfigured(origin);
  return resendConfigured();
}

export function emailProviderLabel(mode: EmailProviderMode): string {
  return mode === "oauth_google" ? "Gmail (OAuth)" : "Resend";
}
