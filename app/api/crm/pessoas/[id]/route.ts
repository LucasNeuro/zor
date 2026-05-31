import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import {
  dadosExtrasEndereco,
  enriquecerPessoaDaDb,
  HUB_PESSOA_SELECT_CORE,
  HUB_PESSOA_SELECT_EXTENDED,
} from "@/lib/crm/hub-pessoas-compat";
import { isMissingPgColumn } from "@/lib/tenant-default";
import { excluirPessoaCrm } from "@/lib/crm/excluir-cadastro-crm";
import {
  actorFromRequestHeaders,
  registrarAuditoriaCrm,
} from "@/lib/crm/registrar-auditoria-crm";
import { normalizarIdUuid } from "@/lib/crm/uuid-crm";

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
  try {
    const err = configError();
    if (err) {
      return NextResponse.json(
        { error: "CRM indisponivel: Supabase nao configurado no servidor.", detail: err },
        { status: 503 }
      );
    }

    const { id: rawId } = await params;
    const id = normalizarIdUuid(rawId);
    if (!id) {
      return NextResponse.json({ error: "ID inválido." }, { status: 400 });
    }

    const supabase = db();
    let res = await supabase
      .from("hub_pessoas")
      .select(HUB_PESSOA_SELECT_EXTENDED)
      .eq("id", id)
      .maybeSingle();

    if (res.error && isMissingPgColumn(res.error)) {
      res = await supabase
        .from("hub_pessoas")
        .select(HUB_PESSOA_SELECT_CORE)
        .eq("id", id)
        .maybeSingle();
    }

    if (res.error) {
      return NextResponse.json({ error: res.error.message }, { status: 500 });
    }
    if (!res.data) {
      return NextResponse.json({ error: "Pessoa não encontrada." }, { status: 404 });
    }

    return NextResponse.json({ data: enriquecerPessoaDaDb(res.data as Record<string, unknown>) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro interno ao carregar contacto.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
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

  const { id: rawId } = await params;
  const id = normalizarIdUuid(rawId);
  if (!id) {
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
    "numero",
    "complemento",
    "bairro",
    "cidade",
    "estado",
  ] as const;

  const updates: Record<string, unknown> = { atualizado_em: new Date().toISOString() };
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  const enderecoKeys = [
    "area_atuacao",
    "cep",
    "logradouro",
    "numero",
    "complemento",
    "bairro",
  ] as const;
  const temEndereco = enderecoKeys.some((k) => k in body);
  if (temEndereco) {
    const extrasPatch = dadosExtrasEndereco({
      area_atuacao: (body.area_atuacao as string) ?? null,
      cep: (body.cep as string) ?? null,
      logradouro: (body.logradouro as string) ?? null,
      numero: (body.numero as string) ?? null,
      complemento: (body.complemento as string) ?? null,
      bairro: (body.bairro as string) ?? null,
    });
    const { data: atual } = await db()
      .from("hub_pessoas")
      .select("dados_extras")
      .eq("id", id)
      .maybeSingle();
    const prev =
      atual?.dados_extras && typeof atual.dados_extras === "object" && !Array.isArray(atual.dados_extras)
        ? (atual.dados_extras as Record<string, unknown>)
        : {};
    updates.dados_extras = { ...prev, ...extrasPatch };
  }

  if (Object.keys(updates).length === 1) {
    return NextResponse.json({ error: "Nenhum campo para atualizar." }, { status: 400 });
  }

  const supabase = db();
  let result = await supabase
    .from("hub_pessoas")
    .update(updates)
    .eq("id", id)
    .select(HUB_PESSOA_SELECT_EXTENDED)
    .maybeSingle();

  if (result.error && isMissingPgColumn(result.error)) {
    const fallback = { ...updates };
    for (const k of enderecoKeys) delete fallback[k];
    result = await supabase
      .from("hub_pessoas")
      .update(fallback)
      .eq("id", id)
      .select(HUB_PESSOA_SELECT_CORE)
      .maybeSingle();
  }

  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
  if (!result.data) return NextResponse.json({ error: "Pessoa não encontrada." }, { status: 404 });

  return NextResponse.json({
    data: enriquecerPessoaDaDb(result.data as Record<string, unknown>),
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return NextResponse.json(
      { error: "Supabase não configurado no servidor." },
      { status: 503 }
    );
  }

  const { id: rawId } = await params;
  const id = normalizarIdUuid(rawId);
  if (!id) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }

  const supabase = db();

  const { data: existente } = await supabase
    .from("hub_pessoas")
    .select("id, nome, codigo, telefone, email, tipo_pessoa, documento")
    .eq("id", id)
    .maybeSingle();

  if (!existente) {
    return NextResponse.json({ error: "Pessoa não encontrada." }, { status: 404 });
  }

  const actor = actorFromRequestHeaders(request.headers);

  const { result, httpStatus } = await excluirPessoaCrm(supabase, id);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error || "Falha ao excluir." },
      { status: httpStatus }
    );
  }

  await registrarAuditoriaCrm(supabase, {
    tabela: "hub_pessoas",
    operacao: "deletar",
    motivo: `Exclusão de contacto ${existente.codigo || id}`,
    actor,
    metadata: {
      registro_id: id,
      snapshot: existente,
    },
  });

  return NextResponse.json({
    ok: true,
    nome: existente.nome,
    codigo: existente.codigo,
  });
}
