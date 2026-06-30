import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cronRequestAuthorized } from "@/lib/cron-auth";
import { defaultTenantId } from "@/lib/tenant-default";
import { executarAgenteInterno } from "@/lib/hub/executar-agente-interno";
import { carregarTrechoPlaybookCopiloto, montarSnapshotOperacionalReadOnly } from "@/lib/agente-briefing-chat";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const MODELO_FALLBACK = "mistral";

async function registrarExecucaoAgenteInterno(
  agenteSlug: string,
  statusExec: "sucesso" | "erro" | "sem_acao",
  resultado: { texto?: string; tokens_output?: number } | null,
  hubCicloId?: string | null
) {
  let cfg: { id: string; total_execucoes: number | null; agente_slug: string } | null = null;

  if (hubCicloId) {
    const { data } = await supabase
      .from("hub_ciclos_ia")
      .select("id, total_execucoes, agente_slug")
      .eq("id", hubCicloId)
      .maybeSingle();
    if (data?.id) cfg = data;
  }

  if (!cfg?.id) {
    const { data } = await supabase
      .from("hub_ciclos_ia")
      .select("id, total_execucoes, agente_slug")
      .eq("agente_slug", agenteSlug)
      .eq("tipo", "programado")
      .order("criado_em", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.id) cfg = data;
  }

  if (!cfg?.id) return;

  const texto = resultado?.texto?.trim() || "";
  const acoes = texto.length > 0 ? [texto.slice(0, 500)] : [];

  await supabase.from("hub_ciclos_log").insert({
    ciclo_id: cfg.id,
    agente_slug: cfg.agente_slug,
    status: statusExec,
    finalizado_em: new Date().toISOString(),
    acoes_tomadas: acoes,
    alertas_gerados: [],
  });

  await supabase
    .from("hub_ciclos_ia")
    .update({
      ultimo_ciclo: new Date().toISOString(),
      ultimo_status: statusExec,
      total_execucoes: (cfg.total_execucoes ?? 0) + 1,
    })
    .eq("id", cfg.id);
}

/**
 * Runner genérico para agentes internos (jobs_internos).
 * Query: ciclo=briefing_programado, hub_ciclo_id, agente_slug (opcional se hub_ciclo_id presente)
 */
export async function GET(request: NextRequest) {
  if (!cronRequestAuthorized(request)) {
    return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  }

  const ciclo = request.nextUrl.searchParams.get("ciclo") || "briefing_programado";
  const hubCicloId = request.nextUrl.searchParams.get("hub_ciclo_id");
  let agenteSlug = request.nextUrl.searchParams.get("agente_slug")?.trim() || "";

  if (!agenteSlug && hubCicloId) {
    const { data: cicloRow } = await supabase
      .from("hub_ciclos_ia")
      .select("agente_slug, configuracoes")
      .eq("id", hubCicloId)
      .maybeSingle();
    if (cicloRow?.agente_slug) agenteSlug = String(cicloRow.agente_slug);
  }

  if (!agenteSlug) {
    return NextResponse.json({ erro: "agente_slug ou hub_ciclo_id obrigatório" }, { status: 400 });
  }

  if (ciclo !== "briefing_programado") {
    return NextResponse.json({ erro: "ciclo_desconhecido", ciclo }, { status: 400 });
  }

  try {
    const { data: agente, error: agErr } = await supabase
      .from("hub_agente_identidade")
      .select(
        "agente_slug, nome, cargo, area, bio, modelo, modo_operacao, tenant_id, system_prompt_base, motor_ferramentas_habilitado, playbook_generated_at, playbook_object_path, playbook_public_url, playbook_source_hash"
      )
      .eq("agente_slug", agenteSlug)
      .maybeSingle();

    if (agErr || !agente) {
      await registrarExecucaoAgenteInterno(agenteSlug, "erro", null, hubCicloId);
      return NextResponse.json({ erro: "agente_nao_encontrado" }, { status: 404 });
    }

    if (agente.modo_operacao !== "jobs_internos") {
      return NextResponse.json(
        { erro: "agente_nao_interno", modo: agente.modo_operacao },
        { status: 400 }
      );
    }

    if (agente.motor_ferramentas_habilitado !== true) {
      await registrarExecucaoAgenteInterno(agenteSlug, "sem_acao", { texto: "Motor de ferramentas desligado." }, hubCicloId);
      return NextResponse.json({
        ok: true,
        aviso: "motor_ferramentas_desligado",
        agente_slug: agenteSlug,
      });
    }

    let briefCiclo =
      "Execute a rotina programada: analise dados operacionais do tenant e produza resumo útil para a equipa conforme o seu cargo.";
    if (hubCicloId) {
      const { data: cicloRow } = await supabase
        .from("hub_ciclos_ia")
        .select("configuracoes, descricao")
        .eq("id", hubCicloId)
        .maybeSingle();
      const cfg = cicloRow?.configuracoes as Record<string, unknown> | null;
      const briefCfg = typeof cfg?.brief_padrao === "string" ? cfg.brief_padrao.trim() : "";
      if (briefCfg) briefCiclo = briefCfg;
      else if (typeof cicloRow?.descricao === "string" && cicloRow.descricao.trim()) {
        briefCiclo = cicloRow.descricao.trim();
      }
    }

    const snapshot = await montarSnapshotOperacionalReadOnly(
      supabase,
      agenteSlug,
      String(agente.nome || agenteSlug)
    );

    const playbookTrecho = await carregarTrechoPlaybookCopiloto(supabase, agenteSlug, {
      playbook_generated_at:
        typeof agente.playbook_generated_at === "string" ? agente.playbook_generated_at : null,
      playbook_object_path:
        typeof agente.playbook_object_path === "string" ? agente.playbook_object_path : null,
      playbook_public_url:
        typeof agente.playbook_public_url === "string" ? agente.playbook_public_url : null,
      playbook_source_hash:
        typeof agente.playbook_source_hash === "string" ? agente.playbook_source_hash : null,
    });

    const tenantId =
      typeof agente.tenant_id === "string" && agente.tenant_id.trim()
        ? agente.tenant_id.trim()
        : defaultTenantId();

    const modelo =
      typeof agente.modelo === "string" && agente.modelo.trim() ? agente.modelo.trim() : MODELO_FALLBACK;

    const resultado = await executarAgenteInterno({
      supabase,
      modelo,
      agenteNome: String(agente.nome || agenteSlug),
      agenteSlug,
      tenantId,
      cargo: typeof agente.cargo === "string" ? agente.cargo : undefined,
      area: typeof agente.area === "string" ? agente.area : undefined,
      bio: typeof agente.bio === "string" ? agente.bio : undefined,
      promptBaseTrecho:
        typeof agente.system_prompt_base === "string" ? agente.system_prompt_base : undefined,
      playbookTrecho,
      snapshot,
      historico: [],
      mensagemUsuario: briefCiclo,
      trigger: "ciclo",
      canalInterno: "ciclo_programado",
      briefCiclo,
    });

    const statusExec = resultado.texto.trim().length > 0 ? "sucesso" : "sem_acao";
    await registrarExecucaoAgenteInterno(agenteSlug, statusExec, resultado, hubCicloId);

    return NextResponse.json({
      ok: true,
      agente_slug: agenteSlug,
      status: statusExec,
      resumo: resultado.texto.slice(0, 400),
      tokens_output: resultado.tokens_output,
      urls_publicas: resultado.urls_publicas ?? [],
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro_execucao";
    console.error("[CICLO-AGENTE-INTERNO]", agenteSlug, msg);
    await registrarExecucaoAgenteInterno(agenteSlug, "erro", { texto: msg }, hubCicloId);
    return NextResponse.json({ erro: msg }, { status: 500 });
  }
}
