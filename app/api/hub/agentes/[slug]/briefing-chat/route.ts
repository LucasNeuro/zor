import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import {
  carregarTrechoPlaybookCopiloto,
  executarBriefingReply,
  executarSimulacaoCanalReply,
  montarSnapshotOperacionalReadOnly,
  type BriefingChatReplyResult,
  type BriefingMensagemLinha,
  type BriefingModoSessao,
} from "@/lib/agente-briefing-chat";
import { agenteEhCopilotoInterno, isModoOperacaoAgente } from "@/lib/hub/agente-modo-operacao";
import {
  agenteRaciocinioAvancadoAtivo,
  mergeUsoFerramentasComPadraoPreservandoCustom,
} from "@/lib/hub/agente-ferramentas-registry";
import { registrarInteracaoPainelAgente } from "@/lib/hub/registrar-interacao-painel";
import { CRM_ACCESS_COOKIE, fetchAuthUserFromAccessToken } from "@/lib/auth/crm-session";
import { mensagemErroBriefingChat } from "@/lib/hub/briefing-chat-errors";
import { isMistralRateLimitError } from "@/lib/ia/mistral-rate-limit";
import {
  montarMensagemComAnexos,
  processarAnexosBriefingChat,
  validarAnexosBriefingChat,
} from "@/lib/hub/briefing-chat-anexos";

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

  let body: {
    sessao_id?: string | null;
    mensagem?: string;
    modo?: unknown;
    anexos?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const modo = normalizarModoBriefing(body.modo);

  const textoUser = String(body.mensagem ?? "").trim();
  let anexosInput: ReturnType<typeof validarAnexosBriefingChat> = [];
  try {
    anexosInput = validarAnexosBriefingChat(body.anexos);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Anexos inválidos.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  if ((!textoUser && anexosInput.length === 0) || textoUser.length > MAX_MENSAGEM_LEN) {
    return NextResponse.json({ error: "Mensagem inválida ou muito longa." }, { status: 400 });
  }

  let blocoMultimodal = "";
  let anexosMeta: Awaited<ReturnType<typeof processarAnexosBriefingChat>>["anexosMeta"] = [];
  if (anexosInput.length > 0) {
    try {
      const proc = await processarAnexosBriefingChat(anexosInput);
      blocoMultimodal = proc.blocoMultimodal;
      anexosMeta = proc.anexosMeta;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao processar anexos.";
      const status = isMistralRateLimitError(msg) ? 429 : 502;
      return NextResponse.json({ error: mensagemErroBriefingChat(msg) }, { status });
    }
  }

  const mensagemParaModelo = montarMensagemComAnexos(textoUser, blocoMultimodal);
  const conteudoVisivelUser =
    textoUser ||
    (anexosMeta.length === 1
      ? `[Anexo: ${anexosMeta[0].nome}]`
      : `[${anexosMeta.length} anexos]`);

  const supabase = db();

  const { data: agente, error: agErr } = await supabase
    .from("hub_agente_identidade")
    .select(
      "agente_slug, nome, cargo, area, bio, modelo_padrao, system_prompt_base, modo_operacao, tenant_id, uso_ferramentas_ia, playbook_generated_at, playbook_object_path, playbook_public_url, playbook_source_hash"
    )
    .eq("agente_slug", slug)
    .maybeSingle();

  if (agErr) return erroBriefingJson(agErr.message, 500);
  if (!agente) return NextResponse.json({ error: "Agente não encontrado" }, { status: 404 });

  const modoOperacaoRaw =
    typeof agente.modo_operacao === "string" ? agente.modo_operacao : null;
  const modoOperacao = isModoOperacaoAgente(modoOperacaoRaw) ? modoOperacaoRaw : null;
  const ehCopilotoInterno = agenteEhCopilotoInterno(modoOperacao);

  if (modo === "simulacao_canal" && ehCopilotoInterno) {
    return NextResponse.json(
      {
        error:
          "Este é um agente interno. Use o copiloto para conversar com a equipa — simulação de canal só existe em agentes de atendimento (WhatsApp).",
      },
      { status: 400 }
    );
  }

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
    conteudo: conteudoVisivelUser,
    metadata: {
      modo,
      ...(anexosMeta.length
        ? {
            multimodal: true,
            anexos: anexosMeta,
            texto_utilizador: textoUser || null,
          }
        : {}),
    },
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

  let usuarioCrmId: string | null = null;
  try {
    const token = request.cookies.get(CRM_ACCESS_COOKIE)?.value;
    if (token) {
      const authUser = await fetchAuthUserFromAccessToken(token);
      usuarioCrmId = authUser?.id ?? null;
    }
  } catch {
    usuarioCrmId = null;
  }

  let resultado: BriefingChatReplyResult;
  try {
    if (modo === "simulacao_canal") {
      resultado = await executarSimulacaoCanalReply({
        agenteSlug: slug,
        historico: historicoParaModelo,
        mensagemUsuario: mensagemParaModelo,
        supabase,
        sessaoId,
        modoOperacao:
          typeof agente.modo_operacao === "string" ? agente.modo_operacao : null,
        tenantId: typeof agente.tenant_id === "string" ? agente.tenant_id : null,
        agenteNome: typeof agente.nome === "string" ? agente.nome : null,
      });
    } else {
      const snapshot = await montarSnapshotOperacionalReadOnly(
        supabase,
        slug,
        String(agente.nome || slug)
      );
      let playbookTrecho: string | undefined;
      if (ehCopilotoInterno) {
        playbookTrecho = await carregarTrechoPlaybookCopiloto(supabase, slug, {
          playbook_generated_at:
            typeof agente.playbook_generated_at === "string" ? agente.playbook_generated_at : null,
          playbook_object_path:
            typeof agente.playbook_object_path === "string" ? agente.playbook_object_path : null,
          playbook_public_url:
            typeof agente.playbook_public_url === "string" ? agente.playbook_public_url : null,
          playbook_source_hash:
            typeof agente.playbook_source_hash === "string" ? agente.playbook_source_hash : null,
        });
      }
      resultado = await executarBriefingReply({
        modelo,
        agenteNome: String(agente.nome || slug),
        agenteSlug: slug,
        cargo: typeof agente.cargo === "string" ? agente.cargo : undefined,
        area: typeof agente.area === "string" ? agente.area : undefined,
        bio: typeof agente.bio === "string" ? agente.bio : undefined,
        promptBaseTrecho:
          typeof agente.system_prompt_base === "string" ? agente.system_prompt_base : undefined,
        playbookTrecho,
        snapshot,
        historico: historicoParaModelo,
        mensagemUsuario: mensagemParaModelo,
        modoOperacao,
        agentReasoningEnabled: agenteRaciocinioAvancadoAtivo(
          mergeUsoFerramentasComPadraoPreservandoCustom(agente.uso_ferramentas_ia)
        ),
        supabase,
        tenantId: typeof agente.tenant_id === "string" ? agente.tenant_id : null,
        usuarioCrmId,
      });
    }
  } catch (e) {
    const raw = e instanceof Error ? e.message : "Falha ao gerar resposta";
    const status = isMistralRateLimitError(raw) ? 429 : 502;
    return NextResponse.json({ error: mensagemErroBriefingChat(raw) }, { status });
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
      motor: resultado.motor ?? "llm_prompt",
      ...(resultado.flow_state ? { flow_state: resultado.flow_state } : {}),
      ...(resultado.urls_publicas?.length
        ? { urls_publicas: resultado.urls_publicas, tipo: "artefato_canvas" }
        : {}),
    },
  });
  if (aErr) return erroBriefingJson(aErr.message, 500);

  try {
    await registrarInteracaoPainelAgente(supabase, {
      agenteSlug: slug,
      modo,
      sessaoId,
      mensagemUsuario: mensagemParaModelo,
      respostaTexto: resultado.texto,
      modelo: resultado.modelo,
      tokens_input: resultado.tokens_input,
      tokens_output: resultado.tokens_output,
      custo_brl: resultado.custo_brl,
      motor: resultado.motor,
      leadId: null,
      ehCopilotoInterno,
    });
  } catch (e) {
    console.warn("[briefing-chat] registrar interacao painel:", e);
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
      urls_publicas: resultado.urls_publicas ?? [],
    },
  };
  cacheSetBriefingGet(slug, sessaoId, payload);
  return NextResponse.json(payload);
}
