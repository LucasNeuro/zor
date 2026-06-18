import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
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

function supabaseAuthClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY ausentes no servidor.");
  }
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Login operacional — não aplica LOGIN_ALLOWED_APP_ROLES do CRM. */
export async function POST(request: NextRequest) {
  try {
    let body: { email?: string; password?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
    }

    const email = body.email?.trim();
    const password = body.password ?? "";
    if (!email || !password) {
      return NextResponse.json({ error: "E-mail e senha são obrigatórios." }, { status: 400 });
    }

    let result: Awaited<ReturnType<ReturnType<typeof supabaseAuthClient>["auth"]["signInWithPassword"]>>;
    try {
      const supabase = supabaseAuthClient();
      result = await supabase.auth.signInWithPassword({ email, password });
    } catch (err) {
      console.error("[api/auth/ops-login] Supabase:", err);
      const msg = isNetworkishError(err)
        ? "Não foi possível contactar o Supabase."
        : err instanceof Error
          ? err.message
          : "Erro ao autenticar.";
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: 401 });
    }

    const session = result.data.session;
    if (!session?.access_token) {
      return NextResponse.json({ error: "Sessão indisponível." }, { status: 502 });
    }

    const rowCheck = await verifyOpsUserForAuth(session.user.id, session.user.email);
    if (!rowCheck.ok) {
      return NextResponse.json({ error: rowCheck.error }, { status: 403 });
    }

    return NextResponse.json({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_in: session.expires_in,
      user: { id: session.user.id, email: session.user.email },
    });
  } catch (err) {
    console.error("[api/auth/ops-login] inesperado:", err);
    return NextResponse.json({ error: "Erro interno ao iniciar sessão operacional." }, { status: 500 });
  }
}
