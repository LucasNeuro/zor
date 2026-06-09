import { NextRequest, NextResponse } from "next/server";
import {
  humanoResponsavelFromActor,
  resolveActorFromRequest,
} from "@/lib/crm/resolve-crm-actor";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";

export async function POST(request: NextRequest) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  let body: { leadId?: string };
  try {
    body = (await request.json()) as { leadId?: string };
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const leadId = body.leadId?.trim();
  if (!leadId) {
    return NextResponse.json({ error: "leadId é obrigatório" }, { status: 400 });
  }

  const supabase = crmDb();
  const actor = await resolveActorFromRequest(supabase, request.headers);
  const humanoSlug = humanoResponsavelFromActor(actor);
  const agora = new Date().toISOString();

  const { data: lead, error: leadErr } = await supabase
    .from("hub_leads_crm")
    .select("id, humano_responsavel")
    .eq("id", leadId)
    .maybeSingle();

  if (leadErr) return NextResponse.json({ error: leadErr.message }, { status: 500 });
  if (!lead) return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });

  const { error: updErr } = await supabase
    .from("hub_leads_crm")
    .update({
      humano_responsavel: humanoSlug,
      atualizado_em: agora,
    })
    .eq("id", leadId);

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  await supabase.from("hub_atividades").insert({
    lead_id: leadId,
    tipo: "ia_acao",
    descricao: `Atendimento assumido por ${humanoSlug}`,
    feito_por: humanoSlug,
    feito_por_tipo: "humano",
    metadata: {
      acao: "assumir_atendimento",
      humano_anterior: lead.humano_responsavel ?? null,
      actor_id: actor.id ?? null,
      actor_email: actor.email ?? null,
    },
  });

  return NextResponse.json({ ok: true, leadId, humano_responsavel: humanoSlug });
}
