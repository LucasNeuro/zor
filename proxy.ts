import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Webhook WhatsApp — protegido por HMAC, não por API key
  if (pathname.startsWith("/api/whatsapp")) {
    return NextResponse.next();
  }

  // Rotas públicas
  if (pathname.startsWith("/api/health")) {
    return NextResponse.next();
  }

  // Todas as outras /api/* exigem x-api-key
  if (pathname.startsWith("/api/")) {
    const apiKey = request.headers.get("x-api-key");
    const validKey = process.env.INTERNAL_API_KEY;

    if (!validKey) {
      return NextResponse.json(
        { error: "Servidor não configurado" },
        { status: 500 }
      );
    }

    if (apiKey !== validKey) {
      return NextResponse.json(
        { error: "Acesso negado" },
        { status: 401 }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
