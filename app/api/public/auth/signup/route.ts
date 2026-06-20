import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { ensureAuthUserWithPassword } from "@/lib/crm/auth-admin-user";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";

function mapAuthError(message: string): string {
  const m = message.toLowerCase();
  if (
    m.includes("already registered") ||
    m.includes("already been registered") ||
    m.includes("user already registered") ||
    m.includes("already exists")
  ) {
    return "Este e-mail já está cadastrado. Entre em Login ou use outro e-mail.";
  }
  if (m.includes("invalid") && m.includes("email")) {
    return "E-mail inválido. Verifique o endereço informado.";
  }
  if (m.includes("password") && (m.includes("weak") || m.includes("short") || m.includes("least"))) {
    return "A senha deve ter pelo menos 6 caracteres.";
  }
  console.error("[signup/auth]", message);
  return "Não foi possível criar a conta agora. Tente novamente em alguns instantes.";
}

function anonConfigError(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  if (!url || !anonKey) return "anon_missing";
  if (url.includes("env-ausente.invalid")) return "url_invalid";
  return null;
}

export async function POST(request: NextRequest) {
  const cfgErr = crmConfigError();
  if (cfgErr) {
    console.error("[signup/config]", cfgErr);
    return NextResponse.json(
      { ok: false, error: "Cadastro temporariamente indisponível. Tente novamente em alguns instantes." },
      { status: 503 },
    );
  }
  if (anonConfigError()) {
    console.error("[signup/config] anon key ausente ou inválida");
    return NextResponse.json(
      { ok: false, error: "Cadastro temporariamente indisponível. Tente novamente em alguns instantes." },
      { status: 503 },
    );
  }

  let body: { email?: string; password?: string; fullName?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido." }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const fullName = String(body.fullName ?? "").trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "E-mail inválido." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ ok: false, error: "A senha deve ter pelo menos 6 caracteres." }, { status: 400 });
  }

  const ensured = await ensureAuthUserWithPassword(crmDb(), {
    email,
    password,
    name: fullName || email,
  });

  if (!ensured.ok) {
    return NextResponse.json({ ok: false, error: mapAuthError(ensured.error) }, { status: 400 });
  }

  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim(),
  );

  const { data: signIn, error: signInErr } = await anon.auth.signInWithPassword({ email, password });
  if (signInErr) {
    console.error("[signup/sign-in]", signInErr.message);
    return NextResponse.json({
      ok: true,
      user: { id: ensured.authId, email },
      session: null,
    });
  }

  const session = signIn.session;
  return NextResponse.json({
    ok: true,
    user: { id: signIn.user?.id ?? ensured.authId, email },
    session: session
      ? {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_in: session.expires_in,
        }
      : null,
  });
}
