import { NextRequest, NextResponse } from "next/server";
import { requireCrmApiAccess } from "@/lib/crm/crm-api-auth";
import { resolveTenantIdFromCaller } from "@/lib/crm/resolve-tenant-from-caller";
import {
  EMAIL_CHANNEL_DISABLED_CODE,
  EMAIL_CHANNEL_DISABLED_MESSAGE,
  isEmailChannelEnabled,
} from "@/lib/feature-flags";
import {
  prepareGoogleOAuthStart,
  resolveGoogleOAuthRedirectUri,
} from "@/lib/email/oauth-google";
import { credentialsEncryptionConfigured } from "@/lib/hub/credentials-crypto";
import { resolveRequestPublicOrigin } from "@/lib/platform-brands";

const STATE_TTL_MS = 15 * 60 * 1000;

function sanitizeReturnTo(raw: string | null): string | null {
  if (!raw) return null;
  const v = raw.trim();
  if (!v.startsWith("/") || v.startsWith("//")) return null;
  return v.slice(0, 500);
}

/**
 * GET — inicia OAuth Google/Gmail para o tenant.
 * Query: agente_slug (opcional), return_to (path relativo opcional).
 * Resposta: redirect 302 para Google ou JSON { authorize_url } se ?json=1.
 */
export async function GET(request: NextRequest) {
  const accessErr = await requireCrmApiAccess(request);
  if (accessErr) return accessErr;

  if (!isEmailChannelEnabled()) {
    return NextResponse.json(
      { error: EMAIL_CHANNEL_DISABLED_MESSAGE, code: EMAIL_CHANNEL_DISABLED_CODE },
      { status: 503 }
    );
  }

  const requestOrigin = resolveRequestPublicOrigin(request);

  if (!credentialsEncryptionConfigured()) {
    return NextResponse.json(
      {
        error:
          "Defina HUB_CREDENTIALS_ENCRYPTION_KEY (32 bytes hex ou base64) para guardar tokens OAuth.",
      },
      { status: 503 }
    );
  }

  const redirectUri = await resolveGoogleOAuthRedirectUri(requestOrigin);
  if (
    !process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() ||
    !process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim() ||
    !credentialsEncryptionConfigured() ||
    !redirectUri
  ) {
    return NextResponse.json(
      {
        error:
          "Google OAuth não configurado: GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET e redirect URI autorizado no GCP.",
      },
      { status: 503 }
    );
  }

  const tenantId = await resolveTenantIdFromCaller(request);
  const agenteSlug =
    request.nextUrl.searchParams.get("agente_slug")?.trim() ||
    request.nextUrl.searchParams.get("agente")?.trim() ||
    undefined;

  const returnRaw =
    request.nextUrl.searchParams.get("return_to") ||
    request.nextUrl.searchParams.get("return");
  let returnTo = sanitizeReturnTo(returnRaw);
  if (!returnTo && returnRaw?.trim()) {
    try {
      const u = new URL(returnRaw.trim());
      returnTo = sanitizeReturnTo(`${u.pathname}${u.search}`);
    } catch {
      returnTo = null;
    }
  }

  const prepared = await prepareGoogleOAuthStart(requestOrigin, {
    tenantId,
    agenteSlug,
    returnTo: returnTo || undefined,
    purpose: "agent_email",
    exp: Date.now() + STATE_TTL_MS,
  });

  if (!prepared) {
    return NextResponse.json({ error: "Não foi possível montar URL de autorização." }, { status: 500 });
  }

  if (request.nextUrl.searchParams.get("json") === "1") {
    return NextResponse.json({ ok: true, authorize_url: prepared.authorizeUrl });
  }

  return NextResponse.redirect(prepared.authorizeUrl);
}
