import { createClient } from "@supabase/supabase-js";
import { normalizarAvatarUrlAgente } from "@/lib/crm/agente-avatar-gen";
import { NextRequest, NextResponse } from "next/server";
import type { CicloTimelineEvent } from "@/lib/crm/ciclo-ui";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function cfgObj(cfg: unknown): Record<string, unknown> {
  return cfg && typeof cfg === "object" && !Array.isArray(cfg) ? (cfg as Record<string, unknown>) : {};
}

function acoesParaTexto(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((x) => String(x)).filter(Boolean).slice(0, 8);
  }
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    const parts: string[] = [];
    if (o.acao) parts.push(String(o.acao));
    if (o.lead_id) parts.push(`lead ${String(o.lead_id).slice(0, 8)}…`);
    if (o.mercado) parts.push(String(o.mercado));
    if (o.descricao) parts.push(String(o.descricao));
    return parts.length > 0 ? parts : [JSON.stringify(raw).slice(0, 120)];
  }
  if (typeof raw === "string" && raw.trim()) return [raw.trim()];
  return [];
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }

  const { id: rawId } = await params;
  const cicloId = decodeURIComponent(rawId).trim();
  if (!cicloId) {
    return NextResponse.json({ error: "id obrigatório." }, { status: 400 });
  }

  const supabase = db();
  const limitRaw = Number.parseInt(new URL(_request.url).searchParams.get("limit") || "50", 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 50;

  const { data: ciclo, error: cicloErr } = await supabase
    .from("hub_ciclos_ia")
    .select(
      "id, agente_slug, nome, descricao, tipo, ativo, ultimo_ciclo, ultimo_status, total_execucoes, configuracoes"
    )
    .eq("id", cicloId)
    .maybeSingle();

  if (cicloErr) {
    return NextResponse.json({ error: cicloErr.message }, { status: 500 });
  }
  if (!ciclo) {
    return NextResponse.json({ error: "Ciclo não encontrado." }, { status: 404 });
  }

  const agenteSlug = String(ciclo.agente_slug || "").trim();
  const tipo = String(ciclo.tipo || "");

  const [logsById, logsByAgente, acoesR, promptsR, agenteR] = await Promise.all([
    supabase
      .from("hub_ciclos_log")
      .select("*")
      .eq("ciclo_id", cicloId)
      .order("iniciado_em", { ascending: false })
      .limit(limit),
    agenteSlug
      ? supabase
          .from("hub_ciclos_log")
          .select("*")
          .eq("agente_slug", agenteSlug)
          .is("ciclo_id", null)
          .order("iniciado_em", { ascending: false })
          .limit(Math.min(limit, 25))
      : Promise.resolve({ data: [], error: null }),
    tipo === "gatilho" && agenteSlug
      ? supabase
          .from("hub_acoes_ia")
          .select("id, tipo, descricao, lead_id, sucesso, erro, tokens_usados, custo_brl, criado_em, metadata")
          .eq("agente_slug", agenteSlug)
          .order("criado_em", { ascending: false })
          .limit(Math.min(limit, 20))
      : Promise.resolve({ data: [], error: null }),
    tipo === "gatilho" && agenteSlug
      ? supabase
          .from("hub_prompt_logs")
          .select(
            "id, lead_id, modelo_usado, tokens_input, tokens_output, custo_brl, tempo_resposta_ms, foi_escalado, criado_em"
          )
          .eq("agente_slug", agenteSlug)
          .order("criado_em", { ascending: false })
          .limit(Math.min(limit, 20))
      : Promise.resolve({ data: [], error: null }),
    agenteSlug
      ? supabase
          .from("hub_agente_identidade")
          .select("agente_slug, nome, cargo, avatar_url, modo_operacao, ativo")
          .eq("agente_slug", agenteSlug)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const errors = [logsById.error, logsByAgente.error, acoesR.error, promptsR.error, agenteR.error].filter(
    Boolean
  );
  if (errors.length > 0) {
    return NextResponse.json({ error: errors.map((e) => e?.message).join("; ") }, { status: 500 });
  }

  const seen = new Set<string>();
  const eventos: CicloTimelineEvent[] = [];

  const pushLog = (log: Record<string, unknown>, origem: "ciclo" | "agente") => {
    const id = String(log.id ?? "");
    if (!id || seen.has(`exec:${id}`)) return;
    seen.add(`exec:${id}`);
    const st = String(log.status ?? "—");
    eventos.push({
      id: `exec:${id}`,
      kind: "execucao",
      status: st,
      titulo: st === "rodando" ? "Execução em curso" : `Execução · ${st.replace(/_/g, " ")}`,
      subtitulo: origem === "agente" ? "Registo do agente (sem ciclo_id)" : undefined,
      iniciado_em: String(log.iniciado_em ?? log.criado_em ?? new Date().toISOString()),
      finalizado_em: log.finalizado_em ? String(log.finalizado_em) : null,
      erro: typeof log.erro === "string" ? log.erro : null,
      tokens_usados: typeof log.tokens_usados === "number" ? log.tokens_usados : null,
      custo_brl: typeof log.custo_brl === "number" ? log.custo_brl : null,
      acoes_tomadas: log.acoes_tomadas,
      alertas_gerados: log.alertas_gerados,
      metadata: { origem },
    });
  };

  for (const log of logsById.data ?? []) {
    pushLog(log as Record<string, unknown>, "ciclo");
  }
  for (const log of logsByAgente.data ?? []) {
    pushLog(log as Record<string, unknown>, "agente");
  }

  for (const ac of acoesR.data ?? []) {
    const row = ac as Record<string, unknown>;
    const id = String(row.id ?? "");
    if (!id || seen.has(`acao:${id}`)) continue;
    seen.add(`acao:${id}`);
    eventos.push({
      id: `acao:${id}`,
      kind: "acao_ia",
      status: row.sucesso === false ? "erro" : "sucesso",
      titulo: String(row.descricao || row.tipo || "Ação IA"),
      subtitulo: String(row.tipo || ""),
      iniciado_em: String(row.criado_em ?? new Date().toISOString()),
      erro: typeof row.erro === "string" ? row.erro : null,
      tokens_usados: typeof row.tokens_usados === "number" ? row.tokens_usados : null,
      custo_brl: typeof row.custo_brl === "number" ? row.custo_brl : null,
      metadata: {
        lead_id: row.lead_id,
        sucesso: row.sucesso,
        ...(cfgObj(row.metadata)),
      },
    });
  }

  for (const pr of promptsR.data ?? []) {
    const row = pr as Record<string, unknown>;
    const id = String(row.id ?? "");
    if (!id || seen.has(`prompt:${id}`)) continue;
    seen.add(`prompt:${id}`);
    const tokensIn = typeof row.tokens_input === "number" ? row.tokens_input : 0;
    const tokensOut = typeof row.tokens_output === "number" ? row.tokens_output : 0;
    eventos.push({
      id: `prompt:${id}`,
      kind: "prompt",
      status: row.foi_escalado === true ? "importante" : "sucesso",
      titulo: "Resposta IA no canal",
      subtitulo: String(row.modelo_usado || ""),
      iniciado_em: String(row.criado_em ?? new Date().toISOString()),
      tokens_usados: tokensIn + tokensOut,
      custo_brl: typeof row.custo_brl === "number" ? row.custo_brl : null,
      metadata: {
        lead_id: row.lead_id,
        tempo_resposta_ms: row.tempo_resposta_ms,
        foi_escalado: row.foi_escalado,
      },
    });
  }

  eventos.sort(
    (a, b) => new Date(b.iniciado_em).getTime() - new Date(a.iniciado_em).getTime()
  );

  const resumo = {
    total: eventos.length,
    execucoes: eventos.filter((e) => e.kind === "execucao").length,
    acoes_ia: eventos.filter((e) => e.kind === "acao_ia").length,
    prompts: eventos.filter((e) => e.kind === "prompt").length,
    inclui_interacao: tipo === "gatilho",
  };

  const agenteRaw = agenteR.data as Record<string, unknown> | null;
  const agente =
    agenteRaw && typeof agenteRaw.agente_slug === "string"
      ? {
          ...agenteRaw,
          avatar_url: normalizarAvatarUrlAgente(
            agenteRaw.agente_slug,
            typeof agenteRaw.nome === "string" ? agenteRaw.nome : null,
            typeof agenteRaw.avatar_url === "string" ? agenteRaw.avatar_url : null
          ),
        }
      : agenteRaw;

  return NextResponse.json({
    ciclo,
    agente,
    eventos: eventos.slice(0, limit),
    resumo,
    dica_vazia:
      eventos.length === 0
        ? tipo === "gatilho"
          ? "Este ciclo dispara quando chega mensagem no WhatsApp/webhook. A timeline mostra execuções, prompts e ações IA do agente."
          : tipo === "programado"
            ? "Ative o ciclo e configure dispatch/cron para o dispatcher registar execuções aqui."
            : "Execuções contínuas e ações do motor aparecem aqui após a primeira corrida."
        : null,
  });
}
