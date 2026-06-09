import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  humanoResponsavelFromActor,
  resolveActorFromRequest,
} from "@/lib/crm/resolve-crm-actor";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function POST(request: NextRequest) {
  const body = await request.json() as {
    lead_id: string;
    data: string;
    hora: string;
    notas?: string;
  };

  const descricao = `Reunião agendada para ${body.data} às ${body.hora}${body.notas ? ` — ${body.notas}` : ""}`;

  const supabase = db();
  const actor = await resolveActorFromRequest(supabase, request.headers);
  const feitoPor = humanoResponsavelFromActor(actor);

  const { error } = await supabase.from("hub_atividades").insert({
    lead_id: body.lead_id,
    tipo: "agendamento",
    descricao,
    feito_por: feitoPor,
    feito_por_tipo: "humano",
    metadata: { data: body.data, hora: body.hora, notas: body.notas },
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
