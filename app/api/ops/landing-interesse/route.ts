import { NextRequest, NextResponse } from "next/server";
import { crmDb } from "@/lib/crm/supabase-server";
import { requireOpsApiAccess } from "@/lib/ops/ops-api-auth";

export async function GET(request: NextRequest) {
  const denied = await requireOpsApiAccess(request);
  if (denied) return denied;

  const { data, error } = await crmDb()
    .from("waje_landing_interesse")
    .select("*")
    .order("criado_em", { ascending: false });

  if (error) {
    const msg = error.message;
    const missing = /waje_landing_interesse|does not exist|schema cache/i.test(msg);
    return NextResponse.json(
      { error: missing ? "Tabela waje_landing_interesse não existe no Supabase." : msg, schema_ready: !missing },
      { status: missing ? 503 : 500 },
    );
  }

  return NextResponse.json({ data: data ?? [], schema_ready: true });
}

export async function POST(request: NextRequest) {
  const denied = await requireOpsApiAccess(request);
  if (denied) return denied;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const nome = String(body.nome ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!nome || !email) {
    return NextResponse.json({ error: "Nome e e-mail são obrigatórios." }, { status: 400 });
  }

  const payload = {
    nome,
    email,
    telefone: body.telefone ? String(body.telefone).trim() : null,
    empresa: body.empresa ? String(body.empresa).trim() : null,
    mensagem: body.mensagem ? String(body.mensagem).trim() : null,
    interesse_principal: body.interesse_principal ? String(body.interesse_principal).trim() : null,
    tamanho_equipe: body.tamanho_equipe ? String(body.tamanho_equipe).trim() : null,
    prazo_inicio: body.prazo_inicio ? String(body.prazo_inicio).trim() : null,
    origem: body.origem ? String(body.origem).trim() : "landing_mini_bot",
    pagina_url: body.pagina_url ? String(body.pagina_url).trim() : null,
    respostas: Array.isArray(body.respostas) ? body.respostas : [],
  };

  const { data, error } = await crmDb()
    .from("waje_landing_interesse")
    .insert(payload)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}
