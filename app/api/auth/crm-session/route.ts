import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { CRM_ACCESS_COOKIE, fetchAuthUserFromAccessToken } from "@/lib/auth/crm-session";
import { shouldVerifyPublicUser, verifyPublicUserForAuth } from "@/lib/auth/verify-public-user";

function isNetworkishError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const m = err.message.toLowerCase();
  return (
    m.includes("fetch failed") ||
    m.includes("ecconnrefused") ||
    m.includes("unable to verify") ||
    m.includes("certificate") ||
    m.includes("econnreset") ||
    err.name === "TypeError"
  );
}

export async function POST(request: NextRequest) {
  try {
    let body: { access_token?: string; expires_in?: number };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
    }

    const access_token = body.access_token?.trim();
    if (!access_token) {
      return NextResponse.json({ error: "access_token obrigatório" }, { status: 400 });
    }

    let authUser: { id: string; email?: string | null } | null;
    try {
      authUser = await fetchAuthUserFromAccessToken(access_token);
    } catch (err) {
      console.error("[api/auth/crm-session] validação token Supabase:", err);
      const hint =
        process.env.NODE_ENV === "development" && err instanceof Error
          ? ` (${err.message})`
          : "";
      const msg = isNetworkishError(err)
        ? `Não foi possível contactar o Supabase (rede ou certificado SSL).${hint} Em desenvolvimento local use \`npm run dev\` (workaround TLS no Node); se estiver a usar \`npm run dev:strict-tls\`, volte ao \`dev\`. Ver README.`
        : `Falha ao validar a sessão com o fornecedor de autenticação.${hint}`;
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    if (!authUser) {
      return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });
    }

    if (shouldVerifyPublicUser()) {
      try {
        const rowCheck = await verifyPublicUserForAuth(authUser.id, authUser.email);
        if (!rowCheck.ok) {
          return NextResponse.json({ error: rowCheck.error }, { status: 403 });
        }
      } catch (err) {
        console.error("[api/auth/crm-session] verify public.users:", err);
        return NextResponse.json(
          { error: "Erro ao validar o perfil do utilizador na base de dados. Contacte o administrador." },
          { status: 502 },
        );
      }
    }

    const maxAge =
      typeof body.expires_in === "number" && body.expires_in > 0
        ? body.expires_in
        : 60 * 60 * 24 * 7;

    const jar = await cookies();
    jar.set(CRM_ACCESS_COOKIE, access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/auth/crm-session] POST inesperado:", err);
    return NextResponse.json(
      { error: "Erro interno ao concluir o login. Contacte o administrador." },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  try {
    const jar = await cookies();
    jar.set(CRM_ACCESS_COOKIE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/auth/crm-session] DELETE:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
