/** Microsoft 365 / Outlook OAuth (canal e-mail). Implementação em progresso. */

export function microsoftOAuthConfigured(): boolean {
  const id = process.env.MICROSOFT_OAUTH_CLIENT_ID?.trim();
  const secret = process.env.MICROSOFT_OAUTH_CLIENT_SECRET?.trim();
  const redirect = microsoftOAuthRedirectUri();
  return Boolean(id && secret && redirect);
}

export function microsoftOAuthRedirectUri(origin?: string): string | null {
  const explicit = process.env.MICROSOFT_OAUTH_REDIRECT_URI?.trim();
  if (explicit) return explicit;
  const base = origin?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!base) return null;
  return `${base.replace(/\/$/, "")}/api/hub/email/oauth/microsoft/callback`;
}
