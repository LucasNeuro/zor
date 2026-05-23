import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import {
  gerarCodigoNegocio,
  validarNegocioCadastro,
  type NegocioCadastroPayload,
} from "@/lib/crm/negocio-cadastro";
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

const NEGOCIO_INSERT_SELECT =
  "id, codigo, titulo, prefixo_mercado, status, etapa, valor_estimado, valor_fechado, data_previsao_fechamento, lead_id, pessoa_id, criado_em";

const NEGOCIO_OPTIONAL_COLUMNS = ["tenant_id", "lead_id", "pessoa_id", "descricao", "tipo"] as const;

async function insertHubNegocio(
  supabase: SupabaseClient,
  row: Record<string, unknown>,
  tenantId: string
) {
  let payload: Record<string, unknown> = { ...row, tenant_id: tenantId };
  const baseRow = { ...row };

  for (let attempt = 0; attempt < NEGOCIO_OPTIONAL_COLUMNS.length + 3; attempt++) {
    const { data, error } = await supabase
      .from("hub_negocios")
      .insert(payload)
      .select(NEGOCIO_INSERT_SELECT)
      .single();

    if (!error) return { data, error: null };

    if (isMissingPgColumn(error, "tenant_id")) {
      delete (payload as Record<string, unknown>).tenant_id;
      delete (baseRow as Record<string, unknown>).tenant_id;
      payload = { ...baseRow };
      continue;
    }

    const missing = NEGOCIO_OPTIONAL_COLUMNS.find((col) => isMissingPgColumn(error, col));
    if (missing) {
      delete (payload as Record<string, unknown>)[missing];
      delete (baseRow as Record<string, unknown>)[missing];
      payload =
        missing === "tenant_id" ? { ...baseRow } : { ...baseRow, tenant_id: tenantId };
      continue;
    }

    const code = "code" in error ? String(error.code) : "";
    const msg = "message" in error ? String(error.message) : "";
    if (code === "PGRST205" || msg.includes("hub_negocios")) {
      return {
        data: null,
        error: {
          message:
            "Tabela hub_negocios nao existe no Supabase. Execute a migracao 20260522120000_ensure_hub_negocios.sql no SQL Editor.",
          code,
        },
      };
    }
    return { data: null, error };
  }

  return { data: null, error: { message: "Falha ao gravar hub_negocios." } };
}

export async function GET(request: NextRequest) {
  const supabase = db();
  const { searchParams } = new URL(request.url);
  const busca = searchParams.get("busca") || "";
  const status = searchParams.get("status") || "";
  const etapa = searchParams.get("etapa") || "";
  const prefixo = searchParams.get("prefixo_mercado") || "";
  const offset = parseInt(searchParams.get("offset") || "0");
  const limit = 20;

  let query = supabase
    .from("hub_negocios")
    .select(
      "id, codigo, titulo, prefixo_mercado, status, etapa, valor_estimado, valor_fechado, data_previsao_fechamento, criado_em",
      { count: "exact" }
    )
    .order("criado_em", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq("status", status);
  if (etapa) query = query.eq("etapa", etapa);
  if (prefixo) query = query.eq("prefixo_mercado", prefixo);
  if (busca) {
    query = query.or(`titulo.ilike.%${busca}%,codigo.ilike.%${busca}%`);
  }

  const { data, error, count } = await query;

  if (error) {
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

  let body: Partial<NegocioCadastroPayload>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const validacao = validarNegocioCadastro(body);
  if (!validacao.ok) {
    return NextResponse.json({ error: validacao.erro }, { status: 400 });
  }

  const d = validacao.data;

  if (d.lead_id) {
    const { data: lead } = await supabase.from("hub_leads_crm").select("id").eq("id", d.lead_id).maybeSingle();
    if (!lead) {
      return NextResponse.json({ error: "Lead vinculado não encontrado." }, { status: 400 });
    }
  }

  if (d.pessoa_id) {
    const { data: pessoa } = await supabase.from("hub_pessoas").select("id").eq("id", d.pessoa_id).maybeSingle();
    if (!pessoa) {
      return NextResponse.json({ error: "Pessoa vinculada não encontrada." }, { status: 400 });
    }
  }

  const codigo = await gerarCodigoNegocio(supabase);
  const now = new Date().toISOString();

  const row: Record<string, unknown> = {
    codigo,
    titulo: d.titulo,
    prefixo_mercado: d.prefixo_mercado,
    etapa: d.etapa,
    status: d.status,
    valor_estimado: d.valor_estimado,
    data_previsao_fechamento: d.data_previsao_fechamento,
    lead_id: d.lead_id,
    pessoa_id: d.pessoa_id,
    criado_em: now,
    atualizado_em: now,
  };

  const { data: created, error } = await insertHubNegocio(supabase, row, tenantId);

  if (error) {
    const detail = "message" in error ? String(error.message) : "Erro desconhecido";
    const code = "code" in error ? String(error.code) : "";
    const status = code === "PGRST205" ? 503 : 500;
    return NextResponse.json({ error: detail, detail }, { status });
  }

  return NextResponse.json({ data: created }, { status: 201 });
}
