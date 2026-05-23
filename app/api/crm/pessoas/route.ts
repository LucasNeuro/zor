import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import {
  gerarCodigoPessoa,
  validarPessoaCadastro,
  type PessoaCadastroPayload,
} from "@/lib/crm/pessoa-cadastro";
import { defaultTenantId, isMissingPgColumn, tenantIdFromRequest } from "@/lib/tenant-default";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}


const HUB_PESSOA_OPTIONAL_COLUMNS = [
  "tenant_id",
  "area_atuacao",
  "cep",
  "logradouro",
  "bairro",
] as const;

const PESSOA_INSERT_SELECT =
  "id, codigo, nome, telefone, email, tipo, tipo_pessoa, empresa, area_atuacao, cidade, estado, cep, criado_em";

function supabaseConfigError(): string | null {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) {
    return "NEXT_PUBLIC_SUPABASE_URL nao esta definida no servidor.";
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return "SUPABASE_SERVICE_ROLE_KEY nao esta definida no servidor.";
  }
  return null;
}

async function insertHubPessoa(
  supabase: SupabaseClient,
  row: Record<string, unknown>,
  tenantId: string
) {
  let payload: Record<string, unknown> = { ...row, tenant_id: tenantId };
  const baseRow = { ...row };
  for (let attempt = 0; attempt < HUB_PESSOA_OPTIONAL_COLUMNS.length + 2; attempt++) {
    const { data, error } = await supabase
      .from("hub_pessoas")
      .insert(payload)
      .select(PESSOA_INSERT_SELECT)
      .single();
    if (!error) return { data, error: null };
    if (isMissingPgColumn(error, "tenant_id")) {
      payload = { ...baseRow };
      for (const col of HUB_PESSOA_OPTIONAL_COLUMNS) {
        if (col === "tenant_id") continue;
        delete (payload as Record<string, unknown>)[col];
        delete (baseRow as Record<string, unknown>)[col];
      }
      continue;
    }
    const missing = HUB_PESSOA_OPTIONAL_COLUMNS.find((col) => isMissingPgColumn(error, col));
    if (missing) {
      delete (payload as Record<string, unknown>)[missing];
      delete (baseRow as Record<string, unknown>)[missing];
      payload =
        missing === "tenant_id"
          ? { ...baseRow }
          : { ...baseRow, tenant_id: tenantId };
      continue;
    }
    const code = "code" in error ? String(error.code) : "";
    const msg = "message" in error ? String(error.message) : "";
    if (code === "PGRST205" || msg.includes("hub_pessoas")) {
      return {
        data: null,
        error: {
          message:
            "Tabela hub_pessoas nao existe no Supabase. Execute a migracao 20260514000000_ensure_hub_pessoas.sql no SQL Editor.",
          code,
        },
      };
    }
    return { data: null, error };
  }
  return { data: null, error: { message: "Falha ao gravar hub_pessoas." } };
}

async function contarPorTipo(
  supabase: SupabaseClient,
  tipo: "PF" | "PJ"
): Promise<number> {
  const { count, error } = await supabase
    .from("hub_pessoas")
    .select("*", { count: "exact", head: true })
    .eq("tipo_pessoa", tipo);
  if (error) return 0;
  return count ?? 0;
}

export async function GET(request: NextRequest) {
  const supabase = db();
  const { searchParams } = new URL(request.url);
  const busca = searchParams.get("busca") || "";
  const tipo_pessoa = searchParams.get("tipo_pessoa") || "";
  const offset = parseInt(searchParams.get("offset") || "0", 10);
  const limit = 20;

  let query = supabase
    .from("hub_pessoas")
    .select(
      "id, codigo, nome, telefone, email, tipo, tipo_pessoa, empresa, area_atuacao, cidade, estado, cep, criado_em",
      { count: "exact" }
    )
    .order("criado_em", { ascending: false })
    .range(offset, offset + limit - 1);

  if (busca) {
    query = query.or(
      `nome.ilike.%${busca}%,email.ilike.%${busca}%,telefone.ilike.%${busca}%`
    );
  }
  if (tipo_pessoa) {
    query = query.eq("tipo_pessoa", tipo_pessoa);
  }

  const [{ data, error, count }, pf, pj] = await Promise.all([
    query,
    contarPorTipo(supabase, "PF"),
    contarPorTipo(supabase, "PJ"),
  ]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    data: data ?? [],
    total: count ?? 0,
    stats: { pf, pj },
  });
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
  const tenantId = tenantIdFromRequest(request.headers);

  let body: Partial<PessoaCadastroPayload>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const validacao = validarPessoaCadastro(body);
  if (!validacao.ok) {
    return NextResponse.json({ error: validacao.erro }, { status: 400 });
  }

  const d = validacao.data;

  const { data: dupTel } = await supabase
    .from("hub_pessoas")
    .select("id, nome, codigo")
    .eq("telefone", d.telefone)
    .maybeSingle();

  if (dupTel) {
    return NextResponse.json(
      {
        error: `Telefone já cadastrado para ${dupTel.nome} (${dupTel.codigo || "sem código"}).`,
        pessoa_id: dupTel.id,
        codigo: dupTel.codigo,
        nome: dupTel.nome,
      },
      { status: 409 }
    );
  }

  if (d.documento) {
    const { data: dupDoc } = await supabase
      .from("hub_pessoas")
      .select("id, nome, codigo")
      .eq("documento", d.documento)
      .maybeSingle();

    if (dupDoc) {
      const label = d.tipo_pessoa === "PF" ? "CPF" : "CNPJ";
      return NextResponse.json(
        {
          error: `${label} já cadastrado para ${dupDoc.nome} (${dupDoc.codigo || "sem código"}).`,
          pessoa_id: dupDoc.id,
          codigo: dupDoc.codigo,
          nome: dupDoc.nome,
        },
        { status: 409 }
      );
    }
  }

  const codigo = await gerarCodigoPessoa(supabase);
  const now = new Date().toISOString();

  const row: Record<string, unknown> = {
    codigo,
    nome: d.nome,
    telefone: d.telefone,
    email: d.email,
    documento: d.documento,
    tipo: "cliente",
    tipo_pessoa: d.tipo_pessoa,
    empresa: d.tipo_pessoa === "PJ" ? d.empresa : null,
    area_atuacao: d.area_atuacao,
    cep: d.cep,
    logradouro: d.logradouro,
    bairro: d.bairro,
    cidade: d.cidade,
    estado: d.estado,
    origem: d.origem,
    criado_em: now,
    atualizado_em: now,
  };

  const { data: created, error } = await insertHubPessoa(supabase, row, tenantId || defaultTenantId());

  if (error) {
    if ("code" in error && error.code === "23505") {
      return NextResponse.json(
        { error: "Registro duplicado (telefone ou documento ja existe)." },
        { status: 409 }
      );
    }
    const detail = "message" in error ? String(error.message) : "Erro desconhecido";
    const status = "code" in error && error.code === "PGRST205" ? 503 : 500;
    return NextResponse.json({ error: detail, detail }, { status });
  }

  return NextResponse.json({ data: created }, { status: 201 });
}

