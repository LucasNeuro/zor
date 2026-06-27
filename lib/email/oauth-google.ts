import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  hostIsKnownPlatformDomain,
  resolveOAuthReturnOrigin,
  resolveRequestPublicOrigin,
} from "@/lib/platform-brands";
import {
  credentialsEncryptionConfigured,
  decryptCredentialCiphertext,
  encryptCredentialPlaintext,
  signOAuthState,
  verifyOAuthState,
} from "@/lib/hub/credentials-crypto";
import type { HubIntegracaoCredenciaisRow } from "@/lib/hub/ferramentas-externas-db";
import { integradorPorId } from "@/lib/hub/integradores-catalogo";

export const GMAIL_INTEGRADOR_ID = "gmail" as const;
export const GOOGLE_CALENDAR_INTEGRADOR_ID = "google_calendar" as const;

/** Gmail canal + Calendar (agentes) + perfil. Não use senha do cliente — OAuth offline. */
export const GOOGLE_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email",
  "openid",
].join(" ");

export type GoogleOAuthState = {
  tenantId: string;
  agenteSlug?: string;
  returnTo?: string;
  /** Origem onde o utilizador iniciou OAuth (ex.: https://synkronia.com.br). */
  returnOrigin?: string;
  /** redirect_uri exacto enviado ao Google (deve coincidir no callback). */
  redirectUri?: string;
  /** agent_email = liga caixa no agente; integradores = só hub_integracoes (Calendar/Gmail tools). */
  purpose?: "agent_email" | "integradores";
  exp: number;
};

export type GoogleTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  token_type?: string;
};

export type StoredGoogleOAuthCredentials = {
  _enc: true;
  access_token: string;
  refresh_token?: string;
  expires_at: number;
  email?: string;
  scope?: string;
};

function googleClientId(): string | null {
  const v = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  return v || null;
}

function googleClientSecret(): string | null {
  const v = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  return v || null;
}

export const GOOGLE_OAUTH_CALLBACK_PATH = "/api/hub/email/oauth/google/callback";

export function googleOAuthRedirectUriForOrigin(origin: string): string | null {
  const trimmed = origin.trim().replace(/\/$/, "");
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return `${u.origin}${GOOGLE_OAUTH_CALLBACK_PATH}`;
  } catch {
    return null;
  }
}

/** redirect_uri para o pedido actual: domínio do vendor se registado, senão env/canónico. */
export async function resolveGoogleOAuthRedirectUri(requestOrigin?: string): Promise<string | null> {
  const origin = requestOrigin?.trim().replace(/\/$/, "");
  if (origin) {
    try {
      const host = new URL(origin).host;
      if (await hostIsKnownPlatformDomain(host)) {
        return googleOAuthRedirectUriForOrigin(origin);
      }
    } catch {
      /* fallback */
    }
  }

  const explicit = process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim();
  if (explicit) return explicit;

  const app = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (app) return googleOAuthRedirectUriForOrigin(app);

  return origin ? googleOAuthRedirectUriForOrigin(origin) : null;
}

export function googleOAuthRedirectUri(origin?: string): string | null {
  const explicit = process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim();
  if (explicit) return explicit;
  const base = origin?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!base) return null;
  return googleOAuthRedirectUriForOrigin(base);
}

export function googleOAuthConfigured(origin?: string): boolean {
  return Boolean(googleClientId() && googleClientSecret() && googleOAuthRedirectUri(origin) && credentialsEncryptionConfigured());
}

export function buildGoogleOAuthState(state: GoogleOAuthState): string {
  const payloadB64 = Buffer.from(JSON.stringify(state), "utf8").toString("base64url");
  const sig = signOAuthState(payloadB64);
  return `${payloadB64}.${sig}`;
}

export function parseGoogleOAuthState(raw: string): GoogleOAuthState | null {
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return null;
  const payloadB64 = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  if (!verifyOAuthState(payloadB64, sig)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as GoogleOAuthState;
    if (!parsed?.tenantId || typeof parsed.exp !== "number") return null;
    if (Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function buildGoogleOAuthAuthorizeUrl(state: string, redirectUri: string): string | null {
  const clientId = googleClientId();
  const uri = redirectUri.trim();
  if (!clientId || !uri) return null;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: uri,
    response_type: "code",
    scope: GOOGLE_OAUTH_SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGoogleOAuthCode(
  code: string,
  redirectUri: string
): Promise<GoogleTokenResponse> {
  const clientId = googleClientId();
  const clientSecret = googleClientSecret();
  const uri = redirectUri.trim();
  if (!clientId || !clientSecret || !uri) {
    throw new Error("Google OAuth não configurado no servidor.");
  }

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: uri,
    grant_type: "authorization_code",
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const detail = typeof json.error === "string" ? json.error : JSON.stringify(json);
    throw new Error(`Falha ao trocar código OAuth: ${detail}`);
  }

  const accessToken = typeof json.access_token === "string" ? json.access_token : "";
  if (!accessToken) throw new Error("Resposta OAuth sem access_token.");

  return {
    access_token: accessToken,
    refresh_token: typeof json.refresh_token === "string" ? json.refresh_token : undefined,
    expires_in: typeof json.expires_in === "number" ? json.expires_in : 3600,
    scope: typeof json.scope === "string" ? json.scope : undefined,
    token_type: typeof json.token_type === "string" ? json.token_type : undefined,
  };
}

/** Monta state + URL de autorização respeitando domínio do vendor (redirect_uri no GCP). */
export async function prepareGoogleOAuthStart(
  requestOrigin: string,
  statePayload: Omit<GoogleOAuthState, "returnOrigin" | "redirectUri">
): Promise<{ authorizeUrl: string; redirectUri: string; returnOrigin: string } | null> {
  const [returnOrigin, redirectUri] = await Promise.all([
    resolveOAuthReturnOrigin(requestOrigin),
    resolveGoogleOAuthRedirectUri(requestOrigin),
  ]);
  if (!redirectUri) return null;

  const state = buildGoogleOAuthState({
    ...statePayload,
    returnOrigin,
    redirectUri,
  });
  const authorizeUrl = buildGoogleOAuthAuthorizeUrl(state, redirectUri);
  if (!authorizeUrl) return null;

  return { authorizeUrl, redirectUri, returnOrigin };
}

export async function refreshGoogleAccessToken(refreshToken: string): Promise<GoogleTokenResponse> {
  const clientId = googleClientId();
  const clientSecret = googleClientSecret();
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth não configurado no servidor.");
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const detail = typeof json.error === "string" ? json.error : JSON.stringify(json);
    throw new Error(`Falha ao renovar token Google: ${detail}`);
  }

  const accessToken = typeof json.access_token === "string" ? json.access_token : "";
  if (!accessToken) throw new Error("Resposta refresh sem access_token.");

  return {
    access_token: accessToken,
    refresh_token: typeof json.refresh_token === "string" ? json.refresh_token : refreshToken,
    expires_in: typeof json.expires_in === "number" ? json.expires_in : 3600,
    scope: typeof json.scope === "string" ? json.scope : undefined,
    token_type: typeof json.token_type === "string" ? json.token_type : undefined,
  };
}

export async function getGoogleProfileEmail(accessToken: string): Promise<string> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error("Não foi possível obter perfil Google.");
  }
  const email = typeof json.email === "string" ? json.email.trim().toLowerCase() : "";
  if (!email) throw new Error("Perfil Google sem e-mail.");
  return email;
}

function credenciaisObj(cred: HubIntegracaoCredenciaisRow | null): Record<string, unknown> {
  if (!cred?.credenciais || typeof cred.credenciais !== "object" || Array.isArray(cred.credenciais)) {
    return {};
  }
  return cred.credenciais as Record<string, unknown>;
}

export function serializeGoogleOAuthCredentials(
  tokens: GoogleTokenResponse,
  profileEmail?: string
): StoredGoogleOAuthCredentials {
  const expiresAt = Date.now() + Math.max(60, tokens.expires_in - 60) * 1000;
  const stored: StoredGoogleOAuthCredentials = {
    _enc: true,
    access_token: encryptCredentialPlaintext(tokens.access_token),
    expires_at: expiresAt,
    scope: tokens.scope,
  };
  if (tokens.refresh_token) {
    stored.refresh_token = encryptCredentialPlaintext(tokens.refresh_token);
  }
  if (profileEmail) stored.email = profileEmail;
  return stored;
}

export function readStoredGoogleOAuthCredentials(
  cred: HubIntegracaoCredenciaisRow | null
): { accessToken: string; refreshToken?: string; expiresAt: number; email?: string } | null {
  const o = credenciaisObj(cred);

  if (o._enc === true) {
    const accessEnc = typeof o.access_token === "string" ? o.access_token : "";
    if (!accessEnc) return null;
    const expiresAt = typeof o.expires_at === "number" ? o.expires_at : 0;
    const refreshEnc = typeof o.refresh_token === "string" ? o.refresh_token : undefined;
    return {
      accessToken: decryptCredentialCiphertext(accessEnc),
      refreshToken: refreshEnc ? decryptCredentialCiphertext(refreshEnc) : undefined,
      expiresAt,
      email: typeof o.email === "string" ? o.email : undefined,
    };
  }

  const legacy = typeof o.bearer_token === "string" ? o.bearer_token.trim() : "";
  if (legacy) {
    return { accessToken: legacy, expiresAt: Date.now() + 3600_000 };
  }

  return null;
}

export async function upsertGoogleOAuthIntegracao(
  supabase: SupabaseClient,
  tenantId: string,
  integracaoId: typeof GMAIL_INTEGRADOR_ID | typeof GOOGLE_CALENDAR_INTEGRADOR_ID,
  tokens: GoogleTokenResponse,
  profileEmail: string
): Promise<{ hubIntegracaoId: string }> {
  const entry = integradorPorId(integracaoId);
  if (!entry) throw new Error(`Integrador ${integracaoId} não encontrado no catálogo.`);

  const config = { oauth_email: profileEmail, provider: "google" };
  const credenciais = serializeGoogleOAuthCredentials(tokens, profileEmail);

  const { data: existing } = await supabase
    .from("hub_integracoes")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("integracao_id", integracaoId)
    .maybeSingle();

  let hubIntegracaoId = existing?.id ? String(existing.id) : "";

  if (hubIntegracaoId) {
    const { error } = await supabase
      .from("hub_integracoes")
      .update({
        nome: entry.nome,
        status: "ativo",
        config,
        ativo: true,
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", hubIntegracaoId)
      .eq("tenant_id", tenantId);
    if (error) throw new Error(error.message);
  } else {
    const { data: inserted, error } = await supabase
      .from("hub_integracoes")
      .insert({
        tenant_id: tenantId,
        integracao_id: integracaoId,
        nome: entry.nome,
        status: "ativo",
        config,
        ativo: true,
      })
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!inserted?.id) throw new Error(`Falha ao criar integração ${integracaoId}.`);
    hubIntegracaoId = String(inserted.id);
  }

  const { data: credExistente } = await supabase
    .from("hub_integracao_credenciais")
    .select("id, credenciais")
    .eq("integracao_id", hubIntegracaoId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  let mergedCredenciais = credenciais;
  if (credExistente?.credenciais && typeof credExistente.credenciais === "object") {
    const prev = credExistente.credenciais as Record<string, unknown>;
    if (!tokens.refresh_token && prev._enc === true && typeof prev.refresh_token === "string") {
      mergedCredenciais = { ...credenciais, refresh_token: prev.refresh_token };
    }
  }

  if (credExistente?.id) {
    await supabase
      .from("hub_integracao_credenciais")
      .update({
        tipo_auth: "oauth2",
        credenciais: mergedCredenciais,
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", credExistente.id);
  } else {
    await supabase.from("hub_integracao_credenciais").insert({
      tenant_id: tenantId,
      integracao_id: hubIntegracaoId,
      tipo_auth: "oauth2",
      credenciais: mergedCredenciais,
    });
  }

  return { hubIntegracaoId };
}

/** Gmail + Google Calendar com o mesmo fluxo OAuth (uma autorização no Google). */
export async function upsertGoogleWorkspaceOAuthIntegracoes(
  supabase: SupabaseClient,
  tenantId: string,
  tokens: GoogleTokenResponse,
  profileEmail: string
): Promise<{ gmailIntegracaoId: string; calendarIntegracaoId: string }> {
  const gmail = await upsertGoogleOAuthIntegracao(
    supabase,
    tenantId,
    GMAIL_INTEGRADOR_ID,
    tokens,
    profileEmail
  );
  const calendar = await upsertGoogleOAuthIntegracao(
    supabase,
    tenantId,
    GOOGLE_CALENDAR_INTEGRADOR_ID,
    tokens,
    profileEmail
  );
  return {
    gmailIntegracaoId: gmail.hubIntegracaoId,
    calendarIntegracaoId: calendar.hubIntegracaoId,
  };
}

/** Revoga token no Google (melhor esforço — ignora falhas). */
async function revokeGoogleToken(token: string): Promise<void> {
  try {
    await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
    });
  } catch {
    /* token já inválido ou rede */
  }
}

/**
 * Desliga Gmail + Calendar do tenant (OAuth Google Workspace).
 * Remove credenciais, desactiva integrações e desassocia agentes que usavam a caixa Gmail.
 */
export async function disconnectGoogleWorkspaceOAuthIntegracoes(
  supabase: SupabaseClient,
  tenantId: string
): Promise<{ desconectado: boolean; email?: string }> {
  const integracaoIds = [GMAIL_INTEGRADOR_ID, GOOGLE_CALENDAR_INTEGRADOR_ID] as const;
  let lastEmail: string | undefined;
  let gmailHubId: string | null = null;
  let hadConnection = false;

  for (const integracaoId of integracaoIds) {
    const { data: row } = await supabase
      .from("hub_integracoes")
      .select("id, config, hub_integracao_credenciais(id, credenciais)")
      .eq("tenant_id", tenantId)
      .eq("integracao_id", integracaoId)
      .maybeSingle();

    if (!row?.id) continue;

    const hubId = String(row.id);
    if (integracaoId === GMAIL_INTEGRADOR_ID) gmailHubId = hubId;

    const cfg =
      row.config && typeof row.config === "object"
        ? (row.config as Record<string, unknown>)
        : {};
    const cfgEmail = typeof cfg.oauth_email === "string" ? cfg.oauth_email : undefined;
    if (cfgEmail) lastEmail = cfgEmail;

    const creds = row.hub_integracao_credenciais;
    const credRow = Array.isArray(creds) ? creds[0] : creds;
    const stored = readStoredGoogleOAuthCredentials(
      credRow && typeof credRow === "object" && "credenciais" in credRow
        ? ({ credenciais: credRow.credenciais } as HubIntegracaoCredenciaisRow)
        : null
    );

    if (stored?.refreshToken) {
      await revokeGoogleToken(stored.refreshToken);
    } else if (stored?.accessToken) {
      await revokeGoogleToken(stored.accessToken);
    }

    if (stored || cfgEmail) hadConnection = true;

    await supabase
      .from("hub_integracao_credenciais")
      .delete()
      .eq("integracao_id", hubId)
      .eq("tenant_id", tenantId);

    await supabase
      .from("hub_integracoes")
      .update({
        status: "inativo",
        ativo: false,
        config: {},
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", hubId)
      .eq("tenant_id", tenantId);
  }

  if (gmailHubId) {
    await supabase
      .from("hub_agente_identidade")
      .update({
        email_provider: null,
        email_integracao_id: null,
        email_from: null,
        email_inbound: null,
        email_ativo: false,
      })
      .eq("tenant_id", tenantId)
      .eq("email_integracao_id", gmailHubId);
  }

  return { desconectado: hadConnection, email: lastEmail };
}

export async function upsertGmailOAuthIntegracao(
  supabase: SupabaseClient,
  tenantId: string,
  tokens: GoogleTokenResponse,
  profileEmail: string
): Promise<{ hubIntegracaoId: string }> {
  return upsertGoogleOAuthIntegracao(supabase, tenantId, GMAIL_INTEGRADOR_ID, tokens, profileEmail);
}

export async function upsertGoogleCalendarOAuthIntegracao(
  supabase: SupabaseClient,
  tenantId: string,
  tokens: GoogleTokenResponse,
  profileEmail: string
): Promise<{ hubIntegracaoId: string }> {
  return upsertGoogleOAuthIntegracao(
    supabase,
    tenantId,
    GOOGLE_CALENDAR_INTEGRADOR_ID,
    tokens,
    profileEmail
  );
}

export async function getValidGoogleAccessToken(
  supabase: SupabaseClient,
  tenantId: string,
  cred: HubIntegracaoCredenciaisRow | null,
  hubIntegracaoRowId: string
): Promise<string | null> {
  const stored = readStoredGoogleOAuthCredentials(cred);
  if (!stored) return null;

  if (stored.expiresAt > Date.now()) {
    return stored.accessToken;
  }

  if (!stored.refreshToken) {
    return stored.accessToken;
  }

  const refreshed = await refreshGoogleAccessToken(stored.refreshToken);
  const credenciais = serializeGoogleOAuthCredentials(refreshed, stored.email);

  await supabase
    .from("hub_integracao_credenciais")
    .update({
      credenciais,
      atualizado_em: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId)
    .eq("integracao_id", hubIntegracaoRowId);

  return refreshed.access_token;
}

export async function linkAgenteToGmailOAuth(
  supabase: SupabaseClient,
  opts: {
    tenantId: string;
    agenteSlug: string;
    hubIntegracaoId: string;
    profileEmail: string;
  }
): Promise<void> {
  const email = opts.profileEmail.trim().toLowerCase();
  const patch: Record<string, unknown> = {
    email_provider: "oauth_google",
    email_integracao_id: opts.hubIntegracaoId,
    email_from: email,
    email_inbound: email,
    email_ativo: true,
    email_configured_at: new Date().toISOString(),
    modo_operacao: "canal_email",
  };

  let query = supabase.from("hub_agente_identidade").update(patch).eq("agente_slug", opts.agenteSlug);
  if (opts.tenantId) {
    query = query.eq("tenant_id", opts.tenantId);
  }

  const { error } = await query;
  if (error) {
    throw new Error(error.message);
  }
}
