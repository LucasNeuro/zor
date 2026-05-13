import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { defaultTenantId, tenantIdFromRequest } from "@/lib/tenant-default";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function GET(request: NextRequest) {
  const supabase = db();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const mercado = searchParams.get("mercado");
  const busca = searchParams.get("busca");
  const tenantId = tenantIdFromRequest(request.headers);

  let query = supabase
    .from("hub_parceiros")
    .select(`
      *,
      hub_parceiros_captacao(estagio, origem, canal),
      hub_parceiros_homologacao(estagio, modulos_concluidos, data_conclusao),
      hub_parceiros_modulos(modulo_numero, status, concluido_em)
    `)
    .eq("tenant_id", tenantId)
    .order("criado_em", { ascending: false });

  if (status) query = query.eq("status", status);
  if (mercado) query = query.eq("mercado", mercado);
  if (busca) query = query.or(`nome.ilike.%${busca}%,email.ilike.%${busca}%,telefone.ilike.%${busca}%`);

  const { data, error } = await query;
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
    if (cpf) {
      const { data: dup } = await supabase.from("hub_parceiros").select("id, nome").eq("tenant_id", tenantId).eq("cpf", cpf.replace(/\D/g, "")).maybeSingle();
      if (dup) return NextResponse.json({ erro: "CPF já cadastrado", parceiro_id: dup.id }, { status: 409 });
    }
    if (cnpj) {
      const { data: dup } = await supabase.from("hub_parceiros").select("id, nome").eq("tenant_id", tenantId).eq("cnpj", cnpj.replace(/\D/g, "")).maybeSingle();
      if (dup) return NextResponse.json({ erro: "CNPJ já cadastrado", parceiro_id: dup.id }, { status: 409 });
    }
    const { data: dupTel } = await supabase.from("hub_parceiros").select("id, nome").eq("tenant_id", tenantId).eq("telefone", telefone.replace(/\D/g, "")).maybeSingle();
    if (dupTel) return NextResponse.json({ erro: "Telefone já cadastrado", parceiro_id: dupTel.id }, { status: 409 });

    // Create partner
    const { data: parceiro, error: errP } = await supabase.from("hub_parceiros").insert({
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

    return NextResponse.json({ parceiro_id: parceiro.id, status: "criado" }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ erro: msg }, { status: 500 });
  }
}
