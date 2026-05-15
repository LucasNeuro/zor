import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { CRM_ACCESS_COOKIE, fetchAuthUserFromAccessToken } from "@/lib/auth/crm-session";
import { getSafeReturnPath } from "@/lib/auth/safe-return-path";

/**
 * Rotas /api públicas ou com auth própria na route handler.
 * Escritório virtual (/office) e CRM (/crm): mesma sessão (cookie após login).
 */
function isPublicApiPath(pathname: string): boolean {
  if (pathname.startsWith("/api/whatsapp")) return true;
  if (pathname.startsWith("/api/health")) return true;
  if (pathname === "/api/parceiros/portal/verify") return true;
  if (pathname.startsWith("/api/validar/")) return true;
  if (pathname.startsWith("/api/ciclos/")) return true;
  if (pathname.startsWith("/api/cron/")) return true;
  if (pathname.startsWith("/api/ml/ciclo")) return true;
  if (pathname === "/api/auth/crm-session") return true;
  return false;
}

async function getSessionUser(request: NextRequest) {
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

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const sessionUser = await getSessionUser(request);

  if (pathname === "/login" || pathname.startsWith("/login/")) {
    if (sessionUser) {
      const url = request.nextUrl.clone();
      const next = url.searchParams.get("next");
      url.pathname = getSafeReturnPath(next, "/office");
      url.search = "";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (pathname === "/office" || pathname.startsWith("/office/")) {
    if (!sessionUser) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = "";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (pathname === "/crm" || pathname.startsWith("/crm/")) {
    if (!sessionUser) {
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

  if (sessionUser) {
    return NextResponse.next();
  }

  if (!validKey) {
    return NextResponse.json({ error: "Servidor não configurado" }, { status: 500 });
  }

  return NextResponse.json({ error: "Acesso negado" }, { status: 401 });
}

export const config = {
  matcher: [
    "/office",
    "/office/:path*",
    "/crm",
    "/crm/:path*",
    "/login",
    "/login/:path*",
    "/api/:path*",
  ],
};
