import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import {
  exchangeGoogleOAuthCode,
  getGoogleProfileEmail,
  linkAgenteToGmailOAuth,
  parseGoogleOAuthState,
  upsertGoogleWorkspaceOAuthIntegracoes,
} from "@/lib/email/oauth-google";
import { isEmailChannelEnabled } from "@/lib/feature-flags";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function appOrigin(request: NextRequest): string {
  return process.env.NEXT_PUBLIC_APP_URL?.trim() || request.nextUrl.origin;
}

function redirectComResultado(
  request: NextRequest,
  opts: { ok: boolean; returnTo?: string; agenteSlug?: string; email?: string; error?: string }
): NextResponse {
  const origin = appOrigin(request);
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

  const origin = appOrigin(request);
  const errorParam = request.nextUrl.searchParams.get("error");
  const stateRaw = request.nextUrl.searchParams.get("state")?.trim() || "";
  const code = request.nextUrl.searchParams.get("code")?.trim() || "";

  const state = parseGoogleOAuthState(stateRaw);
  const returnTo = state?.returnTo;

  if (errorParam) {
    return redirectComResultado(request, {
      ok: false,
      returnTo,
      agenteSlug: state?.agenteSlug,
      error: errorParam,
    });
  }

  if (!state) {
    return redirectComResultado(request, {
      ok: false,
      returnTo,
      error: "state_invalido_ou_expirado",
    });
  }

  if (!code) {
    return redirectComResultado(request, {
      ok: false,
      returnTo,
      agenteSlug: state.agenteSlug,
      error: "codigo_ausente",
    });
  }

  try {
    const tokens = await exchangeGoogleOAuthCode(code, origin);
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
      returnTo,
      agenteSlug: state.agenteSlug,
      email: profileEmail,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "oauth_falhou";
    return redirectComResultado(request, {
      ok: false,
      returnTo,
      agenteSlug: state.agenteSlug,
      error: msg,
    });
  }
}
