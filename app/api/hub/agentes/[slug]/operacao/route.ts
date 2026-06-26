import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { ensureHubCicloPadraoParaAgente } from "@/lib/hub/provision-hub-ciclo-padrao";
import { buildFollowupOperacaoSnapshot } from "@/lib/hub/followup-operacao";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }

  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);
  const supabase = db();

  /** Histórico de execuções no painel (não é “lifetime” completo; ver CRM / relatórios para auditoria longa). */
  const CICLOS_LOG_LIMIT = 150;

  let ciclosR = await supabase
    .from("hub_ciclos_ia")
    .select("id, nome, descricao, tipo, ativo, cron_expressao, ultimo_ciclo, ultimo_status, total_execucoes, intervalo_minutos")
    .eq("agente_slug", slug)
    .order("nome");

  if (!ciclosR.error && (!ciclosR.data || ciclosR.data.length === 0)) {
    const repair = await ensureHubCicloPadraoParaAgente(supabase, slug);
    if (repair.provisionado) {
      ciclosR = await supabase
        .from("hub_ciclos_ia")
        .select("id, nome, descricao, tipo, ativo, cron_expressao, ultimo_ciclo, ultimo_status, total_execucoes, intervalo_minutos")
        .eq("agente_slug", slug)
        .order("nome");
    } else if (repair.erro) {
      console.warn("[operacao] reparo ciclo padrão:", slug, repair.erro);
    }
  }

  const [logsR, acoesR, promptR, followup] = await Promise.all([
    supabase
      .from("hub_ciclos_log")
      .select("id, ciclo_id, status, erro, iniciado_em, finalizado_em, tokens_usados, custo_brl, acoes_tomadas")
      .eq("agente_slug", slug)
      .order("iniciado_em", { ascending: false })
      .limit(CICLOS_LOG_LIMIT),
    supabase
      .from("hub_acoes_ia")
      .select("id, tipo, descricao, lead_id, sucesso, criado_em, metadata")
      .eq("agente_slug", slug)
      .order("criado_em", { ascending: false })
      .limit(12),
    supabase
      .from("hub_prompt_logs")
      .select("criado_em")
      .eq("agente_slug", slug)
      .order("criado_em", { ascending: false })
      .limit(1)
      .maybeSingle(),
    buildFollowupOperacaoSnapshot(supabase, slug),
  ]);

  const errors = [ciclosR.error, logsR.error, acoesR.error, promptR.error].filter(Boolean);
  if (errors.length > 0) {
    return NextResponse.json({ error: errors.map((e) => e?.message).join("; ") }, { status: 500 });
  }

  return NextResponse.json({
    ciclos: ciclosR.data || [],
    execucoes_ciclo: logsR.data || [],
    acoes: acoesR.data || [],
    ultimo_prompt_em: promptR.data?.criado_em ?? null,
    followup,
  });
}
