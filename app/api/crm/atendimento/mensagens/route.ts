import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { backfillMensagensIaCrm } from "@/lib/crm/backfill-mensagens-ia-crm";
import { mensagemTemCorpo, parseMidiaFromRow } from "@/lib/crm/chat-mensagem-midia";
import { mergeMensagensChatDeduped } from "@/lib/crm/dedup-mensagens-chat";
import {
  inferFeitoPorTipoFila,
  remetenteFilaFromFeitoPor,
} from "@/lib/crm/infer-feito-por-tipo-fila";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function metaRecord(row: Record<string, unknown>): Record<string, unknown> {
  const raw = row.metadados ?? row.metadata;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as Record<string, unknown>;
}

function mapHubMensagem(row: Record<string, unknown>) {
  const remetente = String(row.remetente ?? "");
  const direcao =
    remetente === "lead" || remetente === "user" ? "entrada" : "saida";
  const meta = metaRecord(row);
  const midia = parseMidiaFromRow(row);
  return {
    id: row.id,
    conteudo: row.conteudo,
    direcao,
    remetente,
    agente_id: row.agente_id ?? null,
    feito_por_tipo:
      remetente === "humano"
        ? "humano"
        : remetente === "ia" || remetente === "agente"
          ? "ia"
          : meta.feito_por_tipo ?? null,
    criado_em: row.enviada_em ?? row.criado_em,
    email_subject: row.email_subject ?? null,
    email_message_id: row.email_message_id ?? null,
    tipo_conteudo: midia.tipo,
    url_midia: midia.urlMidia,
    nome_arquivo: midia.nomeArquivo,
    whatsapp_message_id: midia.whatsappMessageId,
    metadata: meta,
    fonte: "hub_mensagens",
  };
}

function mapFilaMensagem(row: Record<string, unknown>) {
  const meta = metaRecord(row);
  const direcao = String(row.direcao ?? "saida");
  const feitoPorTipo = inferFeitoPorTipoFila(meta, direcao, row.feito_por_tipo);
  const remetente = remetenteFilaFromFeitoPor(direcao, feitoPorTipo);
  const midia = parseMidiaFromRow(row);
  return {
    id: row.id,
    conteudo: row.conteudo,
    direcao,
    remetente,
    agente_id: row.agente_id ?? null,
    feito_por_tipo: feitoPorTipo,
    criado_em: row.enviada_em ?? row.criado_em ?? row.recebida_em,
    tipo_conteudo: midia.tipo,
    url_midia: midia.urlMidia,
    nome_arquivo: midia.nomeArquivo,
    whatsapp_message_id: midia.whatsappMessageId ?? row.whatsapp_message_id ?? null,
    metadata: meta,
    fonte: "hub_fila_mensagens",
  };
}

function mergeMensagensWhatsapp(
  hubRows: Record<string, unknown>[],
  filaRows: Record<string, unknown>[]
): Record<string, unknown>[] {
  const mapped: Record<string, unknown>[] = [];

  for (const row of hubRows) {
    if (!mensagemTemCorpo(row)) continue;
    mapped.push(mapHubMensagem(row));
  }

  for (const row of filaRows) {
    if (!mensagemTemCorpo(row)) continue;
    mapped.push(mapFilaMensagem(row));
  }

  return mergeMensagensChatDeduped(mapped);
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
  await backfillMensagensIaCrm(supabase, leadId).catch((e) => {
    console.warn("[atendimento/mensagens] backfill IA:", e instanceof Error ? e.message : e);
  });

  const { data: conversas } = await supabase
    .from("hub_conversas")
    .select("id")
    .eq("lead_id", leadId)
    .eq("canal", "whatsapp")
    .order("criado_em", { ascending: false })
    .limit(3);

  const convIds = (conversas ?? []).map((c) => c.id).filter(Boolean);

  let hubRows: Record<string, unknown>[] = [];
  if (convIds.length > 0) {
    const { data, error } = await supabase
      .from("hub_mensagens")
      .select("*")
      .in("conversa_id", convIds)
      .order("enviada_em", { ascending: true, nullsFirst: false })
      .limit(250);
    if (!error && data) {
      hubRows = data as Record<string, unknown>[];
    }
  }

  const { data: filaData, error: filaErr } = await supabase
    .from("hub_fila_mensagens")
    .select("*")
    .eq("lead_id", leadId)
    .or("canal.eq.whatsapp,canal.is.null")
    .order("criado_em", { ascending: true })
    .limit(250);

  if (filaErr) throw new Error(filaErr.message);

  return mergeMensagensWhatsapp(hubRows, (filaData ?? []) as Record<string, unknown>[]);
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
