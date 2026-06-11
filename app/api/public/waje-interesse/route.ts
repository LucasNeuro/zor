import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import type { WajeMiniBotResposta } from "@/lib/landing/waje-mini-bot-flow";

type Payload = {
  nome?: string;
  email?: string;
  telefone?: string;
  empresa?: string;
  mensagem?: string;
  interesse_principal?: string;
  tamanho_equipe?: string;
  prazo_inicio?: string;
  respostas?: WajeMiniBotResposta[];
  pagina_url?: string;
};

function trimOpt(v: unknown, max = 500): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
}

function emailValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: NextRequest) {
  const cfgErr = crmConfigError();
  if (cfgErr) {
    return NextResponse.json({ ok: false, error: cfgErr }, { status: 503 });
  }

  let body: Payload;
  try {
    body = (await request.json()) as Payload;
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido." }, { status: 400 });
  }

  const nome = trimOpt(body.nome, 120);
  const email = trimOpt(body.email, 180)?.toLowerCase() ?? "";
  if (!nome || !email) {
    return NextResponse.json({ ok: false, error: "Informe nome e e-mail." }, { status: 400 });
  }
  if (!emailValido(email)) {
    return NextResponse.json({ ok: false, error: "E-mail inválido." }, { status: 400 });
  }

  const telefone = trimOpt(body.telefone, 30);
  const empresa = trimOpt(body.empresa, 160);
  const mensagem = trimOpt(body.mensagem, 2000);
  const interesse_principal = trimOpt(body.interesse_principal, 120);
  const tamanho_equipe = trimOpt(body.tamanho_equipe, 80);
  const prazo_inicio = trimOpt(body.prazo_inicio, 80);
  const pagina_url = trimOpt(body.pagina_url, 500);
  const respostas = Array.isArray(body.respostas) ? body.respostas.slice(0, 20) : [];

  const userAgent = request.headers.get("user-agent")?.slice(0, 400) ?? null;

  const db = crmDb();
  const { data, error } = await db
    .from("waje_landing_interesse")
    .insert({
      nome,
      email,
      telefone,
      empresa,
      mensagem,
      interesse_principal,
      tamanho_equipe,
      prazo_inicio,
      respostas,
      origem: "landing_mini_bot",
      pagina_url,
      user_agent: userAgent,
    })
    .select("id")
    .single();

  if (error) {
    const msg = error.message || "Erro ao gravar interesse.";
    const missingTable = /waje_landing_interesse|does not exist|schema cache/i.test(msg);
    return NextResponse.json(
      {
        ok: false,
        error: missingTable
          ? "Tabela waje_landing_interesse ainda não existe no Supabase. Aplique a migração 20260710100000_waje_landing_interesse.sql."
          : msg,
      },
      { status: missingTable ? 503 : 500 }
    );
  }

  return NextResponse.json({ ok: true, id: data?.id ?? null });
}
