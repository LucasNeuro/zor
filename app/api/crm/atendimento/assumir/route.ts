import { NextRequest, NextResponse } from "next/server";
import {
  humanoResponsavelFromActor,
  resolveActorFromRequest,
} from "@/lib/crm/resolve-crm-actor";
import { assumirAtendimentoHumanoLead } from "@/lib/crm/atendimento-humano-whatsapp";
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

  const result = await assumirAtendimentoHumanoLead(supabase, {
    leadId,
    humanoSlug,
    feitoPor: humanoSlug,
    actorId: actor.id ?? null,
    actorEmail: actor.email ?? null,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, leadId, humano_responsavel: humanoSlug });
}
