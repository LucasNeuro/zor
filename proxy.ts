import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { CRM_ACCESS_COOKIE, fetchAuthUserFromAccessToken } from "@/lib/auth/crm-session";
import { getSafeReturnPath } from "@/lib/auth/safe-return-path";

/**
 * Rotas /api públicas ou com auth própria na route handler.
 * CRM (/crm): sessão via cookie após login.
 */
function isPublicApiPath(pathname: string): boolean {
  if (pathname.startsWith("/api/public/")) return true;
  if (pathname.startsWith("/api/whatsapp")) return true;
  if (pathname.startsWith("/api/email/")) return true;
  if (pathname.startsWith("/api/health")) return true;
  if (pathname === "/api/parceiros/portal/verify") return true;
  if (pathname.startsWith("/api/validar/")) return true;
  if (pathname.startsWith("/api/ciclos/")) return true;
  if (pathname.startsWith("/api/cron/")) return true;
  if (pathname.startsWith("/api/ml/ciclo")) return true;
  if (pathname.startsWith("/api/auth/")) return true;
  /** Google OAuth: callback vem sem cookie de sessão (redirect cross-site). */
  if (pathname.startsWith("/api/hub/email/oauth/google/")) return true;
  return false;
}

async function getCrmSessionUser(request: NextRequest) {
  const token = request.cookies.get(CRM_ACCESS_COOKIE)?.value;
  if (!token) return null;
  try {
    const authUser = await fetchAuthUserFromAccessToken(token);
    if (!authUser) return null;
    return authUser;
  } catch {
    return null;
  }
}

function mapLegacyOpsPath(pathname: string): string {
  if (pathname === "/ops" || pathname === "/ops/") return "/crm/waje/tenants";
  if (pathname === "/ops/login" || pathname.startsWith("/ops/login/")) return "/login";
  if (pathname === "/ops/tenants" || pathname.startsWith("/ops/tenants/")) return "/crm/waje/tenants";
  if (pathname === "/ops/agentes" || pathname.startsWith("/ops/agentes/")) return "/crm/waje/agentes";
  if (pathname === "/ops/pagamentos" || pathname.startsWith("/ops/pagamentos/")) return "/crm/waje/pagamentos";
  return "/crm/waje/tenants";
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const crmSessionUser = await getCrmSessionUser(request);

  if (pathname === "/login" || pathname.startsWith("/login/")) {
    if (crmSessionUser) {
      const url = request.nextUrl.clone();
      const next = url.searchParams.get("next");
      url.pathname = getSafeReturnPath(next, "/crm");
      url.search = "";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (pathname === "/ops" || pathname.startsWith("/ops/")) {
    const url = request.nextUrl.clone();
    url.pathname = mapLegacyOpsPath(pathname);
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (pathname === "/crm" || pathname.startsWith("/crm/")) {
    if (!crmSessionUser) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = "";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  if (isPublicApiPath(pathname)) {
    return NextResponse.next();
  }

  const validKey = process.env.INTERNAL_API_KEY;
  const apiKey = request.headers.get("x-api-key");

  if (validKey && apiKey === validKey) {
    return NextResponse.next();
  }

  if (crmSessionUser) {
    return NextResponse.next();
  }

  if (!validKey) {
    return NextResponse.json(
      {
        error: "API não autenticável neste pedido",
        detail:
          "Sem sessão CRM e sem INTERNAL_API_KEY no servidor. Para chamadas sem cookie: defina INTERNAL_API_KEY e no cliente NEXT_PUBLIC_INTERNAL_API_KEY (mesmo valor). Para validar o cookie no middleware: NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY devem estar definidos.",
      },
      { status: 401 }
    );
  }

  return NextResponse.json({ error: "Acesso negado" }, { status: 401 });
}

export const config = {
  matcher: [
    "/crm",
    "/crm/:path*",
    "/login",
    "/login/:path*",
    "/ops",
    "/ops/:path*",
    "/api/:path*",
  ],
};
