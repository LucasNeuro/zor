import { NextRequest, NextResponse } from "next/server";
import { registrarLogCrm } from "@/lib/crm/audit-log";
import { buildLeadEstagioPatch } from "@/lib/crm/estagio-map";
import { validarMudancaEstagioLead } from "@/lib/crm/lead-rules";
import { mergeLeadTimelineEvents, parseConversaTurnos } from "@/lib/crm/lead-timeline";
import { resolveTenantIdFromCaller } from "@/lib/crm/resolve-tenant-from-caller";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";

type Params = { params: Promise<{ id: string }> };

const LEAD_SELECT =
  "id, nome, telefone, email, origem, campanha, estagio, estagio_funil, estagio_atendimento, score, valor_estimado, agente_responsavel, humano_responsavel, proxima_acao, data_proxima_acao, motivo_perda, tags, metadata, pessoa_id, tenant_id, ultimo_contato, criado_em, atualizado_em";

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

  const [
    { data: atividades },
    { data: notas },
    { data: propostas },
    { data: memorias },
    { data: mensagens },
    { data: logs },
    { data: encaminhamentos },
  ] = await Promise.all([
    supabase.from("hub_atividades").select("*").eq("lead_id", id).order("criado_em", { ascending: false }).limit(80),
    supabase.from("hub_notas").select("*").eq("lead_id", id).order("criado_em", { ascending: false }).limit(30),
    supabase.from("hub_propostas").select("*").eq("lead_id", id).order("criado_em", { ascending: false }),
    supabase.from("hub_memorias_lead").select("*").eq("lead_id", id).order("criado_em", { ascending: false }),
    supabase
      .from("hub_fila_mensagens")
      .select("id, direcao, conteudo, agente_responsavel, agente_id, remetente_numero, criado_em, enviada_em")
      .eq("lead_id", id)
      .order("criado_em", { ascending: false })
      .limit(40),
    supabase
      .from("hub_logs")
      .select("*")
      .eq("entidade", "lead")
      .eq("entidade_id", id)
      .order("criado_em", { ascending: false })
      .limit(30),
    supabase
      .from("hub_encaminhamentos")
      .select("*")
      .eq("lead_id", id)
      .order("criado_em", { ascending: false })
      .limit(20),
  ]);

  const timeline_events = mergeLeadTimelineEvents({
    atividades: atividades ?? [],
    mensagens: mensagens ?? [],
    logs: logs ?? [],
    encaminhamentos: encaminhamentos ?? [],
    conversaTurnos: parseConversaTurnos(lead.metadata),
  });

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
    timeline_events,
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

  const supabase = crmDb();
  const tenantId = await resolveTenantIdFromCaller(request);

  const { data: atual, error: fetchErr } = await supabase
    .from("hub_leads_crm")
    .select(LEAD_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!atual) return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });

  const novoEstagioRaw =
    typeof body.estagio_funil === "string"
      ? body.estagio_funil
      : typeof body.estagio === "string"
        ? body.estagio
        : null;

  const estagioPatch = novoEstagioRaw ? buildLeadEstagioPatch(novoEstagioRaw) : {};

  const merged = {
    estagio: (estagioPatch.estagio ?? atual.estagio) as string,
    estagio_funil: (estagioPatch.estagio_funil ?? atual.estagio_funil ?? atual.estagio) as string,
    motivo_perda:
      body.motivo_perda !== undefined ? (body.motivo_perda as string | null) : (atual.motivo_perda as string | null),
    proxima_acao:
      body.proxima_acao !== undefined
        ? (body.proxima_acao as string | null)
        : (atual.proxima_acao as string | null),
    data_proxima_acao:
      body.data_proxima_acao !== undefined
        ? (body.data_proxima_acao as string | null)
        : (atual.data_proxima_acao as string | null),
  };

  if (novoEstagioRaw || body.motivo_perda !== undefined) {
    const check = validarMudancaEstagioLead(merged);
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });
  }

  const allowed = [
    "nome",
    "telefone",
    "email",
    "origem",
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
    "tipo_interesse",
    "cidade",
    "bairro",
    "canal_origem",
    "estagio_atendimento",
  ] as const;

  const patch: Record<string, unknown> = {
    atualizado_em: new Date().toISOString(),
    ...estagioPatch,
  };

  for (const key of allowed) {
    if (key in body) patch[key] = body[key];
  }

  if (Object.keys(patch).length <= 1) {
    return NextResponse.json({ error: "Nenhum campo para atualizar" }, { status: 400 });
  }

  const estagioAtendimentoAnterior =
    atual.estagio_atendimento != null ? String(atual.estagio_atendimento) : null;
  const estagioAtendimentoNovo =
    body.estagio_atendimento !== undefined ? String(body.estagio_atendimento) : null;

  const estagioAnterior = String(atual.estagio_funil ?? atual.estagio ?? "");

  const { data, error } = await supabase.from("hub_leads_crm").update(patch).eq("id", id).select(LEAD_SELECT).single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const estagioNovo = String(data.estagio_funil ?? data.estagio ?? "");
  if (novoEstagioRaw && estagioNovo !== estagioAnterior) {
    await supabase.from("hub_atividades").insert({
      lead_id: id,
      tipo: "status_change",
      descricao: `Estágio alterado: ${estagioAnterior || "—"} → ${estagioNovo}`,
      feito_por: "humano",
      feito_por_tipo: "humano",
      tenant_id: tenantId,
    });

    await registrarLogCrm(supabase, {
      entidade: "lead",
      entidade_id: id,
      acao: "estagio_alterado",
      valor_anterior: estagioAnterior || null,
      valor_novo: estagioNovo,
      motivo: merged.motivo_perda,
      tenant_id: tenantId,
    });
  }

  if (
    estagioAtendimentoNovo &&
    estagioAtendimentoNovo !== estagioAtendimentoAnterior
  ) {
    await supabase.from("hub_atividades").insert({
      lead_id: id,
      tipo: "status_change",
      descricao: `Atendimento: ${estagioAtendimentoAnterior || "—"} → ${estagioAtendimentoNovo}`,
      feito_por: "humano",
      feito_por_tipo: "humano",
      tenant_id: tenantId,
    });

    await registrarLogCrm(supabase, {
      entidade: "lead",
      entidade_id: id,
      acao: "estagio_atendimento_alterado",
      valor_anterior: estagioAtendimentoAnterior,
      valor_novo: estagioAtendimentoNovo,
      tenant_id: tenantId,
    });
  }

  return NextResponse.json({ data });
}
