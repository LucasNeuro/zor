import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function mapHubMensagem(row: Record<string, unknown>) {
  const remetente = String(row.remetente ?? "");
  const direcao =
    remetente === "lead" || remetente === "user" ? "entrada" : "saida";
  return {
    id: row.id,
    conteudo: row.conteudo,
    direcao,
    remetente,
    agente_id: row.agente_id ?? null,
    criado_em: row.enviada_em ?? row.criado_em,
    email_subject: row.email_subject ?? null,
    email_message_id: row.email_message_id ?? null,
    metadata: row.metadados ?? row.metadata ?? {},
    fonte: "hub_mensagens",
  };
}

async function mensagensEmail(supabase: ReturnType<typeof db>, leadId: string) {
  const { data: conversas } = await supabase
    .from("hub_conversas")
    .select("id")
    .eq("lead_id", leadId)
    .eq("canal", "email")
    .order("criado_em", { ascending: false })
    .limit(3);

  const ids = (conversas ?? []).map((c) => c.id).filter(Boolean);
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from("hub_mensagens")
    .select("*")
    .in("conversa_id", ids)
    .order("enviada_em", { ascending: true, nullsFirst: false })
    .limit(250);

  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapHubMensagem(r as Record<string, unknown>));
}

async function mensagensWhatsapp(supabase: ReturnType<typeof db>, leadId: string) {
  const { data: conversas } = await supabase
    .from("hub_conversas")
    .select("id")
    .eq("lead_id", leadId)
    .eq("canal", "whatsapp")
    .order("criado_em", { ascending: false })
    .limit(1);

  const convId = conversas?.[0]?.id;
  if (convId) {
    const { data, error } = await supabase
      .from("hub_mensagens")
      .select("*")
      .eq("conversa_id", convId)
      .order("enviada_em", { ascending: true, nullsFirst: false })
      .limit(250);
    if (!error && data && data.length > 0) {
      return data.map((r) => mapHubMensagem(r as Record<string, unknown>));
    }
  }

  const { data, error } = await supabase
    .from("hub_fila_mensagens")
    .select("*")
    .eq("lead_id", leadId)
    .or("canal.eq.whatsapp,canal.is.null")
    .order("criado_em", { ascending: true })
    .limit(250);

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function GET(request: NextRequest) {
  try {
    const leadId = request.nextUrl.searchParams.get("leadId")?.trim();
    const canal = (request.nextUrl.searchParams.get("canal")?.trim() || "whatsapp").toLowerCase();

    if (!leadId) {
      return NextResponse.json({ error: "leadId é obrigatório", mensagens: [] }, { status: 400 });
    }

    const supabase = db();
    const mensagens =
      canal === "email"
        ? await mensagensEmail(supabase, leadId)
        : await mensagensWhatsapp(supabase, leadId);

    const { data: notas, error: notasErr } = await supabase
      .from("hub_notas")
      .select("id, conteudo, criado_por, criado_em")
      .eq("lead_id", leadId)
      .order("criado_em", { ascending: true })
      .limit(100);

    if (notasErr) {
      return NextResponse.json({ error: notasErr.message, mensagens: [] }, { status: 500 });
    }

    return NextResponse.json({ canal, mensagens, notas: notas ?? [] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: msg, mensagens: [] }, { status: 500 });
  }
}
