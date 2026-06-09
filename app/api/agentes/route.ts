import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  humanoResponsavelFromActor,
  resolveActorFromRequest,
} from "@/lib/crm/resolve-crm-actor";
import {
  modeloAltoValorForHubInsert,
  modeloCriticoForHubInsert,
  modeloPadraoForHubInsert,
} from "@/lib/ia/hub-model-defaults";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET() {
  const supabase = db();
  const { data: agentes } = await supabase
    .from("hub_agente_identidade")
    .select("*")
    .order("nivel");

  if (!agentes) return NextResponse.json([]);

  const agentesEnriquecidos = await Promise.all(agentes.map(async (ag) => {
    const slug = ag.agente_slug as string;
    const h24 = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [personalidade, logs, kpis, sugestoes] = await Promise.all([
      supabase.from("hub_personalidade").select("*").eq("agente_slug", slug).single(),
      supabase.from("hub_prompt_logs").select("custo_brl, latencia_ms, converteu").eq("agente_id", slug).gte("criado_em", h24),
      supabase.from("hub_kpis_resultados").select("kpi_slug, valor, nivel_alerta").eq("agente_slug", slug).order("criado_em", { ascending: false }).limit(10),
      supabase.from("hub_ml_sugestoes").select("id, titulo, status").eq("agente_slug", slug).eq("status", "pendente"),
    ]);

    const totalLogs = logs.data?.length || 0;
    const custoTotal = logs.data?.reduce((s: number, l: Record<string, unknown>) => s + ((l.custo_brl as number) || 0), 0) || 0;
    const latenciaMedia = totalLogs > 0
      ? ((logs.data?.reduce((s: number, l: Record<string, unknown>) => s + ((l.latencia_ms as number) || 0), 0) || 0) / totalLogs)
      : 0;
    const convertidos = logs.data?.filter((l: Record<string, unknown>) => l.converteu).length || 0;
    const kpisForaMeta = kpis.data?.filter((k: Record<string, unknown>) => k.nivel_alerta !== "ok").length || 0;

    return {
      ...ag,
      personalidade: personalidade.data,
      metricas: {
        conversas24h: totalLogs,
        custoHoje: custoTotal,
        latenciaMedia: Math.round(latenciaMedia),
        taxaConversao: totalLogs > 0 ? Math.round((convertidos / totalLogs) * 100) : 0,
        kpisForaMeta,
        sugestoesPendentes: sugestoes.data?.length || 0,
      },
    };
  }));

  return NextResponse.json(agentesEnriquecidos);
}

export async function POST(request: NextRequest) {
  const supabase = db();
  const actor = await resolveActorFromRequest(supabase, request.headers);
  const definidoPor = humanoResponsavelFromActor(actor);
  const body = await request.json() as Record<string, unknown>;

  // Validar cargo contra catálogo e forçar nivel/modelo do servidor
  const cargoSlug = (body.cargo_slug || body.agente_slug) as string;
  if (cargoSlug) {
    const { data: cargoReal } = await supabase
      .from("hub_cargos_catalogo")
      .select("nivel, modelo_padrao, titulo")
      .eq("slug", cargoSlug)
      .maybeSingle();

    if (cargoReal) {
      body.nivel = cargoReal.nivel;
      body.modelo_padrao = modeloPadraoForHubInsert(cargoReal.modelo_padrao as string | undefined);
    }
  }

  const {
    agente_slug, nome, cargo, area, nivel,
    modelo_padrao, humor, personalidade_id,
    system_prompt_base, pode_fazer, nao_pode_fazer,
    sempre_dizer, nunca_dizer, prefixo_mercado,
    horario_inicio, horario_fim, dias_semana,
    conhecimentos, supervisor_slug,
  } = body;

  const nivelNum = nivel as number;

  const mp = modeloPadraoForHubInsert(modelo_padrao as string | undefined);
  const mc =
    nivelNum <= 3 ? modeloCriticoForHubInsert(undefined) : modeloPadraoForHubInsert(modelo_padrao as string | undefined);
  const mav =
    nivelNum <= 2
      ? modeloAltoValorForHubInsert(undefined)
      : nivelNum <= 3
        ? modeloCriticoForHubInsert(undefined)
        : modeloPadraoForHubInsert(modelo_padrao as string | undefined);

  const { data: agente, error } = await supabase
    .from("hub_agente_identidade")
    .insert({
      agente_slug,
      nome,
      cargo,
      area,
      nivel: nivelNum,
      modelo_padrao: mp,
      modelo_critico: mc,
      modelo_alto_valor: mav,
      system_prompt_base,
      pode_fazer: (pode_fazer as string[]) || [],
      nao_pode_fazer: (nao_pode_fazer as string[]) || [],
      sempre_dizer: (sempre_dizer as string[]) || [],
      nunca_dizer: (nunca_dizer as string[]) || [],
      prefixo_mercado: (prefixo_mercado as string) || "GRL",
      ativo: true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ erro: error.message }, { status: 400 });

  const humorLabels = ["Analítico", "Criativo", "Pragmático", "Empático", "Competitivo"];
  const personalidadeLabels = ["Formal", "Casual", "Assertivo", "Entusiasta", "Estratégico"];
  const humores = ["analitico", "criativo", "pragmatico", "empatico", "competitivo"];
  const personalidades = ["formal", "casual", "assertivo", "entusiasta", "estrategico"];

  const humorIdx = (humor as number) - 1;
  const persIdx = (personalidade_id as number) - 1;

  await supabase.from("hub_personalidade").insert({
    agente_slug,
    humor,
    personalidade: personalidade_id,
    humor_label: humorLabels[humorIdx] || "Empático",
    personalidade_label: personalidadeLabels[persIdx] || "Casual",
    combinacao_label: `${humorLabels[humorIdx] || "Empático"} ${personalidadeLabels[persIdx] || "Casual"}`,
    descricao_comportamento: `Agente com humor ${humores[humorIdx] || "empatico"} e personalidade ${personalidades[persIdx] || "casual"}.`,
    tom_comunicacao: "profissional",
  });

  const nivelLabel = nivelNum === 1 ? "ceo" : nivelNum === 2 ? "diretor" : nivelNum === 3 ? "gerente" : nivelNum === 4 ? "executor" : "especialista";

  await supabase.from("hub_hierarquia").insert({
    agente_slug,
    nome,
    cargo,
    nivel: nivelLabel,
    nivel_org: nivelNum,
    area: (area as string) || "geral",
    supervisor_slug: (supervisor_slug as string) || "gerente_atendimento",
    subordinados: [],
    limite_autonomia_brl: 0,
    criterios_escalonamento: "proposta, preco, prazo, reclamacao",
  });

  // non-critical: table may not exist yet
  try {
    await supabase.from("hub_agente_configuracao").insert({
      agente_slug,
      modelo_ia: mp,
      temperatura: 0.7,
      max_tokens: 1024,
      tom: "profissional",
      idioma: "pt-BR",
      horario_inicio: (horario_inicio as string) || "08:00",
      horario_fim: (horario_fim as string) || "22:00",
      dias_semana: (dias_semana as number[]) || [0, 1, 2, 3, 4, 5, 6],
      ativo: true,
    });
  } catch { /* non-critical */ }

  const lista = (conhecimentos as Array<Record<string, unknown>>) || [];
  if (lista.length > 0) {
    await supabase.from("hub_agente_conhecimento").insert(
      lista.map((c, i) => ({
        agente_slug,
        secao: c.secao,
        titulo: c.titulo,
        conteudo: c.conteudo,
        ordem: i,
        ativo: true,
      }))
    );
  }

  const kpisPadrao = nivelNum === 4 ? [
    { kpi_slug: "tempo_primeira_resposta", valor_meta: 90,  valor_atencao: 180, valor_critico: 300, alertar_slug: (supervisor_slug as string) || "gerente_atendimento" },
    { kpi_slug: "custo_tokens_dia",        valor_meta: 20,  valor_atencao: 35,  valor_critico: 50,  alertar_slug: (supervisor_slug as string) || "gerente_atendimento" },
    { kpi_slug: "leads_sem_resposta",      valor_meta: 0,   valor_atencao: 2,   valor_critico: 5,   alertar_slug: (supervisor_slug as string) || "gerente_atendimento" },
  ] : [];

  if (kpisPadrao.length > 0) {
    try {
      await supabase.from("hub_kpis_metas").insert(
        kpisPadrao.map(k => ({ ...k, agente_slug, frequencia: "tempo_real", definido_por: definidoPor, ativo: true }))
      );
    } catch { /* non-critical */ }
  }

  return NextResponse.json({ sucesso: true, agente });
}

export async function PATCH(request: NextRequest) {
  const supabase = db();
  const body = await request.json() as Record<string, unknown>;
  const { agente_slug, conhecimentos, ...dadosAgente } = body;

  if (Object.keys(dadosAgente).length > 0) {
    await supabase.from("hub_agente_identidade").update(dadosAgente).eq("agente_slug", agente_slug);
  }

  if (conhecimentos) {
    await supabase.from("hub_agente_conhecimento").delete().eq("agente_slug", agente_slug);
    const list = conhecimentos as Array<Record<string, unknown>>;
    if (list.length > 0) {
      await supabase.from("hub_agente_conhecimento").insert(
        list.map((c, i) => ({ ...c, agente_slug, ordem: i, ativo: true }))
      );
    }
  }

  return NextResponse.json({ sucesso: true });
}
