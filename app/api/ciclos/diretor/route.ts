import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cronRequestAuthorized } from "@/lib/cron-auth";
import { medirKPIs } from "@/lib/ia/ml";
import { whatsappConfigured, whatsappSendText } from "@/lib/whatsapp/whatsapp-send";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/** Slugs reais em hub_agente_identidade (documento mestre — evitar "diretor" inexistente). */
const AG_TRAFEGO = "diretor_operacoes";
const AG_ANALISES = "diretor_geral_ia";

async function buscarDadosWindsor() {
  if (!process.env.WINDSOR_API_KEY) return null;

  try {
    const hoje = new Date();
    const seteDias = new Date(hoje.getTime() - 7 * 24 * 3600000);
    const dateFrom = seteDias.toISOString().split("T")[0];
    const dateTo = hoje.toISOString().split("T")[0];

    const res = await fetch(
      `https://connectors.windsor.ai/facebook?api_key=${process.env.WINDSOR_API_KEY}&date_from=${dateFrom}&date_to=${dateTo}&fields=campaign,spend,clicks,impressions,cpc,ctr`,
      { method: "GET", headers: { "Content-Type": "application/json" } }
    );

    if (!res.ok) return null;
    const data = await res.json();
    return data?.data || null;
  } catch (e) {
    console.error("Erro Windsor:", e);
    return null;
  }
}

async function cicloTrafego() {
  const alertas: string[] = [];
  const sugestoes: string[] = [];

  const campanhas = await buscarDadosWindsor();

  if (!campanhas || campanhas.length === 0) {
    await supabase.from("hub_alertas").insert({
      tipo: "info",
      agente_slug: AG_TRAFEGO,
      titulo: "Verificação de campanhas",
      mensagem: "Dados de campanhas não disponíveis. Configure a integração Windsor.ai.",
      dados: {},
    });
    return { alertas, sugestoes, total: 0 };
  }

  for (const camp of campanhas) {
    const spend = Number(camp.spend) || 0;
    const clicks = Number(camp.clicks) || 0;
    const cpc = spend > 0 && clicks > 0 ? spend / clicks : 0;

    if (cpc > 5) {
      await supabase.from("hub_alertas").insert({
        tipo: "critico",
        agente_slug: AG_TRAFEGO,
        titulo: `CPC crítico: ${camp.campaign}`,
        mensagem: `Campanha "${camp.campaign}" com CPC R$${cpc.toFixed(2)} — muito acima da meta.\nGasto: R$${spend.toFixed(0)} | Cliques: ${clicks}`,
        dados: { campanha: camp.campaign, cpc, spend, clicks },
      });
      alertas.push(`CPC crítico: ${camp.campaign} — R$${cpc.toFixed(2)}`);
    } else if (cpc > 3) {
      await supabase.from("hub_alertas").insert({
        tipo: "importante",
        agente_slug: AG_TRAFEGO,
        titulo: `CPC alto: ${camp.campaign}`,
        mensagem: `Campanha "${camp.campaign}" com CPC R$${cpc.toFixed(2)} — acima da meta de R$2,50.`,
        dados: { campanha: camp.campaign, cpc, spend, clicks },
      });
    }

    if (cpc < 2 && spend > 100) {
      sugestoes.push(`Campanha "${camp.campaign}" com ótimo CPC R$${cpc.toFixed(2)} — considere aumentar orçamento`);
    }
  }

  if (sugestoes.length > 0) {
    await supabase.from("hub_alertas").insert({
      tipo: "sugestao",
      agente_slug: AG_TRAFEGO,
      titulo: `${sugestoes.length} sugestão(ões) de otimização`,
      mensagem: sugestoes.join("\n"),
      dados: { sugestoes },
    });
  }

  return { alertas, sugestoes, total: alertas.length + sugestoes.length };
}

async function cicloAnaliseManha() {
  const [leads, encaminhados, alertasAbertos] = await Promise.all([
    supabase.from("hub_leads_crm").select("id, estagio, valor_estimado").not("estagio", "in", '("ganho","perdido","arquivado")'),
    supabase.from("hub_encaminhamentos").select("id, status").gte("enviado_em", new Date(Date.now() - 7 * 24 * 3600000).toISOString()),
    supabase.from("hub_alertas").select("id, tipo").eq("resolvido", false),
  ]);

  const criticos = (alertasAbertos.data || []).filter(a => a.tipo === "critico").length;
  const todosLeads = leads.data || [];
  const receitaPotencial = todosLeads.reduce((s, l) => s + (l.valor_estimado || 0), 0);

  if (criticos > 0) {
    await supabase.from("hub_alertas").insert({
      tipo: "importante",
      agente_slug: AG_ANALISES,
      titulo: `${criticos} alerta(s) crítico(s) pendente(s)`,
      mensagem: `Há ${criticos} alertas críticos não resolvidos que precisam de atenção.`,
      dados: { criticos },
    });
  }

  return {
    leads_ativos: todosLeads.length,
    receita_potencial: receitaPotencial,
    criticos,
    encaminhamentos_7d: (encaminhados.data || []).length,
  };
}

async function cicloAnaliseNoite() {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);

  const [leadsHoje, encHoje, alertasHoje] = await Promise.all([
    supabase.from("hub_leads_crm").select("id, estagio", { count: "exact" }).gte("criado_em", hoje.toISOString()),
    supabase.from("hub_encaminhamentos").select("id, status", { count: "exact" }).gte("enviado_em", hoje.toISOString()),
    supabase.from("hub_alertas").select("id, tipo", { count: "exact" }).eq("resolvido", false),
  ]);

  const resumo = `📊 *Resumo do dia — Obra10+*

📥 Leads hoje: ${leadsHoje.count || 0}
🤝 Encaminhados: ${encHoje.count || 0}
⚠️ Alertas abertos: ${alertasHoje.count || 0}

${(alertasHoje.count || 0) > 0 ? "Verifique os alertas pendentes." : "✓ Operação saudável hoje!"}`;

  if ((alertasHoje.count || 0) > 0) {
    const { data: contatos } = await supabase
      .from("hub_contatos_notificacao")
      .select("*")
      .eq("ativo", true)
      .eq("notificar_critico", true);

    for (const c of contatos || []) {
      if (c.tipo === "whatsapp" && whatsappConfigured()) {
        try {
          const r = await whatsappSendText(String(c.valor), resumo);
          if (!r.ok) console.error("Erro resumo noite:", r.error);
        } catch (e) {
          console.error("Erro resumo noite:", e);
        }
      }
    }
  }

  return { resumo, leads: leadsHoje.count, encaminhados: encHoje.count, alertas: alertasHoje.count };
}

/** Fragmentos do nome em `hub_ciclos_ia` (ajustar seed se necessário). */
const CICLO_NOME_FRAG: Record<string, { slug: string; frag: string }> = {
  trafego: { slug: AG_TRAFEGO, frag: "tráfego" },
  analise_manha: { slug: AG_ANALISES, frag: "Matinal" },
  analise_noite: { slug: AG_ANALISES, frag: "Noite" },
};

function statusUltimoDiretor(ciclo: string, resultado: unknown): "sucesso" | "sem_acao" {
  if (!resultado || typeof resultado !== "object") return "sem_acao";
  const r = resultado as Record<string, unknown>;
  if (ciclo === "trafego") return ((r.total as number) ?? 0) > 0 ? "sucesso" : "sem_acao";
  if (ciclo === "analise_manha")
    return ((r.criticos as number) ?? 0) > 0 || ((r.leads_ativos as number) ?? 0) > 0 ? "sucesso" : "sem_acao";
  if (ciclo === "analise_noite")
    return ((r.alertas as number) ?? 0) > 0 || ((r.leads as number) ?? 0) > 0 ? "sucesso" : "sem_acao";
  return "sem_acao";
}

async function registrarExecucaoDiretor(
  ciclo: string,
  statusExec: string,
  resultado: unknown,
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

  const map = CICLO_NOME_FRAG[ciclo];

  if (!cfg && map) {
    let { data } = await supabase
      .from("hub_ciclos_ia")
      .select("id, total_execucoes, agente_slug")
      .eq("agente_slug", map.slug)
      .ilike("nome", `%${map.frag}%`)
      .maybeSingle();

    if (!data && ciclo === "trafego") {
      const alt = await supabase
        .from("hub_ciclos_ia")
        .select("id, total_execucoes, agente_slug")
        .eq("agente_slug", map.slug)
        .ilike("nome", "%trafego%")
        .maybeSingle();
      data = alt.data;
    }
    if (!data && ciclo === "analise_manha") {
      const alt = await supabase
        .from("hub_ciclos_ia")
        .select("id, total_execucoes, agente_slug")
        .eq("agente_slug", map.slug)
        .ilike("nome", "%manh%")
        .maybeSingle();
      data = alt.data;
    }
    cfg = data ?? null;
  }

  if (!cfg?.id) return;

  const alertasGer =
    resultado && typeof resultado === "object" && "alertas" in resultado
      ? (resultado as { alertas?: unknown }).alertas
      : [];

  await supabase.from("hub_ciclos_log").insert({
    ciclo_id: cfg.id,
    agente_slug: cfg.agente_slug,
    status: statusExec,
    finalizado_em: new Date().toISOString(),
    acoes_tomadas: [],
    alertas_gerados: Array.isArray(alertasGer) ? alertasGer : [],
  });

  await supabase
    .from("hub_ciclos_ia")
    .update({
      ultimo_ciclo: new Date().toISOString(),
      ultimo_status: statusExec,
      total_execucoes: (cfg.total_execucoes || 0) + 1,
    })
    .eq("id", cfg.id);
}

export async function GET(request: NextRequest) {
  const ciclo = request.nextUrl.searchParams.get("ciclo") || "trafego";
  const hubCicloId = request.nextUrl.searchParams.get("hub_ciclo_id");
  if (!cronRequestAuthorized(request)) {
    return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  }

  try {
    let resultado;
    if (ciclo === "trafego") resultado = await cicloTrafego();
    else if (ciclo === "analise_manha") resultado = await cicloAnaliseManha();
    else if (ciclo === "analise_noite") resultado = await cicloAnaliseNoite();
    else resultado = {};

    const statusExec = statusUltimoDiretor(ciclo, resultado);
    await registrarExecucaoDiretor(ciclo, statusExec, resultado, hubCicloId);

    void Promise.all([
      medirKPIs(AG_TRAFEGO).catch(() => undefined),
      medirKPIs(AG_ANALISES).catch(() => undefined),
    ]);

    return NextResponse.json({ ok: true, ciclo, resultado });
  } catch (erro) {
    return NextResponse.json({ ok: false, erro: erro instanceof Error ? erro.message : "Erro" }, { status: 500 });
  }
}

export const POST = GET;
