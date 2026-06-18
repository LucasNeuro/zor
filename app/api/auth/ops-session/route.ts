import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { fetchAuthUserFromAccessToken, OPS_ACCESS_COOKIE } from "@/lib/auth/ops-session";
import { verifyOpsUserForAuth } from "@/lib/auth/verify-ops-user";

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
      console.error("[api/auth/ops-session] validação token:", err);
      const msg = isNetworkishError(err)
        ? "Não foi possível contactar o Supabase."
        : "Falha ao validar a sessão.";
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    if (!authUser) {
      return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });
    }

    const rowCheck = await verifyOpsUserForAuth(authUser.id, authUser.email);
    if (!rowCheck.ok) {
      return NextResponse.json({ error: rowCheck.error }, { status: 403 });
    }

    const maxAge =
      typeof body.expires_in === "number" && body.expires_in > 0
        ? body.expires_in
        : 60 * 60 * 24 * 7;

    const jar = await cookies();
    jar.set(OPS_ACCESS_COOKIE, access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/auth/ops-session] POST:", err);
    return NextResponse.json({ error: "Erro interno ao concluir login operacional." }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const jar = await cookies();
    jar.set(OPS_ACCESS_COOKIE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/auth/ops-session] DELETE:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
