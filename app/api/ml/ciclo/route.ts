import { NextRequest, NextResponse } from "next/server";
import { rodarCicloML, cobrarSubordinados, medirKPIs } from "@/lib/ia/ml";
import { varrerSistema, monitorarTrafego } from "@/lib/ia/monitor";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { tipo = "completo", agenteSlug } = body;

    if (tipo === "kpis" && agenteSlug) {
      await medirKPIs(agenteSlug);
      return NextResponse.json({ sucesso: true, tipo: "kpis", agente: agenteSlug });
    }

    if (tipo === "monitor") {
      const [sistema, trafego] = await Promise.all([varrerSistema(), monitorarTrafego()]);
      return NextResponse.json({ sucesso: true, sistema, trafego });
    }

    if (tipo === "cobranca" && agenteSlug) {
      await cobrarSubordinados(agenteSlug);
      return NextResponse.json({ sucesso: true, tipo: "cobranca", supervisor: agenteSlug });
    }

    const [mlResultado, monitorResultado] = await Promise.all([
      rodarCicloML(),
      varrerSistema(),
    ]);

    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: agentes } = await db
      .from("hub_agente_identidade")
      .select("agente_slug")
      .eq("ativo", true);

    if (agentes) {
      await Promise.all(agentes.map((a: Record<string, unknown>) => medirKPIs(a.agente_slug as string)));
    }

    return NextResponse.json({
      sucesso: true,
      ml: mlResultado,
      monitor: {
        alertasCriticos: monitorResultado.alertasCriticos.length,
        sugestoes: monitorResultado.sugestoes.length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (erro) {
    const errMsg = erro instanceof Error ? erro.message : "Erro desconhecido";
    console.error("[ML API] Erro:", errMsg);
    return NextResponse.json({ sucesso: false, erro: errMsg }, { status: 500 });
  }
}

export async function GET() {
  try {
    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const [sugestoes, historicos, acoes, kpisForaMeta] = await Promise.all([
      db.from("hub_ml_sugestoes").select("*").eq("status", "pendente").order("criado_em", { ascending: false }),
      db.from("hub_ml_historico").select("*").is("encerrado_em", null).order("criado_em", { ascending: false }),
      db.from("hub_acoes_ia").select("*").gte("criado_em", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()).order("criado_em", { ascending: false }).limit(20),
      db.from("hub_kpis_resultados").select("*").neq("nivel_alerta", "ok").gte("criado_em", new Date(Date.now() - 60 * 60 * 1000).toISOString()),
    ]);

    return NextResponse.json({
      sugestoesPendentes: sugestoes.data?.length || 0,
      sugestoes: sugestoes.data || [],
      historicosAtivos: historicos.data?.length || 0,
      acoesUltimas24h: acoes.data?.length || 0,
      acoes: acoes.data || [],
      kpisForaMeta: kpisForaMeta.data?.length || 0,
      kpis: kpisForaMeta.data || [],
    });
  } catch (erro) {
    return NextResponse.json({ erro: "Erro ao buscar status" }, { status: 500 });
  }
}
