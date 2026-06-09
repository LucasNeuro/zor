import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { gerarCodigoPessoa } from "@/lib/crm/pessoa-cadastro";
import {
  montarMetadataLeadMercados,
  prepararRowHubLeadInsert,
  validarLeadCadastro,
} from "@/lib/crm/lead-cadastro";
import { ensureTenantPipelines, listTenantPipelines } from "@/lib/crm/tenant-pipelines";
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

const LEAD_INSERT_SELECT =
  "id, codigo, nome, telefone, email, origem, estagio, score, valor_estimado, pessoa_id, criado_em, atualizado_em";

async function vincularPessoaPorTelefone(
  supabase: SupabaseClient,
  telefone: string,
  nome: string,
  origem: string,
  mercados: string[]
): Promise<string | null> {
  const { data: existente } = await supabase
    .from("hub_pessoas")
    .select("id")
    .eq("telefone", telefone)
    .maybeSingle();

  if (existente?.id) return existente.id as string;

  const codigo = await gerarCodigoPessoa(supabase);

  const { data: nova, error } = await supabase
    .from("hub_pessoas")
    .insert({
      codigo,
      nome: nome.slice(0, 200),
      telefone,
      tipo: "lead",
      origem: origem || "crm_manual",
      dados_extras: { mercados },
    })
    .select("id")
    .single();

  if (error || !nova) return null;
  return nova.id as string;
}

async function insertHubLead(
  supabase: SupabaseClient,
  row: Record<string, unknown>,
  tenantId: string
) {
  const variants: Record<string, unknown>[] = [
    { ...row, tenant_id: tenantId },
    { ...row, tenant_id: tenantId, pessoa_id: undefined },
    { ...row },
  ];
  const noPessoa = { ...row };
  delete noPessoa.pessoa_id;
  variants.push({ ...noPessoa, tenant_id: tenantId }, { ...noPessoa });

  let lastError: { message?: string; code?: string } | null = null;

  for (const payload of variants) {
    const clean = { ...payload };
    if (clean.pessoa_id === undefined) delete clean.pessoa_id;

    const { data, error } = await supabase
      .from("hub_leads_crm")
      .insert(clean)
      .select(LEAD_INSERT_SELECT)
      .single();

    if (!error) return { data, error: null };

    lastError = error;
    const code = "code" in error ? String(error.code) : "";
    const msg = "message" in error ? String(error.message) : "";
    if (code === "PGRST205" || msg.includes("hub_leads_crm")) {
      return {
        data: null,
        error: {
          message:
            "Tabela hub_leads_crm nao existe no Supabase. Execute a migracao 20260522130000_ensure_hub_leads_crm.sql no SQL Editor.",
          code,
        },
      };
    }
    if (
      !isMissingPgColumn(error, "tenant_id") &&
      !isMissingPgColumn(error, "pessoa_id") &&
      !isMissingPgColumn(error, "codigo") &&
      !isMissingPgColumn(error, "pipeline_id")
    ) {
      return { data: null, error };
    }
  }

  return {
    data: null,
    error: lastError ?? { message: "Falha ao gravar hub_leads_crm." },
  };
}

/** Lista enxuta para selects (ex.: formulário de negócio). */
export async function GET(request: NextRequest) {
  const configErr = supabaseConfigError();
  if (configErr) {
    return NextResponse.json(
      { error: "CRM indisponivel: Supabase nao configurado no servidor.", detail: configErr },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
  const busca = searchParams.get("busca") || "";

  const supabase = db();
  let query = supabase
    .from("hub_leads_crm")
    .select("id, nome, telefone, estagio, valor_estimado, criado_em")
    .not("estagio", "in", "(ganho,perdido)")
    .order("criado_em", { ascending: false })
    .limit(limit);

  if (busca) {
    query = query.or(`nome.ilike.%${busca}%,telefone.ilike.%${busca}%`);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
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

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const validacao = validarLeadCadastro(body);
  if (!validacao.ok) {
    return NextResponse.json({ error: validacao.erro }, { status: 400 });
  }

  const d = validacao.data;

  if (d.telefone) {
    const { data: dup } = await supabase
      .from("hub_leads_crm")
      .select("id, nome")
      .eq("telefone", d.telefone)
      .maybeSingle();

    if (dup) {
      return NextResponse.json(
        { error: `Telefone já cadastrado para o lead ${dup.nome}.`, lead_id: dup.id },
        { status: 409 }
      );
    }
  }

  const indicadoPor =
    typeof body.indicado_por === "string" && body.indicado_por.trim()
      ? body.indicado_por.trim()
      : null;

  const pipelineIdRaw =
    typeof body.pipeline_id === "string" && body.pipeline_id.trim()
      ? body.pipeline_id.trim()
      : null;

  let pipeline_id: string | null = null;
  if (pipelineIdRaw) {
    await ensureTenantPipelines(supabase, tenantId);
    const pipelines = await listTenantPipelines(supabase, tenantId, "lead");
    const pipe = pipelines.find((p) => p.id === pipelineIdRaw);
    if (!pipe) {
      return NextResponse.json({ error: "Pipeline inválido para este tenant." }, { status: 400 });
    }
    pipeline_id = pipe.id;
    const estagios = [...pipe.estagios].sort((a, b) => a.ordem - b.ordem);
    const primeiro = estagios[0]?.slug;
    const estagioBody = typeof body.estagio === "string" ? body.estagio.trim() : "";
    if (primeiro && (!estagioBody || estagioBody === "novo")) {
      d.estagio = primeiro as typeof d.estagio;
    }
  }

  const metadataExtras =
    body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
      ? (body.metadata as Record<string, unknown>)
      : {};

  let pessoa_id: string | null = null;
  if (d.telefone) {
    pessoa_id = await vincularPessoaPorTelefone(
      supabase,
      d.telefone,
      d.nome,
      d.origem,
      d.mercados
    );
  }

  let pessoa_codigo: string | null = null;
  if (pessoa_id) {
    const { data: pe } = await supabase
      .from("hub_pessoas")
      .select("codigo")
      .eq("id", pessoa_id)
      .maybeSingle();
    pessoa_codigo = pe?.codigo != null ? String(pe.codigo) : null;
  }

  const now = new Date().toISOString();
  const rowBase: Record<string, unknown> = {
    nome: d.nome,
    telefone: d.telefone,
    email: d.email,
    origem: d.origem,
    estagio: d.estagio,
    valor_estimado: d.valor_estimado,
    score: 50,
    pessoa_id,
    criado_em: now,
    atualizado_em: now,
    metadata: {
      ...montarMetadataLeadMercados({
        mercados: d.mercados,
        origem_cadastro: "crm_manual",
        indicado_por: indicadoPor,
      }),
      ...metadataExtras,
    },
    ...(pipeline_id ? { pipeline_id } : {}),
  };

  const row = await prepararRowHubLeadInsert(supabase, rowBase, { pessoa_codigo });

  const { data: created, error } = await insertHubLead(supabase, row, tenantId);

  if (error) {
    const detail = "message" in error ? String(error.message) : "Erro desconhecido";
    const code = "code" in error ? String(error.code) : "";
    if (code === "23505") {
      return NextResponse.json({ error: "Lead duplicado (telefone já existe)." }, { status: 409 });
    }
    const status = code === "PGRST205" ? 503 : 500;
    return NextResponse.json({ error: detail, detail }, { status });
  }

  if (created?.id) {
    await supabase.from("hub_atividades").insert({
      lead_id: created.id,
      tipo: "status_change",
      descricao: "Lead criado manualmente no CRM",
      feito_por: "humano",
      feito_por_tipo: "humano",
    });
  }

  return NextResponse.json({ data: created }, { status: 201 });
}
