import { NextRequest, NextResponse } from "next/server";
import { registrarLogCrm } from "@/lib/crm/audit-log";
import { validarMudancaNegocio } from "@/lib/crm/negocio-rules";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { tenantIdFromRequest } from "@/lib/tenant-default";

type Params = { params: Promise<{ id: string }> };

const NEGOCIO_SELECT =
  "id, codigo, titulo, descricao, tipo, prefixo_mercado, lead_id, pessoa_id, empresa_id, pipeline_id, valor_estimado, valor_fechado, percentual_comissao, status, etapa, motivo_perda, proxima_acao, data_previsao_fechamento, data_fechamento, tenant_id, criado_em, atualizado_em";

export async function GET(_request: NextRequest, { params }: Params) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const { id } = await params;
  const supabase = crmDb();

  const { data: negocio, error } = await supabase.from("hub_negocios").select(NEGOCIO_SELECT).eq("id", id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!negocio) return NextResponse.json({ error: "Negócio não encontrado" }, { status: 404 });

  const [{ data: atividades }, { data: lead }, { data: pessoa }, { data: propostas }] = await Promise.all([
    supabase.from("hub_atividades").select("*").eq("negocio_id", id).order("criado_em", { ascending: false }).limit(50),
    negocio.lead_id
      ? supabase.from("hub_leads_crm").select("id, nome, telefone, estagio").eq("id", negocio.lead_id).maybeSingle()
      : Promise.resolve({ data: null }),
    negocio.pessoa_id
      ? supabase.from("hub_pessoas").select("id, codigo, nome, email, telefone").eq("id", negocio.pessoa_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("hub_propostas").select("*").eq("negocio_id", id).order("criado_em", { ascending: false }),
  ]);

  return NextResponse.json({
    data: negocio,
    lead: lead ?? null,
    pessoa: pessoa ?? null,
    timeline: atividades ?? [],
    propostas: propostas ?? [],
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const supabase = crmDb();
  const tenantId = tenantIdFromRequest(request.headers);

  const { data: atual, error: fetchErr } = await supabase
    .from("hub_negocios")
    .select(NEGOCIO_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!atual) return NextResponse.json({ error: "Negócio não encontrado" }, { status: 404 });

  if (body.etapa && atual.pipeline_id) {
    const { data: estagios } = await supabase
      .from("hub_pipeline_estagios")
      .select("slug")
      .eq("pipeline_id", atual.pipeline_id)
      .eq("ativo", true);

    const slugs = new Set((estagios ?? []).map((e) => String(e.slug)));
    if (slugs.size > 0 && !slugs.has(String(body.etapa))) {
      return NextResponse.json({ error: "Etapa inválida para o pipeline deste negócio." }, { status: 400 });
    }
  }

  const merged = {
    etapa: (body.etapa !== undefined ? String(body.etapa) : atual.etapa) as string,
    status: (body.status !== undefined ? String(body.status) : atual.status) as string,
    motivo_perda:
      body.motivo_perda !== undefined
        ? (body.motivo_perda as string | null)
        : ((atual as { motivo_perda?: string }).motivo_perda ?? null),
    pessoa_id:
      body.pessoa_id !== undefined ? (body.pessoa_id as string | null) : (atual.pessoa_id as string | null),
    responsavel_id: body.responsavel_id as string | undefined,
    proxima_acao:
      body.proxima_acao !== undefined
        ? (body.proxima_acao as string | null)
        : ((atual as { proxima_acao?: string }).proxima_acao ?? null),
  };

  const check = validarMudancaNegocio(merged);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

  const allowed = [
    "titulo",
    "descricao",
    "tipo",
    "prefixo_mercado",
    "pessoa_id",
    "empresa_id",
    "lead_id",
    "pipeline_id",
    "valor_estimado",
    "valor_fechado",
    "percentual_comissao",
    "status",
    "etapa",
    "motivo_perda",
    "proxima_acao",
    "data_previsao_fechamento",
    "data_fechamento",
  ] as const;

  const patch: Record<string, unknown> = { atualizado_em: new Date().toISOString() };
  for (const key of allowed) {
    if (key in body) patch[key] = body[key];
  }

  const etapaAnterior = String(atual.etapa ?? "");

  const { data, error } = await supabase.from("hub_negocios").update(patch).eq("id", id).select(NEGOCIO_SELECT).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (body.etapa && String(body.etapa) !== etapaAnterior) {
    await supabase.from("hub_atividades").insert({
      negocio_id: id,
      lead_id: data.lead_id,
      tipo: "status_change",
      descricao: `Etapa: ${etapaAnterior || "—"} → ${data.etapa}`,
      feito_por: "humano",
      feito_por_tipo: "humano",
      tenant_id: tenantId,
    });

    await registrarLogCrm(supabase, {
      entidade: "negocio",
      entidade_id: id,
      acao: "etapa_alterada",
      valor_anterior: etapaAnterior || null,
      valor_novo: String(data.etapa),
      motivo: merged.motivo_perda,
      tenant_id: tenantId,
    });
  }

  return NextResponse.json({ data });
}
