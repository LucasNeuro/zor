import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PESSOA_SELECT =
  "id, codigo, nome, telefone, email, documento, tipo, tipo_pessoa, empresa, origem, area_atuacao, cep, logradouro, bairro, cidade, estado, criado_em, atualizado_em";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function configError(): string | null {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) {
    return "NEXT_PUBLIC_SUPABASE_URL nao esta definida no servidor.";
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return "SUPABASE_SERVICE_ROLE_KEY nao esta definida no servidor.";
  }
  return null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const err = configError();
  if (err) {
    return NextResponse.json(
      { error: "CRM indisponivel: Supabase nao configurado no servidor.", detail: err },
      { status: 503 }
    );
  }

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }

  const supabase = db();
  const { data, error } = await supabase
    .from("hub_pessoas")
    .select(PESSOA_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Pessoa não encontrada." }, { status: 404 });
  }

  return NextResponse.json({ data });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const err = configError();
  if (err) {
    return NextResponse.json(
      { error: "CRM indisponivel: Supabase nao configurado no servidor.", detail: err },
      { status: 503 }
    );
  }

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const allowed = [
    "nome",
    "telefone",
    "email",
    "documento",
    "tipo",
    "tipo_pessoa",
    "empresa",
    "origem",
    "area_atuacao",
    "cep",
    "logradouro",
    "bairro",
    "cidade",
    "estado",
  ] as const;

  const updates: Record<string, unknown> = { atualizado_em: new Date().toISOString() };
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  if (Object.keys(updates).length === 1) {
    return NextResponse.json({ error: "Nenhum campo para atualizar." }, { status: 400 });
  }

  const supabase = db();
  const { data, error } = await supabase
    .from("hub_pessoas")
    .update(updates)
    .eq("id", id)
    .select(PESSOA_SELECT)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Pessoa não encontrada." }, { status: 404 });

  return NextResponse.json({ data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return NextResponse.json(
      { error: "Supabase não configurado no servidor." },
      { status: 503 }
    );
  }

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }

  const supabase = db();

  const { data: existente } = await supabase
    .from("hub_pessoas")
    .select("id, nome, codigo")
    .eq("id", id)
    .maybeSingle();

  if (!existente) {
    return NextResponse.json({ error: "Pessoa não encontrada." }, { status: 404 });
  }

  await supabase.from("hub_leads_crm").update({ pessoa_id: null }).eq("pessoa_id", id);

  const { error } = await supabase.from("hub_pessoas").delete().eq("id", id);

  if (error) {
    const code = "code" in error ? String(error.code) : "";
    if (code === "23503") {
      return NextResponse.json(
        {
          error:
            "Não é possível excluir: este cadastro está vinculado a outros registros do sistema.",
        },
        { status: 409 }
      );
    }
    const msg = "message" in error ? String(error.message) : "Falha ao excluir.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    nome: existente.nome,
    codigo: existente.codigo,
  });
}
