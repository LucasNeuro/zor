import { NextRequest, NextResponse } from "next/server";
import {
  humanoResponsavelFromActor,
  resolveActorFromRequest,
} from "@/lib/crm/resolve-crm-actor";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { leadMetadataRecord } from "@/lib/whatsapp/lead-group-routing";

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

  const meta = leadMetadataRecord(lead.metadata);
  const agora = new Date().toISOString();

  const { error: updErr } = await supabase
    .from("hub_leads_crm")
    .update({
      humano_responsavel: null,
      metadata: {
        ...meta,
        canal_ativo: "direct",
        devolvido_ia_em: agora,
      },
      atualizado_em: agora,
    })
    .eq("id", leadId);

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

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
      whatsapp_group_jid: meta.whatsapp_group_jid ?? null,
    },
  });

  return NextResponse.json({
    ok: true,
    leadId,
    canal_ativo: "direct",
    metadata: {
      ...meta,
      canal_ativo: "direct",
      devolvido_ia_em: agora,
    },
  });
}
