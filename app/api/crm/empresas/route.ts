import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import {
  gerarCodigoEmpresa,
  validarEmpresaCadastro,
  type EmpresaCadastroPayload,
} from "@/lib/crm/empresa-cadastro";
import { defaultTenantId, isMissingPgColumn, tenantIdFromRequest } from "@/lib/tenant-default";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function supabaseConfigError(): string | null {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) {
    return "NEXT_PUBLIC_SUPABASE_URL nao esta definida no servidor.";
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return "SUPABASE_SERVICE_ROLE_KEY nao esta definida no servidor.";
  }
  return null;
}

const EMPRESA_INSERT_SELECT =
  "id, codigo, razao_social, nome_fantasia, cnpj, email, telefone, segmento, prefixo_mercado, cidade, estado, ativo, acesso_habilitado, acesso_habilitado_em, criado_em";

const EMPRESA_OPTIONAL_COLUMNS = [
  "tenant_id",
  "cep",
  "logradouro",
  "numero",
  "complemento",
  "bairro",
  "nome_fantasia",
  "segmento",
  "acesso_habilitado",
  "acesso_habilitado_em",
] as const;

async function insertHubEmpresa(
  supabase: SupabaseClient,
  row: Record<string, unknown>,
  tenantId: string
) {
  let payload: Record<string, unknown> = { ...row, tenant_id: tenantId };
  const baseRow = { ...row };

  for (let attempt = 0; attempt < EMPRESA_OPTIONAL_COLUMNS.length + 3; attempt++) {
    const { data, error } = await supabase
      .from("hub_empresas")
      .insert(payload)
      .select(EMPRESA_INSERT_SELECT)
      .single();

    if (!error) return { data, error: null };

    if (isMissingPgColumn(error, "tenant_id")) {
      delete (payload as Record<string, unknown>).tenant_id;
      delete (baseRow as Record<string, unknown>).tenant_id;
      payload = { ...baseRow };
      continue;
    }

    const missing = EMPRESA_OPTIONAL_COLUMNS.find((col) => isMissingPgColumn(error, col));
    if (missing) {
      delete (payload as Record<string, unknown>)[missing];
      delete (baseRow as Record<string, unknown>)[missing];
      payload =
        missing === "tenant_id" ? { ...baseRow } : { ...baseRow, tenant_id: tenantId };
      continue;
    }

    const code = "code" in error ? String(error.code) : "";
    const msg = "message" in error ? String(error.message) : "";
    if (code === "PGRST205" || msg.includes("hub_empresas")) {
      return {
        data: null,
        error: {
          message:
            "Tabela hub_empresas nao existe no Supabase. Execute a migracao 20260522140000_ensure_hub_empresas.sql no SQL Editor.",
          code,
        },
      };
    }
    return { data: null, error };
  }

  return { data: null, error: { message: "Falha ao gravar hub_empresas." } };
}

export async function GET(request: NextRequest) {
  const configErr = supabaseConfigError();
  if (configErr) {
    return NextResponse.json(
      { error: "CRM indisponivel: Supabase nao configurado no servidor.", detail: configErr },
      { status: 503 }
    );
  }

  const supabase = db();
  const { searchParams } = new URL(request.url);
  const busca = searchParams.get("busca") || "";
  const atoParam = searchParams.get("ativo");
  const ativo = atoParam === "" ? null : atoParam !== "false";
  const segmento = searchParams.get("segmento") || "";
  const prefixo_mercado = searchParams.get("prefixo_mercado") || "";
  const estado = searchParams.get("estado") || "";
  const offset = parseInt(searchParams.get("offset") || "0", 10);
  const limit = Math.min(parseInt(searchParams.get("limit") || "200", 10), 500);

  const EMPRESA_SELECT_LIST =
    "id, codigo, razao_social, nome_fantasia, cnpj, email, telefone, segmento, prefixo_mercado, cep, logradouro, numero, complemento, bairro, cidade, estado, ativo, acesso_habilitado, acesso_habilitado_em, tenant_id, criado_em, atualizado_em";
  const EMPRESA_SELECT_FALLBACK =
    "id, codigo, razao_social, nome_fantasia, cnpj, email, telefone, segmento, prefixo_mercado, cidade, estado, ativo, criado_em";

  const runList = (select: string) => {
    let query = supabase
      .from("hub_empresas")
      .select(select, { count: "exact" })
      .order("criado_em", { ascending: false })
      .range(offset, offset + limit - 1);

    if (ativo !== null) {
      query = query.eq("ativo", ativo);
    }
    if (segmento) {
      query = query.eq("segmento", segmento);
    }
    if (prefixo_mercado) {
      query = query.eq("prefixo_mercado", prefixo_mercado);
    }
    if (estado) {
      query = query.eq("estado", estado);
    }
    if (busca) {
      const b = busca.replace(/%/g, "");
      query = query.or(
        `razao_social.ilike.%${b}%,nome_fantasia.ilike.%${b}%,cnpj.ilike.%${b}%,email.ilike.%${b}%,codigo.ilike.%${b}%`
      );
    }
    return query;
  };

  let { data, error, count } = await runList(EMPRESA_SELECT_LIST);
  if (error) {
    const retryCols = [
      "acesso_habilitado",
      "acesso_habilitado_em",
      "tenant_id",
      "atualizado_em",
      "cep",
      "logradouro",
      "numero",
      "complemento",
      "bairro",
    ];
    if (retryCols.some((c) => isMissingPgColumn(error, c))) {
      ({ data, error, count } = await runList(EMPRESA_SELECT_FALLBACK));
    }
  }

  if (error) {
    const code = "code" in error ? String(error.code) : "";
    if (code === "PGRST205" || error.message?.includes("hub_empresas")) {
      return NextResponse.json(
        {
          error:
            "Tabela hub_empresas nao existe no Supabase. Execute a migracao 20260522140000_ensure_hub_empresas.sql no SQL Editor.",
          detail: error.message,
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [], total: count ?? 0 });
}

export async function POST(request: NextRequest) {
  const configErr = supabaseConfigError();
  if (configErr) {
    return NextResponse.json(
      { error: "CRM indisponivel: Supabase nao configurado no servidor.", detail: configErr },
      { status: 503 }
    );
  }

  const supabase = db();
  const tenantId = tenantIdFromRequest(request.headers) || defaultTenantId();

  let body: Partial<EmpresaCadastroPayload>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const validacao = validarEmpresaCadastro(body);
  if (!validacao.ok) {
    return NextResponse.json({ error: validacao.erro }, { status: 400 });
  }

  const d = validacao.data;

  const { data: dupCnpj } = await supabase
    .from("hub_empresas")
    .select("id, razao_social, codigo")
    .eq("cnpj", d.cnpj)
    .maybeSingle();

  if (dupCnpj) {
    return NextResponse.json(
      {
        error: `CNPJ já cadastrado para ${dupCnpj.razao_social} (${dupCnpj.codigo || "sem código"}).`,
        empresa_id: dupCnpj.id,
      },
      { status: 409 }
    );
  }

  if (d.telefone) {
    const { data: dupTel } = await supabase
      .from("hub_empresas")
      .select("id, razao_social")
      .eq("telefone", d.telefone)
      .maybeSingle();

    if (dupTel) {
      return NextResponse.json(
        {
          error: `Telefone já cadastrado para ${dupTel.razao_social}.`,
          empresa_id: dupTel.id,
        },
        { status: 409 }
      );
    }
  }

  const codigo = await gerarCodigoEmpresa(supabase);
  const now = new Date().toISOString();

  const row: Record<string, unknown> = {
    codigo,
    razao_social: d.razao_social,
    nome_fantasia: d.nome_fantasia,
    cnpj: d.cnpj,
    email: d.email,
    telefone: d.telefone,
    segmento: d.segmento,
    prefixo_mercado: d.prefixo_mercado,
    cep: d.cep,
    logradouro: d.logradouro,
    numero: d.numero,
    complemento: d.complemento,
    bairro: d.bairro,
    cidade: d.cidade,
    estado: d.estado,
    ativo: true,
    acesso_habilitado: true,
    acesso_habilitado_em: now,
    criado_em: now,
    atualizado_em: now,
  };

  const { data: created, error } = await insertHubEmpresa(supabase, row, tenantId);

  if (error) {
    const detail = "message" in error ? String(error.message) : "Erro desconhecido";
    const code = "code" in error ? String(error.code) : "";
    const status = code === "PGRST205" ? 503 : 500;
    return NextResponse.json({ error: detail, detail }, { status });
  }

  return NextResponse.json({ data: created }, { status: 201 });
}
