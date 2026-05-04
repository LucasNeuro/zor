// ============================================================
// MONITOR — Monitoramento Universal de Performance
// Gerente varre todos os agentes e gera sugestões de ajuste
// ============================================================
import { createClient } from "@supabase/supabase-js";

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export interface MetricaAgente {
  slug: string;
  nome: string;
  totalMensagens: number;
  taxaSucesso: number;
  taxaRetrabalho: number;
  latenciaMedia: number;
  custoTotal: number;
  conversoes: number;
  alertas: AlertaPerformance[];
}

export interface AlertaPerformance {
  nivel: "info" | "atencao" | "critico";
  tipo: string;
  descricao: string;
  sugestao: string;
  requerAprovacao: boolean;
}

export interface SugestaoAjuste {
  id?: string;
  agenteSlug: string;
  agenteSupervisorSlug: string;
  tipo: "prompt" | "modelo" | "regra" | "script" | "horario" | "desativar";
  descricao: string;
  motivo: string;
  impactoEstimado: string;
  dadosAjuste: Record<string, unknown>;
  status: "pendente" | "aprovado" | "rejeitado";
}

// ── VARREDURA COMPLETA ────────────────────────────────────────
// Roda a cada 60 segundos — varre todos os agentes
export async function varrerSistema(): Promise<{
  metricas: MetricaAgente[];
  sugestoes: SugestaoAjuste[];
  alertasCriticos: AlertaPerformance[];
}> {
  const db = supabase();

  const { data: agentes } = await db
    .from("hub_agente_identidade")
    .select("*")
    .eq("ativo", true);

  if (!agentes) return { metricas: [], sugestoes: [], alertasCriticos: [] };

  const metricas: MetricaAgente[] = [];
  const sugestoes: SugestaoAjuste[] = [];
  const alertasCriticos: AlertaPerformance[] = [];

  await Promise.all(agentes.map(async (agente: Record<string, unknown>) => {
    const metrica = await calcularMetricaAgente(agente.agente_slug as string, agente.nome as string);
    metricas.push(metrica);

    // Analisa alertas
    for (const alerta of metrica.alertas) {
      if (alerta.nivel === "critico") alertasCriticos.push(alerta);

      // Gera sugestão de ajuste se necessário
      if (alerta.requerAprovacao) {
        const sugestao = await gerarSugestaoAjuste(agente, alerta);
        if (sugestao) sugestoes.push(sugestao);
      }
    }
  }));

  // Salva sugestões no banco para aprovação humana
  if (sugestoes.length > 0) {
    await db.from("hub_aprovacoes").upsert(
      sugestoes.map(s => ({
        tipo: "ajuste_agente",
        agente_slug: s.agenteSlug,
        descricao: s.descricao,
        motivo: s.motivo,
        impacto: s.impactoEstimado,
        dados: s.dadosAjuste,
        status: "pendente",
        criado_em: new Date().toISOString(),
      }))
    );
  }

  return { metricas, sugestoes, alertasCriticos };
}

// ── MÉTRICAS POR AGENTE ───────────────────────────────────────
async function calcularMetricaAgente(slug: string, nome: string): Promise<MetricaAgente> {
  const db = supabase();
  const alertas: AlertaPerformance[] = [];

  // Busca logs das últimas 24h
  const ontemIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: logs } = await db
    .from("hub_prompt_logs")
    .select("*")
    .eq("agente_id", slug)
    .gte("criado_em", ontemIso);

  const total = logs?.length || 0;
  const convertidos = logs?.filter((l: Record<string, unknown>) => l.converteu).length || 0;
  const custoTotal = logs?.reduce((s: number, l: Record<string, unknown>) => s + (l.custo_brl as number || 0), 0) || 0;
  const latencia = total > 0 ? (logs?.reduce((s: number, l: Record<string, unknown>) => s + (l.latencia_ms as number || 0), 0) || 0) / total : 0;

  // Busca scripts e taxa de retrabalho
  const { data: scripts } = await db
    .from("hub_scripts")
    .select("uso_count, conversoes")
    .eq("agente_slug", slug);

  const totalUsos = scripts?.reduce((s: number, sc: Record<string, unknown>) => s + (sc.uso_count as number || 0), 0) || 0;
  const totalConversoes = scripts?.reduce((s: number, sc: Record<string, unknown>) => s + (sc.conversoes as number || 0), 0) || 0;
  const taxaSucesso = totalUsos > 0 ? (totalConversoes / totalUsos) * 100 : 0;
  const taxaRetrabalho = 100 - taxaSucesso;

  // Verifica leads sem resposta (para agentes de atendimento)
  const { data: leadsParados } = await db
    .from("hub_fila_mensagens")
    .select("*")
    .eq("agente_id", slug)
    .eq("status", "pendente")
    .lt("agendado_para", new Date(Date.now() - 5 * 60 * 1000).toISOString());

  if (leadsParados && leadsParados.length > 0) {
    const maisAntigo = leadsParados[0];
    const minutosParado = Math.round((Date.now() - new Date(maisAntigo.agendado_para).getTime()) / 60000);

    if (minutosParado > 15) {
      alertas.push({
        nivel: "critico",
        tipo: "lead_parado",
        descricao: `${leadsParados.length} leads sem resposta há mais de ${minutosParado} min`,
        sugestao: "Escalar para atendimento humano imediatamente",
        requerAprovacao: true,
      });
    } else if (minutosParado > 5) {
      alertas.push({
        nivel: "atencao",
        tipo: "lead_parado",
        descricao: `${leadsParados.length} leads aguardando há ${minutosParado} min`,
        sugestao: "Verificar fila de atendimento",
        requerAprovacao: false,
      });
    }
  }

  // Verifica taxa de retrabalho
  if (taxaRetrabalho > 30 && totalUsos > 5) {
    alertas.push({
      nivel: "atencao",
      tipo: "retrabalho_alto",
      descricao: `Taxa de retrabalho de ${taxaRetrabalho.toFixed(0)}% — acima do limite de 30%`,
      sugestao: "Revisar prompt e contexto do agente",
      requerAprovacao: true,
    });
  }

  // Verifica custo de tokens
  if (custoTotal > 50) {
    alertas.push({
      nivel: "atencao",
      tipo: "custo_alto",
      descricao: `Custo de tokens hoje: R$${custoTotal.toFixed(2)}`,
      sugestao: "Considerar otimização do modelo ou do prompt",
      requerAprovacao: false,
    });
  }

  // Verifica latência
  if (latencia > 30000) {
    alertas.push({
      nivel: "critico",
      tipo: "latencia_alta",
      descricao: `Latência média de ${(latencia / 1000).toFixed(1)}s — acima do limite`,
      sugestao: "Verificar conexão com API e simplificar prompt",
      requerAprovacao: true,
    });
  }

  return {
    slug,
    nome,
    totalMensagens: total,
    taxaSucesso,
    taxaRetrabalho,
    latenciaMedia: latencia,
    custoTotal,
    conversoes: convertidos,
    alertas,
  };
}

// ── GERADOR DE SUGESTÕES ──────────────────────────────────────
async function gerarSugestaoAjuste(
  agente: Record<string, unknown>,
  alerta: AlertaPerformance
): Promise<SugestaoAjuste | null> {
  const db = supabase();

  // Busca hierarquia para saber quem supervisiona
  const { data: hierarquia } = await db
    .from("hub_hierarquia")
    .select("supervisor_slug")
    .eq("agente_slug", agente.agente_slug)
    .single();

  const supervisorSlug = hierarquia?.supervisor_slug || "ceo";

  const sugestoes: Record<string, SugestaoAjuste> = {
    retrabalho_alto: {
      agenteSlug: agente.agente_slug as string,
      agenteSupervisorSlug: supervisorSlug,
      tipo: "prompt",
      descricao: `Ajuste de contexto para ${agente.nome}`,
      motivo: alerta.descricao,
      impactoEstimado: "Redução de retrabalho e melhora na qualidade das entregas",
      dadosAjuste: { tipo: "revisar_prompt", agente_slug: agente.agente_slug },
      status: "pendente",
    },
    lead_parado: {
      agenteSlug: agente.agente_slug as string,
      agenteSupervisorSlug: supervisorSlug,
      tipo: "regra",
      descricao: `Leads parados em ${agente.nome} — ação necessária`,
      motivo: alerta.descricao,
      impactoEstimado: "Recuperação de leads em risco com valor estimado",
      dadosAjuste: { tipo: "escalar_atendimento", agente_slug: agente.agente_slug },
      status: "pendente",
    },
    latencia_alta: {
      agenteSlug: agente.agente_slug as string,
      agenteSupervisorSlug: supervisorSlug,
      tipo: "modelo",
      descricao: `Otimização de modelo para ${agente.nome}`,
      motivo: alerta.descricao,
      impactoEstimado: "Redução de latência e melhora na experiência do lead",
      dadosAjuste: { tipo: "trocar_modelo", modelo_sugerido: "claude-haiku-4-5" },
      status: "pendente",
    },
  };

  return sugestoes[alerta.tipo] || null;
}

// ── MONITOR DE TRÁFEGO ────────────────────────────────────────
// Especializado para campanhas — área crítica de dinheiro
export async function monitorarTrafego(): Promise<{
  alertas: AlertaPerformance[];
  acoesPendentes: SugestaoAjuste[];
}> {
  const db = supabase();
  const alertas: AlertaPerformance[] = [];
  const acoesPendentes: SugestaoAjuste[] = [];

  const { data: metricas } = await db
    .from("hub_metricas_trafego")
    .select("*")
    .gte("criado_em", new Date(Date.now() - 60 * 60 * 1000).toISOString())
    .order("criado_em", { ascending: false });

  if (!metricas) return { alertas, acoesPendentes };

  for (const metrica of metricas) {
    const m = metrica as Record<string, unknown>;
    const cpl = m.cpl as number || 0;
    const cplMeta = m.cpl_meta as number || 60;
    const roas = m.roas as number || 0;
    const verbaDiaria = m.verba_consumida as number || 0;
    const verbaMeta = m.verba_diaria_meta as number || 1000;
    const percentualVerba = (verbaDiaria / verbaMeta) * 100;

    // CPL acima da meta em 20%
    if (cpl > cplMeta * 1.2) {
      alertas.push({
        nivel: cpl > cplMeta * 1.5 ? "critico" : "atencao",
        tipo: "cpl_alto",
        descricao: `CPL R$${cpl.toFixed(0)} vs meta R$${cplMeta.toFixed(0)} — ${((cpl / cplMeta - 1) * 100).toFixed(0)}% acima`,
        sugestao: "Pausar conjunto com maior CPL e redistribuir verba",
        requerAprovacao: true,
      });

      acoesPendentes.push({
        agenteSlug: "gestor_trafego",
        agenteSupervisorSlug: "ariane",
        tipo: "regra",
        descricao: `Campanha ${m.campanha_id} com CPL crítico`,
        motivo: `CPL R$${cpl.toFixed(0)} — ${((cpl / cplMeta - 1) * 100).toFixed(0)}% acima da meta`,
        impactoEstimado: `Economia estimada reduzindo CPL para meta`,
        dadosAjuste: { campanha_id: m.campanha_id, acao: "pausar_conjunto", cpl_atual: cpl, cpl_meta: cplMeta },
        status: "pendente",
      });
    }

    // ROAS abaixo de 1
    if (roas > 0 && roas < 1) {
      alertas.push({
        nivel: "critico",
        tipo: "roas_baixo",
        descricao: `ROAS ${roas.toFixed(2)} — campanha gastando mais do que retorna`,
        sugestao: "Pausar campanha imediatamente para análise",
        requerAprovacao: true,
      });
    }

    // Verba 80% consumida antes das 18h
    const hora = new Date().getHours();
    if (percentualVerba > 80 && hora < 18) {
      alertas.push({
        nivel: "atencao",
        tipo: "verba_alta",
        descricao: `${percentualVerba.toFixed(0)}% da verba consumida às ${hora}h`,
        sugestao: "Reduzir lances ou pausar até o próximo dia",
        requerAprovacao: true,
      });
    }
  }

  // Salva ações pendentes para aprovação humana
  if (acoesPendentes.length > 0) {
    await db.from("hub_aprovacoes").insert(
      acoesPendentes.map(a => ({
        tipo: "trafego",
        agente_slug: a.agenteSlug,
        descricao: a.descricao,
        motivo: a.motivo,
        impacto: a.impactoEstimado,
        dados: a.dadosAjuste,
        status: "pendente",
        criado_em: new Date().toISOString(),
      }))
    );
  }

  return { alertas, acoesPendentes };
}
