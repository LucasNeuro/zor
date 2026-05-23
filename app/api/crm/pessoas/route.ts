import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import {
  enriquecerListaPessoas,
  enriquecerPessoaDaDb,
  HUB_PESSOA_SELECT_CORE,
  montarRowInsertHubPessoa,
} from "@/lib/crm/hub-pessoas-compat";
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

const HUB_PESSOA_OPTIONAL_INSERT_COLUMNS = [
  "tenant_id",
  "area_atuacao",
  "cep",
  "logradouro",
  "bairro",
] as const;

function supabaseConfigError(): string | null {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) {
    return "NEXT_PUBLIC_SUPABASE_URL nao esta definida no servidor.";
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return "SUPABASE_SERVICE_ROLE_KEY nao esta definida no servidor.";
  }
  return null;
}

function isTenantFkError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string };
  if (e.code !== "23503") return false;
  const m = (e.message || "").toLowerCase();
  return m.includes("tenant") || m.includes("hub_tenants");
}

async function insertHubPessoa(
  supabase: SupabaseClient,
  row: Record<string, unknown>,
  tenantId: string
) {
  const baseRow = { ...row };
  let withTenant = false;
  let payload: Record<string, unknown> = { ...baseRow };
  let lastError: { message?: string; code?: string } | null = null;

  if (tenantId) {
    withTenant = true;
    payload = { ...baseRow, tenant_id: tenantId };
  }

  for (let attempt = 0; attempt < HUB_PESSOA_OPTIONAL_INSERT_COLUMNS.length + 5; attempt++) {
    const { data, error } = await supabase
      .from("hub_pessoas")
      .insert(payload)
      .select(HUB_PESSOA_SELECT_CORE)
      .single();

    if (!error && data) {
      return { data: enriquecerPessoaDaDb(data as Record<string, unknown>), error: null };
    }

    if (error) lastError = error;

    if (isTenantFkError(error)) {
      withTenant = false;
      delete (baseRow as Record<string, unknown>).tenant_id;
      payload = { ...baseRow };
      continue;
    }

    if (isMissingPgColumn(error, "tenant_id")) {
      withTenant = false;
      delete (baseRow as Record<string, unknown>).tenant_id;
      payload = { ...baseRow };
      continue;
    }

    const missing = HUB_PESSOA_OPTIONAL_INSERT_COLUMNS.find((col) =>
      isMissingPgColumn(error, col)
    );
    if (missing) {
      delete (baseRow as Record<string, unknown>)[missing];
      payload = withTenant ? { ...baseRow, tenant_id: tenantId } : { ...baseRow };
      continue;
    }

    const code = error && "code" in error ? String(error.code) : "";
    const msg = error && "message" in error ? String(error.message) : "";
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
    if (error) return { data: null, error };
  }

  return {
    data: null,
    error: {
      message:
        lastError?.message?.trim() ||
        "Falha ao gravar hub_pessoas. Execute 20260521130000_hub_pessoas_area_endereco.sql no Supabase.",
      code: lastError?.code,
    },
  };
}

async function listarPessoas(
  supabase: SupabaseClient,
  params: { busca: string; tipo_pessoa: string; offset: number; limit: number }
) {
  const run = (select: string) => {
    let query = supabase
      .from("hub_pessoas")
      .select(select, { count: "exact" })
      .order("criado_em", { ascending: false })
      .range(params.offset, params.offset + params.limit - 1);

    if (params.busca) {
      query = query.or(
        `nome.ilike.%${params.busca}%,email.ilike.%${params.busca}%,telefone.ilike.%${params.busca}%`
      );
    }
    if (params.tipo_pessoa) {
      query = query.eq("tipo_pessoa", params.tipo_pessoa);
    }
    return query;
  };

  const extended =
    `${HUB_PESSOA_SELECT_CORE}, area_atuacao, cep, logradouro, bairro`;
  const first = await run(extended);
  if (!first.error) return first;

  const missingCol = ["area_atuacao", "cep", "logradouro", "bairro"].some((c) =>
    isMissingPgColumn(first.error, c)
  );
  if (missingCol || isMissingPgColumn(first.error)) {
    return run(HUB_PESSOA_SELECT_CORE);
  }
  return first;
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

  const [{ data, error, count }, pf, pj] = await Promise.all([
    listarPessoas(supabase, { busca, tipo_pessoa, offset, limit }),
    contarPorTipo(supabase, "PF"),
    contarPorTipo(supabase, "PJ"),
  ]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    data: enriquecerListaPessoas((data ?? []) as unknown as Record<string, unknown>[]),
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
  const row = montarRowInsertHubPessoa(d, codigo, now);

  const { data: created, error } = await insertHubPessoa(
    supabase,
    row,
    tenantId || defaultTenantId()
  );

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
