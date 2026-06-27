import { googleOAuthConfigured } from "@/lib/email/oauth-google";

export type EmailProviderMode = "oauth_google";

export type AgenteEmailProviderFields = {
  email_provider?: string | null;
  email_integracao_id?: string | null;
};

/** Envio/receção via Gmail OAuth (Resend removido). */
export function resolveEmailProviderForAgente(agente: AgenteEmailProviderFields): EmailProviderMode {
  if (agente.email_provider === "oauth_google" && agente.email_integracao_id) {
    return "oauth_google";
  }
  if (agente.email_integracao_id) {
    return "oauth_google";
  }
  return "oauth_google";
}

export function emailProviderAvailable(mode: EmailProviderMode, origin?: string): boolean {
  if (mode === "oauth_google") return googleOAuthConfigured(origin);
  return false;
}

export function emailProviderLabel(_mode: EmailProviderMode): string {
  return "Gmail (OAuth)";
}
