import { NextRequest, NextResponse } from "next/server";
import {
  humanoResponsavelFromActor,
  resolveActorFromRequest,
} from "@/lib/crm/resolve-crm-actor";
import { devolverAtendimentoParaIa } from "@/lib/crm/atendimento-humano-whatsapp";
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
  const feitoPor = humanoResponsavelFromActor(actor);

  const { data: lead, error: leadErr } = await supabase
    .from("hub_leads_crm")
    .select("id, metadata, humano_responsavel")
    .eq("id", leadId)
    .maybeSingle();

  if (leadErr) return NextResponse.json({ error: leadErr.message }, { status: 500 });
  if (!lead) return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });

  const { metadata } = await devolverAtendimentoParaIa(supabase, {
    leadId,
    feitoPor,
    humanoAnterior: lead.humano_responsavel ?? null,
    metadata: lead.metadata,
  });

  await supabase.from("hub_atividades").insert({
    lead_id: leadId,
    tipo: "ia_acao",
    descricao: "Atendimento devolvido para a IA",
    feito_por: feitoPor,
    feito_por_tipo: "humano",
    metadata: {
      acao: "devolver_ia",
      humano_anterior: lead.humano_responsavel ?? null,
      canal_ativo: "direct",
    },
  });

  return NextResponse.json({
    ok: true,
    leadId,
    canal_ativo: "direct",
    metadata,
  });
}
