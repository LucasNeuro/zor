import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { excluirEmpresaCrm } from "@/lib/crm/excluir-cadastro-crm";
import {
  actorFromRequestHeaders,
  registrarAuditoriaCrm,
} from "@/lib/crm/registrar-auditoria-crm";
import { isMissingPgColumn } from "@/lib/tenant-default";
import { normalizarIdUuid } from "@/lib/crm/uuid-crm";

const EMPRESA_SELECT =
  "id, codigo, razao_social, nome_fantasia, cnpj, email, telefone, segmento, prefixo_mercado, cep, logradouro, numero, complemento, bairro, cidade, estado, ativo, acesso_habilitado, acesso_habilitado_em, criado_em, atualizado_em";
const EMPRESA_SELECT_FALLBACK =
  "id, codigo, razao_social, nome_fantasia, cnpj, email, telefone, segmento, prefixo_mercado, cidade, estado, ativo, criado_em";
const EMPRESA_PATCH_OPTIONAL_COLUMNS = [
  "nome_fantasia",
  "segmento",
  "cep",
  "logradouro",
  "numero",
  "complemento",
  "bairro",
  "acesso_habilitado",
  "acesso_habilitado_em",
  "atualizado_em",
] as const;

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

  const { id: rawId } = await params;
  const id = normalizarIdUuid(rawId);
  if (!id) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }

  const supabase = db();
  let { data, error } = await supabase
    .from("hub_empresas")
    .select(EMPRESA_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error && isMissingPgColumn(error)) {
    ({ data, error } = await supabase
      .from("hub_empresas")
      .select(EMPRESA_SELECT_FALLBACK)
      .eq("id", id)
      .maybeSingle());
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
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

  const updates: Record<string, unknown> = {
    atualizado_em: new Date().toISOString(),
  };

  const textFields = [
    "razao_social",
    "nome_fantasia",
    "cnpj",
    "email",
    "telefone",
    "segmento",
    "prefixo_mercado",
    "cep",
    "logradouro",
    "numero",
    "complemento",
    "bairro",
    "cidade",
    "estado",
  ] as const;
  for (const key of textFields) {
    if (key in body && body[key] != null) updates[key] = String(body[key]).trim();
  }

  if (typeof body.acesso_habilitado === "boolean") {
    updates.acesso_habilitado = body.acesso_habilitado;
    updates.acesso_habilitado_em = body.acesso_habilitado
      ? new Date().toISOString()
      : null;
  }

  if (typeof body.ativo === "boolean") {
    updates.ativo = body.ativo;
  }

  if (Object.keys(updates).length === 1) {
    return NextResponse.json({ error: "Nenhum campo para atualizar." }, { status: 400 });
  }

  const supabase = db();
  let result = await supabase
    .from("hub_empresas")
    .update(updates)
    .eq("id", id)
    .select(EMPRESA_SELECT)
    .maybeSingle();

  if (result.error && isMissingPgColumn(result.error)) {
    const fallbackUpdates = { ...updates };
    for (const key of EMPRESA_PATCH_OPTIONAL_COLUMNS) {
      if (isMissingPgColumn(result.error, key)) delete fallbackUpdates[key];
    }

    if (Object.keys(fallbackUpdates).length === 0) {
      return NextResponse.json({ error: "Nenhum campo compatível para atualizar." }, { status: 400 });
    }

    result = await supabase
      .from("hub_empresas")
      .update(fallbackUpdates)
      .eq("id", id)
      .select(EMPRESA_SELECT_FALLBACK)
      .maybeSingle();
  }

  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }
  if (!result.data) {
    return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
  }

  return NextResponse.json({ data: result.data });
}

export async function DELETE(
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

  const supabase = db();
  const { data: existente } = await supabase
    .from("hub_empresas")
    .select("id, razao_social, codigo, cnpj, email, telefone, prefixo_mercado")
    .eq("id", id)
    .maybeSingle();

  if (!existente) {
    return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
  }

  const actor = actorFromRequestHeaders(request.headers);

  const { result, httpStatus } = await excluirEmpresaCrm(supabase, id);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error || "Falha ao excluir." },
      { status: httpStatus }
    );
  }

  await registrarAuditoriaCrm(supabase, {
    tabela: "hub_empresas",
    operacao: "deletar",
    motivo: `Exclusão de empresa ${existente.codigo || id}`,
    actor,
    metadata: {
      registro_id: id,
      snapshot: existente,
    },
  });

  return NextResponse.json({
    ok: true,
    razao_social: existente.razao_social,
    codigo: existente.codigo,
  });
}
