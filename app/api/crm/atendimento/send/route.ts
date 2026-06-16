import { NextRequest, NextResponse } from "next/server";
import {
  humanoResponsavelFromActor,
  resolveActorFromRequest,
  slugFromActor,
} from "@/lib/crm/resolve-crm-actor";
import { enviarMensagemAtendimentoHumano } from "@/lib/crm/atendimento-humano-whatsapp";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";

export async function POST(request: NextRequest) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  let body: { leadId?: string; texto?: string };
  try {
    body = (await request.json()) as { leadId?: string; texto?: string };
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const leadId = body.leadId?.trim();
  const texto = body.texto?.trim();
  if (!leadId || !texto) {
    return NextResponse.json({ error: "leadId e texto são obrigatórios" }, { status: 400 });
  }

  const supabase = crmDb();
  const actor = await resolveActorFromRequest(supabase, request.headers);
  const operadorSlug = slugFromActor(actor);
  const feitoPor = humanoResponsavelFromActor(actor);

  const result = await enviarMensagemAtendimentoHumano(supabase, {
    leadId,
    texto,
    feitoPor,
    operadorSlug,
    actorId: actor.id ?? null,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status ?? 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    whatsappSkipped: result.whatsappSkipped,
    whatsapp: result.whatsapp,
    tokenOrigem: result.tokenOrigem,
  });
}
