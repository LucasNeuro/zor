import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function supabaseConfigError(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  if (!url || !anonKey) {
    return "Supabase não configurado no servidor (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).";
  }
  if (url.includes("env-ausente.invalid")) {
    return "URL do Supabase inválida no .env.local.";
  }
  return null;
}

export async function POST(request: NextRequest) {
  const cfgErr = supabaseConfigError();
  if (cfgErr) {
    return NextResponse.json({ ok: false, error: cfgErr }, { status: 503 });
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

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim(),
  );

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: fullName ? { data: { full_name: fullName } } : undefined,
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  const user = data.user;
  if (!user?.id) {
    return NextResponse.json(
      { ok: false, error: "Não foi possível criar o usuário no Supabase Auth." },
      { status: 500 },
    );
  }

  const session = data.session;
  return NextResponse.json({
    ok: true,
    user: { id: user.id, email: user.email },
    session: session
      ? {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_in: session.expires_in,
        }
      : null,
  });
}
