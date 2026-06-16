/** Feature flags partilhados (server + client). Canal e-mail desactivado por defeito. */

export const EMAIL_CHANNEL_DISABLED_CODE = "EMAIL_CHANNEL_DISABLED";

export const EMAIL_CHANNEL_DISABLED_MESSAGE =
  "Canal de e-mail desactivado. Defina ENABLE_EMAIL_CHANNEL=true (API) e NEXT_PUBLIC_ENABLE_EMAIL_CHANNEL=true (UI) para activar.";

/** Server-side: requer ENABLE_EMAIL_CHANNEL=true (exacto). */
export function isEmailChannelEnabled(): boolean {
  return process.env.ENABLE_EMAIL_CHANNEL === "true";
}

/** Client-side: requer NEXT_PUBLIC_ENABLE_EMAIL_CHANNEL=true (exacto; acesso literal para webpack). */
export function isEmailChannelEnabledClient(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_EMAIL_CHANNEL === "true";
}
