import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import {
  gerarCodigoNegocio,
  validarNegocioCadastro,
  type NegocioCadastroPayload,
} from "@/lib/crm/negocio-cadastro";
import { prepararRowHubLeadInsert } from "@/lib/crm/lead-cadastro";
import { criarVinculosNegocio } from "@/lib/crm/negocio-vinculos";
import { resolveTenantIdFromCaller } from "@/lib/crm/resolve-tenant-from-caller";
import { resolverServicoCatalogoParaNegocio } from "@/lib/crm/servicos-catalogo";
import { resolveDefaultPipelineId } from "@/lib/crm/tenant-pipelines";
import { isMissingPgColumn, isTenantFkError, isUuidValido } from "@/lib/tenant-default";

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

const NEGOCIO_OPTIONAL_COLUMNS = [
  "tenant_id",
  "lead_id",
  "pessoa_id",
  "empresa_id",
  "descricao",
  "tipo",
  "pipeline_id",
  "servico_catalogo_id",
  "data_entrada",
  "data_entrega",
] as const;

const LEGACY_LEAD_INSERT_SELECT = "id, codigo, nome";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type EntidadeCodigo = {
  id: string;
  codigo: string | null;
};

function legacyNegocioTipoFromMercado(_prefixo: string): string {
  return "produto_servico";
}

function isLegacyLeadRequiredError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string };
  if (String(e.code || "") !== "23502") return false;
  const message = String(e.message || "").toLowerCase();
  return message.includes("lead_id") && message.includes("null value");
}

function isLegacyTipoRequiredError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string };
  if (String(e.code || "") !== "23502") return false;
  const message = String(e.message || "").toLowerCase();
  return message.includes("tipo") && message.includes("null value");
}

function isLegacyTipoCheckError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string };
  if (String(e.code || "") !== "23514") return false;
  const message = String(e.message || "").toLowerCase();
  return message.includes("tipo");
}

function parseUuidList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value) {
    const id = typeof item === "string" ? item.trim() : "";
    if (!id || !UUID_RE.test(id) || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}

function mergeIds(...lists: Array<(string | null | undefined)[] | string[]>) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const list of lists) {
    for (const raw of list) {
      const id = String(raw || "").trim();
      if (!id || !UUID_RE.test(id) || seen.has(id)) continue;
      seen.add(id);
      result.push(id);
    }
  }
  return result;
}

async function carregarCodigosEntidade(
  supabase: SupabaseClient,
  table: "hub_leads_crm" | "hub_pessoas" | "hub_empresas" | "hub_parceiros",
  ids: string[],
  erroLabel: string
): Promise<EntidadeCodigo[]> {
  if (!ids.length) return [];
  const { data, error } = await supabase.from(table).select("id, codigo").in("id", ids);
  if (error) throw new Error(error.message);

  const rows = ((data ?? []) as Array<{ id: string; codigo?: string | null }>).map((row) => ({
    id: String(row.id),
    codigo: row.codigo != null ? String(row.codigo) : null,
  }));

  const encontrados = new Set(rows.map((row) => row.id));
  const faltantes = ids.filter((id) => !encontrados.has(id));
  if (faltantes.length) {
    throw new Error(`${erroLabel} não encontrado(s).`);
  }
  return rows;
}

async function insertHubNegocio(
  supabase: SupabaseClient,
  row: Record<string, unknown>,
  tenantId: string
) {
  const baseRow = { ...row };
  let withTenant = !!tenantId;
  let payload: Record<string, unknown> = withTenant ? { ...baseRow, tenant_id: tenantId } : { ...baseRow };
  let lastError: { message?: string; code?: string } | null = null;

  for (let attempt = 0; attempt < NEGOCIO_OPTIONAL_COLUMNS.length + 5; attempt++) {
    const { data, error } = await supabase
      .from("hub_negocios")
      .insert(payload)
      .select("*")
      .single();

    if (!error) return { data, error: null };

    lastError = error;

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

    const missing = NEGOCIO_OPTIONAL_COLUMNS.find((col) => isMissingPgColumn(error, col));
    if (missing) {
      delete (baseRow as Record<string, unknown>)[missing];
      payload = withTenant ? { ...baseRow, tenant_id: tenantId } : { ...baseRow };
      continue;
    }

    const code = "code" in error ? String(error.code) : "";
    const msg = "message" in error ? String(error.message) : "";
    if (code === "PGRST205" || msg.includes("hub_negocios")) {
      return {
        data: null,
        error: {
          message:
            "Tabela hub_negocios não existe no Supabase. Execute docs/sql/waje-hub-negocios.sql no SQL Editor e recarregue o schema da API.",
          code,
        },
      };
    }
    return { data: null, error };
  }

  return {
    data: null,
    error: {
      message: lastError?.message?.trim() || "Falha ao gravar hub_negocios.",
      code: lastError?.code,
    },
  };
}

async function insertHubLeadCompat(
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
      .select(LEGACY_LEAD_INSERT_SELECT)
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
      !isMissingPgColumn(error, "codigo")
    ) {
      return { data: null, error };
    }
  }

  return {
    data: null,
    error: lastError ?? { message: "Falha ao gravar hub_leads_crm." },
  };
}

async function criarLeadCompatParaNegocio(
  supabase: SupabaseClient,
  opts: {
    titulo: string;
    etapa: string;
    prefixo_mercado: string;
    valor_estimado: number | null;
    pessoa_id?: string | null;
    tenantId: string;
  }
): Promise<EntidadeCodigo> {
  const now = new Date().toISOString();
  const rowBase: Record<string, unknown> = {
    nome: `Negócio direto · ${opts.titulo}`.slice(0, 200),
    telefone: null,
    email: null,
    origem: "outro",
    estagio: opts.etapa || "qualificado",
    valor_estimado: opts.valor_estimado ?? 0,
    score: 60,
    pessoa_id: opts.pessoa_id || null,
    criado_em: now,
    atualizado_em: now,
    metadata: {
      origem_cadastro: "negocio_direto",
      lead_proxy_legacy: true,
      negocio_titulo: opts.titulo,
      negocio_mercado: opts.prefixo_mercado,
    },
  };

  const row = await prepararRowHubLeadInsert(supabase, rowBase);
  const { data, error } = await insertHubLeadCompat(supabase, row, opts.tenantId);
  if (error || !data?.id) {
    throw new Error(
      ("message" in (error || {}) && error?.message) ||
        "Não foi possível criar o lead de apoio exigido pelo schema legado."
    );
  }

  return {
    id: String(data.id),
    codigo: data.codigo != null ? String(data.codigo) : null,
  };
}

export async function GET(request: NextRequest) {
  const supabase = db();
  const { searchParams } = new URL(request.url);
  const busca = searchParams.get("busca") || "";
  const status = searchParams.get("status") || "";
  const etapa = searchParams.get("etapa") || "";
  const prefixo = searchParams.get("prefixo_mercado") || "";
  const pipelineId = searchParams.get("pipeline_id") || "";
  const leadId = searchParams.get("lead_id")?.trim() || "";
  const offset = parseInt(searchParams.get("offset") || "0");
  const limit = leadId ? 50 : 20;

  const selectCols =
    "id, codigo, titulo, prefixo_mercado, status, etapa, valor_estimado, valor_fechado, data_previsao_fechamento, data_entrada, data_entrega, pipeline_id, lead_id, criado_em, atualizado_em";

  let negocioIdsFromVinculos: string[] = [];
  if (leadId && UUID_RE.test(leadId)) {
    const { data: vinculos, error: vincErr } = await supabase
      .from("hub_negocio_vinculos")
      .select("negocio_id")
      .eq("entidade_tipo", "lead")
      .eq("entidade_id", leadId);

    if (!vincErr && Array.isArray(vinculos)) {
      negocioIdsFromVinculos = vinculos
        .map((row) => String((row as { negocio_id?: string }).negocio_id ?? ""))
        .filter((id) => UUID_RE.test(id));
    }
  }

  let query = supabase
    .from("hub_negocios")
    .select(selectCols, { count: "exact" })
    .order("criado_em", { ascending: false })
    .range(offset, offset + limit - 1);

  if (leadId && UUID_RE.test(leadId)) {
    const ids = [...new Set(negocioIdsFromVinculos)];
    if (ids.length) {
      query = query.or(`lead_id.eq.${leadId},id.in.(${ids.join(",")})`);
    } else {
      query = query.eq("lead_id", leadId);
    }
  }

  if (status) query = query.eq("status", status);
  if (etapa) query = query.eq("etapa", etapa);
  if (prefixo) query = query.eq("prefixo_mercado", prefixo);
  if (pipelineId) query = query.eq("pipeline_id", pipelineId);
  if (busca) {
    query = query.or(`titulo.ilike.%${busca}%,codigo.ilike.%${busca}%`);
  }

  let { data, error, count } = await query;

  if (error && leadId && isMissingPgColumn(error, "data_entrada")) {
    const fallbackSelect =
      "id, codigo, titulo, prefixo_mercado, status, etapa, valor_estimado, valor_fechado, data_previsao_fechamento, pipeline_id, lead_id, criado_em, atualizado_em";
    let fallbackQuery = supabase
      .from("hub_negocios")
      .select(fallbackSelect, { count: "exact" })
      .order("criado_em", { ascending: false })
      .range(offset, offset + limit - 1);

    if (negocioIdsFromVinculos.length) {
      fallbackQuery = fallbackQuery.or(
        `lead_id.eq.${leadId},id.in.(${[...new Set(negocioIdsFromVinculos)].join(",")})`
      );
    } else {
      fallbackQuery = fallbackQuery.eq("lead_id", leadId);
    }
    if (status) fallbackQuery = fallbackQuery.eq("status", status);
    if (etapa) fallbackQuery = fallbackQuery.eq("etapa", etapa);
    if (prefixo) fallbackQuery = fallbackQuery.eq("prefixo_mercado", prefixo);
    if (pipelineId) fallbackQuery = fallbackQuery.eq("pipeline_id", pipelineId);
    if (busca) {
      fallbackQuery = fallbackQuery.or(`titulo.ilike.%${busca}%,codigo.ilike.%${busca}%`);
    }

    const fb = await fallbackQuery;
    data = (fb.data ?? []).map((row) => ({
      ...row,
      data_entrada: null,
      data_entrega: null,
    }));
    error = fb.error;
    count = fb.count;
  }

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
  const tenantId = await resolveTenantIdFromCaller(request);

  let body: Partial<NegocioCadastroPayload> & {
    pipeline_id?: string | null;
    empresa_id?: string | null;
    parceiro_id?: string | null;
    lead_ids?: string[];
    pessoa_ids?: string[];
    empresa_ids?: string[];
    parceiro_ids?: string[];
  };
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
  let pipeline_id =
    typeof body.pipeline_id === "string" && body.pipeline_id.trim()
      ? body.pipeline_id.trim()
      : null;

  if (pipeline_id && !isUuidValido(pipeline_id)) {
    pipeline_id = null;
  }

  if (!pipeline_id) {
    try {
      pipeline_id = await resolveDefaultPipelineId(supabase, tenantId, "negocio");
    } catch {
      pipeline_id = null;
    }
  }

  if (!pipeline_id) {
    return NextResponse.json(
      {
        error:
          "Nenhum funil de negócios configurado para a sua empresa. Configure em Negócios → Estágios.",
      },
      { status: 400 }
    );
  }

  let servicoCatalogo: Awaited<ReturnType<typeof resolverServicoCatalogoParaNegocio>> = null;
  if (d.servico_catalogo_id) {
    try {
      servicoCatalogo = await resolverServicoCatalogoParaNegocio(
        supabase,
        tenantId,
        d.servico_catalogo_id
      );
      if (!servicoCatalogo) {
        return NextResponse.json({ error: "Serviço do catálogo não encontrado ou inativo." }, { status: 400 });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao validar serviço do catálogo.";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  const tituloFinal =
    d.titulo ||
    (servicoCatalogo ? `${servicoCatalogo.nome} — negócio` : "Negócio");
  const valorEstimadoFinal =
    d.valor_estimado ??
    (servicoCatalogo?.preco_referencia != null ? Number(servicoCatalogo.preco_referencia) : null);
  const empresa_id =
    typeof body.empresa_id === "string" && body.empresa_id.trim()
      ? body.empresa_id.trim()
      : null;
  const parceiro_id =
    typeof body.parceiro_id === "string" && body.parceiro_id.trim()
      ? body.parceiro_id.trim()
      : null;

  const leadIds = mergeIds(parseUuidList(body.lead_ids), d.lead_id ? [d.lead_id] : []);
  const pessoaIds = mergeIds(parseUuidList(body.pessoa_ids), d.pessoa_id ? [d.pessoa_id] : []);
  const empresaIds = mergeIds(parseUuidList(body.empresa_ids), empresa_id ? [empresa_id] : []);
  const parceiroIds = mergeIds(parseUuidList(body.parceiro_ids), parceiro_id ? [parceiro_id] : []);

  let leadsSelecionados: EntidadeCodigo[] = [];
  let pessoasSelecionadas: EntidadeCodigo[] = [];
  let empresasSelecionadas: EntidadeCodigo[] = [];
  let parceirosSelecionados: EntidadeCodigo[] = [];

  try {
    [leadsSelecionados, pessoasSelecionadas, empresasSelecionadas, parceirosSelecionados] =
      await Promise.all([
        carregarCodigosEntidade(supabase, "hub_leads_crm", leadIds, "Lead"),
        carregarCodigosEntidade(supabase, "hub_pessoas", pessoaIds, "Pessoa"),
        carregarCodigosEntidade(supabase, "hub_empresas", empresaIds, "Empresa"),
        carregarCodigosEntidade(supabase, "hub_parceiros", parceiroIds, "Parceiro"),
      ]);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao validar vínculos do negócio.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const codigo = await gerarCodigoNegocio(supabase);
  const now = new Date().toISOString();

  const row: Record<string, unknown> = {
    codigo,
    titulo: tituloFinal,
    tipo: legacyNegocioTipoFromMercado(d.prefixo_mercado),
    prefixo_mercado: d.prefixo_mercado,
    servico_catalogo_id: servicoCatalogo?.id ?? d.servico_catalogo_id,
    etapa: d.etapa,
    status: d.status,
    valor_estimado: valorEstimadoFinal,
    data_previsao_fechamento: d.data_previsao_fechamento ?? d.data_entrega,
    data_entrada: d.data_entrada,
    data_entrega: d.data_entrega ?? d.data_previsao_fechamento,
    lead_id: leadsSelecionados[0]?.id ?? null,
    pessoa_id: pessoasSelecionadas[0]?.id ?? null,
    empresa_id: empresasSelecionadas[0]?.id ?? null,
    pipeline_id,
    criado_em: now,
    atualizado_em: now,
  };

  let compatWarning: string | null = null;
  let insertResult = await insertHubNegocio(supabase, row, tenantId);

  if (insertResult.error && isLegacyTipoRequiredError(insertResult.error)) {
    row.tipo = legacyNegocioTipoFromMercado(d.prefixo_mercado);
    compatWarning =
      "Schema legado exigia o campo tipo; foi aplicado um tipo compatível automaticamente.";
    insertResult = await insertHubNegocio(supabase, row, tenantId);
  }

  if (insertResult.error && isLegacyTipoCheckError(insertResult.error)) {
    row.tipo = "negocio";
    compatWarning =
      "Schema legado exigia um tipo diferente; foi aplicado um fallback genérico automaticamente.";
    insertResult = await insertHubNegocio(supabase, row, tenantId);
  }

  if (insertResult.error && isLegacyLeadRequiredError(insertResult.error) && !leadsSelecionados[0]?.id) {
    try {
      const leadCompat = await criarLeadCompatParaNegocio(supabase, {
        titulo: d.titulo,
        etapa: d.etapa,
        prefixo_mercado: d.prefixo_mercado,
        valor_estimado: d.valor_estimado,
        pessoa_id: pessoasSelecionadas[0]?.id ?? null,
        tenantId,
      });
      leadsSelecionados = [leadCompat, ...leadsSelecionados];
      row.lead_id = leadCompat.id;
      compatWarning =
        "Schema legado exigia lead principal; foi criado um lead de apoio automaticamente para o negócio.";
      insertResult = await insertHubNegocio(supabase, row, tenantId);
    } catch (err) {
      const detail =
        err instanceof Error
          ? err.message
          : "Não foi possível criar o lead de apoio exigido pelo schema legado.";
      return NextResponse.json(
        {
          error:
            "O seu banco ainda exige lead principal em hub_negocios. Selecione um lead no wizard ou aplique a migracao 20260522120000_ensure_hub_negocios.sql.",
          detail,
        },
        { status: 400 }
      );
    }
  }

  const { data: created, error } = insertResult;

  if (error) {
    const detail = "message" in error ? String(error.message) : "Erro desconhecido";
    const code = "code" in error ? String(error.code) : "";
    const status = code === "PGRST205" ? 503 : 500;
    const friendly =
      code === "PGRST205" || detail.includes("hub_negocios")
        ? "Tabela hub_negocios não existe no Supabase. Execute docs/sql/waje-hub-negocios.sql no SQL Editor e recarregue o schema da API."
        : detail;
    return NextResponse.json(
      { error: friendly, ...(friendly !== detail ? { detail } : {}) },
      { status }
    );
  }

  try {
    await criarVinculosNegocio(supabase, {
      negocio_id: String(created.id),
      leads: leadsSelecionados,
      pessoas: pessoasSelecionadas,
      empresas: empresasSelecionadas,
      parceiros: parceirosSelecionados,
      tenant_id: tenantId,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Falha ao gravar vínculos do negócio.";
    return NextResponse.json(
      {
        error: `Negócio criado, mas vínculos falharam: ${detail}`,
        data: created,
        detail,
        warning: compatWarning,
      },
      { status: 207 }
    );
  }

  return NextResponse.json({ data: created, warning: compatWarning }, { status: 201 });
}
