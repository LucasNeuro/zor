import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { tenantIdFromRequest } from "@/lib/tenant-default";

type Params = { params: Promise<{ id: string }> };

const LEAD_SELECT =
  "id, nome, telefone, email, origem, campanha, estagio, score, valor_estimado, agente_responsavel, humano_responsavel, proxima_acao, data_proxima_acao, motivo_perda, tags, metadata, pessoa_id, tenant_id, ultimo_contato, criado_em, atualizado_em";

export async function GET(_request: NextRequest, { params }: Params) {
  const configErr = crmConfigError();
  if (configErr) {
    return NextResponse.json({ error: configErr }, { status: 503 });
  }

  const { id } = await params;
  const supabase = crmDb();

  const { data: lead, error } = await supabase.from("hub_leads_crm").select(LEAD_SELECT).eq("id", id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!lead) return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });

  const [{ data: atividades }, { data: notas }, { data: propostas }, { data: memorias }] = await Promise.all([
    supabase.from("hub_atividades").select("*").eq("lead_id", id).order("criado_em", { ascending: false }).limit(50),
    supabase.from("hub_notas").select("*").eq("lead_id", id).order("criado_em", { ascending: false }).limit(30),
    supabase.from("hub_propostas").select("*").eq("lead_id", id).order("criado_em", { ascending: false }),
    supabase.from("hub_memorias_lead").select("*").eq("lead_id", id).order("criado_em", { ascending: false }),
  ]);

  let pessoa = null;
  if (lead.pessoa_id) {
    const { data } = await supabase.from("hub_pessoas").select("id, codigo, nome, email, telefone").eq("id", lead.pessoa_id).maybeSingle();
    pessoa = data;
  }

  const { data: negocios } = await supabase
    .from("hub_negocios")
    .select("id, codigo, titulo, etapa, status, valor_estimado")
    .eq("lead_id", id);

  return NextResponse.json({
    data: lead,
    pessoa,
    negocios: negocios ?? [],
    timeline: atividades ?? [],
    notas: notas ?? [],
    propostas: propostas ?? [],
    memorias: memorias ?? [],
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const configErr = crmConfigError();
  if (configErr) {
    return NextResponse.json({ error: configErr }, { status: 503 });
  }

  const { id } = await params;
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
    "origem",
    "estagio",
    "score",
    "valor_estimado",
    "agente_responsavel",
    "humano_responsavel",
    "proxima_acao",
    "data_proxima_acao",
    "motivo_perda",
    "tags",
    "pessoa_id",
    "metadata",
  ] as const;

  const patch: Record<string, unknown> = { atualizado_em: new Date().toISOString() };
  for (const key of allowed) {
    if (key in body) patch[key] = body[key];
  }

  if (Object.keys(patch).length === 1) {
    return NextResponse.json({ error: "Nenhum campo para atualizar" }, { status: 400 });
  }

  const supabase = crmDb();
  const estagioAnterior = typeof body.estagio === "string" ? body._estagio_anterior : undefined;

  const { data, error } = await supabase.from("hub_leads_crm").update(patch).eq("id", id).select(LEAD_SELECT).single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (body.estagio && body.estagio !== estagioAnterior) {
    await supabase.from("hub_atividades").insert({
      lead_id: id,
      tipo: "status_change",
      descricao: `Estágio alterado para ${body.estagio}`,
      feito_por: "humano",
      feito_por_tipo: "humano",
      tenant_id: tenantIdFromRequest(request.headers),
    });
  }

  return NextResponse.json({ data });
}
