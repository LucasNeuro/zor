import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { registrarLogCrm } from "@/lib/crm/audit-log";
import { crmFeatureFlags } from "@/lib/crm/feature-flags";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const STATUS_VALIDOS = [
  "sugerido_ia",
  "aguardando_validacao",
  "aprovado_envio",
  "enviado",
  "recebido",
  "aceito",
  "recusado",
  "sem_resposta",
  "em_atendimento",
  "convertido_negocio",
  "perdido",
  "bloqueado",
] as const;

export async function GET(request: NextRequest) {
  const lead_id = new URL(request.url).searchParams.get("lead_id");
  if (!lead_id) return NextResponse.json({ error: "lead_id obrigatório" }, { status: 400 });

  const { data, error } = await db()
    .from("hub_encaminhamentos")
    .select("*")
    .eq("lead_id", lead_id)
    .order("criado_em", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: NextRequest) {
  if (!crmFeatureFlags.encaminhamentoV2()) {
    return NextResponse.json(
      { error: "Encaminhamento V2 desativado. Defina CRM_ENCAMINHAMENTO_V2=true." },
      { status: 403 }
    );
  }

  const body = (await request.json()) as Record<string, unknown>;
  const lead_id = body.lead_id as string | undefined;
  if (!lead_id) return NextResponse.json({ error: "lead_id obrigatório" }, { status: 400 });

  const status = (body.status as string) || "aguardando_validacao";
  if (!STATUS_VALIDOS.includes(status as (typeof STATUS_VALIDOS)[number])) {
    return NextResponse.json({ error: "status inválido" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const row = {
    lead_id,
    negocio_id: (body.negocio_id as string) || null,
    destinatario_pessoa_id: (body.destinatario_pessoa_id as string) || null,
    destinatario_empresa_id: (body.destinatario_empresa_id as string) || null,
    segmento: (body.segmento as string) || null,
    responsavel_envio: (body.responsavel_envio as string) || null,
    sugerido_ia: Boolean(body.sugerido_ia),
    validado_humano: Boolean(body.validado_humano),
    status,
    criterio_selecao: (body.criterio_selecao as string) || null,
    encaminhado_em: body.encaminhado_em ?? now,
    enviado_em: status === "enviado" ? now : null,
  };

  const supabase = db();
  const { data, error } = await supabase.from("hub_encaminhamentos").insert(row).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase
    .from("hub_leads_crm")
    .update({
      estagio_funil: "encaminhado",
      estagio: "encaminhado",
      atualizado_em: now,
    })
    .eq("id", lead_id);

  await registrarLogCrm(supabase, {
    entidade: "encaminhamento",
    entidade_id: data.id,
    acao: "encaminhamento_criado",
    valor_novo: status,
    metadata: { lead_id },
  });

  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const body = (await request.json()) as Record<string, unknown>;
  const id = body.id as string | undefined;
  const status = body.status as string | undefined;
  if (!id || !status) {
    return NextResponse.json({ error: "id e status obrigatórios" }, { status: 400 });
  }

  const supabase = db();
  const updates: Record<string, unknown> = {
    status,
    atualizado_em: new Date().toISOString(),
  };
  if (status === "enviado") updates.enviado_em = new Date().toISOString();
  if (status === "aceito" || status === "recusado") {
    updates.respondido_em = new Date().toISOString();
    updates.resposta_destinatario = (body.resposta_destinatario as string) || null;
  }
  if (body.validado_humano === true) updates.validado_humano = true;

  const { data: prev } = await supabase.from("hub_encaminhamentos").select("status, lead_id").eq("id", id).single();

  const { error } = await supabase.from("hub_encaminhamentos").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await registrarLogCrm(supabase, {
    entidade: "encaminhamento",
    entidade_id: id,
    acao: "status_alterado",
    valor_anterior: prev?.status ?? null,
    valor_novo: status,
  });

  return NextResponse.json({ ok: true });
}
