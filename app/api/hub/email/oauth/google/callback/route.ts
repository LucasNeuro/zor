import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import {
  exchangeGoogleOAuthCode,
  getGoogleProfileEmail,
  linkAgenteToGmailOAuth,
  parseGoogleOAuthState,
  resolveGoogleOAuthRedirectUri,
  upsertGoogleWorkspaceOAuthIntegracoes,
} from "@/lib/email/oauth-google";
import { isEmailChannelEnabled } from "@/lib/feature-flags";
import { resolveOAuthReturnOrigin, resolveRequestPublicOrigin } from "@/lib/platform-brands";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function redirectOrigin(
  request: NextRequest,
  stateOrigin?: string
): Promise<string> {
  const fromState = stateOrigin?.trim().replace(/\/$/, "");
  if (fromState) {
    try {
      const u = new URL(fromState);
      if (u.protocol === "https:" || u.protocol === "http:") {
        return (await resolveOAuthReturnOrigin(u.origin)).replace(/\/$/, "");
      }
    } catch {
      /* fallback */
    }
  }
  const publicOrigin = resolveRequestPublicOrigin(request);
  const resolved = await resolveOAuthReturnOrigin(publicOrigin);
  return (
    resolved.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") ||
    request.nextUrl.origin
  );
}

async function redirectComResultado(
  request: NextRequest,
  opts: {
    ok: boolean;
    returnOrigin?: string;
    returnTo?: string;
    agenteSlug?: string;
    email?: string;
    error?: string;
  }
): Promise<NextResponse> {
  const origin = await redirectOrigin(request, opts.returnOrigin);
  const base =
    opts.returnTo ||
    (opts.agenteSlug ? `/crm/agentes/${encodeURIComponent(opts.agenteSlug)}` : "/crm/canais");

  const url = new URL(base.startsWith("http") ? base : `${origin}${base}`);
  url.searchParams.set("email_oauth", opts.ok ? "connected" : "error");
  url.searchParams.set("google_oauth", opts.ok ? "connected" : "error");
  if (opts.email) url.searchParams.set("email", opts.email);
  if (opts.error) {
    url.searchParams.set("email_oauth_error", opts.error.slice(0, 200));
    url.searchParams.set("email_oauth_message", opts.error.slice(0, 200));
  }

  return NextResponse.redirect(url.toString());
}

/**
 * GET — callback OAuth Google. Troca code por tokens, grava integração gmail do tenant
 * e opcionalmente liga agente (agente_slug no state).
 */
export async function GET(request: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }

  const errorParam = request.nextUrl.searchParams.get("error");
  const stateRaw = request.nextUrl.searchParams.get("state")?.trim() || "";
  const code = request.nextUrl.searchParams.get("code")?.trim() || "";

  const state = parseGoogleOAuthState(stateRaw);
  const returnTo = state?.returnTo;
  const returnOrigin = state?.returnOrigin;

  if (errorParam) {
    return redirectComResultado(request, {
      ok: false,
      returnOrigin,
      returnTo,
      agenteSlug: state?.agenteSlug,
      error: errorParam,
    });
  }

  if (!state) {
    return redirectComResultado(request, {
      ok: false,
      returnOrigin,
      returnTo,
      error: "state_invalido_ou_expirado",
    });
  }

  if (!code) {
    return redirectComResultado(request, {
      ok: false,
      returnOrigin,
      returnTo,
      agenteSlug: state.agenteSlug,
      error: "codigo_ausente",
    });
  }

  const redirectUri =
    state.redirectUri?.trim() ||
    (await resolveGoogleOAuthRedirectUri(resolveRequestPublicOrigin(request))) ||
    "";

  if (!redirectUri) {
    return redirectComResultado(request, {
      ok: false,
      returnOrigin,
      returnTo,
      agenteSlug: state.agenteSlug,
      error: "redirect_uri_nao_configurado",
    });
  }

  try {
    const tokens = await exchangeGoogleOAuthCode(code, redirectUri);
    const profileEmail = await getGoogleProfileEmail(tokens.access_token);

    const supabase = db();
    const { gmailIntegracaoId } = await upsertGoogleWorkspaceOAuthIntegracoes(
      supabase,
      state.tenantId,
      tokens,
      profileEmail
    );

    const linkEmailAgente =
      state.agenteSlug &&
      state.purpose !== "integradores" &&
      isEmailChannelEnabled();

    if (linkEmailAgente && state.agenteSlug) {
      await linkAgenteToGmailOAuth(supabase, {
        tenantId: state.tenantId,
        agenteSlug: state.agenteSlug,
        hubIntegracaoId: gmailIntegracaoId,
        profileEmail,
      });
    }

    return redirectComResultado(request, {
      ok: true,
      returnOrigin,
      returnTo,
      agenteSlug: state.agenteSlug,
      email: profileEmail,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "oauth_falhou";
    return redirectComResultado(request, {
      ok: false,
      returnOrigin,
      returnTo,
      agenteSlug: state.agenteSlug,
      error: msg,
    });
  }
}
