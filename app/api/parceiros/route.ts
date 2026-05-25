import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { gerarCodigoParceiro } from "@/lib/crm/parceiro-cadastro";
import { HUB_PARCEIRO_LIST_SELECT } from "@/lib/crm/parceiro-list-fetch";
import { defaultTenantId, isMissingPgColumn, tenantIdFromRequest, tenantScopeOrFilter } from "@/lib/tenant-default";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

const HUB_PARCEIRO_LIST_FALLBACK = `
  id,
  codigo,
  nome,
  telefone,
  email,
  especialidade,
  mercado,
  cidade,
  estado,
  status,
  criado_em
`;

function isParceiroCompatError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string };
  const message = String(e.message || "").toLowerCase();
  return (
    isMissingPgColumn(err, "tenant_id") ||
    isMissingPgColumn(err, "modulo_atual") ||
    isMissingPgColumn(err, "recebe_leads") ||
    isMissingPgColumn(err, "total_leads_recebidos") ||
    isMissingPgColumn(err, "total_leads_convertidos") ||
    message.includes("hub_parceiros_captacao") ||
    message.includes("hub_parceiros_homologacao") ||
    message.includes("schema cache")
  );
}

export async function GET(request: NextRequest) {
  const supabase = db();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const mercado = searchParams.get("mercado");
  const busca = searchParams.get("busca");
  const tenantId = tenantIdFromRequest(request.headers) || defaultTenantId();

  const runList = (select: string, withTenantFilter: boolean) => {
    let query = supabase
      .from("hub_parceiros")
      .select(select)
      .order("criado_em", { ascending: false });

    if (withTenantFilter) {
      query = query.or(tenantScopeOrFilter(tenantId));
    }

    if (status) query = query.eq("status", status);
    if (mercado) query = query.eq("mercado", mercado);
    if (busca) query = query.or(`nome.ilike.%${busca}%,email.ilike.%${busca}%,telefone.ilike.%${busca}%`);

    return query;
  };

  let { data, error } = await runList(HUB_PARCEIRO_LIST_SELECT, true);
  if (error && isParceiroCompatError(error)) {
    ({ data, error } = await runList(HUB_PARCEIRO_LIST_FALLBACK, !isMissingPgColumn(error, "tenant_id")));
  }

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  return NextResponse.json({ parceiros: data || [] });
}

export async function POST(request: NextRequest) {
  const supabase = db();
  const tenantId = tenantIdFromRequest(request.headers);

  try {
    const body = await request.json();
    const { nome, telefone, email, cpf, cnpj, especialidade, mercado, cidade, estado, comissao_pct, origem, canal, utm_source, utm_medium, utm_campaign, indicado_por } = body;

    if (!nome || !telefone) {
      return NextResponse.json({ erro: "nome e telefone são obrigatórios" }, { status: 400 });
    }

    // Duplicate detection
    const tenantScope = tenantScopeOrFilter(tenantId || defaultTenantId());
    if (cpf) {
      const { data: dup } = await supabase
        .from("hub_parceiros")
        .select("id, nome")
        .or(tenantScope)
        .eq("cpf", cpf.replace(/\D/g, ""))
        .maybeSingle();
      if (dup) return NextResponse.json({ erro: "CPF já cadastrado", parceiro_id: dup.id }, { status: 409 });
    }
    if (cnpj) {
      const { data: dup } = await supabase
        .from("hub_parceiros")
        .select("id, nome")
        .or(tenantScope)
        .eq("cnpj", cnpj.replace(/\D/g, ""))
        .maybeSingle();
      if (dup) return NextResponse.json({ erro: "CNPJ já cadastrado", parceiro_id: dup.id }, { status: 409 });
    }
    const { data: dupTel } = await supabase
      .from("hub_parceiros")
      .select("id, nome")
      .or(tenantScope)
      .eq("telefone", telefone.replace(/\D/g, ""))
      .maybeSingle();
    if (dupTel) return NextResponse.json({ erro: "Telefone já cadastrado", parceiro_id: dupTel.id }, { status: 409 });

    const codigo = await gerarCodigoParceiro(supabase);

    const { data: parceiro, error: errP } = await supabase.from("hub_parceiros").insert({
      codigo,
      nome,
      telefone: telefone.replace(/\D/g, ""),
      email: email || null,
      cpf: cpf ? cpf.replace(/\D/g, "") : null,
      cnpj: cnpj ? cnpj.replace(/\D/g, "") : null,
      especialidade: especialidade || null,
      mercado: mercado || null,
      cidade: cidade || null,
      estado: estado || null,
      comissao_pct: comissao_pct || 5,
      indicado_por: indicado_por || null,
      status: "captacao",
      tenant_id: tenantId || defaultTenantId(),
    }).select().single();

    if (errP || !parceiro) return NextResponse.json({ erro: errP?.message || "Erro ao criar parceiro" }, { status: 500 });

    // Auto-create captacao entry
    await supabase.from("hub_parceiros_captacao").insert({
      parceiro_id: parceiro.id,
      estagio: "interessado",
      origem: origem || "direto",
      canal: canal || null,
      utm_source: utm_source || null,
      utm_medium: utm_medium || null,
      utm_campaign: utm_campaign || null,
    });

    // Immutable log
    await supabase.from("hub_parceiros_log").insert({
      parceiro_id: parceiro.id,
      evento: "parceiro_cadastrado",
      descricao: `Parceiro ${nome} cadastrado via ${origem || "direto"}`,
      feito_por: "sistema",
      feito_por_tipo: "sistema",
      dados: { nome, telefone, email, especialidade, mercado, origem, canal },
    });

    return NextResponse.json(
      { parceiro_id: parceiro.id, codigo: parceiro.codigo ?? codigo, status: "criado" },
      { status: 201 }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ erro: msg }, { status: 500 });
  }
}
