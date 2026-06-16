import { NextRequest, NextResponse } from "next/server";
import { resolverTokenInstanciaWhatsapp } from "@/lib/crm/resolver-token-whatsapp";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { requireInternalApiKey } from "@/lib/crm/crm-api-auth";
import { uazapiObterUrlMidiaMensagem } from "@/lib/whatsapp/uazapi-transcribe-audio";

export async function GET(request: NextRequest) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });
  const keyErr = requireInternalApiKey(request);
  if (keyErr) return keyErr;

  const leadId = request.nextUrl.searchParams.get("leadId")?.trim();
  const messageId = request.nextUrl.searchParams.get("messageId")?.trim();
  const tipo = (request.nextUrl.searchParams.get("tipo")?.trim() || "audio").toLowerCase();

  if (!leadId || !messageId) {
    return NextResponse.json({ error: "leadId e messageId são obrigatórios" }, { status: 400 });
  }

  const supabase = crmDb();
  const { data: lead, error: leadErr } = await supabase
    .from("hub_leads_crm")
    .select("id, agente_responsavel")
    .eq("id", leadId)
    .maybeSingle();

  if (leadErr) return NextResponse.json({ error: leadErr.message }, { status: 500 });
  if (!lead) return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });

  const { token } = await resolverTokenInstanciaWhatsapp(
    supabase,
    typeof lead.agente_responsavel === "string" ? lead.agente_responsavel : null
  );

  if (!token) {
    return NextResponse.json(
      { error: "WhatsApp não configurado para o agente deste lead." },
      { status: 502 }
    );
  }

  const result = await uazapiObterUrlMidiaMensagem(messageId, token, {
    preferMp3: tipo === "audio",
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.erro }, { status: 502 });
  }

  return NextResponse.json({ url: result.url });
}
