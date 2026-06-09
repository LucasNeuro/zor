import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import {
  executarBriefingReply,
  executarSimulacaoCanalReply,
  montarSnapshotOperacionalReadOnly,
  type BriefingMensagemLinha,
  type BriefingModoSessao,
} from "@/lib/agente-briefing-chat";
import { extrairESalvarMemoriasAgente, formatarBlocoMemoriasAgente, listarMemoriasAgente } from "@/lib/ia/memoria-agente";
import { mensagemErroBriefingChat } from "@/lib/hub/briefing-chat-errors";

function erroBriefingJson(message: string, status: number) {
  return NextResponse.json({ error: mensagemErroBriefingChat(message) }, { status });
}

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const MODELO_FALLBACK = "mistral";
const MAX_HISTORICO_MENSAGENS = 48;
const MAX_MENSAGEM_LEN = 12_000;
const BRIEFING_GET_CACHE_TTL_MS = 15_000;
const BRIEFING_GET_CACHE_MAX = 150;

const briefingGetCache = new Map<
  string,
  { expireAt: number; payload: Record<string, unknown> }
>();

function cacheKeyBriefingGet(slug: string, sessaoId: string | null): string {
  return `${slug}::${sessaoId || "no-session"}`;
}

function cacheGetBriefingGet(slug: string, sessaoId: string | null): Record<string, unknown> | null {
  const key = cacheKeyBriefingGet(slug, sessaoId);
  const now = Date.now();
  const hit = briefingGetCache.get(key);
  if (!hit) return null;
  if (hit.expireAt <= now) {
    briefingGetCache.delete(key);
    return null;
  }
  return hit.payload;
}

function cacheSetBriefingGet(slug: string, sessaoId: string | null, payload: Record<string, unknown>) {
  if (briefingGetCache.size > BRIEFING_GET_CACHE_MAX) {
    // remove entradas expiradas e depois a mais antiga (ordem de inserção).
    const now = Date.now();
    for (const [k, v] of briefingGetCache.entries()) {
      if (v.expireAt <= now) briefingGetCache.delete(k);
    }
    if (briefingGetCache.size > BRIEFING_GET_CACHE_MAX) {
      const firstKey = briefingGetCache.keys().next().value;
      if (firstKey) briefingGetCache.delete(firstKey);
    }
  }
  briefingGetCache.set(cacheKeyBriefingGet(slug, sessaoId), {
    expireAt: Date.now() + BRIEFING_GET_CACHE_TTL_MS,
    payload,
  });
}

function cacheInvalidateBriefingGet(slug: string, sessaoId: string | null) {
  const prefix = `${slug}::`;
  for (const k of briefingGetCache.keys()) {
    if (!k.startsWith(prefix)) continue;
    if (!sessaoId || k === cacheKeyBriefingGet(slug, sessaoId) || k === cacheKeyBriefingGet(slug, null)) {
      briefingGetCache.delete(k);
    }
  }
}

function normalizarModoBriefing(v: unknown): BriefingModoSessao {
  const s = String(v ?? "").trim();
  if (s === "simulacao_canal") return "simulacao_canal";
  return "briefing_interno";
}

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
  const cached = cacheGetBriefingGet(slug, sessaoId);
  if (cached) return NextResponse.json(cached);

  const supabase = db();

  const { data: agente, error: agErr } = await supabase
    .from("hub_agente_identidade")
    .select("agente_slug, nome")
    .eq("agente_slug", slug)
    .maybeSingle();

  if (agErr) return erroBriefingJson(agErr.message, 500);
  if (!agente) return NextResponse.json({ error: "Agente não encontrado" }, { status: 404 });

  const { data: sessoes, error: sErr } = await supabase
    .from("hub_crm_agente_briefing_sessao")
    .select("id, titulo, criado_em, atualizado_em")
    .eq("agente_slug", slug)
    .order("atualizado_em", { ascending: false })
    .limit(40);

  if (sErr) return erroBriefingJson(sErr.message, 500);

  let mensagens: Record<string, unknown>[] = [];
  if (sessaoId) {
    const sid = sessaoId.trim();
    const { data: ses, error: se } = await supabase
      .from("hub_crm_agente_briefing_sessao")
      .select("id")
      .eq("id", sid)
      .eq("agente_slug", slug)
      .maybeSingle();
    if (se) return erroBriefingJson(se.message, 500);
    if (!ses) return NextResponse.json({ error: "Sessão não encontrada" }, { status: 404 });

    const { data: msgs, error: mErr } = await supabase
      .from("hub_crm_agente_briefing_mensagem")
      .select("id, papel, conteudo, criado_em, metadata")
      .eq("sessao_id", sid)
      .order("criado_em", { ascending: true })
      .limit(500);

    if (mErr) return erroBriefingJson(mErr.message, 500);
    mensagens = msgs || [];
  }

  const payload = {
    agente_slug: agente.agente_slug,
    nome: agente.nome,
    sessoes: sessoes || [],
    mensagens,
    sessao_id_ativa: sessaoId || null,
  };
  cacheSetBriefingGet(slug, sessaoId, payload);
  return NextResponse.json(payload);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }
  const temMistral = Boolean(process.env.MISTRAL_API_KEY?.trim());
  const temAnthropic = Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  if (!temMistral && !temAnthropic) {
    return NextResponse.json(
      { error: "Nenhum provedor IA configurado (MISTRAL_API_KEY ou ANTHROPIC_API_KEY)." },
      { status: 503 }
    );
  }

  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);

  let body: { sessao_id?: string | null; mensagem?: string; modo?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const modo = normalizarModoBriefing(body.modo);

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

  if (agErr) return erroBriefingJson(agErr.message, 500);
  if (!agente) return NextResponse.json({ error: "Agente não encontrado" }, { status: 404 });

  const modelo =
    (typeof agente.modelo_padrao === "string" && agente.modelo_padrao.trim())
      ? agente.modelo_padrao.trim()
      : MODELO_FALLBACK;

  let sessaoId = body.sessao_id?.trim() || "";
  if (!sessaoId) {
    const { data: nova, error: nErr } = await supabase
      .from("hub_crm_agente_briefing_sessao")
      .insert({ agente_slug: slug, titulo: null, modo })
      .select("id")
      .single();
    if (nErr || !nova) {
      return erroBriefingJson(nErr?.message || "Falha ao criar sessão", 500);
    }
    sessaoId = nova.id as string;
  } else {
    const { data: ses, error: vErr } = await supabase
      .from("hub_crm_agente_briefing_sessao")
      .select("id, modo")
      .eq("id", sessaoId)
      .eq("agente_slug", slug)
      .maybeSingle();
    if (vErr) return erroBriefingJson(vErr.message, 500);
    if (!ses) return NextResponse.json({ error: "Sessão inválida" }, { status: 400 });
    const modoSessao = (ses as { modo?: string }).modo ?? "briefing_interno";
    if (modoSessao !== modo) {
      return NextResponse.json(
        {
          error:
            "Esta conversa foi iniciada noutro modo. Ajuste o modo no painel AI — Funcionários ou feche e abra de novo.",
        },
        { status: 409 }
      );
    }
  }

  const { error: uErr } = await supabase.from("hub_crm_agente_briefing_mensagem").insert({
    sessao_id: sessaoId,
    papel: "user",
    conteudo: textoUser,
    metadata: { modo },
  });
  if (uErr) return erroBriefingJson(uErr.message, 500);

  const { data: historicoRows, error: hErr } = await supabase
    .from("hub_crm_agente_briefing_mensagem")
    .select("papel, conteudo")
    .eq("sessao_id", sessaoId)
    .order("criado_em", { ascending: true })
    .limit(MAX_HISTORICO_MENSAGENS);

  if (hErr) return erroBriefingJson(hErr.message, 500);

  const historico: BriefingMensagemLinha[] = (historicoRows || [])
    .filter(
      (r): r is { papel: string; conteudo: string } =>
        (r.papel === "user" || r.papel === "assistant") && typeof r.conteudo === "string"
    )
    .map((r) => ({ papel: r.papel as "user" | "assistant", conteudo: r.conteudo }));

  const historicoParaModelo = historico.slice(0, -1);

  let memoriasAgenteBloco = "";
  try {
    const memAgente = await listarMemoriasAgente(supabase, slug, 6);
    memoriasAgenteBloco = formatarBlocoMemoriasAgente(memAgente);
  } catch {
    memoriasAgenteBloco = "";
  }

  let resultado;
  try {
    if (modo === "simulacao_canal") {
      resultado = await executarSimulacaoCanalReply({
        agenteSlug: slug,
        historico: historicoParaModelo,
        mensagemUsuario: textoUser,
      });
    } else {
      const snapshot = await montarSnapshotOperacionalReadOnly(
        supabase,
        slug,
        String(agente.nome || slug)
      );
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
        memoriasAgenteBloco,
      });
    }
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
      modo,
    },
  });
  if (aErr) return erroBriefingJson(aErr.message, 500);

  try {
    await extrairESalvarMemoriasAgente(supabase, {
      agenteSlug: slug,
      mensagemUsuario: textoUser,
      respostaIA: resultado.texto,
      origem: "briefing",
    });
  } catch {
    /* hub_memorias_agente opcional até migração aplicada */
  }

  await supabase
    .from("hub_crm_agente_briefing_sessao")
    .update({ atualizado_em: new Date().toISOString() })
    .eq("id", sessaoId);
  cacheInvalidateBriefingGet(slug, sessaoId);

  const { data: mensagens, error: mErr } = await supabase
    .from("hub_crm_agente_briefing_mensagem")
    .select("id, papel, conteudo, criado_em, metadata")
    .eq("sessao_id", sessaoId)
    .order("criado_em", { ascending: true })
    .limit(500);

  if (mErr) return erroBriefingJson(mErr.message, 500);

  const payload = {
    sessao_id: sessaoId,
    modo,
    mensagens: mensagens || [],
    ultima_resposta_meta: {
      modelo: resultado.modelo,
      tokens_input: resultado.tokens_input,
      tokens_output: resultado.tokens_output,
      custo_brl: resultado.custo_brl,
    },
  };
  cacheSetBriefingGet(slug, sessaoId, payload);
  return NextResponse.json(payload);
}
