import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import {
  executarBriefingReply,
  montarSnapshotOperacionalReadOnly,
  type BriefingMensagemLinha,
} from "@/lib/agente-briefing-chat";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const MODELO_FALLBACK = "claude-sonnet-4-20250514";
const MAX_HISTORICO_MENSAGENS = 48;
const MAX_MENSAGEM_LEN = 12_000;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }

  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);
  const sessaoId = req.nextUrl.searchParams.get("sessao_id");

  const supabase = db();

  const { data: agente, error: agErr } = await supabase
    .from("hub_agente_identidade")
    .select("agente_slug, nome")
    .eq("agente_slug", slug)
    .maybeSingle();

  if (agErr) return NextResponse.json({ error: agErr.message }, { status: 500 });
  if (!agente) return NextResponse.json({ error: "Agente não encontrado" }, { status: 404 });

  const { data: sessoes, error: sErr } = await supabase
    .from("hub_crm_agente_briefing_sessao")
    .select("id, titulo, criado_em, atualizado_em")
    .eq("agente_slug", slug)
    .order("atualizado_em", { ascending: false })
    .limit(40);

  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });

  let mensagens: Record<string, unknown>[] = [];
  if (sessaoId) {
    const sid = sessaoId.trim();
    const { data: ses, error: se } = await supabase
      .from("hub_crm_agente_briefing_sessao")
      .select("id")
      .eq("id", sid)
      .eq("agente_slug", slug)
      .maybeSingle();
    if (se) return NextResponse.json({ error: se.message }, { status: 500 });
    if (!ses) return NextResponse.json({ error: "Sessão não encontrada" }, { status: 404 });

    const { data: msgs, error: mErr } = await supabase
      .from("hub_crm_agente_briefing_mensagem")
      .select("id, papel, conteudo, criado_em, metadata")
      .eq("sessao_id", sid)
      .order("criado_em", { ascending: true })
      .limit(500);

    if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });
    mensagens = msgs || [];
  }

  return NextResponse.json({
    agente_slug: agente.agente_slug,
    nome: agente.nome,
    sessoes: sessoes || [],
    mensagens,
    sessao_id_ativa: sessaoId || null,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY não configurada" }, { status: 503 });
  }

  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);

  let body: { sessao_id?: string | null; mensagem?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const textoUser = String(body.mensagem ?? "").trim();
  if (!textoUser || textoUser.length > MAX_MENSAGEM_LEN) {
    return NextResponse.json({ error: "Mensagem inválida ou muito longa." }, { status: 400 });
  }

  const supabase = db();

  const { data: agente, error: agErr } = await supabase
    .from("hub_agente_identidade")
    .select("agente_slug, nome, cargo, modelo_padrao, system_prompt_base")
    .eq("agente_slug", slug)
    .maybeSingle();

  if (agErr) return NextResponse.json({ error: agErr.message }, { status: 500 });
  if (!agente) return NextResponse.json({ error: "Agente não encontrado" }, { status: 404 });

  const modelo =
    (typeof agente.modelo_padrao === "string" && agente.modelo_padrao.trim())
      ? agente.modelo_padrao.trim()
      : MODELO_FALLBACK;

  let sessaoId = body.sessao_id?.trim() || "";
  if (!sessaoId) {
    const { data: nova, error: nErr } = await supabase
      .from("hub_crm_agente_briefing_sessao")
      .insert({ agente_slug: slug, titulo: null })
      .select("id")
      .single();
    if (nErr || !nova) {
      return NextResponse.json({ error: nErr?.message || "Falha ao criar sessão" }, { status: 500 });
    }
    sessaoId = nova.id as string;
  } else {
    const { data: ses, error: vErr } = await supabase
      .from("hub_crm_agente_briefing_sessao")
      .select("id")
      .eq("id", sessaoId)
      .eq("agente_slug", slug)
      .maybeSingle();
    if (vErr) return NextResponse.json({ error: vErr.message }, { status: 500 });
    if (!ses) return NextResponse.json({ error: "Sessão inválida" }, { status: 400 });
  }

  const { error: uErr } = await supabase.from("hub_crm_agente_briefing_mensagem").insert({
    sessao_id: sessaoId,
    papel: "user",
    conteudo: textoUser,
    metadata: {},
  });
  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });

  const { data: historicoRows, error: hErr } = await supabase
    .from("hub_crm_agente_briefing_mensagem")
    .select("papel, conteudo")
    .eq("sessao_id", sessaoId)
    .order("criado_em", { ascending: true })
    .limit(MAX_HISTORICO_MENSAGENS);

  if (hErr) return NextResponse.json({ error: hErr.message }, { status: 500 });

  const historico: BriefingMensagemLinha[] = (historicoRows || [])
    .filter(
      (r): r is { papel: string; conteudo: string } =>
        (r.papel === "user" || r.papel === "assistant") && typeof r.conteudo === "string"
    )
    .map((r) => ({ papel: r.papel as "user" | "assistant", conteudo: r.conteudo }));

  const historicoParaModelo = historico.slice(0, -1);

  const snapshot = await montarSnapshotOperacionalReadOnly(
    supabase,
    slug,
    String(agente.nome || slug)
  );

  let resultado;
  try {
    resultado = await executarBriefingReply({
      modelo,
      agenteNome: String(agente.nome || slug),
      agenteSlug: slug,
      cargo: typeof agente.cargo === "string" ? agente.cargo : undefined,
      promptBaseTrecho:
        typeof agente.system_prompt_base === "string" ? agente.system_prompt_base : undefined,
      snapshot,
      historico: historicoParaModelo,
      mensagemUsuario: textoUser,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao gerar resposta";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const { error: aErr } = await supabase.from("hub_crm_agente_briefing_mensagem").insert({
    sessao_id: sessaoId,
    papel: "assistant",
    conteudo: resultado.texto,
    metadata: {
      modelo: resultado.modelo,
      tokens_input: resultado.tokens_input,
      tokens_output: resultado.tokens_output,
      custo_brl: resultado.custo_brl,
    },
  });
  if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 });

  await supabase
    .from("hub_crm_agente_briefing_sessao")
    .update({ atualizado_em: new Date().toISOString() })
    .eq("id", sessaoId);

  const { data: mensagens, error: mErr } = await supabase
    .from("hub_crm_agente_briefing_mensagem")
    .select("id, papel, conteudo, criado_em, metadata")
    .eq("sessao_id", sessaoId)
    .order("criado_em", { ascending: true })
    .limit(500);

  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });

  return NextResponse.json({
    sessao_id: sessaoId,
    mensagens: mensagens || [],
    ultima_resposta_meta: {
      modelo: resultado.modelo,
      tokens_input: resultado.tokens_input,
      tokens_output: resultado.tokens_output,
      custo_brl: resultado.custo_brl,
    },
  });
}
